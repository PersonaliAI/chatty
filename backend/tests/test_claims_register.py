"""Automated CI verification of public architectural claims documented in CLAIMS_REGISTER.md.
Ensures tool counts, critical claims, and source-of-truth registries stay synchronized.
"""

from pathlib import Path
import re
import pytest


def test_mcp_tool_count_matches_claims_register():
    backend_dir = Path(__file__).resolve().parent.parent
    mcp_file = backend_dir / "app" / "routers" / "mcp.py"
    assert mcp_file.exists(), f"mcp.py not found at {mcp_file}"

    text = mcp_file.read_text(encoding="utf-8")
    
    # FastMCP tools are declared with @mcp.tool()
    fn_matches = re.findall(r'@mcp\.tool\([^\)]*\)\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)', text)
    tool_count = len(fn_matches)

    # Exactly 81 FastMCP tools
    assert tool_count == 81, (
        f"Expected 81 FastMCP tools as specified in CLAIMS_REGISTER.md and README.md, "
        f"but found {tool_count}. Update CLAIMS_REGISTER.md and all public docs if tools changed."
    )


def test_claims_register_document_exists():
    root_dir = Path(__file__).resolve().parent.parent.parent
    register = root_dir / "CLAIMS_REGISTER.md"
    assert register.exists(), "CLAIMS_REGISTER.md must exist in root repository"
    content = register.read_text(encoding="utf-8")
    assert "81 FastMCP Tools" in content
    assert "Under 5 minutes" in content
    assert "Free Open-Source Software (MIT)" in content
