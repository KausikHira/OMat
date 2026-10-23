import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { Markdown } from "./markdown";

/**
 * Markup-level assertions stand in for visual verification (this repo does
 * not allow browser screenshots): the renderer must emit real elements and
 * never leak raw markdown syntax or unsafe anchors.
 */
describe("Markdown", () => {
  test("renders elements instead of raw markdown syntax", () => {
    const html = renderToStaticMarkup(<Markdown text={"## Summary\n\n- **bold** item\n- plain"} />);
    expect(html).toContain("<h4");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>");
    expect(html).not.toContain("**");
    expect(html).not.toContain("##");
  });

  test("code fences render as pre/code with the body intact", () => {
    const html = renderToStaticMarkup(<Markdown text={"```python\nx = 1\n```"} />);
    expect(html).toContain("<pre");
    expect(html).toContain("x = 1");
    expect(html).not.toContain("```");
  });

  test("http(s) links become anchors; unsafe schemes stay text", () => {
    const safe = renderToStaticMarkup(<Markdown text={"[docs](https://example.com)"} />);
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain('rel="noopener noreferrer"');

    const unsafe = renderToStaticMarkup(<Markdown text={"[x](javascript:alert(1))"} />);
    expect(unsafe).not.toContain("<a");
    expect(unsafe).not.toContain("href=");
  });
});
