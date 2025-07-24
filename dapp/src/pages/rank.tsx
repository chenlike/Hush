import React from 'react';
import DefaultLayout from "@/layouts/default";
import { RankingBoard } from '@/components/ranking/RankingBoard';
import { title } from "@/components/primitives";

export default function RankPage() {
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-6 py-6 md:py-8">
        {/* Page title */}
        <div className="inline-block max-w-4xl text-center justify-center">
          <h1 className={title()}>🏆 Trading Leaderboard</h1>
          <p className="text-default-500 mt-4">
            Real-time trading ranking based on public balances, showcasing the true strength of trading experts
          </p>
        </div>

        {/* Leaderboard content */}
        <div className="w-full max-w-6xl px-4">
          <RankingBoard />
        </div>
      </section>
    </DefaultLayout>
  );
}
