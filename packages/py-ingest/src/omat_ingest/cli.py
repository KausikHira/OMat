"""CSV -> validated records -> OpenSearch.

Stages: parse -> validate -> derive -> dedupe -> stage -> index.
The CLI is intentionally thin; the logic belongs in ``omat_core``/``pipeline``.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Iterator, Sequence
from pathlib import Path

from omat_core.opensearch import bulk_index, count_all, ensure_index, make_client
from omat_core.taxonomy import load_taxonomy

from .pipeline import IngestStats, iter_records, run_validate, stage_jsonl, write_rejects


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate a CSV without writing to OpenSearch."""
    taxonomy = load_taxonomy()
    stats, rejects, _records = run_validate(Path(args.path), taxonomy)
    if rejects:
        out = write_rejects(rejects, Path(args.rejects))
        print(f"rejects written to {out}")
    print(json.dumps({
        "total_rows": stats.total_rows,
        "records": stats.records_built,
        "golden": stats.golden,
        "property_only": stats.property_only,
        "composition_only": stats.composition_only,
        "duplicates": stats.duplicates,
        "rejections": stats.rejections,
        "warnings": stats.warnings,
    }, indent=2))
    return 0 if stats.rejections == 0 else 1


def cmd_index(args: argparse.Namespace) -> int:
    """Build a versioned index and swap the alias after staging."""
    taxonomy = load_taxonomy()
    stats = IngestStats()
    rejects: list = []
    staged = 0
    if args.dry_run:
        for _ in iter_records(Path(args.path), taxonomy, stats, rejects):
            pass
        print(json.dumps({"dry_run": True, **_stats_dict(stats)}, indent=2))
        return 0

    client = make_client(args.opensearch_url)
    concrete = ensure_index(client, version=args.version)
    print(f"indexing into {concrete} via alias {args.alias}")
    staged = stage_jsonl(
        iter_records(Path(args.path), taxonomy, stats, rejects),
        Path(args.stage) / "records.jsonl",
    )
    # Re-read the staged JSONL so indexing and stats never disagree.
    def _docs() -> Iterator[dict]:
        with (Path(args.stage) / "records.jsonl").open() as handle:
            for line in handle:
                yield json.loads(line)

    ok, failed = bulk_index(client, _docs())
    client.indices.refresh(index=args.alias)
    total = count_all(client)
    print(json.dumps({
        **_stats_dict(stats),
        "staged": staged,
        "indexed_ok": ok,
        "indexed_failed": failed,
        "alias_count": total,
    }, indent=2))
    if rejects:
        write_rejects(rejects, Path(args.rejects))
    return 0


def _stats_dict(stats) -> dict:
    return {
        "total_rows": stats.total_rows,
        "records": stats.records_built,
        "golden": stats.golden,
        "property_only": stats.property_only,
        "composition_only": stats.composition_only,
        "duplicates": stats.duplicates,
        "rejections": stats.rejections,
    }


def cmd_report(args: argparse.Namespace) -> int:
    """Summarize a validation run from data/rejects/."""
    path = Path(args.rejects) / "rejects.jsonl"
    if not path.exists():
        print(f"no rejects file at {path}")
        return 0
    reasons: dict[str, int] = {}
    total = 0
    with path.open() as handle:
        for line in handle:
            entry = json.loads(line)
            total += 1
            reasons[entry["reason"]] = reasons.get(entry["reason"], 0) + 1
    print(json.dumps({"total_rejections": total, "by_reason": reasons}, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="omat-ingest",
        description="Validate and index OMAT-SE measurement records.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    validate = sub.add_parser("validate", help="validate a CSV and write rejects")
    validate.add_argument("path", help="path to the source CSV")
    validate.add_argument("--rejects", default="data/rejects", help="rejects directory")
    validate.set_defaults(func=cmd_validate)

    index = sub.add_parser("index", help="build an index and swap the alias")
    index.add_argument("path", help="path to the source CSV")
    index.add_argument("--alias", default="papers", help="index alias to update")
    index.add_argument("--version", default=None, help="index version, e.g. 2")
    index.add_argument("--dry-run", action="store_true", help="parse and validate only")
    index.add_argument("--stage", default="data/staging", help="JSONL staging directory")
    index.add_argument("--rejects", default="data/rejects", help="rejects directory")
    index.add_argument(
        "--opensearch-url", default="http://localhost:9200", help="OpenSearch URL"
    )
    index.set_defaults(func=cmd_index)

    report = sub.add_parser("report", help="summarize the last validation run")
    report.add_argument("--rejects", default="data/rejects", help="rejects directory")
    report.set_defaults(func=cmd_report)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except FileNotFoundError as exc:
        print(f"omat-ingest: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
