import type { MouseEvent, ReactNode } from "react";
import { ROUTE_PATHS, type Route } from "../../lib/router";

interface Props {
  to: Route;
  current: boolean;
  onNavigate: (route: Route) => void;
  className: string;
  children: ReactNode;
}

/** A real link to an app route: in-app navigation on a plain click; new tab/window still work. */
export function RouteLink({ to, current, onNavigate, className, children }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(to);
  };
  return (
    <a href={ROUTE_PATHS[to]} onClick={onClick} aria-current={current ? "page" : undefined} className={className}>
      {children}
    </a>
  );
}
