"use client";

import { useEffect, useRef, useState } from "react";

import type { SearchState } from "@/lib/search";
import { ArrowRightIcon, SearchIcon } from "./icons";

type SearchFormProps = {
  defaultValue?: string;
  autoFocus?: boolean;
  compact?: boolean;
  preserve?: Pick<SearchState, "elements" | "applications" | "property" | "journal" | "sort">;
};

export function SearchForm({
  defaultValue = "",
  autoFocus = false,
  compact = false,
  preserve,
}: SearchFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      action="/search"
      method="get"
      aria-label="Search measurements"
      className={`search-field flex items-center border border-line-strong bg-panel ${
        compact ? "h-11 rounded-[9px] pl-3 pr-1.5" : "h-[3.65rem] rounded-xl pl-4 pr-2"
      }`}
    >
      <SearchIcon className={`shrink-0 text-muted ${compact ? "size-[18px]" : "size-5"}`} />
      <label htmlFor="q" className="sr-only">
        Search measurements
      </label>
      <input
        ref={inputRef}
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="Composition, property, or DOI"
        className={`min-w-0 flex-1 bg-transparent text-ink outline-none ${
          compact ? "px-2.5 text-base sm:text-[15px]" : "px-3 text-base"
        }`}
      />
      {preserve?.elements.map((element) => (
        <input key={element} type="hidden" name="element" value={element} />
      ))}
      {preserve?.applications.map((application) => (
        <input key={application} type="hidden" name="application" value={application} />
      ))}
      {preserve?.property ? (
        <input type="hidden" name="property" value={preserve.property} />
      ) : null}
      {preserve?.journal ? <input type="hidden" name="journal" value={preserve.journal} /> : null}
      {preserve?.sort && preserve.sort !== "relevance" ? (
        <input type="hidden" name="sort" value={preserve.sort} />
      ) : null}
      <button
        type="submit"
        aria-label="Search"
        className={`inline-flex shrink-0 items-center justify-center rounded-[7px] bg-accent text-accent-ink transition-opacity hover:opacity-85 ${
          compact ? "size-9" : "size-10"
        }`}
      >
        <ArrowRightIcon className={compact ? "size-4" : "size-[18px]"} />
      </button>
    </form>
  );
}
