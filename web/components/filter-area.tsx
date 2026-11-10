"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Wraps a GET filter form and its results.
 * - Changing a dropdown or checkbox applies the filters straight away (no Search tap needed).
 * - Search / Enter in the name box still works.
 * - Updates happen in place (no full page reload, scroll position kept).
 * - While new results load, anything marked `group-data-[pending]:…` fades, so stale results never look current.
 */
export function FilterArea({ path, children }: { path: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") params.set(k, v);
    const qs = params.toString();
    start(() => router.push(qs ? `${path}?${qs}` : path, { scroll: false }));
  };

  return (
    <div
      className="group flex flex-col gap-5"
      data-pending={pending || undefined}
      aria-busy={pending}
      onChange={(e) => {
        const t = e.target;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && t.type === "checkbox")) {
          if (t.form) go(t.form);
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.target as HTMLFormElement);
      }}
    >
      {children}
    </div>
  );
}
