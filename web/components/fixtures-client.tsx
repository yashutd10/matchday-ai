"use client";

import { useEffect } from "react";
import { useFavourite } from "@/components/favourite";

export function FavBadge({ tlas }: { tlas: string[] }) {
  const fav = useFavourite();
  if (!fav || !tlas.includes(fav)) return null;
  return <span className="mr-auto rounded-full bg-lime px-2 py-0.5 text-[10px] font-semibold text-pitch">YOUR TEAM</span>;
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
