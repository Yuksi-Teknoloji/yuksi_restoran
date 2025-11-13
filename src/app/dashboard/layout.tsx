// src/app/dashboards/[role]/admin/layout.tsx
import DashboardShell from "@/src/components/dashboard/Shell";
import Header from "@/src/components/dashboard/Header";
import Sidebar from "@/src/components/dashboard/Sidebar";
import { navForRole } from "@/src/app/config/nav";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { decodeJwt, isExpired, roleSegment } from "@/src/utils/jwt";
import "@/src/styles/soft-ui.css";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/");
  }

  const claims = decodeJwt(token);

  if (!claims || isExpired(claims)) {
    redirect("/");
  }

  const role = String(roleSegment(claims.userType) || "").toLowerCase();

  if (role !== "restaurant") {
    redirect("/");
  }

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
