"""Local Chatty voice-agent backend.

This package is intentionally isolated from the HTTP application.  It uses
the same Chatty business services in-process, while LiveKit Agents owns the
real-time audio session.
"""

__version__ = "0.1.0"
