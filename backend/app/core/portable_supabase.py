"""Small, parameterized Supabase-query compatibility layer for self-host mode.

The application historically uses supabase-py as a query builder throughout
the widget and API routers.  Rewriting every feature at once would leave
portable deployments with partial behavior, so self-host mode supplies the
same narrow builder contract over PostgreSQL.  It deliberately supports only
the operators used by this repository, validates every identifier, and never
interpolates values into SQL.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

from psycopg2.extras import Json, RealDictCursor

from app.core.db_pool import connection
from app.core.object_store import get_bytes, put_bytes, safe_object_key

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_TABLE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_CATEGORY_RELATION = re.compile(r"(?:,\s*)?category:chatty_kb_categories\([^)]*\)")


def _identifier(value: str) -> str:
    if not isinstance(value, str) or not _IDENT.fullmatch(value):
        raise ValueError("unsafe SQL identifier")
    return value


def _value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return Json(value)
    return value


@dataclass
class PortableResult:
    data: Any
    count: int | None = None
    error: Any = None


class _Not:
    def __init__(self, query: "PortableQuery") -> None:
        self._query = query

    def is_(self, column: str, value: str) -> "PortableQuery":
        return self._query._add_filter(column, "IS NOT" if value == "null" else "<>", None if value == "null" else value)


class PortableQuery:
    def __init__(self, table: str) -> None:
        self.table = _identifier(table)
        self.operation = "select"
        self.payload: dict[str, Any] | list[dict[str, Any]] | None = None
        self.columns = "*"
        self.filters: list[tuple[str, str, Any]] = []
        self._or_groups: list[tuple[str, list[Any]]] = []
        self.orders: list[tuple[str, bool]] = []
        self._limit: int | None = None
        self._offset: int | None = None
        self._count_mode: str | None = None
        self._head = False
        self._single = False
        self._maybe_single = False
        self._relation: str | None = None

    @property
    def not_(self) -> _Not:
        return _Not(self)

    def select(self, columns: str = "*", count: str | None = None, head: bool = False, **_: Any) -> "PortableQuery":
        self.operation = "select"
        self.columns = columns or "*"
        self._count_mode = count
        self._head = head
        return self

    def insert(self, payload: dict[str, Any] | list[dict[str, Any]]) -> "PortableQuery":
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> "PortableQuery":
        self.operation = "update"
        self.payload = payload
        return self

    def delete(self) -> "PortableQuery":
        self.operation = "delete"
        return self

    def upsert(self, payload: dict[str, Any] | list[dict[str, Any]], on_conflict: str | None = None, **_: Any) -> "PortableQuery":
        self.operation = "upsert"
        self.payload = payload
        self._relation = on_conflict
        return self

    def eq(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, "=", value)
    def neq(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, "<>", value)
    def gt(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, ">", value)
    def gte(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, ">=", value)
    def lt(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, "<", value)
    def lte(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, "<=", value)
    def ilike(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, "ILIKE", value)
    def like(self, column: str, value: Any) -> "PortableQuery": return self._add_filter(column, "LIKE", value)

    def in_(self, column: str, values: Iterable[Any]) -> "PortableQuery":
        return self._add_filter(column, "IN", list(values))

    def is_(self, column: str, value: str) -> "PortableQuery":
        return self._add_filter(column, "IS", None if value == "null" else value)

    def contains(self, column: str, value: Any) -> "PortableQuery":
        return self._add_filter(column, "@>", value)

    def or_(self, expression: str) -> "PortableQuery":
        parts: list[tuple[str, str, Any]] = []
        for item in expression.split(","):
            try:
                column, operator, raw = item.split(".", 2)
            except ValueError as exc:
                raise ValueError("unsupported OR expression") from exc
            op = {"eq": "=", "ilike": "ILIKE", "like": "LIKE"}.get(operator)
            if not op:
                raise ValueError("unsupported OR operator")
            parts.append((_identifier(column), op, raw))
        self._or_groups.append(("OR", parts))
        return self

    def order(self, column: str, desc: bool = False, **_: Any) -> "PortableQuery":
        self.orders.append((_identifier(column), bool(desc)))
        return self

    def limit(self, value: int) -> "PortableQuery":
        self._limit = max(0, int(value))
        return self

    def range(self, start: int, end: int) -> "PortableQuery":
        self._offset = max(0, int(start))
        self._limit = max(0, int(end) - int(start) + 1)
        return self

    def single(self) -> "PortableQuery":
        self._single = True
        return self

    def maybe_single(self) -> "PortableQuery":
        self._maybe_single = True
        return self

    def _add_filter(self, column: str, operator: str, value: Any) -> "PortableQuery":
        self.filters.append((_identifier(column), operator, value))
        return self

    def _where(self) -> tuple[str, list[Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        for column, operator, value in self.filters:
            if operator == "IN":
                values = list(value or [])
                if not values:
                    clauses.append("FALSE")
                else:
                    # Use scalar placeholders instead of ANY(array): UUID
                    # columns and text columns otherwise infer different
                    # PostgreSQL array types from a Python list.
                    clauses.append(f"{column} IN ({', '.join(['%s'] * len(values))})")
                    params.extend(_value(v) for v in values)
            elif operator in ("IS", "IS NOT") and value is None:
                clauses.append(f"{column} {operator} NULL")
            elif operator == "@>":
                clauses.append(f"{column} @> %s::jsonb")
                params.append(_value(value))
            else:
                clauses.append(f"{column} {operator} %s")
                params.append(_value(value))
        for _, parts in self._or_groups:
            sub: list[str] = []
            for column, operator, value in parts:
                sub.append(f"{column} {operator} %s")
                params.append(value)
            clauses.append("(" + " OR ".join(sub) + ")")
        return (" WHERE " + " AND ".join(clauses)) if clauses else "", params

    def _select_columns(self) -> tuple[str, str | None]:
        # PostgREST relation syntax used by the KB endpoint is expanded after
        # the base rows are read; reject all other SQL-like syntax.
        relation = None
        raw = self.columns.strip()
        fields: list[str] = []
        # PostgREST's nested relation projection contains commas inside its
        # parentheses. Remove the one relation used by this repository before
        # splitting the base projection; arbitrary SQL/function syntax remains
        # rejected below.
        relation_match = _CATEGORY_RELATION.search(raw)
        if relation_match:
            relation = "category"
            raw = raw[:relation_match.start()] + raw[relation_match.end():]
        for token in raw.split(","):
            token = token.strip()
            if not token:
                continue
            if token == "*":
                fields = ["*"]
                break
            if ":" in token or "(" in token or ")" in token:
                raise ValueError("unsupported select relation")
            fields.append(_identifier(token))
        return ", ".join(fields) if fields else "*", relation

    def execute(self) -> PortableResult:
        if self.operation == "select":
            return self._execute_select()
        if self.operation in ("insert", "upsert"):
            return self._execute_insert(upsert=self.operation == "upsert")
        if self.operation in ("update", "delete"):
            return self._execute_mutation()
        raise ValueError("unsupported portable operation")

    def _execute_select(self) -> PortableResult:
        columns, relation = self._select_columns()
        where, params = self._where()
        order = "" if not self.orders else " ORDER BY " + ", ".join(f"{c} {'DESC' if d else 'ASC'}" for c, d in self.orders)
        paging = ""
        page_params: list[Any] = []
        if self._limit is not None:
            paging += " LIMIT %s"; page_params.append(self._limit)
        if self._offset is not None:
            paging += " OFFSET %s"; page_params.append(self._offset)
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                count = None
                if self._count_mode:
                    cur.execute(f"SELECT COUNT(*) FROM {self.table}{where}", tuple(params))
                    count = int(cur.fetchone()["count"])
                if self._head:
                    return PortableResult([], count)
                cur.execute(f"SELECT {columns} FROM {self.table}{where}{order}{paging}", tuple(params + page_params))
                rows = [dict(row) for row in cur.fetchall()]
                if relation == "category":
                    self._expand_categories(cur, rows)
        if self._single or self._maybe_single:
            if self._single and len(rows) != 1:
                raise ValueError("expected exactly one row")
            return PortableResult(rows[0] if rows else None, count)
        return PortableResult(rows, count)

    @staticmethod
    def _expand_categories(cur: Any, rows: list[dict[str, Any]]) -> None:
        ids = [row.get("category_id") for row in rows if row.get("category_id")]
        if not ids:
            return
        cur.execute(
            f"SELECT id, name, slug, icon FROM chatty_kb_categories WHERE id IN ({', '.join(['%s'] * len(ids))})",
            tuple(ids),
        )
        categories = {str(row["id"]): dict(row) for row in cur.fetchall()}
        for row in rows:
            row["category"] = categories.get(str(row.get("category_id")))

    def _execute_insert(self, upsert: bool) -> PortableResult:
        rows = self.payload if isinstance(self.payload, list) else [self.payload or {}]
        if not rows:
            return PortableResult([])
        columns = [_identifier(key) for key in rows[0].keys()]
        values_sql = ", ".join(["%s"] * len(columns))
        all_values = [[_value(row.get(column)) for column in columns] for row in rows]
        conflict = ""
        if upsert:
            keys = [_identifier(k.strip()) for k in (self._relation or "").split(",") if k.strip()]
            if not keys:
                raise ValueError("upsert requires an explicit conflict column")
            updates = [c for c in columns if c not in keys]
            if not updates:
                conflict = f" ON CONFLICT ({', '.join(keys)}) DO NOTHING"
            else:
                conflict = f" ON CONFLICT ({', '.join(keys)}) DO UPDATE SET " + ", ".join(f"{c}=EXCLUDED.{c}" for c in updates)
        sql = f"INSERT INTO {self.table} ({', '.join(columns)}) VALUES ({values_sql}){conflict} RETURNING *"
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                returned: list[dict[str, Any]] = []
                for values in all_values:
                    cur.execute(sql, tuple(values))
                    row = cur.fetchone()
                    if row:
                        returned.append(dict(row))
        return PortableResult(returned)

    def _execute_mutation(self) -> PortableResult:
        where, params = self._where()
        if not where:
            # A missing predicate on a public-facing compatibility call is
            # almost certainly a programming error. Refuse full-table writes
            # and deletes rather than turning a query-builder typo into data
            # loss in a self-host deployment.
            raise ValueError("portable update/delete requires a filter")
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if self.operation == "delete":
                    cur.execute(f"DELETE FROM {self.table}{where} RETURNING *", tuple(params))
                else:
                    payload = self.payload if isinstance(self.payload, dict) else {}
                    columns = [_identifier(key) for key in payload]
                    if not columns:
                        return PortableResult([])
                    cur.execute(
                        f"UPDATE {self.table} SET " + ", ".join(f"{c} = %s" for c in columns) + f"{where} RETURNING *",
                        tuple([_value(payload[c]) for c in columns] + params),
                    )
                return PortableResult([dict(row) for row in cur.fetchall()])


class PortablePostgresClient:
    @property
    def storage(self) -> "PortableStorage":
        return PortableStorage()

    def table(self, table: str) -> PortableQuery:
        return PortableQuery(table)

    def rpc(self, name: str, params: dict[str, Any] | None = None) -> "PortableRpc":
        return PortableRpc(name, params or {})


class PortableRpc:
    """Allowlist the vector-search functions used by the application."""

    def __init__(self, name: str, params: dict[str, Any]) -> None:
        self.name = _identifier(name)
        self.params = params

    @staticmethod
    def _vector(value: Any) -> str:
        if not isinstance(value, (list, tuple)) or not value:
            raise ValueError("vector embedding must be a non-empty list")
        try:
            values = [float(item) for item in value]
        except (TypeError, ValueError) as exc:
            raise ValueError("vector embedding contains a non-numeric value") from exc
        if len(values) != 768:
            raise ValueError("vector embedding must contain 768 values")
        return "[" + ",".join(format(item, ".12g") for item in values) + "]"

    def execute(self) -> PortableResult:
        vector = self._vector(self.params.get("query_embedding"))
        threshold = float(self.params.get("match_threshold", 0.40))
        count = max(1, min(int(self.params.get("match_count", 8)), 100))
        if self.name == "match_document_chunks":
            user_id = self.params.get("match_user_id")
            folder_id = self.params.get("match_folder_id")
            where_folder = " AND (%s IS NULL OR d.parent_folder_id = %s)"
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT c.id, c.document_id, c.drive_file_id, c.file_name,
                               c.chunk_index, c.content,
                               1 - (c.embedding <=> %s::vector) AS similarity
                        FROM document_chunks c
                        JOIN drive_documents d ON d.id = c.document_id
                        WHERE c.user_id = %s
                          AND c.embedding IS NOT NULL
                          AND (1 - (c.embedding <=> %s::vector)) > %s
                        """ + where_folder + """
                        ORDER BY c.embedding <=> %s::vector
                        LIMIT %s
                        """,
                        (vector, user_id, vector, threshold, folder_id, folder_id, vector, count),
                    )
                    return PortableResult([dict(row) for row in cur.fetchall()])
        if self.name == "match_media_items":
            bot_id = self.params.get("match_bot_id")
            media_type = self.params.get("filter_media_type")
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT m.id, m.bot_id, m.media_type, m.title, m.description,
                               m.sku, m.price, m.currency, m.url, m.media_url,
                               m.thumbnail_url, m.video_url, m.video_timestamp_start,
                               m.video_timestamp_end, m.visual_attributes, m.metadata,
                               1 - (m.embedding <=> %s::vector) AS similarity
                        FROM chatty_media_items m
                        WHERE m.bot_id = %s
                          AND (%s IS NULL OR m.media_type = %s)
                          AND m.embedding IS NOT NULL
                          AND (1 - (m.embedding <=> %s::vector)) >= %s
                        ORDER BY m.embedding <=> %s::vector
                        LIMIT %s
                        """,
                        (vector, bot_id, media_type, media_type, vector, threshold, vector, count),
                    )
                    return PortableResult([dict(row) for row in cur.fetchall()])
        raise ValueError(f"unsupported self-host RPC: {self.name}")


class PortableStorage:
    """Small Supabase-storage-compatible facade backed by private S3."""

    def from_(self, bucket: str) -> "PortableBucket":
        return PortableBucket(bucket)

    def create_bucket(self, _bucket: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
        # Buckets are provisioned by the self-host object-store service or the
        # operator's S3 policy. Keeping this call idempotent preserves Supabase semantics.
        return {"name": _bucket, "public": bool((options or {}).get("public", False))}


class PortableBucket:
    def __init__(self, bucket: str) -> None:
        if not re.fullmatch(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$", bucket):
            raise ValueError("unsafe storage bucket identifier")
        self.bucket = bucket

    def upload(self, path: str, data: bytes, options: dict[str, Any] | None = None) -> dict[str, Any]:
        content_type = (options or {}).get("content-type", "application/octet-stream")
        return {"path": path, "url": put_bytes(f"{self.bucket}/{path}", data, content_type)}

    def get_public_url(self, path: str) -> str:
        from app.core.config import S3_BUCKET, S3_PUBLIC_URL

        if not S3_PUBLIC_URL:
            raise RuntimeError("S3_PUBLIC_URL is required when returning public asset URLs")
        object_key = safe_object_key(f"{self.bucket}/{path}")
        return f"{S3_PUBLIC_URL}/{S3_BUCKET}/{object_key}"

    def download(self, path: str) -> bytes:
        return get_bytes(f"{self.bucket}/{path}")
