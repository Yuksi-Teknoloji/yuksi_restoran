// src/app/dashboards/[role]/restaurant/couriers/ratings/page.tsx
'use client';

import * as React from 'react';
import { Star, StarHalf, Search, SortAsc, X } from 'lucide-react';

/* ==================== Auth & helpers ==================== */
export function getAuthToken(): string | null {
  try {
    const ls = localStorage.getItem('auth_token');
    if (ls) return ls;
  } catch {}
  // cookie'den dene
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

function parseJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function getRestaurantIdFromToken(): string | null {
  const token = getAuthToken();
  if (!token) return null;
  const p = parseJwtPayload(token);
  const id = p?.userId ?? p?.sub ?? null;
  return id ? String(id) : null;
}

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return (t as any);
  }
}
const pickMsg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;
const api = (p: string) => `/yuksi${p}`;

/* ==================== Types ==================== */
type CourierRow = {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  vehicle?: string;
  avg?: number;
  votes?: number;
  completed?: number;
  lastComment?: string;
};

type RatingItem = {
  id: string;
  order_id?: string;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
};

/* ==================== Page ==================== */
export default function CourierRatingsPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [restaurantId] = React.useState<string>(() => getRestaurantIdFromToken() ?? '');

  const [loadingCouriers, setLoadingCouriers] = React.useState(false);
  const [couriers, setCouriers] = React.useState<CourierRow[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  // filtreler ve sıralama
  const [q, setQ] = React.useState('');
  const [minRating, setMinRating] = React.useState<number>(0);
  const [sortKey, setSortKey] = React.useState<'avg' | 'completed' | 'name'>('avg');
  const [sortAsc, setSortAsc] = React.useState(false);

  // Rate modal
  const [rateOpen, setRateOpen] = React.useState(false);
  const [rateCourier, setRateCourier] = React.useState<CourierRow | null>(null);
  const [rateOrderId, setRateOrderId] = React.useState('');
  const [tempRating, setTempRating] = React.useState<number>(0);
  const [hoverRating, setHoverRating] = React.useState<number>(0);
  const [comment, setComment] = React.useState('');
  const [savingRate, setSavingRate] = React.useState(false);

  // Assign modal
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignCourier, setAssignCourier] = React.useState<CourierRow | null>(null);
  const [assignOrderId, setAssignOrderId] = React.useState('');
  const [savingAssign, setSavingAssign] = React.useState(false);

  // “Puanlarım” modal (bu restoranın bir kuryeye verdiği puanlar)
  const [myRatingsOpen, setMyRatingsOpen] = React.useState(false);
  const [ratingsLoading, setRatingsLoading] = React.useState(false);
  const [ratings, setRatings] = React.useState<RatingItem[]>([]);
  const [ratingsCourier, setRatingsCourier] = React.useState<CourierRow | null>(null);

  // “Tüm puanları” modal (kurye global tüm puanları)
  const [allRatingsOpen, setAllRatingsOpen] = React.useState(false);
  const [allRatingsLoading, setAllRatingsLoading] = React.useState(false);
  const [allRatings, setAllRatings] = React.useState<RatingItem[]>([]);
  const [allRatingsCourier, setAllRatingsCourier] = React.useState<CourierRow | null>(null);

  /* ---------- Load couriers ---------- */
  const loadCouriers = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoadingCouriers(true); setErr(null);
    try {
      const res = await fetch(api(`/api/restaurant/${restaurantId}/couriers`), { cache: 'no-store', headers });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const list: any[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: CourierRow[] = list.map((c) => ({
        id: String(c?.id ?? c?.courier_id ?? ''),
        name: String(c?.name ?? c?.full_name ?? 'Kurye'),
        phone: c?.phone ?? c?.phone_number ?? '',
        avatar: c?.avatar_url ?? '/icons/1.jpg',
        vehicle: c?.vehicle_type ?? 'Motosiklet',
        avg: Number(c?.avg_rating ?? c?.average ?? 0) || 0,
        votes: Number(c?.votes ?? c?.ratings_count ?? 0) || 0,
        completed: Number(c?.completed_deliveries ?? c?.completed ?? 0) || 0,
        lastComment: c?.last_comment ?? undefined,
      })).filter(x => x.id);
      setCouriers(mapped);
    } catch (e: any) {
      setCouriers([]);
      setErr(e?.message || 'Kuryeler alınamadı.');
    } finally {
      setLoadingCouriers(false);
    }
  }, [headers, restaurantId]);

  // İlk açılışta token’dan gelen id ile otomatik yükle
  React.useEffect(() => { loadCouriers(); }, [loadCouriers]);

  /* ---------- derived list ---------- */
  const filtered = React.useMemo(() => {
    let list = couriers.filter(r => {
      const mQ = !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''));
      const mR = (r.avg ?? 0) >= minRating;
      return mQ && mR;
    });
    list.sort((a, b) => {
      let v = 0;
      if (sortKey === 'avg') v = (a.avg ?? 0) - (b.avg ?? 0);
      if (sortKey === 'completed') v = (a.completed ?? 0) - (b.completed ?? 0);
      if (sortKey === 'name') v = a.name.localeCompare(b.name, 'tr');
      return sortAsc ? v : -v;
    });
    return list;
  }, [couriers, q, minRating, sortKey, sortAsc]);

  /* ---------- open modals ---------- */
  function openRate(c: CourierRow) {
    setRateCourier(c);
    setTempRating(0);
    setHoverRating(0);
    setComment('');
    setRateOrderId('');
    setRateOpen(true);
  }
  function openAssign(c: CourierRow) {
    setAssignCourier(c);
    setAssignOrderId('');
    setAssignOpen(true);
  }

  async function openMyRatings(c: CourierRow) {
    if (!restaurantId) return;
    setRatingsCourier(c);
    setMyRatingsOpen(true);
    setRatingsLoading(true);
    try {
      const res = await fetch(api(`/api/restaurant/${restaurantId}/couriers/${c.id}/ratings`), { cache: 'no-store', headers });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      const list: any[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: RatingItem[] = list.map((r) => ({
        id: String(r?.id ?? r?.rating_id ?? ''),
        order_id: r?.order_id ? String(r.order_id) : undefined,
        rating: Number(r?.rating ?? 0) || 0,
        comment: r?.comment ?? null,
        created_at: r?.created_at ?? null,
      })).filter(x => x.id);
      setRatings(mapped);
    } catch (e: any) {
      setRatings([]);
      alert(e?.message || 'Puanlar alınamadı.');
    } finally {
      setRatingsLoading(false);
    }
  }

  async function openAllRatings(c: CourierRow) {
    setAllRatingsCourier(c);
    setAllRatingsOpen(true);
    setAllRatingsLoading(true);
    try {
      const res = await fetch(api(`/api/restaurant/couriers/${c.id}/ratings`), { cache: 'no-store', headers });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      const list: any[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: RatingItem[] = list.map((r) => ({
        id: String(r?.id ?? r?.rating_id ?? ''),
        order_id: r?.order_id ? String(r.order_id) : undefined,
        rating: Number(r?.rating ?? 0) || 0,
        comment: r?.comment ?? null,
        created_at: r?.created_at ?? null,
      })).filter(x => x.id);
      setAllRatings(mapped);
    } catch (e: any) {
      setAllRatings([]);
      alert(e?.message || 'Kurye tüm puanları alınamadı.');
    } finally {
      setAllRatingsLoading(false);
    }
  }

  /* ---------- actions ---------- */
  async function submitRating() {
    if (!restaurantId || !rateCourier) return;
    if (!rateOrderId) { alert('Order ID zorunlu.'); return; }
    if (tempRating <= 0) { alert('Puan seçin.'); return; }

    setSavingRate(true);
    try {
      const res = await fetch(api(`/api/restaurant/${restaurantId}/couriers/${rateCourier.id}/rate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ order_id: rateOrderId, rating: tempRating, comment }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      // optimistic update
      setCouriers(prev => prev.map(c => {
        if (c.id !== rateCourier.id) return c;
        const currentAvg = c.avg ?? 0;
        const currentVotes = c.votes ?? 0;
        const sum = currentAvg * currentVotes + tempRating;
        const votes = currentVotes + 1;
        const avg = +(sum / votes).toFixed(2);
        return { ...c, avg, votes, lastComment: comment || c.lastComment };
      }));
      setRateOpen(false);
    } catch (e: any) {
      alert(e?.message || 'Puan kaydedilemedi.');
    } finally {
      setSavingRate(false);
    }
  }

  async function assignCourierToOrder() {
    if (!restaurantId || !assignCourier) return;
    if (!assignOrderId) { alert('Order ID zorunlu.'); return; }

    setSavingAssign(true);
    try {
      const res = await fetch(api(`/api/restaurant/${restaurantId}/orders/${assignOrderId}/assign-courier`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ courier_id: assignCourier.id }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setAssignOpen(false);
      alert('Kurye siparişe atandı.');
    } catch (e: any) {
      alert(e?.message || 'Atama başarısız.');
    } finally {
      setSavingAssign(false);
    }
  }

  async function updateRating(r: RatingItem, newRating: number, newComment: string) {
    if (!restaurantId || !ratingsCourier) return;
    try {
      const res = await fetch(api(`/api/restaurant/${restaurantId}/couriers/${ratingsCourier.id}/ratings/${r.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ rating: newRating, comment: newComment }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setRatings(prev => prev.map(x => x.id === r.id ? { ...x, rating: newRating, comment: newComment } : x));
    } catch (e: any) {
      alert(e?.message || 'Güncellenemedi.');
    }
  }

  async function deleteRating(r: RatingItem) {
    if (!restaurantId || !ratingsCourier) return;
    if (!confirm('Bu puanı silmek istiyor musunuz?')) return;
    try {
      const res = await fetch(api(`/api/restaurant/${restaurantId}/couriers/${ratingsCourier.id}/ratings/${r.id}`), {
        method: 'DELETE',
        headers,
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setRatings(prev => prev.filter(x => x.id !== r.id));
    } catch (e: any) {
      alert(e?.message || 'Silinemedi.');
    }
  }

  /* ==================== UI ==================== */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">Kurye Puanları</h1>

        <div className="hidden md:flex items-center gap-2 text-sm text-neutral-500">
          <SortButton
            active={sortKey === 'avg'} asc={sortAsc}
            onClick={() => { setSortKey('avg'); setSortAsc(k => !k); }}
            label="Ort."
          />
          <SortButton
            active={sortKey === 'completed'} asc={sortAsc}
            onClick={() => { setSortKey('completed'); setSortAsc(k => !k); }}
            label="Teslim"
          />
          <SortButton
            active={sortKey === 'name'} asc={sortAsc}
            onClick={() => { setSortKey('name'); setSortAsc(k => !k); }}
            label="İsim"
          />
        </div>
      </div>

      {!restaurantId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Giriş belirtecinizden restoran kimliği okunamadı. Oturumunuzu kontrol edin.
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm soft-card overflow-hidden">
        {/* Filtreler */}
        <div className="px-4 lg:px-6 py-4 sm:py-6">
          <div className="grid items-end gap-4 md:grid-cols-[minmax(240px,1fr)_220px_200px]">
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

            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Minimum Puan</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={minRating}
                  onChange={(e) => setMinRating(parseFloat(e.target.value))}
                  className="w-full"
                />
                <Star className="h-4 w-4 text-orange-500" />
                <span className="w-8 text-sm tabular-nums">{minRating.toFixed(1)}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <span className="inline-flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-700">
                Listelenen: <strong>{filtered.length}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Tablo */}
        <div className="border-t border-neutral-200/70">
          <div className="overflow-x-auto bg-white px-4 lg:px-6">
            <table className="w-full table-fixed">
              <thead>
                <tr className="text-left text-sm text-neutral-500">
                  <th className="px-4 lg:px-6 py-3 font-medium w-[120px]"> </th>
                  <th className="px-4 lg:px-6 py-3 font-medium">Kurye</th>
                  <th className="px-4 lg:px-6 py-3 font-medium w-40">Puan</th>
                  <th className="px-4 lg:px-6 py-3 font-medium w-32">Teslim</th>
                  <th className="px-4 lg:px-6 py-3 font-medium">Son Yorum</th>
                  <th className="px-4 lg:px-6 py-3 font-medium w-[360px]">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loadingCouriers && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-neutral-500">Yükleniyor…</td>
                  </tr>
                )}

                {!loadingCouriers && filtered.map((c) => (
                  <tr key={c.id} className="border-t border-neutral-200/70 hover:bg-neutral-50 align-middle">
                    <td className="px-4 lg:px-6 py-3">
                      <img
                        src={c.avatar || '/icons/1.jpg'}
                        alt={c.name}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow"
                      />
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <div className="font-medium text-neutral-900">{c.name}</div>
                      <div className="text-xs text-neutral-500">{c.vehicle ?? '—'} · {c.phone ?? '—'}</div>
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <RatingView value={c.avg ?? 0} />
                      <div className="text-xs text-neutral-500 mt-0.5">({c.votes ?? 0})</div>
                    </td>
                    <td className="px-4 lg:px-6 py-3 tabular-nums">{c.completed ?? 0}</td>
                    <td className="px-4 lg:px-6 py-3 truncate max-w-[280px]">{c.lastComment ?? '—'}</td>
                    <td className="px-4 lg:px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openRate(c)}
                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
                        >
                          Puan Ver
                        </button>
                        <button
                          onClick={() => openAssign(c)}
                          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-600"
                        >
                          Ata
                        </button>
                        <button
                          onClick={() => openMyRatings(c)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          Puanlarım
                        </button>
                        <button
                          onClick={() => openAllRatings(c)}
                          className="rounded-lg bg-neutral-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-neutral-800"
                        >
                          Tüm Puanları
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loadingCouriers && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">
                      {err || 'Kayıt bulunamadı.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------- RATE MODAL ---------- */}
      {rateOpen && rateCourier && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="font-semibold">Puan Ver</div>
              <button onClick={() => setRateOpen(false)} className="p-1 rounded-md hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <img src={rateCourier.avatar || '/icons/1.jpg'} alt={rateCourier.name} className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="font-medium">{rateCourier.name}</div>
                  <div className="text-xs text-neutral-500">{rateCourier.phone ?? '—'}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-700">Order ID</label>
                <input
                  value={rateOrderId}
                  onChange={(e) => setRateOrderId(e.target.value)}
                  placeholder="Sipariş ID"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <div className="mb-2 text-sm text-neutral-700">Puanınız</div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <button
                      key={i}
                      className="p-1"
                      onMouseEnter={() => setHoverRating(i)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setTempRating(i)}
                      aria-label={`${i} yıldız`}
                    >
                      <Star
                        className={`h-7 w-7 transition ${
                          (hoverRating || tempRating) >= i ? 'fill-orange-500 text-orange-500' : 'text-neutral-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm tabular-nums">{(hoverRating || tempRating) || '-'}/5</span>
                </div>
              </div>

              <div>
                <div className="mb-1 text-sm text-neutral-700">Yorum (opsiyonel)</div>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Teslimat deneyiminizi kısaca yazın…"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <button
                onClick={() => setRateOpen(false)}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Vazgeç
              </button>
              <button
                onClick={submitRating}
                disabled={tempRating === 0 || savingRate}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {savingRate ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- ASSIGN MODAL ---------- */}
      {assignOpen && assignCourier && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="font-semibold">Kuryeyi Siparişe Ata</div>
              <button onClick={() => setAssignOpen(false)} className="p-1 rounded-md hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <img src={assignCourier.avatar || '/icons/1.jpg'} alt={assignCourier.name} className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="font-medium">{assignCourier.name}</div>
                  <div className="text-xs text-neutral-500">{assignCourier.phone ?? '—'}</div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-700">Order ID</label>
                <input
                  value={assignOrderId}
                  onChange={(e) => setAssignOrderId(e.target.value)}
                  placeholder="Sipariş ID"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <button
                onClick={() => setAssignOpen(false)}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Vazgeç
              </button>
              <button
                onClick={assignCourierToOrder}
                disabled={savingAssign}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingAssign ? 'Atanıyor…' : 'Ata'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MY RATINGS MODAL ---------- */}
      {myRatingsOpen && ratingsCourier && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="font-semibold">Puanlarım — {ratingsCourier.name}</div>
              <button onClick={() => setMyRatingsOpen(false)} className="p-1 rounded-md hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-auto">
              {ratingsLoading && <div className="text-sm text-neutral-500 py-6 text-center">Yükleniyor…</div>}
              {!ratingsLoading && ratings.length === 0 && <div className="text-sm text-neutral-500 py-6 text-center">Kayıt yok.</div>}
              {!ratingsLoading && ratings.map((r) => (
                <RatingEditableRow
                  key={r.id}
                  item={r}
                  onSave={(val, txt) => updateRating(r, val, txt)}
                  onDelete={() => deleteRating(r)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- ALL RATINGS (READ-ONLY) MODAL ---------- */}
      {allRatingsOpen && allRatingsCourier && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="font-semibold">Kurye Tüm Puanları — {allRatingsCourier.name}</div>
              <button onClick={() => setAllRatingsOpen(false)} className="p-1 rounded-md hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-auto">
              {allRatingsLoading && <div className="text-sm text-neutral-500 py-6 text-center">Yükleniyor…</div>}
              {!allRatingsLoading && allRatings.length === 0 && <div className="text-sm text-neutral-500 py-6 text-center">Kayıt yok.</div>}
              {!allRatingsLoading && allRatings.map((r) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">Order: {r.order_id ?? '—'}</div>
                    <div className="text-xs text-neutral-500">{r.created_at ? new Date(r.created_at).toLocaleString('tr-TR') : '—'}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm">Puan: <strong>{r.rating}</strong></div>
                    <div className="text-sm text-neutral-700 truncate max-w-[60%]">{r.comment ?? '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== UI helpers ==================== */
function RatingView({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.25 && value - full < 0.75 ? 1 : 0;
  const empty = 5 - full - half;

  return (
    <div className="flex items-center">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} className="h-4 w-4 fill-orange-500 text-orange-500" />
      ))}
      {half === 1 && <StarHalf className="h-4 w-4 fill-orange-500 text-orange-500" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className="h-4 w-4 text-neutral-300" />
      ))}
      <span className="ml-2 text-sm tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}

function SortButton({
  active, asc, onClick, label,
}: { active: boolean; asc: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 rounded-md px-2 py-1',
        active ? 'bg-orange-100 text-orange-700' : 'hover:bg-neutral-100',
      ].join(' ')}
      title={`Sırala (${label})`}
    >
      <SortAsc className={`h-4 w-4 ${asc ? 'rotate-180' : ''}`} />
      {label}
    </button>
  );
}

function RatingEditableRow({
  item, onSave, onDelete,
}: {
  item: RatingItem;
  onSave: (rating: number, comment: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [val, setVal] = React.useState<number>(item.rating);
  const [txt, setTxt] = React.useState<string>(item.comment ?? '');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function save() {
    setSaving(true);
    try { await onSave(val, txt); } finally { setSaving(false); }
  }
  async function del() {
    if (!confirm('Silinsin mi?')) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">Order: {item.order_id ?? '—'}</div>
        <div className="text-xs text-neutral-500">{item.created_at ? new Date(item.created_at).toLocaleString('tr-TR') : '—'}</div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr]">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Puan</label>
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            className="w-full rounded-lg border px-2 py-1"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Yorum</label>
          <input
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            className="w-full rounded-lg border px-2 py-1"
            placeholder="(opsiyonel)"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button onClick={del} disabled={deleting} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {deleting ? 'Siliniyor…' : 'Sil'}
        </button>
        <button onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Kaydediliyor…' : 'Güncelle'}
        </button>
      </div>
    </div>
  );
}
