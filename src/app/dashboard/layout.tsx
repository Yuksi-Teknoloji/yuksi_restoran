// src/app/dashboards/[role]/admin/layout.tsx
import DashboardShell from "@/src/components/dashboard/Shell";
import Header from "@/src/components/dashboard/Header";
import Sidebar from "@/src/components/dashboard/Sidebar";
import { navForRole } from "@/src/app/config/nav";
import "@/src/styles/soft-ui.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = navForRole("restaurant");

  return (
    <div className="min-h-dvh bg-neutral-100 flex">
      <Sidebar nav={nav} />
      <div className="flex-1 orange-ui">
        <Header
          title="Yüksi Panel"
          headerClass="bg-orange-500 border-orange-400 text-white"
          titleClass="font-extrabold"
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
