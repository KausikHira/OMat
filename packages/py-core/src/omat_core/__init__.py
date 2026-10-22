"""Shared domain layer for OMAT-SE.

The API, MCP server, workers, and ingestion CLI all import from this package so
that search semantics exist in exactly one place. Adapters stay thin.
"""

__version__ = "0.1.0"
