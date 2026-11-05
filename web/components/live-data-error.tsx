/**
 * Shown when live football data didn't load.
 * Two different causes, two different messages:
 * - no API key set up (only happens on a fresh install)
 * - the key is fine but football-data.org didn't answer in time (usually its
 *   free-plan limit of 10 requests a minute). This fixes itself, so say so.
 */
export function LiveDataError({ what }: { what: string }) {
  if (!process.env.FOOTBALL_DATA_KEY) {
    return (
      <p className="text-soft">
        {what} need live data. Add your football-data.org key to <code className="text-lime">.env.local</code> and restart the server.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-5">
      <p className="font-semibold">Live data is busy right now</p>
      <p className="text-sm text-soft">
        Couldn&apos;t load the {what.toLowerCase()} from football-data.org just now (its free plan allows 10 requests a minute). Refresh in a minute and it&apos;ll be back.
      </p>
    </div>
  );
}
