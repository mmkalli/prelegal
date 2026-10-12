type Props = {
  /** "light" for dark backgrounds. */
  tone?: "dark" | "light";
  className?: string;
};

export function Logo({ tone = "dark", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-brand-yellow text-sm font-bold text-brand-navy">
        P
      </span>
      <span className={tone === "light" ? "text-white" : "text-brand-navy"}>
        Pre<span className="text-brand-blue">legal</span>
      </span>
    </span>
  );
}
