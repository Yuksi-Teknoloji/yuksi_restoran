"use client";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useState } from "react";
import type { NavGroup } from "@/src/types/roles";
import { ChevronRight } from "lucide-react";

const ROLE_TITLES: Record<string, string> = {
  admin: "Admin",
  restaurant: "Restoran",
  dealer: "Bayi",
  corporate: "Kurumsal",
  marketing: "Pazarlama",
};

export default function Sidebar({ nav = [] as NavGroup[] }: { nav?: NavGroup[] }) {
  const pathname = usePathname();

  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(nav.map((g) => [g.title, true])) as Record<string, boolean>
  );

  return (
    <aside className="sticky top-0 h-dvh w-72 shrink-0 bg-white border-r border-neutral-200 flex flex-col overflow-hidden">
       {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2 h-8 overflow-visible">
          <img
            src="/Brand/yuksi.png"
            alt="Yüksi"
            className="h-28 w-[120px] object-containshrink-0 select-none"
            draggable={false}
          />
          <div className="text-lg font-semibold text-orange-600">Restoran Panel</div>
        </div>
      </div>

      {/* Scrollable area */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-4 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-neutral-300/60 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-track]:bg-transparent">
        {nav.map((group) => {
          const isOpen = open[group.title] ?? true;
          return (
            <div key={group.title} className="rounded-2xl">
              <button
                onClick={() => setOpen((s) => ({ ...s, [group.title]: !isOpen }))}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
              >
                <span className="text-sm font-semibold">{group.title}</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`} />
              </button>

              <ul className={`${isOpen ? "mt-2" : "hidden"} space-y-2 px-1`}>
                {group.items.map((it) => {
                  const href = `${it.href}`;
                  const isRootLink = it.href.replace(/^\/+|\/+$/g, "").split("/").length === 1;
                  const active = isRootLink ? pathname === href : pathname === href || pathname.startsWith(href + "/");

                  return (
                    <li key={it.href}>
                      <Link
                        href={href}
                        className={[
                          "flex items-center justify-between rounded-xl px-4 py-3 transition",
                          active ? "bg-orange-500 text-white shadow-sm" : "text-orange-600 hover:bg-orange-50",
                        ].join(" ")}
                      >
                        <span className="text-sm font-medium">{it.label}</span>
                        <ChevronRight className={`h-4 w-4 ${active ? "text-white" : "text-orange-500"}`} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
