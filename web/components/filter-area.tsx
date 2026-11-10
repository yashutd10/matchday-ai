"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
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
  const box = useRef<HTMLDivElement>(null);

  const go = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") params.set(k, v);
    const qs = params.toString();
    start(() => router.push(qs ? `${path}?${qs}` : path, { scroll: false }));
  };

  // A change made before the page finished loading (slow phones) never reached the handler above.
  // Once ready, if any box differs from what the page was rendered with, apply it now.
  useEffect(() => {
    const form = box.current?.querySelector("form");
    if (!form) return;
    const changed = [...form.elements].some((el) =>
      el instanceof HTMLSelectElement
        ? [...el.options].some((o) => o.selected !== o.defaultSelected)
        : el instanceof HTMLInputElement && el.type === "checkbox"
          ? el.checked !== el.defaultChecked
          : false,
    );
    if (changed) go(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={box}
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
