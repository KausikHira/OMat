"use client";

import { useEffect, useRef, useState } from "react";

import { streamPaperChat } from "@omat/api-client";

import { type ChatMessage, offlinePaperReply } from "@/lib/paper-chat";
import type { PaperGroup } from "@/lib/papers";

type PaperChatProps = {
  paper: PaperGroup;
};

type Suggestion = { label: string; message: string };

function suggestionsFor(paper: PaperGroup): Suggestion[] {
  const first = paper.records[0];
  const suggestions: Suggestion[] = [
    { label: "Summarize this paper", message: "Summarize this paper and its properties." },
  ];
  if (first) {
    suggestions.push({
      label: `Highest ${first.property.name.toLowerCase()}?`,
      message: `Which composition has the highest ${first.property.name.toLowerCase()}?`,
    });
  }
  if (paper.records.length > 1) {
    const second = paper.records[1];
    if (second && second.composition !== first?.composition) {
      suggestions.push({
        label: `Values for ${second.composition}`,
        message: `What are the values for ${second.composition}?`,
      });
    }
  }
  return suggestions.slice(0, 3);
}

/**
 * Per-paper chat. The ↵ circle opens a side drawer whose conversation is
 * scoped to exactly this paper's indexed measurement records — no full-text
 * or other papers. Live mode streams from POST /v1/papers/{id}/chat; when the
 * API is unreachable the reply is built offline from the same records.
 */
export function PaperChat({ paper }: PaperChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const node = listRef.current;
    const last = messages.at(-1);
    if (node && last) {
      node.scrollTo({ top: node.scrollHeight });
    }
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) {
      return;
    }
    seqRef.current += 1;
    const userMessage: ChatMessage = { id: seqRef.current, role: "user", text: message };
    seqRef.current += 1;
    const pendingReply: ChatMessage = { id: seqRef.current, role: "assistant", text: "" };
    setMessages((current) => [...current, userMessage, pendingReply]);
    setInput("");
    setBusy(true);

    const append = (chunk: string) => {
      setMessages((current) => {
        const next = [...current];
        const last = next.at(-1);
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, text: last.text + chunk };
        }
        return next;
      });
    };

    let streamed = false;
    try {
      await streamPaperChat(paper.doi || paper.pii, message, (chunk) => {
        streamed = true;
        append(chunk);
      });
    } catch {
      // API unreachable or chat not configured: fall back to the offline
      // replies built from this paper's records only.
    }
    if (!streamed) {
      const reply = offlinePaperReply(paper, message);
      for (const chunk of reply.match(/[\s\S]{1,48}/g) ?? [reply]) {
        append(chunk);
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      setMessages((current) => {
        const next = [...current];
        const last = next.at(-1);
        if (last?.role === "assistant") {
          next[next.length - 1] = { ...last, text: reply, offline: true };
        }
        return next;
      });
    }
    setBusy(false);
  }

  const empty = messages.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Chat about ${paper.title}`}
        title="Chat about this paper"
        className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong bg-panel text-muted transition-colors hover:border-accent hover:bg-accent hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5"
          aria-hidden="true"
        >
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          <path d="m9 10-5 5 5 5" />
        </svg>
      </button>

      {open ? (
        <dialog
          open
          aria-modal="true"
          aria-label={`Chat about ${paper.title}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none justify-end border-0 bg-transparent p-0"
        >
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/25"
          />
          <aside
            className="relative flex h-full w-full max-w-[26rem] flex-col border-l border-line bg-canvas shadow-2xl"
            aria-label={`Chat about ${paper.title}`}
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
                  Paper chat · scoped to this paper
                </p>
                <h2 className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-5 text-ink">
                  {paper.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong text-muted transition-colors hover:bg-accent hover:text-accent-ink"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="size-3.5"
                  aria-hidden="true"
                >
                  <path d="m4 4 8 8m0-8-8 8" />
                </svg>
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {empty ? (
                <div className="space-y-3">
                  <p className="text-[12.5px] leading-6 text-muted">
                    Ask about this paper&apos;s {paper.records.length} indexed measurement
                    {paper.records.length === 1 ? "" : "s"} — every answer cites its record.
                  </p>
                  <div className="space-y-2">
                    {suggestionsFor(paper).map((suggestion) => (
                      <button
                        key={suggestion.message}
                        type="button"
                        onClick={() => void send(suggestion.message)}
                        className="block w-full rounded-[9px] border border-line bg-panel/60 px-3.5 py-2.5 text-left text-[12.5px] leading-5 text-ink transition-colors hover:border-accent"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%] rounded-[10px] bg-accent px-3.5 py-2.5 text-[12.5px] leading-5 text-accent-ink"
                          : "max-w-[92%] rounded-[10px] border border-line bg-panel px-3.5 py-2.5 text-[12.5px] leading-5 text-ink"
                      }
                    >
                      <p className="whitespace-pre-wrap">{message.text || "…"}</p>
                      {message.offline && message.text ? (
                        <p className="mt-1.5 text-[10px] uppercase tracking-[0.06em] text-muted">
                          offline · records only
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="border-t border-line px-4 py-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder={`Ask about ${paper.journal} ${paper.year} records…`}
                  className="max-h-28 flex-1 resize-none rounded-[9px] border border-line-strong bg-panel px-3 py-2 text-[12.5px] leading-5 text-ink outline-none placeholder:text-muted focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send message"
                  className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-accent text-accent-ink transition-opacity disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                    aria-hidden="true"
                  >
                    <path d="M8 13V3m0 0L4 7m4-4 4 4" />
                  </svg>
                </button>
              </div>
            </form>
          </aside>
        </dialog>
      ) : null}
    </>
  );
}
