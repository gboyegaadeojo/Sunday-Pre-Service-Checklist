// Small inline icons. Decorative: always paired with text.

export function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path
        fill="currentColor"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
      />
    </svg>
  );
}

export function AlertIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path
        fill="currentColor"
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4a1 1 0 0 1 1 1v3.5a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Zm0 8.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z"
      />
    </svg>
  );
}
