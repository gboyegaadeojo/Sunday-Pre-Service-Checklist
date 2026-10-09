import { Button } from "./Button";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-fg-muted">
      <span aria-hidden="true" className="size-4 motion-safe:animate-spin rounded-full border-2 border-line border-t-accent-soft" />
      {label}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-card border border-danger/40 bg-danger/10 p-5">
      <p className="font-semibold text-fg">{title}</p>
      <p className="mt-1 text-sm text-fg-muted">{message}</p>
      {onRetry && (
        <Button className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-10 text-center">
      <p className="font-medium text-fg">{title}</p>
      {message && <p className="mt-1 text-sm text-fg-muted">{message}</p>}
    </div>
  );
}
