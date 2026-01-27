"use client";

import { useEffect, useState } from "react";
import type { NavGroup } from "@/src/types/roles";
import DashboardShell from "@/src/components/dashboard/Shell";
import Header from "@/src/components/dashboard/Header";
import Sidebar from "@/src/components/dashboard/Sidebar";

type DashboardFrameProps = {
  nav: NavGroup[];
  children: React.ReactNode;
  title: string;
  titleClass?: string;
  headerClass?: string;
  userLabel?: string;
};

export default function DashboardFrame({
  nav,
  children,
  title,
  titleClass = "",
  headerClass = "",
  userLabel = "Hesabım",
}: DashboardFrameProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="min-h-dvh bg-neutral-100 flex">
      {/* Overlay: sadece mobilde sidebar açıkken */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        nav={nav}
        open={sidebarOpen}
        onClose={isMobile ? () => setSidebarOpen(false) : undefined}
      />

      <div className="flex-1 orange-ui min-w-0">
        <Header
          title={title}
          titleClass={titleClass}
          headerClass={headerClass}
          userLabel={userLabel}
          onSidebarToggle={() => setSidebarOpen((v) => !v)}
        />
        <main className="px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <DashboardShell>{children}</DashboardShell>
          </div>
        </main>
      </div>
    </div>
  );
}
