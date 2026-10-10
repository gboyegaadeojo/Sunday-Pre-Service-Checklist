import type { MouseEvent, ReactNode } from "react";
import { type Navigate, ROUTE_PATHS, type Route } from "../../lib/router";

interface Props {
  to: Route;
  current: boolean;
  onNavigate: Navigate;
  /** Query string to carry, e.g. "?list=5". */
  search?: string;
  className: string;
  children: ReactNode;
  /** e.g. "menuitem" inside the account menu. */
  role?: string;
}

/** A real link to an app route: in-app navigation on a plain click; new tab/window still work. */
export function RouteLink({ to, current, onNavigate, search = "", className, children, role }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(to, search);
  };
  return (
    <a href={ROUTE_PATHS[to] + search} onClick={onClick} aria-current={current ? "page" : undefined} className={className} role={role}>
      {children}
    </a>
  );
}
