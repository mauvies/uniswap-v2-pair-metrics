import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-[16px] pt-[16px] md:px-[42px] md:pt-[23px]">{children}</main>
      </div>
    </div>
  );
}
