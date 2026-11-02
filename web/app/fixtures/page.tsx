import type { Metadata } from "next";
import { getSeasonFixtures } from "@/lib/football";
import { FixturesBrowser } from "@/components/fixtures-browser";

export const metadata: Metadata = { title: "Fixtures & Results" };

export default async function FixturesPage() {
  const data = await getSeasonFixtures();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Fixtures &amp; Results</h1>
        <p className="text-sm text-soft md:text-base">Every gameweek this season. Results show what the AI predicted before kickoff; upcoming matches show its current call. Times in IST.</p>
      </div>
      {data ? (
        <FixturesBrowser gameweeks={data.gameweeks} current={data.current} />
      ) : (
        <p className="text-soft">Fixtures need live data. Add your football-data.org key to <code className="text-lime">.env.local</code> and restart the server.</p>
      )}
    </main>
  );
}
