const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** Planning Center avatar when available (Stage 9), otherwise initials. Decorative: the name is always shown nearby. */
export function Avatar({ name, url, className = "size-8" }: { name: string; url: string | null; className?: string }) {
  if (url) return <img src={url} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full border border-line bg-hover text-xs font-semibold text-fg ${className}`}
    >
      {initials(name)}
    </span>
  );
}
