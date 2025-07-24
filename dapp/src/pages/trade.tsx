import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import RegistrationStatus from "@/components/registration-status";
import { TradingExample } from "@/components/trading-example";

export default function TradePage() {
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-8 py-8 md:py-10">
        <div className="inline-block max-w-4xl text-center justify-center">
          <h1 className={title()}>交易竞赛</h1>
          <p className="text-default-500 mt-4">
            使用同态加密技术进行安全的私密交易
          </p>
        </div>

        <div className="w-full max-w-4xl space-y-8">
          {/* 注册状态组件 */}
          <div className="flex justify-center">
            <RegistrationStatus />
          </div>

          {/* 交易示例组件 */}
          <div className="flex justify-center">
            <TradingExample />
          </div>
        </div>
      </section>
    </DefaultLayout>
  );
}
