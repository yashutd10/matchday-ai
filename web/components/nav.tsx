"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Matches", d: "M3 4h18v17H3zM3 9h18M8 2v4M16 2v4" },
  { href: "/table", label: "Table", d: "M3 5h18M3 12h18M3 19h18M8 5v14" },
  { href: "/stats", label: "Players", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" },
  { href: "/ask", label: "Ask AI", d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { href: "/accuracy", label: "Accuracy", d: "M3 3v18h18M7 15l4-4 3 3 5-6" },
];

const profile = { href: "/profile", label: "Your team", d: "M12 2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 16.8 6.1 20l1.3-6.5L2.5 8.9l6.6-.8z" };

export const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const isActive = (path: string, href: string) => (href === "/" ? path === "/" || path.startsWith("/match") : path.startsWith(href));

export function TopBar() {
  return <TopBarView path={usePathname()} />;
}

export function TopBarView({ path }: { path: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#1e2632] bg-pitch/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:h-[72px] md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-lime text-pitch">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></svg>
          </span>
          <span className="font-display text-2xl font-bold tracking-wide">MATCHDAY AI</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {items.map((item) => {
            const active = isActive(path, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${active ? "bg-card font-semibold text-lime" : "text-muted hover:bg-card hover:text-ink"}`}>
                <Icon d={item.d} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href={profile.href}
          aria-label={profile.label}
          aria-current={isActive(path, profile.href) ? "page" : undefined}
          className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-sm transition ${isActive(path, profile.href) ? "border-lime/50 text-lime" : "border-line bg-card text-soft hover:text-ink"}`}
        >
          <Icon d={profile.d} size={18} />
          <span className="hidden sm:inline">{profile.label}</span>
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  return <BottomNavView path={usePathname()} />;
}

export function BottomNavView({ path }: { path: string }) {
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-5 border-t border-[#1e2632] bg-[#0e131a] px-2 pt-2 pb-5 text-[11px] lg:hidden">
      {items.map((item) => {
        const active = isActive(path, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 py-1.5 ${active ? "font-semibold text-lime" : "text-muted"}`}>
            <Icon d={item.d} size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AskBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/ask" className="flex flex-col gap-1.5">
      <label htmlFor="ask" className="text-xs text-muted">Ask the AI analyst</label>
      <div className="flex items-center gap-2 rounded-[14px] border border-[#2a3441] bg-card py-1 pr-1 pl-3.5 focus-within:border-lime/60">
        <input id="ask" name="q" type="text" required defaultValue={defaultValue} placeholder="Why do Spurs drop points after Europe?" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8a94a3]" />
        <button type="submit" aria-label="Send question" className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-lime text-pitch transition hover:brightness-110 active:scale-95">
          <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4z" size={18} />
        </button>
      </div>
    </form>
  );
}
