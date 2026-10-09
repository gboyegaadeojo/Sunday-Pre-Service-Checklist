import { useCallback, useEffect, useState } from "react";
import type { ChecklistResponse } from "../../shared/types";
import { getJson } from "../api";
import { CategoryCard } from "../components/CategoryCard";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; checklist: ChecklistResponse };

export function ChecklistPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", checklist: await getJson<ChecklistResponse>("/api/checklist") });
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-12">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-semibold">Pre-Service Checklist</h1>
        {state.status === "ready" && <p className="text-sm text-neutral-400">{state.checklist.list.name}</p>}
      </header>

      {state.status === "loading" && <p className="py-8 text-center text-neutral-400">Loading checklist…</p>}

      {state.status === "error" && (
        <div role="alert" className="rounded-lg border border-red-900 bg-red-950/50 p-4">
          <p className="mb-3 text-red-200">{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-11 rounded-md bg-neutral-800 px-4 font-medium hover:bg-neutral-700"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="space-y-3">
          {state.checklist.categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              expanded={expanded.has(category.id)}
              onToggle={() => toggle(category.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
