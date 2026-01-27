import DashboardFrame from "@/src/components/dashboard/DashboardFrame";
import { navForRole } from "@/src/app/config/nav";
import "@/src/styles/soft-ui.css";

export default async function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = navForRole("restaurant") ?? [];

  return (
    <DashboardFrame
      nav={nav}
      title="Yüksi Panel"
      headerClass="bg-orange-500 border-orange-400 text-white"
      titleClass="font-extrabold"
    >
      {children}
    </DashboardFrame>
  );
}
