import Link from "next/link";

export function TableTabs({ active }: { active: "current" | "predicted" }) {
  const tab = (key: "current" | "predicted", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex h-11 items-center rounded-xl px-4 text-sm font-semibold transition ${active === key ? "bg-lime text-pitch" : "text-soft hover:text-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Table view" className="flex w-fit gap-1 rounded-2xl border border-line bg-card p-1">
      {tab("current", "/table", "Current")}
      {tab("predicted", "/table/predicted", "Predicted")}
    </nav>
  );
}

export const teamHref = (tla: string) => `/team/${tla.toLowerCase()}`;
