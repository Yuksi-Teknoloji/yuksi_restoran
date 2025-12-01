//src/app/dashboard/list-load/ListLoad.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getAuthToken } from '@/src/utils/auth';

import 'leaflet/dist/leaflet.css';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from 'react-leaflet';

type Job = {
  id: string;
  deliveryType?: string;
  carrierType?: string;
  vehicleType?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  specialNotes?: string;
  campaignCode?: string;
  extraServices?: any[];
  extraServicesTotal?: number;
  totalPrice?: number;
  paymentMethod?: string;
  imageFileIds?: string[]; // API bazen JSON-string döndürebilir, loader parse ediyor
  // görüntü amaçlı
  createdAt?: string;
  pickupCoordinates?: [number, number] | null;
  dropoffCoordinates?: [number, number] | null;

  // Yeni:
  deliveryDate?: string | null; // "DD.MM.YYYY" ya da null
  deliveryTime?: string | null; // "HH:mm" ya da null
};

type LatLng = { lat: number; lng: number };

const PAGE_SIZE = 10;

/* ---------- helpers ---------- */
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text().catch(() => '');
  try {
    return t ? JSON.parse(t) : ({} as any);
  } catch {
    return t as any;
  }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.title || d?.detail || fb;

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

function parseMaybeJsonArray(val: any): string[] | undefined {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return undefined;
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? arr.map(String) : [s];
    } catch {
      if (s.includes(',')) return s.split(',').map((x) => x.trim()).filter(Boolean);
      return [s];
    }
  }
  return undefined;
}

// "DD.MM.YYYY" <-> "YYYY-MM-DD" dönüşümleri
function trToHtmlDate(tr?: string | null) {
  if (!tr) return '';
  const parts = tr.split('.');
  if (parts.length !== 3) return '';
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}
function htmlToTrDate(html?: string | null) {
  if (!html) return '';
  const [yyyy, mm, dd] = html.split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}.${mm}.${yyyy}`;
}
function fmtAppt(date?: string | null, time?: string | null) {
  if (!date && !time) return '-';
  if (date && time) return `${date} ${time}`;
  return date || time || '-';
}

// "14:30:00" / "14.30" / "1430" -> "14:30"
function normalizeTimeToHHmm(raw?: string | null) {
  if (!raw) return '';
  const s = String(raw).trim();
  // 1) HH:mm
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  // 2) HH:mm:ss
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  // 3) HH.mm veya HH.mm.ss
  if (/^\d{2}\.\d{2}(\.\d{2})?$/.test(s)) return s.replace('.', ':').slice(0, 5);
  // 4) HHmm
  if (/^\d{4}$/.test(s)) return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
  return '';
}

/* ====================================================== */

export default function RestaurantJobsPage() {
  const { role } = useParams<{ role: string }>();

  const [rows, setRows] = React.useState<Job[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);

  // auth
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

  // offset tabanlı backend varsa ileride kullanmak için bıraktım
  const [offset] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // rewrite: /yuksi/:path* → https://www.yuksi.dev/api/:path*
      const res = await fetch(`/yuksi/Restaurant/jobs?offset=${offset}`, {
        cache: 'no-store',
        headers,
      });

      const data: any = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

      const arr: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

      const mapped: Job[] = arr.map((j: any) => ({
        id: String(j.id),
        deliveryType: j.deliveryType ?? '',
        carrierType: j.carrierType ?? '',
        vehicleType: j.vehicleType ?? '',
        pickupAddress: j.pickupAddress ?? '',
        dropoffAddress: j.dropoffAddress ?? '',
        specialNotes: j.specialNotes ?? '',
        campaignCode: j.campaignCode ?? '',
        extraServices: Array.isArray(j.extraServices) ? j.extraServices : [],
        extraServicesTotal:
          typeof j.extraServicesTotal === 'number' ? j.extraServicesTotal : undefined,
        totalPrice: typeof j.totalPrice === 'number' ? j.totalPrice : undefined,
        paymentMethod: j.paymentMethod ?? '',
        imageFileIds: parseMaybeJsonArray(j.imageFileIds),
        createdAt: j.createdAt ?? '',
        pickupCoordinates: Array.isArray(j.pickupCoordinates) ? j.pickupCoordinates : null,
        dropoffCoordinates: Array.isArray(j.dropoffCoordinates) ? j.dropoffCoordinates : null,

        // yeni:
        deliveryDate: j.deliveryDate ?? null,
        deliveryTime: j.deliveryTime ?? null,
      }));

      setRows(mapped);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || 'Yük listesi alınamadı.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, offset]);

  React.useEffect(() => {
    load();
  }, [load]);

  /* ----- filtre + client-side sayfalama ----- */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.id,
        r.deliveryType,
        r.carrierType,
        r.vehicleType,
        r.pickupAddress,
        r.dropoffAddress,
        r.paymentMethod,
        r.campaignCode,
        r.specialNotes,
        r.deliveryDate,
        r.deliveryTime,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  /* ----- edit + delete ----- */
  const [editing, setEditing] = React.useState<Job | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm('Kaydı silmek istiyor musunuz?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/yuksi/Restaurant/jobs/${id}`, { method: 'DELETE', headers });
      const j = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      await load();
    } catch (e: any) {
      alert(e?.message || 'Silme işlemi başarısız.');
    } finally {
      setBusyId(null);
    }
  }

  async function onUpdateSubmit(id: string, body: any) {
    setBusyId(id);
    try {
      const res = await fetch(`/yuksi/Restaurant/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const j = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Güncelleme başarısız.');
    } finally {
      setBusyId(null);
    }
  }

  /* ----- Haritada Göster (dealer sayfasından alınan kısım) ----- */

  const [routeOpen, setRouteOpen] = React.useState(false);
  const [routeFor, setRouteFor] = React.useState<Job | null>(null);
  const [routeLoading, setRouteLoading] = React.useState(false);
  const [start, setStart] = React.useState<LatLng | null>(null);
  const [end, setEnd] = React.useState<LatLng | null>(null);
  const [routeErr, setRouteErr] = React.useState<string | null>(null);

  const geoCache = React.useRef<Map<string, LatLng>>(new Map());

  async function geocodeOnce(address: string): Promise<LatLng> {
    const key = address.trim();
    if (!key) throw new Error('Adres boş.');
    const c = geoCache.current.get(key);
    if (c) return c;

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('limit', '1');
    url.searchParams.set('q', key);
    const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'tr' } });
    const arr = (await res.json()) as any[];
    if (!arr?.length) throw new Error('Adres bulunamadı: ' + key);
    const lat = Number(arr[0].lat),
      lng = Number(arr[0].lon);
    const v = { lat, lng };
    geoCache.current.set(key, v);
    return v;
  }

  async function showRoute(r: Job) {
    setRouteOpen(true);
    setRouteFor(r);
    setRouteLoading(true);
    setRouteErr(null);
    setStart(null);
    setEnd(null);

    try {
      // Önce koordinatları dene, yoksa adres geocode'a düş
      if (
        Array.isArray(r.pickupCoordinates) &&
        r.pickupCoordinates.length === 2 &&
        Array.isArray(r.dropoffCoordinates) &&
        r.dropoffCoordinates.length === 2
      ) {
        const [plat, plng] = r.pickupCoordinates;
        const [dlat, dlng] = r.dropoffCoordinates;
        setStart({ lat: plat, lng: plng });
        setEnd({ lat: dlat, lng: dlng });
      } else {
        const [s, e] = await Promise.all([
          geocodeOnce(r.pickupAddress || ''),
          geocodeOnce(r.dropoffAddress || ''),
        ]);
        setStart(s);
        setEnd(e);
      }
    } catch (e: any) {
      setRouteErr(e?.message || 'Konumlar getirilemedi.');
    } finally {
      setRouteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Yük Listesi (Restaurant)</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
          >
            Yenile
          </button>
          <Link
            href={`/dashboards/${role}/restaurants/create-load`}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-700"
          >
            Yeni Yük
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="p-6">
          <div className="space-y-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Ara: id, araç tipi, adres, ödeme yöntemi…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-sky-200"
            />
            <p className="text-sm text-neutral-500">
              Toplam {filtered.length} kayıt • Bu sayfada {pageRows.length} kayıt
              {query ? ` (filtre: “${query}”)` : ''}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-t border-neutral-200/70">
            <thead>
              <tr className="text-left text-sm text-neutral-500">
                <th className="px-6 py-3 font-medium">ID</th>
                <th className="px-6 py-3 font-medium">Teslimat</th>
                <th className="px-6 py-3 font-medium">Araç</th>
                <th className="px-6 py-3 font-medium">Adres (Alış → Bırakış)</th>
                <th className="px-6 py-3 font-medium">Randevu</th>
                <th className="px-6 py-3 font-medium">Ödeme</th>
                <th className="px-6 py-3 font-medium">Tutar</th>
                <th className="px-6 py-3 font-medium">Oluşturma</th>
                <th className="px-6 py-3 font-medium w-[260px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-neutral-500">
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-8 whitespace-pre-wrap text-center text-rose-600"
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                pageRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-neutral-200/70 align-top hover:bg-neutral-50"
                  >
                    <td className="px-3 py-4">
                      <div className="font-mono text-sm text-neutral-900">{r.id}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-neutral-900">
                        {r.deliveryType || '-'}
                        {r.carrierType ? ` • ${r.carrierType}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-neutral-900">{r.vehicleType || '-'}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="max-w-[480px] text-neutral-900">
                        <div className="line-clamp-2">{r.pickupAddress || '-'}</div>
                        <div className="text-neutral-500">→</div>
                        <div className="line-clamp-2">{r.dropoffAddress || '-'}</div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-neutral-900">
                        {fmtAppt(r.deliveryDate, r.deliveryTime)}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-neutral-900">{r.paymentMethod || '-'}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-neutral-900 tabular-nums">
                        {typeof r.totalPrice === 'number' ? r.totalPrice.toFixed(2) : '-'}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-neutral-900">{r.createdAt || '-'}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          onClick={() => showRoute(r)}
                          className="rounded-lg bg-sky-600 px-2 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                        >
                          Haritada Göster
                        </button>
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded-lg bg-amber-500 px-2 py-1.5 text-sm font-semibold text-white shadow hover:bg-amber-600"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => onDelete(r.id)}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-rose-500 px-2 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-60"
                        >
                          {busyId === r.id ? 'Siliniyor…' : 'Sil'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && !error && pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-sm text-neutral-500"
                  >
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Client-side sayfalama */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 text-sm text-neutral-600">
            <span>
              Sayfa {page} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                ‹ Önceki
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                Sonraki ›
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Harita modalı */}
      {routeOpen && routeFor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setRouteOpen(false)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold">
                Rota:{' '}
                <span className="font-normal">{routeFor.pickupAddress || '-'}</span> ➜{' '}
                <span className="font-normal">{routeFor.dropoffAddress || '-'}</span>
              </h3>
              <button
                onClick={() => setRouteOpen(false)}
                className="rounded-full p-2 hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            {routeErr && (
              <div className="m-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {routeErr}
              </div>
            )}
            {routeLoading && (
              <div className="p-4 text-sm text-neutral-500">Konumlar yükleniyor…</div>
            )}

            {!routeLoading && !routeErr && start && end && (
              <div className="p-4">
                <div style={{ height: 420 }} className="rounded-xl overflow-hidden">
                  <RouteMap start={start} end={end} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <EditJobModal
          row={editing}
          onClose={() => setEditing(null)}
          onSubmit={(payload) => onUpdateSubmit(editing.id, payload)}
        />
      )}
    </div>
  );
}

/* =================== Edit Modal =================== */
function EditJobModal({
  row,
  onClose,
  onSubmit,
}: {
  row: Job;
  onClose: () => void;
  onSubmit: (payload: {
    deliveryType?: string;
    carrierType?: string;
    vehicleType?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    specialNotes?: string;
    campaignCode?: string;
    extraServices?: any[];
    extraServicesTotal?: number;
    totalPrice?: number;
    paymentMethod?: string;
    imageFileIds?: string[];
    deliveryDate?: string | null;
    deliveryTime?: string | null;
  }) => void;
}) {
  const [deliveryType, setDeliveryType] = React.useState(row.deliveryType ?? '');
  const [carrierType, setCarrierType] = React.useState(row.carrierType ?? '');
  const [vehicleType, setVehicleType] = React.useState(row.vehicleType ?? '');
  const [pickupAddress, setPickupAddress] = React.useState(row.pickupAddress ?? '');
  const [dropoffAddress, setDropoffAddress] = React.useState(row.dropoffAddress ?? '');
  const [specialNotes, setSpecialNotes] = React.useState(row.specialNotes ?? '');
  const [campaignCode, setCampaignCode] = React.useState(row.campaignCode ?? '');
  const [extraServicesJson, setExtraServicesJson] = React.useState(
    JSON.stringify(row.extraServices ?? [], null, 2),
  );
  const [extraServicesTotal, setExtraServicesTotal] = React.useState<number | ''>(
    typeof row.extraServicesTotal === 'number' ? row.extraServicesTotal : '',
  );
  const [totalPrice, setTotalPrice] = React.useState<number | ''>(
    typeof row.totalPrice === 'number' ? row.totalPrice : '',
  );
  const [paymentMethod, setPaymentMethod] = React.useState(row.paymentMethod ?? '');
  const [imageIds, setImageIds] = React.useState<string>(
    (row.imageFileIds ?? []).join(','),
  );

  // Yeni: randevu alanları
  const [dDate, setDDate] = React.useState<string>(
    trToHtmlDate(row.deliveryDate || undefined),
  );
  // BURASI admin/shipments/EditModal ile aynı: state'e doğrudan backend değeri (veya '') koyuyoruz
  const [dTime, setDTime] = React.useState<string>(row.deliveryTime || '');

  function save(e: React.FormEvent) {
    e.preventDefault();
    let parsedExtra: any[] | undefined;
    try {
      const trimmed = extraServicesJson.trim();
      parsedExtra = trimmed ? JSON.parse(trimmed) : [];
      if (!Array.isArray(parsedExtra)) throw new Error('extraServices bir dizi olmalı');
    } catch {
      alert('Extra Services JSON geçerli değil.');
      return;
    }

    const imageFileIds =
      imageIds
        ?.split(',')
        .map((x) => x.trim())
        .filter(Boolean) || undefined;

    onSubmit({
      deliveryType: deliveryType || undefined,
      carrierType: carrierType || undefined,
      vehicleType: vehicleType || undefined,
      pickupAddress: pickupAddress || undefined,
      dropoffAddress: dropoffAddress || undefined,
      specialNotes: specialNotes || undefined,
      campaignCode: campaignCode || undefined,
      extraServices: parsedExtra,
      extraServicesTotal: extraServicesTotal === '' ? undefined : Number(extraServicesTotal),
      totalPrice: totalPrice === '' ? undefined : Number(totalPrice),
      paymentMethod: paymentMethod || undefined,
      imageFileIds,

      // boş bırakılırsa null göndererek immediate'a temizleme imkanı
      deliveryDate: dDate ? htmlToTrDate(dDate) : null,
      // submit ederken normalize ediyoruz (input value'da değil)
      deliveryTime: dTime ? normalizeTimeToHHmm(dTime) : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* daha küçük genişlik + yükseklik sınırı */}
      <div className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl grid grid-rows-[auto,1fr,auto]">
        {/* header (sticky görünümü için ayrı satır) */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base sm:text-lg font-semibold">Yük Kaydını Düzenle</h3>
          <button
            className="rounded-full p-2 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        {/* scrollable content */}
        <form onSubmit={save} className="overflow-y-auto p-4 pb-28">
          <div className="grid gap-4 sm:grid-cols-2 pb-28">
            <Field label="Teslimat Tipi">
              <input
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value)}
                placeholder="immediate / scheduled"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Carrier Type">
              <input
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Araç Tipi">
              <input
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Ödeme Yöntemi">
              <input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="cash / card …"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Toplam Tutar">
              <input
                type="number"
                step="0.01"
                value={totalPrice as any}
                onChange={(e) =>
                  setTotalPrice(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Ek Hizmetler Toplamı">
              <input
                type="number"
                step="0.01"
                value={extraServicesTotal as any}
                onChange={(e) =>
                  setExtraServicesTotal(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>

            <Field label="Alım Adresi">
              <textarea
                rows={2}
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Bırakış Adresi">
              <textarea
                rows={2}
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>

            <Field label="Kampanya Kodu">
              <input
                value={campaignCode}
                onChange={(e) => setCampaignCode(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Notlar">
              <textarea
                rows={2}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>

            <Field label="Image File Ids (virgül ile)">
              <input
                value={imageIds}
                onChange={(e) => setImageIds(e.target.value)}
                placeholder="id1,id2,id3"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>

            {/* Randevu bilgileri */}
            <Field label="Teslim Tarihi">
              <input
                type="date"
                value={dDate}
                onChange={(e) => setDDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>
            <Field label="Teslim Saati">
              <input
                type="time"
                value={dTime}
                onChange={(e) => setDTime(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              />
            </Field>

            <div className="sm:col-span-2">
              <div className="mb-1 text-sm font-medium text-neutral-700">
                Extra Services (JSON array)
              </div>
              <textarea
                rows={6}
                value={extraServicesJson}
                onChange={(e) => setExtraServicesJson(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          {/* sticky footer buttons (form içinde ama alt satıra sabit) */}
          <div className="sticky bottom-0 mt-4 -mx-4 border-t bg-white px-4 py-3">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
              >
                İptal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* small field wrapper */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-neutral-700">{label}</div>
      {children}
    </div>
  );
}

/* ================= Route Map (markers + OSRM polyline) ================= */

function FitBounds({ start, end }: { start: LatLng; end: LatLng }) {
  const map = useMap();
  React.useEffect(() => {
    try {
      map.fitBounds(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        { padding: [30, 30] },
      );
    } catch {}
  }, [map, start, end]);
  return null;
}

function RouteMap({ start, end }: { start: LatLng; end: LatLng }) {
  const [points, setPoints] = React.useState<[number, number][]>([]);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchRoute() {
      setRouteError(null);
      try {
        // OSRM rota servisi: en kısa sürüş rotası
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const j: any = await res.json();
        const coords: [number, number][] =
          j?.routes?.[0]?.geometry?.coordinates?.map((c: [number, number]) => [c[1], c[0]]) ??
          [];
        if (!coords.length) throw new Error('Rota bulunamadı');
        if (!cancelled) {
          setPoints(coords);
        }
      } catch (e) {
        console.error('OSRM route error, falling back to straight line:', e);
        if (!cancelled) {
          setRouteError('Rota hesaplanamadı, kuş uçuşu çizgi gösteriliyor.');
          setPoints([
            [start.lat, start.lng],
            [end.lat, end.lng],
          ]);
        }
      }
    }

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [start.lat, start.lng, end.lat, end.lng]);

  const center: [number, number] = [(start.lat + end.lat) / 2, (start.lng + end.lng) / 2];
  const polyPositions = points.length
    ? (points as [number, number][])
    : ([[start.lat, start.lng], [end.lat, end.lng]] as [number, number][]);

  return (
    <>
      {routeError && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          {routeError}
        </div>
      )}
      <MapContainer center={center} zoom={12} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <FitBounds start={start} end={end} />
        <CircleMarker
          center={[start.lat, start.lng]}
          radius={8}
          pathOptions={{ color: '#22c55e', weight: 3, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Alım Noktası
          </Tooltip>
        </CircleMarker>
        <CircleMarker
          center={[end.lat, end.lng]}
          radius={8}
          pathOptions={{ color: '#ef4444', weight: 3, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Teslim Noktası
          </Tooltip>
        </CircleMarker>
        <Polyline positions={polyPositions} pathOptions={{ weight: 4, opacity: 0.85 }} />
      </MapContainer>
    </>
  );
}
