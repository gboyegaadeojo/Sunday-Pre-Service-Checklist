// Compact top bar (design.md §3A). User, role and service date are added in the stages that provide them.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-line bg-panel">
      <div className="mx-auto flex h-full max-w-app items-center gap-3 px-4 md:px-6">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-control bg-accent text-[11px] font-bold tracking-wide text-white"
        >
          IFC
        </span>
        <p className="leading-tight">
          <span className="block text-sm font-semibold">IFC Production</span>
          <span className="block text-meta text-fg-muted">Pre-Service Checklist</span>
        </p>
      </div>
    </header>
  );
}
