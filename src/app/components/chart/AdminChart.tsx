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
    <div className="w-full max-w-[500px] h-[300px] bg-white rounded-md shadow">
      <div className="flex justify-between">
        <span className=" p-1">{title}</span>
        <span className="bg-gray-100 p-1 rounded">Toplam: {data.total}</span>
      </div>
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
          <Legend formatter={(name) => TypeTR[name as keyof typeof TypeTR] ?? name}></Legend>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
