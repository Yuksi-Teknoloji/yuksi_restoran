// src/app/dashboards/[role]/restaurants/courier/add-courier/page.tsx
'use client';

import * as React from 'react';
import { Loader2, RefreshCcw, Search, UserRoundCheck, Trash2 } from 'lucide-react';

/* ================= Helpers ================= */
export function getAuthToken(): string | null {
  try {
    const ls = localStorage.getItem('auth_token');
    if (ls) return ls;
  } catch {}

  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

type JwtPayload = {
  sub?: string;
  unique_name?: string;
  userId?: string;
  email?: string;
  userType?: string;
  role?: string[];
  exp?: number;
};

function parseJwt(token?: string | null): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    try {
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  }
}

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}

const pickMsg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;

/* ================= API types ================= */
type CourierItem = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  vehicle_type?: string | number | null;
  is_active?: boolean | null;
};

type AssignmentItem = {
  assignment_id: string;
  courier: CourierItem;
  notes?: string | null;
};

/* ================= Page ================= */
export default function AssignCourierToRestaurantPage() {
  const token = React.useMemo(getAuthToken, []);
  const jwt = React.useMemo(() => parseJwt(token || undefined), [token]);
  const restaurantId = React.useMemo(() => jwt?.userId || jwt?.sub || '', [jwt]); // kullanıcıya gösterme

  const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

  // Aktif kuryeler (seçim için)
  const [couriers, setCouriers] = React.useState<CourierItem[]>([]);
  const [couriersLoading, setCouriersLoading] = React.useState(false);
  const [couriersError, setCouriersError] = React.useState<string | null>(null);

  // Restorana atanmış kuryeler
  const [assignments, setAssignments] = React.useState<AssignmentItem[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = React.useState(false);
  const [assignmentsError, setAssignmentsError] = React.useState<string | null>(null);

  // form
  const [selectedCourierId, setSelectedCourierId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [assigning, setAssigning] = React.useState(false);

  // ui
  const [qCourier, setQCourier] = React.useState('');
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  function ok(s: string) { setOkMsg(s); setTimeout(() => setOkMsg(null), 3000); }
  function err(s: string) { setErrMsg(s); setTimeout(() => setErrMsg(null), 4000); }

  // === Aktif kuryeleri getir (SADECE is_active === true) ===
  const loadCouriers = React.useCallback(async () => {
    setCouriersLoading(true);
    setCouriersError(null);
    try {
      const res = await fetch('/yuksi/Courier/list', { cache: 'no-store', headers });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const list = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: CourierItem[] = list
        .map((c: any) => ({
          id: String(c?.id ?? ''),
          first_name: c?.first_name ?? null,
          last_name: c?.last_name ?? null,
          phone: c?.phone ?? null,
          vehicle_type: c?.vehicle_type ?? null,
          is_active: typeof c?.is_active === 'boolean' ? c.is_active : null,
        }))
        .filter((c: CourierItem) => c.id && c.is_active === true); // ← sadece aktif kuryeler

      setCouriers(mapped);
    } catch (e: any) {
      setCouriers([]); setCouriersError(e?.message || 'Kurye listesi alınamadı.');
    } finally {
      setCouriersLoading(false);
    }
  }, [headers]);

  // === Restorana atanmış kuryeleri getir ===
  const loadAssignments = React.useCallback(async () => {
    if (!restaurantId) { setAssignmentsError('Restoran kimliği yok.'); return; }
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const res = await fetch(`/yuksi/Restaurant/${restaurantId}/couriers`, { cache: 'no-store', headers });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      // Beklenen shape:
      // { success, data: { stats: {...}, couriers: [ { id: <assignmentId>, courier_id, first_name, last_name, phone, is_active, notes, ... } ] } }
      const list = Array.isArray(j?.data?.couriers)
        ? j.data.couriers
        : Array.isArray(j?.couriers)
        ? j.couriers
        : Array.isArray(j)
        ? j
        : [];

      const mapped: AssignmentItem[] = list
        .map((x: any) => ({
          assignment_id: String(x?.id ?? ''), // assignment id
          notes: x?.notes ?? null,
          courier: {
            id: String(x?.courier_id ?? ''), // kurye id
            first_name: x?.first_name ?? null,
            last_name: x?.last_name ?? null,
            phone: x?.phone ?? null,
            vehicle_type: null,
            is_active: typeof x?.is_active === 'boolean' ? x.is_active : null,
          },
        }))
        .filter((a: AssignmentItem) => a.assignment_id && a.courier?.id);

      setAssignments(mapped);
    } catch (e: any) {
      setAssignments([]); setAssignmentsError(e?.message || 'Atanmış kurye listesi alınamadı.');
    } finally {
      setAssignmentsLoading(false);
    }
  }, [restaurantId, headers]);

  React.useEffect(() => { loadCouriers(); }, [loadCouriers]);
  React.useEffect(() => { loadAssignments(); }, [loadAssignments]);

  // === Atama ===
  async function assign() {
    setOkMsg(null); setErrMsg(null);
    if (!restaurantId) return err('Restoran kimliği bulunamadı.');
    if (!selectedCourierId) return err('Bir kurye seçin.');

    setAssigning(true);
    try {
      const res = await fetch(`/yuksi/Restaurant/${restaurantId}/assign-courier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ courier_id: selectedCourierId, notes }),
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      ok('Kurye restorana atandı.');
      setSelectedCourierId('');
      setNotes('');
      await loadAssignments();
    } catch (e: any) {
      err(e?.message || 'Kurye atama başarısız.');
    } finally {
      setAssigning(false);
    }
  }

  // === Atamayı kaldır ===
  async function removeAssignment(assignmentId: string) {
    if (!restaurantId || !assignmentId) return;
    try {
      const res = await fetch(`/yuksi/Restaurant/${restaurantId}/couriers/${assignmentId}`, {
        method: 'DELETE',
        headers,
      });
      const j: any = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      ok('Kurye ataması kaldırıldı.');
      await loadAssignments();
    } catch (e: any) {
      err(e?.message || 'Atama kaldırılamadı.');
    }
  }

  const couriersFiltered = React.useMemo(() => {
    if (!qCourier.trim()) return couriers;
    const q = qCourier.toLowerCase();
    return couriers.filter(c => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ').toLowerCase();
      const veh = String(c.vehicle_type ?? '').toLowerCase();
      return name.includes(q) || (c.phone ?? '').toLowerCase().includes(q) || veh.includes(q) || c.id.toLowerCase().includes(q);
    });
  }, [couriers, qCourier]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Restorana Kurye Ata</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCouriers}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            title="Kuryeleri yenile"
          >
            <RefreshCcw className="h-4 w-4" />
            Kuryeleri Yenile
          </button>
          <button
            onClick={loadAssignments}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
            title="Atamaları yenile"
          >
            <RefreshCcw className="h-4 w-4" />
            Atamaları Yenile
          </button>
        </div>
      </div>

      {/* Atama Alanı */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Kurye arama + seç */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Kurye</label>
            <div className="relative">
              <input
                value={qCourier}
                onChange={(e) => setQCourier(e.target.value)}
                placeholder="Kurye ara… (isim, tel, araç)"
                className="mb-2 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 pl-9 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              />
              <Search className="pointer-events-none absolute left-2.5 top-[7px] h-4 w-4 text-neutral-400" />
            </div>
            <select
              value={selectedCourierId}
              onChange={(e) => setSelectedCourierId(e.target.value)}
              disabled={couriersLoading}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 disabled:opacity-60"
            >
              <option value="">{couriersLoading ? 'Yükleniyor…' : 'Kurye seçin… (sadece AKTİF)'}</option>
              {couriersError && <option value="">{couriersError}</option>}
              {!couriersLoading && !couriersError && couriersFiltered.map(c => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'İsimsiz';
                return (
                  <option key={c.id} value={c.id}>
                    {name} • {(c.phone ?? '').trim() || 'tel yok'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Notlar */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Not (opsiyonel)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Örn: Akşam vardiyası"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => { setSelectedCourierId(''); setNotes(''); setOkMsg(null); setErrMsg(null); }}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Temizle
          </button>
          <button
            onClick={assign}
            disabled={assigning || !selectedCourierId}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-700 disabled:opacity-60"
          >
            {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCheck className="h-4 w-4" />}
            Ata
          </button>
        </div>

        {okMsg && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{okMsg}</div>}
        {errMsg && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errMsg}</div>}
      </section>

      {/* Restorana atanmış kuryeler */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">Restorana Atanmış Kuryeler</div>
          {assignmentsLoading && <span className="text-xs text-neutral-500">Yükleniyor…</span>}
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Kurye</th>
                <th className="px-4 py-2">Telefon</th>
                <th className="px-4 py-2">Not</th>
                <th className="px-4 py-2 w-28">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const name = [a.courier.first_name, a.courier.last_name].filter(Boolean).join(' ') || a.courier.id;
                return (
                  <tr key={a.assignment_id} className="border-t text-sm">
                    <td className="px-4 py-2">{name}</td>
                    <td className="px-4 py-2">{a.courier.phone ?? '—'}</td>
                    <td className="px-4 py-2">{a.notes ?? '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => removeAssignment(a.assignment_id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        title="Atamayı kaldır"
                      >
                        <Trash2 className="h-4 w-4" />
                        Kaldır
                      </button>
                    </td>
                  </tr>
                );
              })}
              {assignments.length === 0 && !assignmentsLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-neutral-500">
                    Atanmış kurye yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {assignmentsError && (
          <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {assignmentsError}
          </div>
        )}
      </section>
    </div>
  );
}
