"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  Tooltip,
  LineChart,
  XAxis,
  YAxis,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
  Cell,
} from "recharts";

function getDays(s: string | number | Date, e: string | number | Date) {
  const arr = [];
  let d = new Date(s);
  while (d < new Date(e)) {
    console.log(d);
    arr.push(d.toISOString().substring(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

interface ChartLineProps {
  startDate: string | number | Date;
  endDate: string | number | Date;
  option: string;
  data: {
    orders: Array<{
      created_at: string;
      amount: string | number;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
}

export function ChartLine({ startDate, endDate, option, data }: ChartLineProps) {
  let chart_data;

  if (option === "daily") {
    chart_data =
      data.orders.length == 0
        ? [{ name: "00:00", value: 0 }]
        : data.orders
            .slice()
            .reverse()
            .map((o) => ({
              name: o.created_at.slice(11, 19) || "null",
              value: parseFloat(String(o.amount)) || 0,
            }));
  } else {
    const incomeByDay = data.orders.reduce((acc: { [key: string]: number }, o) => {
      const day = o.created_at.slice(0, 10);
      const amt = parseFloat(String(o.amount)) || 0;
      acc[day] = (acc[day] || 0) + amt;
      return acc;
    }, {});

    chart_data = getDays(startDate, endDate).map((date) => ({
      name: date,
      value: incomeByDay[date] ?? 0,
    }));
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chart_data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value, name) => [value + " tl", name]} />
        <CartesianGrid />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#8884d8"
          strokeWidth={2}
          dot={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

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

enum StatusTr {
  hazirlaniyor = "Hazırlanıyor",
  kurye_reddetti = "Kurye reddetti",
  kuryeye_istek_atildi = "Kuryeye istek atıldı",
  kuryeye_verildi = "Kuryeye verildi",
  siparis_havuza_atildi = "Sipariş havuza atıldı",
  teslim_edildi = "Teslim edildi",
}

interface ChartPieProps {
  data: Array<{ status: string; [key: string]: any }>;
  title?: string;
}

export function ChartPie({ data, title }: ChartPieProps) {
  const orderByStatus = data.reduce((acc: { [key: string]: number }, o) => {
    const status = o.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const chart_data = Object.entries(orderByStatus).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="w-full max-w-[500px] h-[300px] bg-white rounded-md shadow">
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
              StatusTr[name as keyof typeof StatusTr] ?? name,
            ]}
          />
          <Legend formatter={(name) => StatusTr[name as keyof typeof StatusTr] ?? name}></Legend>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
