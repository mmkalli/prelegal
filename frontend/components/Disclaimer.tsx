export const DISCLAIMER =
  "Documents created with Prelegal are drafts and are subject to legal review. " +
  "Prelegal is not a law firm and does not provide legal advice.";

/** The draft notice shown with every document. */
export function DraftNotice({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-2 rounded-md border border-brand-yellow/40 bg-brand-yellow/10 px-3 py-2 text-xs text-neutral-700 ${className}`}
    >
      <span aria-hidden className="font-bold text-brand-yellow">
        !
      </span>
      <span>
        <strong className="font-semibold">Draft.</strong> {DISCLAIMER}
      </span>
    </p>
  );
}
