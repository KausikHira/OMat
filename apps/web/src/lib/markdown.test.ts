import { describe, expect, test } from "bun:test";

import { type Block, parseBlocks, parseInline } from "./markdown";

function texts(nodes: ReturnType<typeof parseInline>): string {
  return nodes
    .map((node) => {
      switch (node.kind) {
        case "text":
        case "code":
          return node.text;
        case "link":
          return node.label;
        case "bold":
        case "italic":
          return texts(node.content);
      }
    })
    .join("");
}

describe("parseInline", () => {
  test("plain text passes through as one text node", () => {
    expect(parseInline("hardness is 6.2 GPa")).toEqual([
      { kind: "text", text: "hardness is 6.2 GPa" },
    ]);
  });

  test("bold, italic and inline code are recognised", () => {
    expect(parseInline("**strong** *em* _also_ `code`")).toEqual([
      { kind: "bold", content: [{ kind: "text", text: "strong" }] },
      { kind: "text", text: " " },
      { kind: "italic", content: [{ kind: "text", text: "em" }] },
      { kind: "text", text: " " },
      { kind: "italic", content: [{ kind: "text", text: "also" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "code" },
    ]);
  });

  test("bold wins over italic when stars are doubled", () => {
    const nodes = parseInline("**only bold**");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.kind).toBe("bold");
  });

  test("http(s) links parse; unsafe schemes stay literal text", () => {
    expect(parseInline("[docs](https://example.com/a)")).toEqual([
      { kind: "link", href: "https://example.com/a", label: "docs" },
    ]);
    const unsafe = parseInline("[click](javascript:alert(1))");
    expect(unsafe.every((node) => node.kind !== "link")).toBe(true);
    expect(texts(unsafe)).toBe("[click](javascript:alert(1))");
  });

  test("unmatched markers stay plain text", () => {
    expect(texts(parseInline("a ** b * c"))).toBe("a ** b * c");
  });

  test("intraword underscores in slugs never open emphasis", () => {
    const slug = "the glass_transition_temperature of GlassA";
    expect(texts(parseInline(slug))).toBe(slug);
    expect(parseInline("glass_transition_temperature").every((node) => node.kind === "text")).toBe(
      true,
    );
  });
});

describe("parseBlocks", () => {
  test("blank line separates paragraphs", () => {
    const blocks = parseBlocks("first line\nstill first\n\nsecond");
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "paragraph"]);
  });

  test("single newlines inside a paragraph are preserved", () => {
    const blocks = parseBlocks("line one\nline two");
    expect(blocks).toHaveLength(1);
    expect(texts((blocks[0] as { content: ReturnType<typeof parseInline> }).content)).toBe(
      "line one\nline two",
    );
  });

  test("headings capture level and inline content", () => {
    const blocks = parseBlocks("### **Summary**");
    expect(blocks[0]).toEqual({
      kind: "heading",
      level: 3,
      content: [{ kind: "bold", content: [{ kind: "text", text: "Summary" }] }],
    });
  });

  test("fenced code keeps its language, body and blank lines", () => {
    const blocks = parseBlocks("```python\nx = 1\n\ny = 2\n```\nafter");
    expect(blocks[0]).toEqual({ kind: "code", lang: "python", code: "x = 1\n\ny = 2" });
    expect(blocks.map((block) => block.kind)).toEqual(["code", "paragraph"]);
  });

  test("dash and bullet markers build one unordered list", () => {
    const blocks = parseBlocks("- first\n• second\n- third");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      kind: "list",
      ordered: false,
      items: [
        [{ kind: "text", text: "first" }],
        [{ kind: "text", text: "second" }],
        [{ kind: "text", text: "third" }],
      ],
    });
  });

  test("numbered items build an ordered list and stop at prose", () => {
    const blocks = parseBlocks("1. alpha\n2) beta\nafter the list");
    expect(blocks.map((block) => block.kind)).toEqual(["list", "paragraph"]);
    expect((blocks[0] as { ordered: boolean }).ordered).toBe(true);
  });

  test("paragraph followed by a list splits without an empty paragraph", () => {
    const blocks = parseBlocks("intro text\n- item one\n- item two");
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "list"]);
  });

  test("CRLF line endings normalise to LF", () => {
    const blocks = parseBlocks("a\r\nb\r\n\r\nc");
    expect(blocks.map((block) => block.kind)).toEqual(["paragraph", "paragraph"]);
    expect(texts((blocks[0] as { content: ReturnType<typeof parseInline> }).content)).toBe("a\nb");
  });

  test("every block kind is covered for a realistic model reply", () => {
    const reply = [
      "## Result",
      "",
      "The highest **hardness** is `6.2 GPa`:",
      "",
      "- GlassA — 6.2 GPa",
      "- GlassB — 4.1 GPa",
      "",
      "See [the docs](https://example.com).",
    ].join("\n");
    const kinds = parseBlocks(reply).map((block: Block) => block.kind);
    expect(kinds).toEqual(["heading", "paragraph", "list", "paragraph"]);
  });
});
