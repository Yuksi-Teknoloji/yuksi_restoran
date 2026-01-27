"use client";

import * as React from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = [
  "#EB75D9",
  "#EB8175",
  "#EB7593",
  "#CE75EB",
  "#DA91ED",
  "#525B57",
  "#DF5ADA",
  "#D95F7E",
];

enum TypeTR {
  couriers = "Kurye",
  restaurants = "Restoran",
  admins = "Admin",
  dealers = "Bayi",
}

export function ChartPie({ data, title }: { data: Record<string, number>; title: string }) {
  const chart_data = Object.entries(data)
    .filter(([name]) => name !== "total")
    .map(([name, value]) => ({
      name,
      value,
    }));

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-white shadow sm:max-w-[500px]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 sm:px-4">
        <span className="text-sm font-medium sm:text-base">{title}</span>
        <span className="rounded bg-neutral-100 px-2 py-1 text-xs sm:px-2.5 sm:py-1 sm:text-sm">
          Toplam: {data.total}
        </span>
      </div>
      <div className="h-[220px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chart_data}
              dataKey="value"
              nameKey="name"
              label={true}
              innerRadius="50%"
            >
              {chart_data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                value,
                TypeTR[name as keyof typeof TypeTR] ?? name,
              ]}
            />
            <Legend formatter={(name) => TypeTR[name as keyof typeof TypeTR] ?? name} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
