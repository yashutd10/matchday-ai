import type { Fixture, Form, Team } from "@/lib/fixtures";

export function Crest({ team, size = "md", ring }: { team: Team; size?: "md" | "lg"; ring?: string }) {
  const dims = size === "lg" ? "h-16 w-16 text-xl" : "h-14 w-14 text-lg";
  return (
    <div
      className={`${dims} flex items-center justify-center rounded-full border-2 bg-[#1e2632] font-display font-bold`}
      style={{ borderColor: ring ?? "#2e3947" }}
    >
      {team.short}
    </div>
  );
}

export function ProbBar({ probs, labels }: { probs: Fixture["probs"]; labels: [string, string] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
        <div className="bg-home" style={{ width: `${probs.home}%` }} />
        <div className="bg-[#5b6573]" style={{ width: `${probs.draw}%` }} />
        <div className="bg-away" style={{ width: `${probs.away}%` }} />
      </div>
      <div className="flex justify-between text-xs text-soft">
        <span>{labels[0]} {probs.home}%</span>
        <span>Draw {probs.draw}%</span>
        <span>{labels[1]} {probs.away}%</span>
      </div>
    </div>
  );
}

const formColor: Record<Form, string> = { W: "bg-[#1f6b46]", D: "bg-[#3a4350]", L: "bg-[#8a2e2e]" };

export function FormRow({ name, form }: { name: string; form: Form[] }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{name}</span>
      <div className="flex gap-1.5">
        {form.map((r, i) => (
          <span key={i} className={`${formColor[r]} flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold`}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatBar({ label, home, away, suffix = "" }: Fixture["stats"][number]) {
  const total = home + away;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{home}{suffix}</span>
        <span className="text-muted">{label}</span>
        <span className="font-semibold">{away}{suffix}</span>
      </div>
      <div className="flex h-1.5 gap-1">
        <div className="rounded-full bg-home" style={{ width: `${(home / total) * 100}%` }} />
        <div className="rounded-full bg-away" style={{ width: `${(away / total) * 100}%` }} />
      </div>
    </div>
  );
}
