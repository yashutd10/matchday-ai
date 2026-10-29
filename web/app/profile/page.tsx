import { getTeams } from "@/lib/football";
import { TeamPicker } from "@/components/favourite";

export default async function ProfilePage() {
  const teams = await getTeams();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Profile</h1>
        <p className="text-sm text-soft md:text-base">Pick your team and their match shows up first on the home page. Saved in this browser.</p>
      </div>
      <TeamPicker teams={teams} />
    </main>
  );
}
