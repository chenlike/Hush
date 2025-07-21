import type { Route } from "./+types/home";
import { Navbar } from "../components/navbar";
import { TradingInterface } from "../components/trading-interface";
import { StatusDisplay } from "../components/status-display";
import { Instructions } from "../components/instructions";
import { BalanceDisplay } from "../components/balance-display";
import { useState } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hush Trading" },
    { name: "description", content: "隐私保护的加密货币交易平台" },
  ];
}

export default function Home() {
  const [status, setStatus] = useState<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {status && (
        <StatusDisplay
          message={status.message}
          type={status.type}
          onClose={() => setStatus(null)}
        />
      )}
      <div className="container mx-auto px-4 py-8">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            隐私保护交易平台
          </h1>
          <p className="text-muted-foreground text-lg">
            使用全同态加密技术保护您的交易隐私
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TradingInterface />
            <div className="mt-6">
              <BalanceDisplay />
            </div>
          </div>
          <div>
            <Instructions />
          </div>
        </div>
      </div>
    </div>
  );
}
