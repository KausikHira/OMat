"""CSV -> validated records -> OpenSearch.

Planned stages (phase 0):

1. parse        ``ast.literal_eval`` on Composition, Property, Elements,
                APL_Group, and Table No. cells.
2. validate     pydantic models; rejected rows go to ``data/rejects/`` with a
                reason and the original line.
3. normalize    journal names, property names, units, years, DOI, PII.
4. derive       ``paper_link``, canonical formula, at%, element vector.
5. dedupe       ``proxy_id`` + property slug; report DOI/PII conflicts.
6. stage        write JSONL to S3 (MinIO locally).
7. index        bulk into ``papers_vN``, smoke test, then swap the alias.

The CLI is intentionally thin: the logic belongs in ``omat_core``.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate a CSV without writing to OpenSearch."""
    raise NotImplementedError("the validation pipeline lands in phase 0")


def cmd_index(args: argparse.Namespace) -> int:
    """Build a versioned index and swap the alias after smoke tests."""
    raise NotImplementedError("the indexing pipeline lands in phase 0")


def cmd_report(args: argparse.Namespace) -> int:
    """Summarize a validation run from ``data/rejects/``."""
    raise NotImplementedError("the validation report lands in phase 0")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="omat-ingest",
        description="Validate and index OMAT-SE measurement records.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate", help="validate a CSV and write rejects")
    validate.add_argument("path", help="path to the source CSV")
    validate.set_defaults(func=cmd_validate)

    index = sub.add_parser("index", help="build an index and swap the alias")
    index.add_argument("path", help="path to the source CSV")
    index.add_argument("--alias", default="papers", help="index alias to update")
    index.add_argument("--dry-run", action="store_true", help="parse and validate only")
    index.set_defaults(func=cmd_index)

    report = sub.add_parser("report", help="summarize the last validation run")
    report.add_argument("--rejects", default="data/rejects", help="rejects directory")
    report.set_defaults(func=cmd_report)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except NotImplementedError as exc:
        print(f"omat-ingest: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
