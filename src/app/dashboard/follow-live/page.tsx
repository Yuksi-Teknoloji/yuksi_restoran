// src/app/dashboard/follow-live/page.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Clock,
  Phone,
  RefreshCcw,
  Search,
  Menu,
  Pencil,
  Maximize2,
  MapPin,
  Minimize2,
} from "lucide-react";
import { getAuthToken } from "@/src/utils/auth";

// Haritayı sadece client'ta renderla
const LiveLeaflet = dynamic(() => import("@/src/components/map/LiveLeaflet"), {
  ssr: false,
});

/* ================= Types ================= */
type OrderStatus =
  | "hazirlaniyor"
  | "kurye_cagrildi"
  | "kuryeye_verildi"
  | "kuryeye_istek_atildi"
  | "kurye_reddetti"
  | "siparis_havuza_atildi"
  | "yolda"
  | "teslim_edildi"
  | "iptal";

type ApiOrder = {
  id: string;
  code?: string;
  customer?: string;
  phone?: string;
  address?: string;
  delivery_address?: string;
  type?: string;
  amount?: string | number;
  status?: OrderStatus;
  created_at?: string;

  pickup_lat?: string | number | null;
  pickup_lng?: string | number | null;
  dropoff_lat?: string | number | null;
  dropoff_lng?: string | number | null;
};

type Order = {
  id: string;
  code: string;
  customer: string;
  phone?: string;
  status: OrderStatus;
  address?: string | null;
  delivery_address?: string | null;
  type?: string | null;
  amount?: number | null;
  createdAt?: string | null;

  // ham koordinatlar
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;

  // haritada kullanılacak koordinat (öncelik dropoff)
  lat: number;
  lng: number;
};

/* ================= Helpers ================= */
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return t as any;
  }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

// JWT -> payload decode (base64url)
function decodeJwt<T = any>(token?: string | null): T | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const STATUS_TABS: { key: OrderStatus; label: string; color: TabColor }[] = [
  { key: "hazirlaniyor", label: "Hazırlanıyor", color: "sky" },
  {
    key: "kuryeye_istek_atildi",
    label: "Kuryeye İstek Atıldı",
    color: "emerald",
  },
  { key: "kurye_reddetti", label: "Kurye Reddetti", color: "rose" },
  { key: "kurye_cagrildi", label: "Kurye Çağrıldı", color: "amber" },
  { key: "kuryeye_verildi", label: "Kuryeye Verildi", color: "indigo" },
  {
    key: "siparis_havuza_atildi",
    label: "Sipariş Havuza Atıldı",
    color: "purple",
  },
  { key: "yolda", label: "Yolda", color: "blue" },
  { key: "teslim_edildi", label: "Teslim Edildi", color: "emerald" },
  { key: "iptal", label: "İptal", color: "rose" },
];

function statusReadable(s: OrderStatus) {
  const found = STATUS_TABS.find((t) => t.key === s);
  return found?.label ?? s;
}

/* ================= Page ================= */
export default function FollowLivePage() {
  const token = React.useMemo(getAuthToken, []);
  const payload = React.useMemo(() => decodeJwt<any>(token), [token]);
  const restaurantId = payload?.userId as string | undefined;

  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] =
    React.useState<OrderStatus>("hazirlaniyor");
  const [maximizeMap, setMaximizeMap] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const sectionRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: "application/json" };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  /* ------- Siparişleri getir (status filtresi ile) ------- */
  const loadOrders = React.useCallback(
    async (status: OrderStatus) => {
      if (!restaurantId) {
        setError("Restoran kimliği bulunamadı (token).");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("limit", "100");
        qs.set("offset", "0");
        qs.set("status", status); // swagger’daki status query’si

        const res = await fetch(
          `/yuksi/restaurant/${restaurantId}/order-history?${qs.toString()}`,
          { headers, cache: "no-store" }
        );
        const j = await readJson(res);
        if (!res.ok || j?.success === false) {
          throw new Error(pickMsg(j, `HTTP ${res.status}`));
        }

        const list: ApiOrder[] = Array.isArray(j?.data?.orders)
          ? j.data.orders
          : Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j)
          ? j
          : [];

        const mapped: Order[] = list
          .map((o) => {
            const pickupLat =
              o.pickup_lat != null && o.pickup_lat !== ""
                ? Number(o.pickup_lat)
                : null;
            const pickupLng =
              o.pickup_lng != null && o.pickup_lng !== ""
                ? Number(o.pickup_lng)
                : null;
            const dropLat =
              o.dropoff_lat != null && o.dropoff_lat !== ""
                ? Number(o.dropoff_lat)
                : null;
            const dropLng =
              o.dropoff_lng != null && o.dropoff_lng !== ""
                ? Number(o.dropoff_lng)
                : null;

            // Öncelik: dropoff (teslimat noktası), yoksa pickup (restoran)
            const lat = dropLat ?? pickupLat;
            const lng = dropLng ?? pickupLng;
            if (
              !Number.isFinite(lat as number) ||
              !Number.isFinite(lng as number)
            ) {
              return null;
            }

            return {
              id: String(o.id),
              code: o.code ?? "",
              customer: o.customer ?? "",
              phone: o.phone ?? "",
              status: (o.status as OrderStatus) ?? status,
              address: o.address ?? null,
              delivery_address: o.delivery_address ?? null,
              type: o.type ?? null,
              amount:
                o.amount != null && o.amount !== "" ? Number(o.amount) : null,
              createdAt: o.created_at ?? null,
              pickupLat,
              pickupLng,
              dropoffLat: dropLat,
              dropoffLng: dropLng,
              lat: lat as number,
              lng: lng as number,
            } as Order;
          })
          .filter((o): o is Order => !!o);

        setOrders(mapped);
        setSelectedOrderId((prev) =>
          prev && mapped.some((m) => m.id === prev)
            ? prev
            : mapped[0]?.id ?? null
        );
      } catch (e: any) {
        setError(e?.message || "Siparişler alınamadı.");
        setOrders([]);
        setSelectedOrderId(null);
      } finally {
        setLoading(false);
      }
    },
    [headers, restaurantId]
  );

  /* ------- İlk yükleme + status değişince yükle ------- */
  React.useEffect(() => {
    loadOrders(selectedStatus);
  }, [loadOrders, selectedStatus]);

  /* ------- Arama filtresi ------- */
  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return orders;
    return orders.filter((o) => {
      const code = o.code.toLowerCase();
      const cust = o.customer.toLowerCase();
      const phone = (o.phone ?? "").replace(/\s/g, "").toLowerCase();
      return (
        code.includes(qq) ||
        cust.includes(qq) ||
        phone.includes(qq.replace(/\s/g, "").toLowerCase())
      );
    });
  }, [orders, q]);

  const sel =
    filtered.find((o) => o.id === selectedOrderId) ?? filtered[0] ?? null;

  // Leaflet için marker listesi
  const markers = filtered.map((o) => ({
    id: o.id,
    name: o.code || o.customer || "Sipariş",
    phone: o.customer || o.phone || "",
    lat: o.lat,
    lng: o.lng,
  }));

  /* =================== UI =================== */
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Üst bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Canlı Takip
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="text-xs text-neutral-500 min-w-0 sm:text-sm">
            {!mounted ? (
              "—"
            ) : restaurantId ? (
              <>
                Restoran: <b className="truncate">{restaurantId}</b>
              </>
            ) : (
              "Restoran kimliği bulunamadı"
            )}
          </div>
          <button
            onClick={() => loadOrders(selectedStatus)}
            disabled={loading || !mounted || !restaurantId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 disabled:opacity-60 sm:w-auto"
            title="Yenile"
          >
            <RefreshCcw className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {loading ? "Yükleniyor…" : "Siparişleri Yenile"}
            </span>
          </button>
        </div>
      </div>

      {/* Harita + sağ panel */}
      <section
        ref={sectionRef}
        className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* Sol: Harita */}
          <div className="relative h-max min-h-0">
            <LiveLeaflet
              markers={markers}
              selectedId={sel?.id ?? null}
              onSelect={(id) => setSelectedOrderId(id)}
              className={`w-full ${
                maximizeMap
                  ? "h-screen"
                  : "h-[280px] sm:h-80 md:h-96 lg:h-[500px]"
              } rounded-t-xl lg:rounded-t-none lg:rounded-l-xl`}
              overlay={
                <>
                  {/* Sağ dikey buton grubu */}
                  <div className="pointer-events-auto absolute right-2 top-2 z-10 flex flex-col gap-1.5 sm:right-3 sm:top-3 sm:gap-2">
                    <button
                      title="Menü"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-600 text-white shadow sm:h-10 sm:w-10"
                    >
                      <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                    <button
                      title="Düzenle"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-amber-500 text-white shadow sm:h-10 sm:w-10"
                    >
                      <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (maximizeMap) {
                          document.exitFullscreen?.();
                        } else {
                          sectionRef.current?.requestFullscreen?.();
                        }
                        setMaximizeMap(!maximizeMap);
                      }}
                      title={maximizeMap ? "Küçült" : "Tam Ekran"}
                      className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md bg-neutral-700 text-white shadow sm:h-10 sm:w-10"
                    >
                      {maximizeMap ? (
                        <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      ) : (
                        <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </button>
                    <div className="grid h-9 min-w-9 shrink-0 place-items-center rounded-md bg-neutral-900 px-2 text-white shadow sm:h-10 sm:min-w-10">
                      <span className="tabular-nums text-xs sm:text-sm">
                        {filtered.length}
                      </span>
                    </div>
                  </div>

                  {/* Sağ alt: rozet (mobilde gizli, sayı zaten üstte) */}
                  <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden flex-col items-end gap-2 sm:flex">
                    <div className="pointer-events-auto rounded-md bg-neutral-900/90 px-3 py-1.5 text-xs font-semibold text-white">
                      Listelenen Paket Sayısı: {filtered.length}
                    </div>
                  </div>

                  {/* Alt: durum sekmeleri – mobilde yatay scroll, masaüstünde grid */}
                  <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 mb-2 mt-4 md:my-10">
                    <div className="mx-2 flex flex-nowrap gap-2 overflow-x-auto pb-1 [scrollbar-width:thin] md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                      {STATUS_TABS.map((t) => (
                        <Tab
                          key={t.key}
                          color={t.color}
                          label={t.label}
                          active={selectedStatus === t.key}
                          onClick={() => setSelectedStatus(t.key)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              }
            />
          </div>
          {/* Sağ: detay paneli */}
          <aside className="min-h-0 border-t border-neutral-200/70 bg-white p-4 lg:border-t-0 lg:border-l lg:p-6">
            {!sel ? (
              <div className="grid min-h-[120px] place-items-center text-sm text-neutral-500 sm:min-h-[160px]">
                Haritada gösterilecek sipariş yok.
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold sm:text-lg">
                      #{sel.code || sel.id.slice(0, 8)}
                    </div>
                    <div className="truncate text-sm text-neutral-600">
                      {sel.customer || "Müşteri"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Durum: {statusReadable(sel.status)}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center rounded-full bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white">
                    Paket
                  </span>
                </div>

                <div className="space-y-2 rounded-xl border border-neutral-200 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-neutral-500" />
                    {sel.phone ? (
                      <a
                        className="text-sky-600 hover:underline"
                        href={`tel:${sel.phone.replace(/\s/g, "")}`}
                      >
                        {sel.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-500">Telefon yok</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-neutral-500" />
                    <span className="text-neutral-700">
                      Oluşturma:{" "}
                      <b>
                        {sel.createdAt
                          ? new Date(sel.createdAt).toLocaleString("tr-TR")
                          : "—"}
                      </b>
                    </span>
                  </div>
                  {sel.amount != null && (
                    <div>
                      Tutar: <b>{sel.amount.toFixed(2)} ₺</b>
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-500">
                      Restoran Adresi
                    </div>
                    <div className="text-neutral-800 break-words">
                      {sel.address || "—"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-500">
                      Teslimat Adresi
                    </div>
                    <div className="text-neutral-800 break-words">
                      {sel.delivery_address || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        {/* Alt sipariş listesi: mobilde yatay scroll, md+ wrap */}
        <div className="overflow-x-auto md:overflow-visible [scrollbar-width:thin]">
          <div className="flex flex-nowrap gap-3 px-4 py-3 md:flex-wrap">
            {filtered.map((o) => {
              const active = sel?.id === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={`flex min-w-[140px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition sm:min-w-0 sm:gap-3 md:w-[150px] ${
                    active
                      ? "border-orange-300 bg-orange-50"
                      : "border-neutral-200 bg-white hover:bg-neutral-50"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-900">
                      #{o.code || o.id.slice(0, 8)}
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {o.customer || "Müşteri"} • {statusReadable(o.status)}
                    </div>
                  </div>
                  <MapPin className="h-4 w-4 shrink-0 text-neutral-400" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="w-full px-4 py-2 text-sm text-neutral-500">
                Bu durum için sipariş bulunamadı.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Alt filtre (arama) */}
      <section className="rounded-xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="space-y-3 px-4 py-4 sm:py-5 lg:px-6 lg:py-6">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(200px,1fr)_auto]">
            <div className="min-w-0">
              <label className="mb-1 block text-sm font-semibold text-neutral-700">
                Sipariş Kodu / Müşteri / Telefon
              </label>
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ara…"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 pl-9 text-base outline-none ring-2 ring-transparent transition focus:ring-sky-200"
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              </div>
            </div>
            <div className="flex justify-start sm:justify-end">
              <span className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
                Gösterilen: <strong>{filtered.length}</strong>
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* Alt şeritteki küçük buton komponenti */
type TabColor =
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "blue"
  | "indigo";

function Tab({
  color,
  label,
  active,
  onClick,
}: {
  color: TabColor;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const colors: Record<TabColor, string> = {
    sky: "bg-sky-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-600",
    rose: "bg-rose-600",
    purple: "bg-purple-600",
    blue: "bg-blue-600",
    indigo: "bg-indigo-600",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-white shadow text-xs sm:gap-2 sm:px-3 sm:py-2 sm:text-sm ${
        colors[color]
      } ${active ? "ring-2 ring-white/90 scale-[1.02]" : ""}`}
    >
      <span className="text-xs leading-none sm:text-sm">●</span>
      <span className="font-semibold">{label}</span>
    </button>
  );
}
