"""Anti-template Jaccard similarity spinning gate (DeskcommCRM anti-ban architecture)."""

from __future__ import annotations

from collections import deque
import logging
import re
from typing import Deque, Optional

from app.services.waha.models import SpinningConfig

logger = logging.getLogger("chatty.waha.spinning")


def _tokenize(text: str) -> set[str]:
    """Normalize text into a set of lowercased alphanumeric word tokens."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    tokens = {tok.strip() for tok in cleaned.split() if len(tok.strip()) > 1}
    return tokens


def jaccard_similarity(set_a: set[str], set_b: set[str]) -> float:
    """Compute Jaccard token overlap similarity between two token sets in [0.0, 1.0]."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return intersection / union if union > 0 else 0.0


class SpinningGate:
    """Sliding-window duplicate message detector preventing mass hash bans."""

    def __init__(self, config: Optional[SpinningConfig] = None):
        self.config = config or SpinningConfig()
        self._history: Deque[str] = deque(maxlen=self.config.window_size)

    def is_exempt(self, text: str) -> bool:
        """Check if message matches short utility text or allowlisted URL patterns."""
        clean = text.strip()
        if len(clean) <= 15:
            # Short transactional words like 'ok', 'yes', 'perfect'
            return True
        for pat in self.config.allowlist_patterns:
            if re.search(pat, clean, re.IGNORECASE):
                return True
        return False

    def check_duplicate(self, candidate: str) -> tuple[bool, int, float]:
        """
        Check if candidate text is dangerously similar to recent outbound copies.
        Returns:
            (is_vetoed: bool, duplicate_count: int, max_similarity: float)
        """
        if self.is_exempt(candidate):
            return False, 0, 0.0

        cand_tokens = _tokenize(candidate)
        duplicate_count = 0
        max_sim = 0.0

        for past_msg in self._history:
            past_tokens = _tokenize(past_msg)
            sim = jaccard_similarity(cand_tokens, past_tokens)
            if sim > max_sim:
                max_sim = sim
            if sim >= self.config.similarity_threshold:
                duplicate_count += 1

        is_vetoed = duplicate_count >= self.config.repetition_threshold
        if is_vetoed:
            logger.warning(
                "Spinning gate flagged duplicate outbound copy (sim=%.2f, duplicates=%d >= %d): '%s...'",
                max_sim,
                duplicate_count,
                self.config.repetition_threshold,
                candidate[:50],
            )
        return is_vetoed, duplicate_count, max_sim

    def record_outbound(self, text: str) -> None:
        """Record outbound message into sliding window ledger."""
        if not self.is_exempt(text):
            self._history.append(text)

    def apply_spinning_variation(self, text: str) -> str:
        """
        Inject minor natural human variations into message if duplicate detected,
        breaking the static hash without changing core meaning.
        """
        variations_prefix = [
            "Just to confirm: ",
            "Quick update: ",
            "Here's the detail: ",
            "To answer your question: ",
        ]
        import random
        prefix = random.choice(variations_prefix)
        return f"{prefix}{text}"
