import { Suspense } from "react";
import { AskChat } from "@/components/ask-chat";

async function Chat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <AskChat initialQuestion={q ?? ""} />;
}

export default function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 pt-8 pb-6 md:px-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold leading-none md:text-6xl">Ask AI</h1>
        <p className="text-sm text-soft md:text-base">Ask anything about this Premier League season. Answers use the live table and this week&apos;s fixtures.</p>
      </div>
      <Suspense fallback={<AskChat />}>
        <Chat searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
