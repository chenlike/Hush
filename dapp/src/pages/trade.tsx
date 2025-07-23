import { title } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";
import RegistrationStatus from "@/components/registration-status";

export default function DocsPage() {
  return (
    <DefaultLayout>

        {/* 注册状态组件 */}
        <div className="w-full max-w-4xl">
          <RegistrationStatus />
        </div>

    </DefaultLayout>
  );
}
