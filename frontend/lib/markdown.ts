// Helpers for putting user-entered values into document markdown.

/** Shown in the document for terms that aren't filled in, so they can be completed by hand. */
export const BLANK = "\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_";

/** Escapes all ASCII punctuation so user text renders literally (no markdown, no raw HTML). */
export function escapeMarkdown(text: string): string {
  return text.replace(/[!-/:-@[-`{-~]/g, "\\$&");
}

/** For single-line contexts such as table cells and list items. */
export function inline(text: string, fallback = BLANK): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed ? escapeMarkdown(collapsed) : fallback;
}

/** For paragraph contexts: keeps the user's line breaks. */
export function block(text: string, fallback = BLANK): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(escapeMarkdown);
  return lines.length ? lines.join("  \n") : fallback;
}

export function formatYears(years: number): string {
  return `${years} year${years === 1 ? "" : "s"}`;
}

/** Formats an ISO date (YYYY-MM-DD) as e.g. "October 11, 2026" without timezone shifts. */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const [, year, month, day] = match.map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}
