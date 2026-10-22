"""OpenSearch adapter: mappings, query builders, aggregations.

Search must stay behind this package. The API and MCP server never build raw
query JSON, and OpenSearch is never exposed outside the VPC.
"""
