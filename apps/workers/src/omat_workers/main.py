"""Worker entry point (phase 2).

Planned consumers:

- ``records.index.upsert``  reindex a batch into ``papers_vN``
- ``papers.enrich.doi``     Crossref metadata for title/authors
- ``search.events``         anonymized query analytics
- ``dlq.*``                 inspection and replay

Until phase 2, ingestion runs as a CLI job. Keep this process idle rather than
adding a queue nobody consumes.
"""

import logging

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger.info("omat-workers: no consumers registered (phase 2)")


if __name__ == "__main__":
    main()
