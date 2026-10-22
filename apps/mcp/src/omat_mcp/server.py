"""MCP server built on the Python SDK's FastMCP.

Local (stdio):

    python -m omat_mcp.server

Remote (streamable HTTP behind the ALB) will be enabled in phase 3. Tools must
delegate to ``omat_core`` so the agent surface and the REST surface cannot drift.
"""

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("omat-se")


@mcp.tool()
def search_records(query: str, limit: int = 10) -> list[dict[str, object]]:
    """Search measurement records by composition, property, journal, or application."""
    raise NotImplementedError("wire to omat_core.opensearch in phase 1")


@mcp.tool()
def get_paper(doi_or_pii: str) -> dict[str, object]:
    """Return every measurement row for one paper."""
    raise NotImplementedError("wire to omat_core in phase 1")


@mcp.tool()
def aggregate_records(metric: str, group_by: str) -> list[dict[str, object]]:
    """Aggregate records, for example mean property value grouped by journal."""
    raise NotImplementedError("wire to omat_core.opensearch in phase 2")


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
