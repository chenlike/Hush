import { Link } from "@heroui/link";

import { Navbar } from "@/components/navbar";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-7xl px-6 flex-grow pt-16 bg-background">
        {children}
      </main>
      <footer className="w-full flex items-center justify-center py-3 bg-background">
        {/* <Link
          isExternal
          className="flex items-center gap-1 text-current"
          href="https://github.com/chenlike/Hush"
          title="repo"
        >
          <span className="text-default-600">Open Source in </span>
          <p className="text-primary">Github</p>
        </Link> */}
      </footer>
    </div>
  );
}
