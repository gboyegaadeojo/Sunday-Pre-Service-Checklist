/** "+ Add …" button used at the end of each level of the editor. 44px tall. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-medium text-accent-soft transition-colors hover:bg-hover"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
        <path fill="currentColor" d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
      </svg>
      {label}
    </button>
  );
}
