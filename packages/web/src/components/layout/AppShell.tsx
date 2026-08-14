import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-[16px] md:pl-[42px] md:pr-[50px] md:pt-[23px] md:pb-[45px]">
          {children}
        </main>
      </div>
    </div>
  );
}
