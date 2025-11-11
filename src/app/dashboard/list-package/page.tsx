// src/app/dashboards/[role]/restaurants/list-package/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAuthToken } from '@/src/utils/auth';

/* ================= helpers ================= */
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try { return t ? JSON.parse(t) : (null as any); } catch { return (t as any); }
}
const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}
function fmtTRY(n?: number | null) {
  if (n == null) return '-';
  try { return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }); }
  catch { return String(n); }
}
function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('tr-TR'); } catch { return iso; }
}
function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
}

/* =============== API types ================= */
type PackageInfo = {
  id?: string | null;
  restaurantId?: string | null;
  unit_price?: number | null;
  last_package?: number | null;
  next_package?: number | null;
  note?: string | null;
  updated_at?: string | null;
};
type PackageStatus = {
  package_info?: PackageInfo;
  max_package?: number | null;
  delivered_count?: number | null;
  total_count?: number | null;
  remaining_packages?: number | null;
  has_package_left?: boolean | null;
  warning_message?: string | null; // ✅
};
type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: PackageStatus;
};

/* ================== Page =================== */
export default function RestaurantPackageStatusPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();

  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

  const [data, setData] = React.useState<PackageStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  function toast(s: string) { setInfo(s); setTimeout(() => setInfo(null), 2200); }

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/yuksi/PackagePrice/package-status', {
        headers,
        cache: 'no-store',
      });
      const j = await readJson<ApiResponse>(res);
      if (!res.ok || (j && (j as any).success === false)) {
        throw new Error(pickMsg(j, `HTTP ${res.status}`));
      }
      const payload = (j?.data ?? (j as any)?.data) as PackageStatus | undefined;
      setData(payload ?? null);
      if ((j as any)?.message) toast((j as any).message);
    } catch (e: any) {
      setError(e?.message || 'Paket durumu alınamadı.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  React.useEffect(() => { load(); }, [load]);

  const maxPkg = data?.max_package ?? 0;
  const delivered = data?.delivered_count ?? 0;
  const totalOrdered = data?.total_count ?? 0;
  const remaining = data?.remaining_packages ?? Math.max(0, maxPkg - delivered);
  const percentUsed = pct(delivered, maxPkg || (delivered + remaining));

  // ✅ paket bitti mi?
  const outOfPackages = data?.has_package_left === false || remaining <= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Paket Durumu</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
          >
            Yenile
          </button>
        </div>
      </div>

      {info && (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm shadow">
          {info}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title="Toplam Paket Hakkı" value={maxPkg} />
          <Stat title="Teslim Edilen" value={delivered} />
          <Stat title="Satın Alınan Paket" value={totalOrdered} />
          <Stat title="Kalan Paket" value={remaining} />
        </div>

        {/* progress */}
        <div className="px-5 pb-5">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-neutral-600">Kullanım</span>
            <span className="font-medium text-neutral-800">{percentUsed}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-3 rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {delivered} / {maxPkg} teslimat kullanıldı
            {data?.has_package_left === false && (
              <span className="ml-2 rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 ring-1 ring-rose-100">
                Paket hakkı bitmiş
              </span>
            )}
          </div>

          {/* warning message (API'den geldiğinde göster) */}
          {data?.warning_message && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {data.warning_message}
            </div>
          )}

          {/* ✅ Paket bitince satın alma butonu */}
          {outOfPackages && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => router.push('/dashboards/restaurant/restaurants/buy-package')}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                Paket Satın Al
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Package detail */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Paket Bilgisi</h2>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-neutral-500">Yükleniyor…</div>
        )}

        {!loading && (
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Info title="Paket ID" value={data?.package_info?.id || '-'} mono />
            <Info title="Restaurant ID" value={data?.package_info?.restaurantId || '-'} mono />
            <Info title="Birim Fiyat" value={fmtTRY(data?.package_info?.unit_price)} />
            <Info title="Son Paket" value={data?.package_info?.last_package ?? '-'} />
            <Info title="Sonraki Paket" value={data?.package_info?.next_package ?? '-'} />
            <Info title="Güncelleme" value={fmtDate(data?.package_info?.updated_at)} />
            <div className="sm:col-span-2">
              <div className="mb-1 text-sm font-medium text-neutral-700">Not</div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-900">
                {data?.package_info?.note || '-'}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============== small components ============== */
function Stat({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-neutral-900">{value ?? '-'}</div>
    </div>
  );
}
function Info({
  title, value, mono,
}: { title: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-neutral-700">{title}</div>
      <div className={`rounded-xl border border-neutral-200 bg-white px-3 py-2 ${mono ? 'font-mono' : ''}`}>
        {value ?? '-'}
      </div>
    </div>
  );
}
