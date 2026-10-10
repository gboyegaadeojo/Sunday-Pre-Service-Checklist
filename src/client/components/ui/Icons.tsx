// Small inline icons. Decorative: always paired with text.

import type { ReactNode } from "react";

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

export function InfoIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path
        fill="currentColor"
        d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM10 9a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

/** Outline icons for the Admin menu (design.md §7), drawn on a 20px grid with a 1.5px stroke. */
function Outline({ className = "size-5", children }: { className?: string; children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export const OverviewIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
    <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
    <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
    <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1" />
  </Outline>
);

export const ChecklistIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="m3 5 1.5 1.5L7 4M3 11l1.5 1.5L7 10M10 5.5h7M10 11.5h7M10 16h7M3.5 16h2" />
  </Outline>
);

export const ListsIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="m10 3 7 3.5-7 3.5-7-3.5L10 3Z" />
    <path d="m3 10 7 3.5 7-3.5M3 13.5 10 17l7-3.5" />
  </Outline>
);

export const MappingIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <rect x="2.5" y="3" width="6" height="5" rx="1" />
    <rect x="11.5" y="12" width="6" height="5" rx="1" />
    <path d="M5.5 8v3.5a1 1 0 0 0 1 1H11.5" />
  </Outline>
);

export const UsersIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <circle cx="7.5" cy="7" r="2.75" />
    <path d="M2.5 16.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" />
    <path d="M13 4.6a2.6 2.6 0 0 1 0 4.8M15 12.8c1.3.6 2.1 1.9 2.5 3.7" />
  </Outline>
);

export const ActivityIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="M2.5 10h3l2-5 3.5 10 2-5h4.5" />
  </Outline>
);

export const HistoryIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="M3.5 10a6.5 6.5 0 1 0 1.9-4.6M3.5 3.5v3h3" />
    <path d="M10 6.5V10l2.5 1.5" />
  </Outline>
);

export const ChurchSettingsIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <circle cx="10" cy="10" r="2.5" />
    <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
  </Outline>
);

export const SignOutIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="M8 3.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8M12.5 6.5 16 10l-3.5 3.5M16 10H7.5" />
  </Outline>
);

export const PreferencesIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="M3.5 6h6M13.5 6h3M3.5 14h3M10.5 14h6" />
    <circle cx="11.5" cy="6" r="2" />
    <circle cx="8.5" cy="14" r="2" />
  </Outline>
);

export const MoonIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <path d="M16.5 11.8A6.5 6.5 0 0 1 8.2 3.5a6.5 6.5 0 1 0 8.3 8.3Z" />
  </Outline>
);

export const SunIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <circle cx="10" cy="10" r="3.25" />
    <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.06 1.06M14.24 14.24l1.06 1.06M4.7 15.3l1.06-1.06M14.24 5.76l1.06-1.06" />
  </Outline>
);

export const MonitorIcon = ({ className }: { className?: string }) => (
  <Outline className={className}>
    <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
    <path d="M7 16.5h6M10 13.5v3" />
  </Outline>
);
