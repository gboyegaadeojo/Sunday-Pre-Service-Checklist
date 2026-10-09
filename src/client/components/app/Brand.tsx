export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-control bg-accent text-[11px] font-bold tracking-wide text-white"
      >
        IFC
      </span>
      <p className="leading-tight">
        <span className="block text-sm font-semibold">IFC Production</span>
        <span className="block text-meta text-fg-muted">Pre-Service Checklist</span>
      </p>
    </div>
  );
}
