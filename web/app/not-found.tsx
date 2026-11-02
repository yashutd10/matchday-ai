import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start justify-center gap-4 px-5 py-16 md:px-8">
      <span className="font-display text-8xl font-bold leading-none text-lime">0 – 4</span>
      <h1 className="font-display text-4xl font-bold">This page got relegated</h1>
      <p className="text-soft">The match or page you&apos;re looking for isn&apos;t here. Old fixtures disappear once a gameweek is played.</p>
      <Link href="/" className="flex h-12 items-center rounded-[14px] bg-lime px-5 font-semibold text-pitch transition hover:brightness-110">Back to this weekend</Link>
    </main>
  );
}
