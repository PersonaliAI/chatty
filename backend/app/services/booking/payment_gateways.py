"""Multi-Gateway Payment Adapter for Stripe, Lemon Squeezy, and Polar.sh.

Provides:
- Secure verification of API keys and credentials.
- In-chat checkout session generation for Stripe, Lemon Squeezy, and Polar.sh.
- Decoupled, PCI-DSS compliant architecture (zero card data stored locally).
"""

from __future__ import annotations

import base64
import logging
import os
import re
from typing import Any, Optional
import httpx

logger = logging.getLogger("chatty.payment_gateways")

_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")

PAYPAL_LIVE_BASE = "https://api-m.paypal.com"
PAYPAL_SANDBOX_BASE = "https://api-m.sandbox.paypal.com"


def safe_gateway_id(value: Any, label: str) -> str:
    """Validate a user-supplied identifier before it is interpolated into an outbound URL path/query (SSRF guard)."""
    text = str(value).strip() if value is not None else ""
    if not _SAFE_ID_RE.match(text):
        raise ValueError(f"Invalid {label}: only letters, digits, '-' and '_' are allowed")
    return text


class PaymentGatewaysService:
    """Manages multi-gateway checkout session creation and credential verification."""

    # -------------------------------------------------------------------------
    # 1. STRIPE ADAPTER
    # -------------------------------------------------------------------------
    @staticmethod
    async def verify_stripe(secret_key: str) -> dict[str, Any]:
        """Verify Stripe API key by querying the balance endpoint."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                "https://api.stripe.com/v1/balance",
                auth=(secret_key.strip(), ""),
            )
            if res.status_code == 200:
                data = res.json()
                currency = (
                    data.get("available", [{}])[0].get("currency", "usd")
                    if data.get("available")
                    else "usd"
                )
                return {
                    "valid": True,
                    "currency": currency,
                    "livemode": data.get("livemode", False),
                }
            return {
                "valid": False,
                "error": res.json().get("error", {}).get("message", f"HTTP {res.status_code}"),
            }

    @staticmethod
    async def create_stripe_checkout(
        secret_key: str,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        cancel_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a Stripe Checkout Session via REST API."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            form_data = {
                "payment_method_types[0]": "card",
                "mode": "payment",
                "success_url": success_url,
                "cancel_url": cancel_url,
                "line_items[0][price_data][currency]": currency.lower(),
                "line_items[0][price_data][unit_amount]": str(amount_cents),
                "line_items[0][price_data][product_data][name]": title,
                "line_items[0][quantity]": "1",
            }
            if customer_email:
                form_data["customer_email"] = customer_email
            if metadata:
                for k, v in metadata.items():
                    form_data[f"metadata[{k}]"] = str(v)

            res = await client.post(
                "https://api.stripe.com/v1/checkout/sessions",
                auth=(secret_key.strip(), ""),
                data=form_data,
            )
            if res.status_code in (200, 201):
                data = res.json()
                return {
                    "provider": "stripe",
                    "checkout_url": data["url"],
                    "session_id": data["id"],
                    "amount_cents": amount_cents,
                    "currency": currency,
                }
            error_msg = res.json().get("error", {}).get("message", res.text)
            raise RuntimeError(f"Stripe API error: {error_msg}")

    # -------------------------------------------------------------------------
    # 2. LEMON SQUEEZY ADAPTER
    # -------------------------------------------------------------------------
    @staticmethod
    async def verify_lemonsqueezy(api_key: str, store_id: Optional[str] = None) -> dict[str, Any]:
        """Verify Lemon Squeezy API credentials."""
        headers = {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key.strip()}",
        }
        url = (
            f"https://api.lemonsqueezy.com/v1/stores/{safe_gateway_id(store_id, 'store ID')}"
            if store_id
            else "https://api.lemonsqueezy.com/v1/stores"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                store_name = "Lemon Squeezy Store"
                resolved_store_id = store_id
                if "data" in data:
                    if isinstance(data["data"], list) and len(data["data"]) > 0:
                        store_name = data["data"][0].get("attributes", {}).get("name", store_name)
                        resolved_store_id = data["data"][0].get("id")
                    elif isinstance(data["data"], dict):
                        store_name = data["data"].get("attributes", {}).get("name", store_name)
                return {
                    "valid": True,
                    "store_name": store_name,
                    "store_id": resolved_store_id,
                }
            return {
                "valid": False,
                "error": res.json().get("errors", [{}])[0].get("detail", f"HTTP {res.status_code}"),
            }

    @staticmethod
    async def create_lemonsqueezy_checkout(
        api_key: str,
        store_id: str,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        metadata: Optional[dict[str, Any]] = None,
        variant_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a Lemon Squeezy checkout.

        Lemon Squeezy cannot create products on the fly: a checkout must reference an
        existing variant, and `custom_price` only overrides that variant's price.
        """
        if not variant_id:
            raise RuntimeError(
                "Lemon Squeezy needs an existing product variant to attach a custom price to. "
                "Create at least one product in your Lemon Squeezy store, or pick one from the synced catalog."
            )
        store_id = safe_gateway_id(store_id, "store ID")
        variant_id = safe_gateway_id(variant_id, "variant ID")
        headers = {
            "Accept": "application/vnd.api+json",
            "Content-Type": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key.strip()}",
        }
        clean_meta = {str(k): str(v) for k, v in (metadata or {}).items() if v is not None and str(v) != ""}
        checkout_data: dict[str, Any] = {"custom": clean_meta}
        if customer_email and "@" in customer_email:
            checkout_data["email"] = customer_email.strip()

        payload = {
            "data": {
                "type": "checkouts",
                "attributes": {
                    "custom_price": amount_cents,
                    "product_options": {
                        "name": title,
                        "redirect_url": success_url,
                    },
                    "checkout_data": checkout_data,
                },
                "relationships": {
                    "store": {
                        "data": {
                            "type": "stores",
                            "id": str(store_id),
                        }
                    },
                    "variant": {
                        "data": {
                            "type": "variants",
                            "id": variant_id,
                        }
                    },
                },
            }
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.lemonsqueezy.com/v1/checkouts",
                headers=headers,
                json=payload,
            )
            if res.status_code in (200, 201):
                data = res.json()
                checkout_url = (
                    data.get("data", {})
                    .get("attributes", {})
                    .get("url")
                )
                checkout_id = data.get("data", {}).get("id")
                return {
                    "provider": "lemonsqueezy",
                    "checkout_url": checkout_url,
                    "session_id": checkout_id,
                    "amount_cents": amount_cents,
                    "currency": currency,
                }
            err = res.json().get("errors", [{}])[0].get("detail", res.text)
            raise RuntimeError(f"Lemon Squeezy API error: {err}")

    # -------------------------------------------------------------------------
    # 3. POLAR.SH ADAPTER
    # -------------------------------------------------------------------------
    @staticmethod
    async def verify_polar(
        access_token: str,
        organization_id: Optional[str] = None,
        test_mode: bool = False,
    ) -> dict[str, Any]:
        """Verify Polar.sh API credentials (supporting both live & sandbox tokens seamlessly)."""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token.strip()}",
        }
        candidates = [
            ("sandbox", "https://sandbox-api.polar.sh"),
            ("live", "https://api.polar.sh"),
        ] if test_mode else [
            ("live", "https://api.polar.sh"),
            ("sandbox", "https://sandbox-api.polar.sh"),
        ]

        last_error = "Failed to reach Polar.sh API"
        async with httpx.AsyncClient(timeout=10.0) as client:
            for env_name, base_url in candidates:
                url = (
                    f"{base_url}/v1/organizations/{safe_gateway_id(organization_id, 'organization ID')}"
                    if organization_id
                    else f"{base_url}/v1/organizations"
                )
                try:
                    res = await client.get(url, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        org_name = "Polar Organization"
                        resolved_org_id = organization_id
                        if "items" in data and len(data["items"]) > 0:
                            org_name = data["items"][0].get("name", org_name)
                            resolved_org_id = data["items"][0].get("id")
                        elif "name" in data:
                            org_name = data.get("name", org_name)
                        return {
                            "valid": True,
                            "organization_name": org_name,
                            "organization_id": resolved_org_id,
                            "detected_environment": env_name,
                        }
                    else:
                        last_error = f"Polar {env_name} returned HTTP {res.status_code}"
                except Exception as exc:
                    last_error = str(exc)

        return {
            "valid": False,
            "error": last_error,
        }

    @staticmethod
    async def create_polar_checkout(
        access_token: str,
        organization_id: str,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        metadata: Optional[dict[str, Any]] = None,
        product_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a Polar.sh checkout session (supports both catalog products and on-the-fly custom amounts)."""
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {access_token.strip()}",
        }
        clean_title = (title or "Order Payment").strip()[:120]
        clean_currency = (currency or "usd").strip().lower()
        clean_meta = {
            str(k): str(v)[:400]
            for k, v in (metadata or {}).items()
            if v is not None and str(v).strip() != ""
        }

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            # 1. Detect live vs sandbox base URL for this token
            base_url = "https://api.polar.sh"
            probe = await client.get(f"{base_url}/v1/organizations/", headers=headers)
            if probe.status_code == 401:
                sb_probe = await client.get("https://sandbox-api.polar.sh/v1/organizations/", headers=headers)
                if sb_probe.status_code == 200:
                    base_url = "https://sandbox-api.polar.sh"

            # 2. Resolve or create a Polar product matching the requested title & amount
            is_org_token = access_token.strip().startswith("polar_oat_")
            resolved_product_id = product_id.strip() if (product_id and str(product_id).strip()) else None
            is_adhoc_custom = not bool(resolved_product_id)

            if not resolved_product_id:
                list_url = f"{base_url}/v1/products/?is_archived=false&limit=100"
                if organization_id and not is_org_token:
                    list_url += f"&organization_id={safe_gateway_id(organization_id, 'organization ID')}"
                list_res = await client.get(list_url, headers=headers)
                if list_res.status_code == 200:
                    for prod in list_res.json().get("items", []):
                        if str(prod.get("name") or "").strip().lower() == clean_title.lower() and not prod.get("is_recurring"):
                            prices = prod.get("prices") or []
                            if prices and prices[0].get("price_amount") == amount_cents and str(prices[0].get("price_currency") or "usd").lower() == clean_currency:
                                resolved_product_id = prod.get("id")
                                break

            if not resolved_product_id:
                prod_payload: dict[str, Any] = {
                    "name": clean_title,
                    "recurring_interval": None,
                    "metadata": {"chatty_adhoc_custom": "true"},
                    "prices": [
                        {
                            "amount_type": "fixed",
                            "price_amount": int(amount_cents),
                            "price_currency": clean_currency,
                        }
                    ],
                }
                if organization_id and not is_org_token:
                    prod_payload["organization_id"] = organization_id.strip()

                prod_res = await client.post(
                    f"{base_url}/v1/products/",
                    headers=headers,
                    json=prod_payload,
                )
                if prod_res.status_code == 422 and "organization_id" in prod_payload:
                    prod_payload.pop("organization_id", None)
                    prod_res = await client.post(
                        f"{base_url}/v1/products/",
                        headers=headers,
                        json=prod_payload,
                    )
                if prod_res.status_code not in (200, 201):
                    try:
                        err_detail = prod_res.json().get("detail", prod_res.text)
                    except Exception:
                        err_detail = prod_res.text
                    raise RuntimeError(f"Polar.sh product setup error: {err_detail}")
                resolved_product_id = prod_res.json().get("id")

            # 3. Create the hosted Polar checkout session via /v1/checkouts/
            chk_payload: dict[str, Any] = {
                "products": [resolved_product_id],
                "success_url": success_url,
                "metadata": clean_meta,
            }
            if customer_email and "@" in customer_email:
                chk_payload["customer_email"] = customer_email.strip()

            res = await client.post(
                f"{base_url}/v1/checkouts/",
                headers=headers,
                json=chk_payload,
            )
            if res.status_code in (200, 201):
                data = res.json()
                return {
                    "provider": "polar",
                    "checkout_url": data.get("url"),
                    "session_id": data.get("id"),
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "adhoc_product_id": resolved_product_id if is_adhoc_custom else None,
                }
            try:
                err = res.json().get("detail", res.text)
            except Exception:
                err = res.text
            raise RuntimeError(f"Polar.sh API error: {err}")

    # -------------------------------------------------------------------------
    # 4. PRODUCT & PRICING CATALOG SYNC
    # -------------------------------------------------------------------------
    @classmethod
    async def fetch_stripe_products(cls, secret_key: str) -> list[dict[str, Any]]:
        """Fetch active products and prices from Stripe."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                "https://api.stripe.com/v1/prices?active=true&limit=100&expand[]=data.product",
                auth=(secret_key.strip(), ""),
            )
            if res.status_code != 200:
                logger.warning("Failed to fetch Stripe products: %s", res.text)
                return []

            items = []
            for item in res.json().get("data", []):
                prod = item.get("product") or {}
                if isinstance(prod, str):
                    prod_name = "Stripe Product"
                    prod_desc = None
                    prod_img = None
                else:
                    prod_name = prod.get("name") or "Stripe Product"
                    prod_desc = prod.get("description")
                    images = prod.get("images") or []
                    prod_img = images[0] if len(images) > 0 else None

                amount_cents = item.get("unit_amount") or 0
                currency = (item.get("currency") or "usd").upper()
                rec = item.get("recurring")
                interval = rec.get("interval") if rec else None
                formatted = f"${(amount_cents / 100):.2f} {currency}"
                if interval:
                    formatted += f" / {interval}"

                items.append({
                    "id": item["id"],
                    "price_id": item["id"],
                    "variant_id": item["id"],
                    "product_id": prod.get("id") if isinstance(prod, dict) else prod,
                    "provider": "stripe",
                    "name": prod_name,
                    "description": prod_desc,
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "formatted_price": formatted,
                    "recurring": interval,
                    "image_url": prod_img,
                })
            return items

    @classmethod
    async def fetch_lemonsqueezy_products(cls, api_key: str, store_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Fetch products and variants from Lemon Squeezy."""
        headers = {
            "Accept": "application/vnd.api+json",
            "Authorization": f"Bearer {api_key.strip()}",
        }
        url = "https://api.lemonsqueezy.com/v1/products?include=variants&page[size]=100"
        if store_id:
            url += f"&filter[store_id]={safe_gateway_id(store_id, 'store ID')}"

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                logger.warning("Failed to fetch Lemon Squeezy products: %s", res.text)
                return []

            data = res.json()
            variants_map = {}
            for inc in data.get("included", []):
                if inc.get("type") == "variants":
                    variants_map[inc["id"]] = inc.get("attributes", {})

            items = []
            variants_by_product: dict[str, list[dict[str, Any]]] = {}
            for vid, vattrs in variants_map.items():
                variants_by_product.setdefault(str(vattrs.get("product_id")), []).append({"id": vid, **vattrs})

            for prod in data.get("data", []):
                attrs = prod.get("attributes", {})
                if attrs.get("status") not in (None, "published"):
                    continue
                name = attrs.get("name") or "Lemon Squeezy Product"
                currency = (attrs.get("currency") or "USD").upper()
                variants = [
                    v for v in variants_by_product.get(str(prod["id"]), [])
                    if v.get("status") in (None, "published", "pending")
                ]
                if not variants:
                    continue
                for v in variants:
                    amount_cents = v.get("price") or 0
                    interval = v.get("interval") if v.get("is_subscription") else None
                    vname = v.get("name")
                    display = name if not vname or vname.lower() in ("default", name.lower()) else f"{name} - {vname}"
                    formatted = f"${(amount_cents / 100):.2f} {currency}"
                    if interval:
                        formatted += f" / {interval}"
                    items.append({
                        "id": f"{prod['id']}:{v['id']}",
                        "product_id": prod["id"],
                        "price_id": str(v["id"]),
                        "variant_id": str(v["id"]),
                        "provider": "lemonsqueezy",
                        "name": display,
                        "description": attrs.get("description"),
                        "amount_cents": amount_cents,
                        "currency": currency,
                        "formatted_price": formatted,
                        "recurring": interval,
                        "image_url": attrs.get("thumb_url"),
                        "checkout_url": attrs.get("buy_now_url"),
                    })
            return items

    @classmethod
    async def resolve_lemonsqueezy_variant(cls, api_key: str, store_id: Optional[str], preferred: Optional[str] = None) -> Optional[str]:
        """Pick the variant a custom-priced Lemon Squeezy checkout is attached to (preferred, else first published)."""
        if preferred:
            return safe_gateway_id(preferred, "variant ID")
        products = await cls.fetch_lemonsqueezy_products(api_key, store_id)
        return products[0]["variant_id"] if products else None

    @classmethod
    async def fetch_polar_products(cls, access_token: str, organization_id: Optional[str] = None) -> list[dict[str, Any]]:
        """Fetch products from Polar.sh."""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token.strip()}",
        }
        is_org_token = access_token.strip().startswith("polar_oat_")
        query_suffix = "/v1/products/?is_archived=false&limit=100"
        if organization_id and not is_org_token:
            query_suffix += f"&organization_id={safe_gateway_id(organization_id, 'organization ID')}"

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            res = await client.get(f"https://api.polar.sh{query_suffix}", headers=headers)
            if res.status_code == 401:
                res = await client.get(f"https://sandbox-api.polar.sh{query_suffix}", headers=headers)
            if res.status_code != 200:
                logger.warning("Failed to fetch Polar.sh products: %s", res.text)
                return []

            items = []
            for prod in res.json().get("items", []):
                prod_meta = prod.get("metadata") or {}
                if isinstance(prod_meta, dict) and str(prod_meta.get("chatty_adhoc_custom") or "").lower() in ("true", "1", "yes"):
                    continue
                p_name = str(prod.get("name") or "").strip().lower()
                p_desc = str(prod.get("description") or "").strip()
                prices = prod.get("prices") or []
                primary_price = prices[0] if len(prices) > 0 else {}
                rec = primary_price.get("recurring_interval")

                # Filter out ad-hoc dynamic custom quotes generated during chat/inbox sessions
                if not rec and not p_desc and p_name in (
                    "consultation & service deposit",
                    "order payment",
                    "custom checkout",
                    "custom payment",
                    "custom deposit",
                ):
                    continue

                amount_cents = primary_price.get("price_amount") or 0
                currency = (primary_price.get("price_currency") or "usd").upper()
                formatted = f"${(amount_cents / 100):.2f} {currency}"
                if rec:
                    formatted += f" / {rec}"

                items.append({
                    "id": prod["id"],
                    "product_id": prod["id"],
                    "variant_id": prod["id"],
                    "price_id": primary_price.get("id"),
                    "provider": "polar",
                    "name": prod.get("name") or "Polar Product",
                    "description": prod.get("description"),
                    "amount_cents": amount_cents,
                    "currency": currency,
                    "formatted_price": formatted,
                    "recurring": rec,
                    "image_url": None,
                })
            return items

    # -------------------------------------------------------------------------
    # 5. PAYPAL ADAPTER (Orders v2, REST OAuth2 client-credentials)
    # -------------------------------------------------------------------------
    @staticmethod
    def _paypal_base(test_mode: bool) -> str:
        return PAYPAL_SANDBOX_BASE if test_mode else PAYPAL_LIVE_BASE

    @classmethod
    async def _paypal_token(cls, client_id: str, client_secret: str, test_mode: bool) -> str:
        basic = base64.b64encode(f"{client_id.strip()}:{client_secret.strip()}".encode()).decode()
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{cls._paypal_base(test_mode)}/v1/oauth2/token",
                headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
                data={"grant_type": "client_credentials"},
            )
        if res.status_code != 200:
            try:
                detail = res.json().get("error_description") or res.json().get("error") or f"HTTP {res.status_code}"
            except Exception:
                detail = f"HTTP {res.status_code}"
            raise RuntimeError(f"PayPal authentication failed: {detail}")
        return res.json()["access_token"]

    @classmethod
    async def verify_paypal(cls, client_id: str, client_secret: str, test_mode: bool = True) -> dict[str, Any]:
        """Verify PayPal REST app credentials by exchanging them for an access token."""
        try:
            await cls._paypal_token(client_id, client_secret, test_mode)
        except RuntimeError as e:
            return {"valid": False, "error": str(e)}
        return {"valid": True, "mode": "sandbox" if test_mode else "live"}

    @classmethod
    async def create_paypal_checkout(
        cls,
        client_id: str,
        client_secret: str,
        test_mode: bool,
        amount_cents: int,
        currency: str,
        title: str,
        customer_email: Optional[str],
        success_url: str,
        cancel_url: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Create a PayPal order and return the hosted payer-approval URL."""
        token = await cls._paypal_token(client_id, client_secret, test_mode)
        payload: dict[str, Any] = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "description": title[:127],
                "custom_id": str((metadata or {}).get("session_id", ""))[:127],
                "amount": {"currency_code": currency.upper(), "value": f"{amount_cents / 100:.2f}"},
            }],
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "user_action": "PAY_NOW",
                        "return_url": success_url,
                        "cancel_url": cancel_url,
                    }
                }
            },
        }
        if customer_email:
            payload["payment_source"]["paypal"]["email_address"] = customer_email
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{cls._paypal_base(test_mode)}/v2/checkout/orders",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=payload,
            )
        if res.status_code not in (200, 201):
            try:
                err = res.json().get("message") or res.text
            except Exception:
                err = res.text
            raise RuntimeError(f"PayPal API error: {err}")
        data = res.json()
        link = next((l.get("href") for l in data.get("links", []) if l.get("rel") in ("payer-action", "approve")), None)
        if not link:
            raise RuntimeError("PayPal did not return an approval link")
        return {
            "provider": "paypal",
            "checkout_url": link,
            "session_id": data.get("id"),
            "amount_cents": amount_cents,
            "currency": currency,
        }

    @classmethod
    async def capture_paypal_order(
        cls,
        client_id: str,
        client_secret: str,
        test_mode: bool,
        order_id: str,
    ) -> dict[str, Any]:
        """Capture an approved PayPal order upon buyer return."""
        oid = safe_gateway_id(order_id, "PayPal order ID")
        token = await cls._paypal_token(client_id, client_secret, test_mode)
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{cls._paypal_base(test_mode)}/v2/checkout/orders/{oid}/capture",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={},
            )
        if res.status_code in (200, 201):
            return {"captured": True, "data": res.json()}
        return {"captured": False, "status_code": res.status_code, "error": res.text[:300]}

    # -------------------------------------------------------------------------
    # 6. AUTOMATIC WEBHOOK REGISTRATION ACROSS ALL GATEWAYS
    # -------------------------------------------------------------------------
    @classmethod
    async def auto_register_webhook(
        cls,
        provider: str,
        secret_key: str,
        webhook_url: str,
        test_mode: bool = True,
        publishable_key: Optional[str] = None,
        extra_config: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Attempt to automatically register the Chatty webhook endpoint on the payment gateway."""
        prov = provider.lower().strip()
        extra = extra_config or {}
        import secrets as _secrets

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                if prov == "stripe":
                    headers = {"Authorization": f"Bearer {secret_key.strip()}"}
                    # Check existing endpoints first
                    list_res = await client.get("https://api.stripe.com/v1/webhook_endpoints?limit=25", headers=headers)
                    if list_res.status_code == 200:
                        for ep in list_res.json().get("data", []):
                            if ep.get("url") == webhook_url and ep.get("status") == "enabled":
                                return {
                                    "registered": True,
                                    "already_existed": True,
                                    "webhook_id": ep.get("id"),
                                    "events": ep.get("enabled_events", []),
                                }
                    form_data = {
                        "url": webhook_url,
                        "enabled_events[0]": "checkout.session.completed",
                        "enabled_events[1]": "charge.refunded",
                        "enabled_events[2]": "payment_intent.payment_failed",
                        "description": "Chatty AI Conversational Commerce Webhook",
                    }
                    res = await client.post("https://api.stripe.com/v1/webhook_endpoints", headers=headers, data=form_data)
                    if res.status_code in (200, 201):
                        data = res.json()
                        return {
                            "registered": True,
                            "webhook_id": data.get("id"),
                            "webhook_secret": data.get("secret"),
                            "events": data.get("enabled_events", []),
                        }
                    return {"registered": False, "reason": f"Stripe returned HTTP {res.status_code}"}

                elif prov == "polar":
                    headers = {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {secret_key.strip()}",
                    }
                    base_url = "https://api.polar.sh"
                    probe = await client.get(f"{base_url}/v1/organizations/", headers=headers)
                    if probe.status_code == 401:
                        sb_probe = await client.get("https://sandbox-api.polar.sh/v1/organizations/", headers=headers)
                        if sb_probe.status_code == 200:
                            base_url = "https://sandbox-api.polar.sh"

                    # Check existing Polar webhook endpoints
                    list_res = await client.get(f"{base_url}/v1/webhooks/endpoints", headers=headers)
                    if list_res.status_code == 200:
                        for ep in list_res.json().get("items", []):
                            if ep.get("url") == webhook_url:
                                return {
                                    "registered": True,
                                    "already_existed": True,
                                    "webhook_id": ep.get("id"),
                                    "webhook_secret": ep.get("secret"),
                                    "events": ep.get("events", []),
                                }
                    generated_secret = f"polar_whs_{_secrets.token_urlsafe(24)}"
                    payload: dict[str, Any] = {
                        "url": webhook_url,
                        "format": "raw",
                        "secret": generated_secret,
                        "events": [
                            "checkout.created",
                            "checkout.updated",
                            "order.created",
                            "subscription.created",
                            "refund.created",
                        ],
                    }
                    if extra.get("organization_id") and not secret_key.strip().startswith("polar_oat_"):
                        payload["organization_id"] = extra["organization_id"]
                    res = await client.post(f"{base_url}/v1/webhooks/endpoints", headers=headers, json=payload)
                    if res.status_code in (200, 201):
                        data = res.json()
                        return {
                            "registered": True,
                            "webhook_id": data.get("id"),
                            "webhook_secret": data.get("secret") or generated_secret,
                            "events": data.get("events", payload["events"]),
                        }
                    return {"registered": False, "reason": f"Polar returned HTTP {res.status_code}"}

                elif prov == "lemonsqueezy":
                    store_id = str(extra.get("store_id") or "").strip()
                    if not store_id:
                        return {"registered": False, "reason": "Store ID required for Lemon Squeezy webhook setup"}
                    headers = {
                        "Accept": "application/vnd.api+json",
                        "Content-Type": "application/vnd.api+json",
                        "Authorization": f"Bearer {secret_key.strip()}",
                    }
                    generated_secret = _secrets.token_hex(16)
                    payload = {
                        "data": {
                            "type": "webhooks",
                            "attributes": {
                                "url": webhook_url,
                                "events": ["order_created", "order_refunded", "subscription_payment_success"],
                                "secret": generated_secret,
                                "test_mode": test_mode,
                            },
                            "relationships": {
                                "store": {
                                    "data": {"type": "stores", "id": store_id}
                                }
                            },
                        }
                    }
                    res = await client.post("https://api.lemonsqueezy.com/v1/webhooks", headers=headers, json=payload)
                    if res.status_code in (200, 201):
                        data = res.json().get("data", {})
                        return {
                            "registered": True,
                            "webhook_id": data.get("id"),
                            "webhook_secret": generated_secret,
                            "events": ["order_created", "order_refunded", "subscription_payment_success"],
                        }
                    return {"registered": False, "reason": f"Lemon Squeezy returned HTTP {res.status_code}"}

                elif prov == "paypal":
                    if not publishable_key:
                        return {"registered": False, "reason": "PayPal Client ID required"}
                    token = await cls._paypal_token(publishable_key, secret_key, test_mode)
                    base = cls._paypal_base(test_mode)
                    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                    list_res = await client.get(f"{base}/v1/notifications/webhooks", headers=headers)
                    if list_res.status_code == 200:
                        for ep in list_res.json().get("webhooks", []):
                            if ep.get("url") == webhook_url:
                                return {
                                    "registered": True,
                                    "already_existed": True,
                                    "webhook_id": ep.get("id"),
                                }
                    payload = {
                        "url": webhook_url,
                        "event_types": [
                            {"name": "CHECKOUT.ORDER.APPROVED"},
                            {"name": "PAYMENT.CAPTURE.COMPLETED"},
                            {"name": "PAYMENT.CAPTURE.REFUNDED"},
                        ],
                    }
                    res = await client.post(f"{base}/v1/notifications/webhooks", headers=headers, json=payload)
                    if res.status_code in (200, 201):
                        data = res.json()
                        return {
                            "registered": True,
                            "webhook_id": data.get("id"),
                            "events": ["CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.REFUNDED"],
                        }
                    return {"registered": False, "reason": f"PayPal returned HTTP {res.status_code}"}

        except Exception as exc:
            logger.warning("Auto-register payment webhook failed (%s)", type(exc).__name__)
            return {"registered": False, "reason": str(exc)}

        return {"registered": False, "reason": "Unsupported provider"}
