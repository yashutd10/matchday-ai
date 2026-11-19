import Link from "next/link";
import type { ReactNode } from "react";
import { fullName, playerHref, teamColor, teamName } from "@/lib/ipl";

export function TeamBadge({ code, size = "md" }: { code: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14 text-base" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-[11px]";
  return (
    <span className={`${dims} flex shrink-0 items-center justify-center rounded-full border-2 bg-[#1e2632] font-display font-bold`} style={{ borderColor: teamColor(code) }}>
      {code}
    </span>
  );
}

export const teamHref = (code: string) => `/ipl/team/${code.toLowerCase()}`;

export function TeamLink({ code, full, className = "" }: { code: string; full?: boolean; className?: string }) {
  return <Link href={teamHref(code)} className={`hover:text-lime ${className}`}>{full ? teamName(code) : code}</Link>;
}

/** Player name, linked to his page when he has one (active in the last three seasons). */
export function PlayerName({ name, className = "" }: { name: string; className?: string }) {
  const href = playerHref(name);
  return href ? <Link href={href} className={`hover:text-lime hover:underline ${className}`}>{fullName(name) ?? name}</Link> : <span className={className}>{fullName(name) ?? name}</span>;
}

/** 0–99 rating chip. Colour says how good; "–" means too few balls to rate. */
export function Rating({ value, size = "md", active }: { value: number | undefined; size?: "md" | "lg"; active?: boolean }) {
  const dims = size === "lg" ? "h-11 min-w-11 text-xl" : "h-7 min-w-8 text-sm";
  if (value === undefined) return <span className={`${dims} inline-flex items-center justify-center rounded-lg text-muted`} title="Not enough balls to rate">–</span>;
  const tone = value >= 85 ? "bg-lime text-pitch" : value >= 65 ? "bg-[#1f6b46] text-ink" : value >= 40 ? "bg-[#1e2632] text-ink" : "bg-[#1e2632] text-muted";
  return <span className={`${dims} inline-flex items-center justify-center rounded-lg px-1 font-display font-bold ${tone} ${active ? "outline outline-2 outline-offset-1 outline-lime/60" : ""}`}>{value}</span>;
}

export function PageHeader({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-soft md:text-base">{intro}</p>
      </div>
      {children}
    </div>
  );
}

export const card = "rounded-[18px] border border-line bg-card";
export const main = "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:gap-8 md:px-8 md:pt-12";
