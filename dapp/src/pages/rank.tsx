import React from 'react';
import DefaultLayout from "@/layouts/default";
import { RankingBoard } from '@/components/ranking/RankingBoard';
import { title } from "@/components/primitives";

export default function RankPage() {
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-6 py-6 md:py-8">
        {/* 页面标题 */}
        <div className="inline-block max-w-4xl text-center justify-center">
          <h1 className={title()}>🏆 交易排行榜</h1>
          <p className="text-default-500 mt-4">
            基于公开余额的实时交易排名，展示交易高手的真实实力
          </p>
        </div>

        {/* 排行榜内容 */}
        <div className="w-full max-w-6xl px-4">
          <RankingBoard />
        </div>
      </section>
    </DefaultLayout>
  );
}
