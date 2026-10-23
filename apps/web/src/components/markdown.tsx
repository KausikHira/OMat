import { Fragment, type ReactNode } from "react";

import { type Block, type Inline, parseBlocks } from "@/lib/markdown";

/**
 * Map a static sequence with positional keys. Parsed markdown is a snapshot
 * rebuilt on every stream chunk — nodes never reorder independently — so
 * positional keys are stable for React.
 */
function keyed<T>(items: T[], render: (item: T) => ReactNode): ReactNode {
  // biome-ignore lint/suspicious/noArrayIndexKey: see keyed() doc
  return items.map((item, index) => <Fragment key={index}>{render(item)}</Fragment>);
}

function renderInline(nodes: Inline[]): ReactNode {
  return keyed(nodes, (node) => {
    switch (node.kind) {
      case "text":
        return node.text;
      case "bold":
        return <strong>{renderInline(node.content)}</strong>;
      case "italic":
        return <em>{renderInline(node.content)}</em>;
      case "code":
        return (
          <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[11.5px]">{node.text}</code>
        );
      case "link":
        return (
          <a
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            {node.label}
          </a>
        );
    }
  });
}

function headingTag(level: number): "h3" | "h4" | "h5" | "h6" {
  if (level <= 1) {
    return "h3";
  }
  if (level <= 2) {
    return "h4";
  }
  if (level <= 3) {
    return "h5";
  }
  return "h6";
}

function renderBlock(block: Block): ReactNode {
  switch (block.kind) {
    case "paragraph":
      return <p className="whitespace-pre-wrap">{renderInline(block.content)}</p>;
    case "heading": {
      const Tag = headingTag(block.level);
      return (
        <Tag className="text-[13px] font-semibold text-ink">{renderInline(block.content)}</Tag>
      );
    }
    case "code":
      return (
        <pre className="overflow-x-auto rounded-[8px] border border-line bg-canvas px-3 py-2 font-mono text-[11.5px] leading-5">
          <code>{block.code}</code>
        </pre>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={`space-y-1 pl-5 marker:text-muted ${
            block.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {keyed(block.items, (item) => (
            <li>{renderInline(item)}</li>
          ))}
        </ListTag>
      );
    }
  }
}

/** Render assistant chat markdown as safe React elements (never raw HTML). */
export function Markdown({ text }: { text: string }) {
  return <div className="space-y-2">{keyed(parseBlocks(text), renderBlock)}</div>;
}
