// src/app/dashboards/[role]/restaurant/live-track/page.tsx
'use client';

import * as React from 'react';
import { Bike, Clock, Phone, RefreshCcw, Search } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';
import dynamic from 'next/dynamic';

// Haritayı yalnızca client'ta renderla
const LiveLeaflet = dynamic(() => import('@/src/components/map/LiveLeaflet'), { ssr: false });

/* ================= Types ================= */
type ApiCourier = {
  courier_id: string;
  courier_name?: string | null;
  courier_phone?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_updated_at?: string | null;
  assigned_at?: string | null;
  notes?: string | null;
};

type Courier = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  updatedAt?: string | null;
  assignedAt?: string | null;
  notes?: string | null;
};

type ApiOrder = {
  id: string;
  code?: string;
  customer?: string;
  phone?: string;
  address?: string;
  delivery_address?: string;
  type?: string;
  amount?: string | number;
  status?: string;
  created_at?: string;
};

type OrderLite = {
  id: string;
  code: string;
  customer: string;
  createdAt?: string | null;
};

/* =============== Helpers =============== */
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

// JWT -> payload decode (base64url)
function decodeJwt<T = any>(token?: string | null): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch { return null; }
}

/* =============== Page =============== */
export default function FollowLivePage() {
  const token = React.useMemo(getAuthToken, []);
  const payload = React.useMemo(() => decodeJwt<any>(token), [token]);
  const restaurantId = payload?.userId as string | undefined; // token’dan

  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = React.useState<string | null>(null);

  // 🆕 Sipariş listesi (select)
  const [orders, setOrders] = React.useState<OrderLite[]>([]);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string>('');

  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  /* ------- Kuryeleri (tümü) getir ------- */
  const loadCouriers = React.useCallback(async () => {
    if (!restaurantId) { setError('Restoran kimliği bulunamadı (token).'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/yuksi/Restaurant/${restaurantId}/couriers/gps`, { headers, cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const arr: ApiCourier[] =
        Array.isArray(j?.data?.couriers) ? j.data.couriers :
        Array.isArray(j?.data) ? j.data :
        Array.isArray(j) ? j : [];

      const mapped: Courier[] = arr.map((c) => {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        return {
          id: String(c.courier_id),
          name: (c.courier_name ?? '').trim() || '(İsimsiz Kurye)',
          phone: (c.courier_phone ?? '').trim(),
          lat, lng,
          updatedAt: c.location_updated_at ?? null,
          assignedAt: c.assigned_at ?? null,
          notes: c.notes ?? null,
        };
      }).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));

      setRows(mapped);
      if (mapped.length && !selectedCourierId) setSelectedCourierId(mapped[0].id);
    } catch (e: any) {
      setError(e?.message || 'Kurye konumları alınamadı.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, restaurantId, selectedCourierId]);

  /* ------- 🆕 Sipariş geçmişini getir -> select’e bas ------- */
  const loadOrders = React.useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await fetch(`/yuksi/restaurant/${restaurantId}/order-history`, { headers, cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const list: ApiOrder[] =
        Array.isArray(j?.data?.orders) ? j.data.orders :
        Array.isArray(j?.data) ? j.data :
        Array.isArray(j) ? j : [];

      const mapped: OrderLite[] = list.map(o => ({
        id: String(o.id),
        code: o.code ?? '',
        customer: o.customer ?? '',
        createdAt: o.created_at ?? null,
      }));

      // En yeni üstte olacak şekilde sırala (created_at varsa)
      mapped.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });

      setOrders(mapped);
      if (mapped.length && !selectedOrderId) setSelectedOrderId(mapped[0].id);
    } catch (e) {
      // sipariş yoksa sessiz geç; UI yine çalışır
      console.warn('order-history yüklenemedi:', e);
      setOrders([]);
    }
  }, [headers, restaurantId, selectedOrderId]);

  /* ------- 🆕 Belirli siparişin kuryesini getir ------- */
  const loadCourierByOrder = React.useCallback(async (orderId: string) => {
    if (!restaurantId || !orderId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/yuksi/restaurant/${restaurantId}/orders/${encodeURIComponent(orderId)}/courier-gps`, {
        headers, cache: 'no-store',
      });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const c: any = j?.data ?? j;
      const lat = Number(c?.latitude);
      const lng = Number(c?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Konum bilgisi bulunamadı.');

      const one: Courier = {
        id: String(c.courier_id ?? 'courier'),
        name: (c.courier_name ?? '').trim() || '(İsimsiz Kurye)',
        phone: (c.courier_phone ?? '').trim(),
        lat, lng,
        updatedAt: c.location_updated_at ?? null,
        assignedAt: c.assigned_at ?? null,
        notes: c.notes ?? null,
      };

      setRows([one]);
      setSelectedCourierId(one.id);
    } catch (e: any) {
      setError(e?.message || 'Sipariş kurye konumu alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [headers, restaurantId]);

  /* ------- İlk yükleme + 10sn/refresh (tüm kuryeler) ------- */
  React.useEffect(() => { loadCouriers(); }, [loadCouriers]);
  React.useEffect(() => {
    if (!restaurantId) return;
    const t = setInterval(loadCouriers, 10_000);
    return () => clearInterval(t);
  }, [restaurantId, loadCouriers]);

  /* ------- Sipariş listesini getir ------- */
  React.useEffect(() => { loadOrders(); }, [loadOrders]);

  /* ------- Filtre ------- */
  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((c) =>
      c.name.toLowerCase().includes(qq) ||
      c.phone.replace(/\s/g, '').includes(qq.replace(/\s/g, ''))
    );
  }, [rows, q]);

  const sel = filtered.find((c) => c.id === selectedCourierId) ?? filtered[0] ?? null;

  /* =================== UI =================== */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Canlı Takip</h1>
        <div className="flex items-end gap-2">
          <div className="text-sm text-neutral-500">
            {restaurantId ? <>Restoran: <b>{restaurantId}</b></> : 'Restoran kimliği bulunamadı'}
          </div>
          <button
            onClick={loadCouriers}
            disabled={loading || !restaurantId}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-neutral-50 disabled:opacity-60"
            title="Yenile"
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? 'Yükleniyor…' : 'Tüm Kuryeleri Getir'}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm soft-card overflow-hidden">
        {/* Filtre/Özet + 🆕 Sipariş select */}
        <div className="px-4 lg:px-6 py-4 sm:py-6 space-y-3">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Kurye / Telefon</label>
              <div className="relative">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="İsim veya tel ara…"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 pl-9 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              </div>
            </div>
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
                Aktif Kurye: <strong>{filtered.length}</strong>
              </span>
            </div>
          </div>

          {/* 🆕 Sipariş seçerek tek kurye konumu */}
          <div className="grid gap-3 md:grid-cols-[minmax(280px,520px)_auto]">
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Sipariş Seç</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              >
                {orders.length === 0 && <option value="">Sipariş bulunamadı</option>}
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.code || o.id.slice(0, 8)} • {o.customer || 'Müşteri'} • {o.createdAt ? new Date(o.createdAt).toLocaleString('tr-TR') : '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => loadCourierByOrder(selectedOrderId)}
                disabled={loading || !restaurantId || !selectedOrderId}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                Bu Siparişin Kuryesini Göster
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Harita + Liste + Detay */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] border-t border-neutral-200/70">
          <div className="grid grid-rows-[1fr_auto]">
            <LiveLeaflet
              markers={filtered}
              selectedId={sel?.id ?? null}
              onSelect={(id) => setSelectedCourierId(id)}
            />

            <div className="overflow-x-auto border-t border-neutral-200/70 bg-white">
              <div className="flex gap-3 px-4 py-3">
                {filtered.map((c) => {
                  const active = sel?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCourierId(c.id)}
                      className={`min-w-[220px] flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-neutral-900">{c.name}</div>
                        <div className="text-xs text-neutral-500">{c.phone || '—'}</div>
                      </div>
                      <Bike className="h-4 w-4 text-neutral-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l border-neutral-200/70 bg-white p-4 lg:p-6">
            {!sel ? (
              <div className="grid h-full place-items-center text-sm text-neutral-500">Kurye seçiniz.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">{sel.name}</div>
                    <div className="text-sm text-neutral-500">{sel.notes || '—'}</div>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white bg-emerald-500">
                    Aktif
                  </span>
                </div>

                <div className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-neutral-500" />
                    {sel.phone ? (
                      <a className="text-sky-600 hover:underline" href={`tel:${sel.phone.replace(/\s/g, '')}`}>
                        {sel.phone}
                      </a>
                    ) : (
                      <span className="text-neutral-500">—</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-neutral-500" />
                    <span className="text-neutral-700">
                      Son güncelleme: <b>{sel.updatedAt ? new Date(sel.updatedAt).toLocaleString('tr-TR') : '—'}</b>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
