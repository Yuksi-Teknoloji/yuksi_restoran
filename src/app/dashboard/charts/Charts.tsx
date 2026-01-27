"use client";
import * as React from "react";
import { ChartLine } from "@/src/components/chart/RestaurantChart";
import { getAuthToken } from "@/src/utils/auth";
import { useSearchParams } from "next/navigation";
import { ChartPie } from "@/src/components/chart/RestaurantChart";

async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : ({} as any);
  } catch {
    return txt as any;
  }
}

function getRawTokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const keys = ["auth_token", "token", "access_token", "auth", "jwt"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (typeof v === "string" && v.trim())
      return v.replace(/^Bearer\s+/i, "").trim();
  }
  return null;
}

function b64urlDecode(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  if (pad) s += "=".repeat(pad);
  try {
    return atob(s);
  } catch {
    return "";
  }
}

type TokenPayload = { userId?: string; exp?: number };
function getRestaurantIdFromToken(): { id: string | null; bearer?: string } {
  const raw = getRawTokenFromStorage();
  if (!raw) return { id: null };
  const parts = raw.split(".");
  if (parts.length < 2) return { id: null, bearer: raw };
  let payload: TokenPayload | null = null;
  try {
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch {}
  return { id: payload?.userId || null, bearer: raw };
}

function getDayRange() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  return { start: now, end: tomorrow };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  return { start: monday, end: sunday };
}

function getMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth());
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: first, end: last };
}

function formatDateYMD(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Charts() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: "application/json" };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const searchParams = useSearchParams();
  const ridFromQuery = searchParams.get("rid") || "";
  const ridFromLS =
    typeof window !== "undefined" ? localStorage.getItem("userId") : "";

  const tokenInfo = React.useMemo(() => getRestaurantIdFromToken(), []);
  const resolvedRestaurantId =
    ridFromQuery || tokenInfo.id || ridFromLS || null;

  const [restaurantId] = React.useState(resolvedRestaurantId);
  const [dataWithRange, setDataWithRange] = React.useState<any>(null);
  const [data, setData] = React.useState<any[] | null>(null);
  const [option, setOption] = React.useState("daily");

  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (option === "daily") {
      const { start, end } = getDayRange();
      setStartDate(start);
      setEndDate(end);
    } else if (option === "weekly") {
      const { start, end } = getWeekRange();
      setStartDate(start);
      setEndDate(end);
    } else if (option === "monthly") {
      const { start, end } = getMonthRange();
      setStartDate(start);
      setEndDate(end);
    }
  }, [option]);

  const fetchOrdersWithDateRange = React.useCallback(async () => {
    if (!restaurantId || !startDate || !endDate) return;

    const params = new URLSearchParams();
    params.append("start_date", formatDateYMD(startDate));
    params.append("end_date", formatDateYMD(endDate));

    const res = await fetch(
      `/yuksi/restaurant/${restaurantId}/order-history?${params.toString()}`,
      { cache: "no-store", headers }
    );

    const json = await readJson(res);
    setDataWithRange(json?.data);
  }, [restaurantId, headers, startDate, endDate]);

  React.useEffect(() => {
    fetchOrdersWithDateRange();
  }, [fetchOrdersWithDateRange]);

  const fetchOrders = React.useCallback(async () => {
    if (!restaurantId) return;

    const res = await fetch(`/yuksi/restaurant/${restaurantId}/order-history`, {
      cache: "no-store",
      headers,
    });

    const json = await readJson(res);
    setData(json?.data.orders);
  }, [restaurantId, headers]);

  React.useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (!dataWithRange || !data || !startDate || !endDate) return;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:gap-6">
      {/* Sipariş Gelirleri — çizgi grafik */}
      <div className="flex min-w-0 flex-col rounded-lg bg-white shadow sm:max-w-[500px] sm:flex-1">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 sm:px-4">
          <select
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none ring-2 ring-transparent transition focus:ring-sky-200 sm:px-3 sm:py-2"
            name="option"
            value={option}
            onChange={(e) => setOption(e.target.value)}
          >
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
            <option value="monthly">Aylık</option>
          </select>
          <span className="text-sm font-medium sm:text-base">Sipariş Gelirleri</span>
          <span className="rounded bg-neutral-100 px-2 py-1 text-xs sm:px-2.5 sm:py-1 sm:text-sm">
            Toplam: {dataWithRange.total_amount} &#8378;
          </span>
        </div>
        <div className="h-[220px] w-full sm:h-[260px]">
          <ChartLine
            startDate={startDate}
            endDate={endDate}
            option={option}
            data={dataWithRange}
          />
        </div>
      </div>

      {/* Sipariş Durumu — pasta grafik */}
      <div className="flex min-w-0 flex-col rounded-lg bg-white shadow sm:max-w-[500px] sm:flex-1">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 sm:px-4">
          <span className="text-sm font-medium sm:text-base">Sipariş Durumu</span>
          <span className="rounded bg-neutral-100 px-2 py-1 text-xs sm:px-2.5 sm:py-1 sm:text-sm">
            Sipariş Sayısı: {data.length}
          </span>
        </div>
        <div className="h-[220px] w-full sm:h-[260px]">
          <ChartPie data={data} />
        </div>
      </div>
    </div>
  );
}
