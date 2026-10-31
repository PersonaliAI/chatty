"""Unit & Integration tests for Enterprise Outbox, Checkpoints, CRM Pipelines, and Audit."""

from __future__ import annotations

import os
os.environ.setdefault("SUPABASE_URL", "https://mock.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "mock-key")
os.environ.setdefault("SUPABASE_KEY", "mock-key")
os.environ.setdefault("SUPABASE_SECRET_KEY", "mock-secret-key")
os.environ.setdefault("GEMINI_API_KEY", "mock-gemini")
try:
    import dotenv
    dotenv.load_dotenv()
except Exception:
    pass


import unittest
from unittest.mock import MagicMock, patch

from app.services.enterprise.audit_service import AuditService
from app.services.enterprise.checkpoint_service import CheckpointService
from app.services.enterprise.event_log_service import EventLogService
from app.services.enterprise.pipeline_service import PipelineService


class TestEnterpriseEventLog(unittest.IsolatedAsyncioTestCase):
    @patch("app.core.clients.supabase.table")
    async def test_record_new_event(self, mock_table):
        mock_query = MagicMock()
        mock_query.execute.return_value.data = [{"id": "evt-123", "status": "pending"}]
        mock_table.return_value.insert.return_value = mock_query

        is_dup, evt = await EventLogService.record_event(
            channel="whatsapp",
            external_id="msg_external_123",
            bot_id="00000000-0000-0000-0000-000000000001",
            payload={"text": "hello"},
        )
        self.assertFalse(is_dup)
        self.assertEqual(evt["id"], "evt-123")

    @patch("app.core.clients.supabase.table")
    async def test_idempotent_duplicate_detection(self, mock_table):
        mock_insert = MagicMock()
        mock_insert.execute.side_effect = Exception("duplicate key value violates unique constraint 'uq_event_log_channel_external_id'")
        mock_table.return_value.insert.return_value = mock_insert

        mock_select = MagicMock()
        mock_select.execute.return_value.data = [{"id": "evt-123", "status": "completed"}]
        mock_table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value = mock_select

        is_dup, evt = await EventLogService.record_event(
            channel="whatsapp",
            external_id="msg_external_123",
            bot_id="00000000-0000-0000-0000-000000000001",
            payload={"text": "duplicate"},
        )
        self.assertTrue(is_dup)
        self.assertEqual(evt["id"], "evt-123")


class TestEnterpriseCheckpoints(unittest.IsolatedAsyncioTestCase):
    @patch("app.core.clients.supabase.table")
    async def test_checkpoint_extraction_sales_intent(self, mock_table):
        mock_upsert = MagicMock()
        mock_upsert.execute.return_value.data = [{"id": "chk-1"}]
        mock_table.return_value.upsert.return_value = mock_upsert

        checkpoint = await CheckpointService.extract_and_save_turn_checkpoint(
            bot_id="00000000-0000-0000-0000-000000000001",
            session_id="sess_abc",
            customer_message="How much is the commercial solar setup? It seems a bit expensive for me right now.",
            assistant_reply="Our systems start at $12,000, and we will follow up with zero-down financing options.",
            previous_checkpoint=None,
        )

        self.assertEqual(checkpoint["lead_intent"], "sales")
        self.assertEqual(checkpoint["customer_sentiment"], "hesitant")
        self.assertIn("Price / Budget concern", checkpoint["unresolved_objections"])
        self.assertIn("Follow up with requested details", checkpoint["active_commitments"])


class TestEnterprisePipeline(unittest.IsolatedAsyncioTestCase):
    @patch("app.core.clients.supabase.table")
    async def test_get_kanban_board(self, mock_table):
        mock_pipe = MagicMock()
        mock_pipe.execute.return_value.data = [{"id": "pipe-1", "name": "Sales Pipeline"}]

        mock_stages = MagicMock()
        mock_stages.execute.return_value.data = [
            {"id": "stg-1", "name": "New Lead", "stage_order": 0},
            {"id": "stg-2", "name": "Qualified", "stage_order": 1},
        ]

        mock_deals = MagicMock()
        mock_deals.execute.return_value.data = [
            {"id": "deal-1", "stage_id": "stg-1", "title": "Acme Corp", "value_cents": 500000},
            {"id": "deal-2", "stage_id": "stg-2", "title": "Beta LLC", "value_cents": 1200000},
        ]

        def table_router(table_name):
            m = MagicMock()
            if table_name == "chatty_pipelines":
                m.select.return_value.eq.return_value.order.return_value.limit.return_value = mock_pipe
            elif table_name == "chatty_pipeline_stages":
                m.select.return_value.eq.return_value.order.return_value = mock_stages
            elif table_name == "chatty_deals":
                m.select.return_value.eq.return_value.eq.return_value.order.return_value = mock_deals
            return m

        mock_table.side_effect = table_router

        board = await PipelineService.get_kanban_board("00000000-0000-0000-0000-000000000001", "pipe-1")
        self.assertEqual(len(board["stages"]), 2)
        self.assertEqual(board["total_deals"], 2)
        self.assertEqual(board["total_pipeline_value_cents"], 1700000)
        self.assertEqual(board["stages"][0]["deal_count"], 1)


class TestEnterpriseAudit(unittest.IsolatedAsyncioTestCase):
    @patch("app.core.clients.supabase.table")
    async def test_audit_recording(self, mock_table):
        mock_insert = MagicMock()
        mock_insert.execute.return_value.data = [{"id": "aud-1"}]
        mock_table.return_value.insert.return_value = mock_insert

        await AuditService.record_audit(
            action="pipeline_stage_created",
            entity_type="chatty_pipeline_stage",
            entity_id="stg-123",
            bot_id="00000000-0000-0000-0000-000000000001",
            user_id="00000000-0000-0000-0000-000000000002",
            diff={"name": "Proposal Sent"},
        )
        mock_insert.execute.assert_called_once()




class TestEnterpriseEventLogWorker(unittest.IsolatedAsyncioTestCase):
    @patch("app.workers.event_log_worker.EventLogService.mark_completed")
    @patch("app.workers.event_log_worker.EventLogService.mark_processing")
    @patch("app.core.clients.supabase.table")
    async def test_drain_event_log_success(self, mock_table, mock_mark_processing, mock_mark_completed):
        from app.workers.event_log_worker import drain_event_log

        mock_query = MagicMock()
        mock_query.execute.return_value.data = [
            {
                "id": "evt-1",
                "channel": "whatsapp",
                "payload": {"text": "test"},
                "bot_id": "00000000-0000-0000-0000-000000000001",
            }
        ]
        mock_table.return_value.select.return_value.in_.return_value.or_.return_value.order.return_value.limit.return_value = mock_query

        stats = await drain_event_log(limit=10)
        self.assertEqual(stats["processed"], 1)
        self.assertEqual(stats["succeeded"], 1)
        self.assertEqual(stats["failed"], 0)
        mock_mark_processing.assert_called_once_with("evt-1")
        mock_mark_completed.assert_called_once_with("evt-1")


if __name__ == "__main__":
    unittest.main()
