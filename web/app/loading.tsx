export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 animate-pulse flex-col gap-6 px-5 pt-8 pb-10 md:px-8 md:pt-12" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-40 rounded bg-card" />
      <div className="h-12 w-72 rounded-xl bg-card" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="h-96 rounded-[20px] bg-card" />
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-28 rounded-2xl bg-card" />)}
        </div>
      </div>
    </main>
  );
}
