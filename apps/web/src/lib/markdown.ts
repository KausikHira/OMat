/**
 * Minimal markdown subset for chat replies, parsed to plain data — no HTML
 * strings, no dependencies. The React renderer maps the AST to elements, so
 * source text can never inject markup.
 *
 * Supported: paragraphs (hard line breaks preserved), `#`..`######` headings,
 * fenced code blocks, ordered/unordered/bullet-point lists, and inline
 * `**bold**`, `*italic*` / `_italic_`, `` `code` `` and [links](https://…)
 * (http/https only; anything else stays literal text).
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; content: Inline[] }
  | { kind: "italic"; content: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; label: string };

export type Block =
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "heading"; level: number; content: Inline[] }
  | { kind: "code"; lang: string; code: string }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

// Order matters: the bold arm must be tried before the italic arm. The
// lookarounds keep unmatched `**` literal and stop `_x_` from matching inside
// snake_case slugs (intraword `_` never opens emphasis, as in CommonMark).
const INLINE_PATTERN =
  /(?<code>`[^`\n]+`)|(?<bold>\*\*[^*\n]+\*\*)|(?<italicStar>(?<!\*)\*(?!\*)[^*\n]+\*(?!\*))|(?<italicUnderscore>(?<!\w)_[^_\n]+_(?!\w))|(?<link>\[(?<label>[^\]\n]+)\]\((?<href>https?:\/\/[^)\s]+)\))/g;

export function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, "g");
  let last = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    const full = match[0] ?? "";
    const start = match.index;
    if (start > last) {
      nodes.push({ kind: "text", text: text.slice(last, start) });
    }
    const groups = match.groups ?? {};
    const { code, bold, italicStar, italicUnderscore, label, href } = groups;
    if (code !== undefined) {
      nodes.push({ kind: "code", text: code.slice(1, -1) });
    } else if (bold !== undefined) {
      nodes.push({ kind: "bold", content: parseInline(bold.slice(2, -2)) });
    } else if (italicStar !== undefined) {
      nodes.push({ kind: "italic", content: parseInline(italicStar.slice(1, -1)) });
    } else if (italicUnderscore !== undefined) {
      nodes.push({ kind: "italic", content: parseInline(italicUnderscore.slice(1, -1)) });
    } else if (label !== undefined && href !== undefined) {
      nodes.push({ kind: "link", href, label });
    } else {
      nodes.push({ kind: "text", text: full });
    }
    last = start + full.length;
    match = pattern.exec(text);
  }
  if (last < text.length) {
    nodes.push({ kind: "text", text: text.slice(last) });
  }
  return nodes;
}

const FENCE_OPEN = /^```(\w*)\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*•]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;
const BLOCK_START = /^(\s*[-*•]\s|\s*\d+[.)]\s|#{1,6}\s|```)/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = FENCE_OPEN.exec(line);
    if (fence !== null) {
      const lang = fence[1] ?? "";
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i] ?? "")) {
        code.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // consume the closing fence (or stop at EOF)
      blocks.push({ kind: "code", lang, code: code.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      blocks.push({
        kind: "heading",
        level: (heading[1] ?? "#").length,
        content: parseInline((heading[2] ?? "").trim()),
      });
      i += 1;
      continue;
    }

    const bullet = BULLET_ITEM.exec(line);
    const orderedItem = ORDERED_ITEM.exec(line);
    if (bullet !== null || orderedItem !== null) {
      const ordered = bullet === null;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const b = BULLET_ITEM.exec(current);
        const o = ORDERED_ITEM.exec(current);
        const body = ordered ? o?.[1] : b?.[1];
        if (body === undefined) {
          break;
        }
        items.push(parseInline(body.trim()));
        i += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      if (!current.trim() || BLOCK_START.test(current)) {
        break;
      }
      paragraph.push(current);
      i += 1;
    }
    blocks.push({ kind: "paragraph", content: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}
