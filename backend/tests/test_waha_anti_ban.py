"""Unit tests for WAHA integration, Pacing Engine, Spinning Gate, and Anti-Ban Warmup Ladder."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from app.services.waha.anti_ban import WahaAntiBanService
from app.services.waha.client import WahaClient
from app.services.waha.models import (
    PacingConfig,
    SpinningConfig,
    WahaBotConfig,
    WahaSessionState,
    WarmupConfig,
)
from app.services.waha.pacing import PacingEngine
from app.services.waha.spinning import SpinningGate, jaccard_similarity
from app.services.waha.warmup import WarmupLedger


class TestWahaPacing(unittest.TestCase):
    def test_pacing_delay_calculation(self):
        cfg = PacingConfig(
            throttle_ms=1000,
            jitter_max_ms=200,
            reading_delay_ms=1000,
            typing_ms_per_char=20,
        )
        engine = PacingEngine(cfg)

        short_text = "Hi"
        reading_sec, typing_sec = engine.calculate_delay(short_text)
        self.assertGreaterEqual(reading_sec, 1.0)
        self.assertLessEqual(reading_sec, 1.3)
        # 2 chars * 20ms = 40ms, bounded to min 1.2s
        self.assertGreaterEqual(typing_sec, 1.2)

    def test_business_window_check(self):
        cfg = PacingConfig(window_start_hour=8, window_end_hour=20)
        engine = PacingEngine(cfg)
        self.assertTrue(engine.is_within_business_window(12))
        self.assertFalse(engine.is_within_business_window(23))
        self.assertFalse(engine.is_within_business_window(3))


class TestWahaSpinning(unittest.TestCase):
    def test_jaccard_similarity_calculation(self):
        set_a = {"hello", "world", "this", "is", "a", "test"}
        set_b = {"hello", "world", "this", "is", "another", "test"}
        sim = jaccard_similarity(set_a, set_b)
        self.assertGreater(sim, 0.70)
        self.assertLess(sim, 1.0)

    def test_spinning_duplicate_veto(self):
        cfg = SpinningConfig(
            window_size=10,
            similarity_threshold=0.80,
            repetition_threshold=2,
        )
        gate = SpinningGate(cfg)

        text = "Hello! Your appointment has been booked for tomorrow afternoon at 2pm."
        # First time: clean
        vetoed, count, _ = gate.check_duplicate(text)
        self.assertFalse(vetoed)
        gate.record_outbound(text)

        # Second time: 1 duplicate found, not yet vetoed (threshold is 2)
        vetoed, count, _ = gate.check_duplicate(text)
        self.assertFalse(vetoed)
        gate.record_outbound(text)

        # Third time: 2 duplicates found >= threshold -> VETOED!
        vetoed, count, _ = gate.check_duplicate(text)
        self.assertTrue(vetoed)

        # Ensure dynamic variation changes text
        spun = gate.apply_spinning_variation(text)
        self.assertNotEqual(spun, text)


class TestWahaWarmup(unittest.TestCase):
    def test_warmup_ladder_stages(self):
        # SIM age 2 days -> Stage 1 (cap 20)
        w1 = WarmupLedger(WarmupConfig(sim_age_days=2, auto_warmup_enabled=True))
        self.assertEqual(w1.get_effective_cap(), 20)

        # SIM age 5 days -> Stage 2 (cap 50)
        w2 = WarmupLedger(WarmupConfig(sim_age_days=5, auto_warmup_enabled=True))
        self.assertEqual(w2.get_effective_cap(), 50)

        # SIM age 10 days -> Stage 3 (cap 120)
        w3 = WarmupLedger(WarmupConfig(sim_age_days=10, auto_warmup_enabled=True))
        self.assertEqual(w3.get_effective_cap(), 120)

        # SIM age 35 days -> Stage 5 (formed / unlimited)
        w5 = WarmupLedger(WarmupConfig(sim_age_days=35, auto_warmup_enabled=True))
        self.assertIsNone(w5.get_effective_cap())

    def test_quota_exhaustion_blocks_send(self):
        w = WarmupLedger(WarmupConfig(sim_age_days=1, daily_cap=2, auto_warmup_enabled=False))
        self.assertTrue(w.can_send()[0])
        w.record_sent()
        self.assertTrue(w.can_send()[0])
        w.record_sent()
        # Cap of 2 reached -> blocked!
        self.assertFalse(w.can_send()[0])


class TestWahaAntiBanService(unittest.IsolatedAsyncioTestCase):
    async def test_opt_out_detection(self):
        service = WahaAntiBanService(WahaBotConfig(opt_out_shield_enabled=True))
        self.assertTrue(service.is_opt_out_request("STOP"))
        self.assertTrue(service.is_opt_out_request("sair"))
        self.assertTrue(service.is_opt_out_request("parar de enviar"))
        self.assertTrue(service.is_opt_out_request("Por favor cancelar"))
        self.assertFalse(service.is_opt_out_request("What are your hours?"))

    @patch("app.services.waha.client.WahaClient.send_text", new_callable=AsyncMock)
    @patch("app.services.waha.pacing.PacingEngine.execute_pacing", new_callable=AsyncMock)
    async def test_dispatch_outbound_pipeline(self, mock_pacing, mock_send):
        mock_send.return_value = {"id": "msg-123"}
        service = WahaAntiBanService(WahaBotConfig())

        res = await service.dispatch_outbound(
            chat_id="123456789@c.us",
            text="Your order has been confirmed!",
            is_inbound_reply=True,
        )
        self.assertTrue(res["delivered"])
        mock_pacing.assert_called_once()
        mock_send.assert_called_once()


if __name__ == "__main__":
    unittest.main()
