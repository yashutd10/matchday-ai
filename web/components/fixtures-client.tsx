"use client";

import { useEffect, useState } from "react";
import { useFavourite } from "@/components/favourite";

export function FavBadge({ tlas }: { tlas: string[] }) {
  const fav = useFavourite();
  if (!fav || !tlas.includes(fav)) return null;
  return <span className="mr-auto rounded-full bg-lime px-2 py-0.5 text-[10px] font-semibold text-pitch">YOUR TEAM</span>;
}

/**
 * "Starts in 10 days" / "This weekend" / "Today" for the next gameweek.
 * Worked out in the browser (the page itself is cached), so it's always right for the viewer's clock.
 */
export function StartsIn({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((day(new Date(iso)) - day(new Date())) / 86_400_000);
    setLabel(days <= 0 ? "Starts today" : days === 1 ? "Starts tomorrow" : `Starts in ${days} days`);
  }, [iso]);
  if (!label) return null;
  const soon = label === "Starts today" || label === "Starts tomorrow";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold md:text-xs ${soon ? "bg-lime text-pitch" : "bg-[#1e2632] text-soft"}`}>{label}</span>;
}

/** On phones the gameweek strip scrolls sideways; keep the selected week in view. */
export function ScrollActiveIntoView({ containerId }: { containerId: string }) {
  useEffect(() => {
    const strip = document.getElementById(containerId);
    const active = strip?.querySelector<HTMLElement>("[data-active]");
    if (strip && active && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    }
  });
  return null;
}
