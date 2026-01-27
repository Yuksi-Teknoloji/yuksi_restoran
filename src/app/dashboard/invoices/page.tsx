// src/app/dashboards/[role]/restaurants/invoices/page.tsx
'use client';

import * as React from 'react';

type InvoiceStatus = 'Ödendi' | 'Beklemede' | 'İptal';
type Row = {
  id: string;
  invoiceNo: string;
  restaurant: string;
  date: string;   // ISO yyyy-mm-dd
  amount: number; // ₺
  status: InvoiceStatus;
};

const SEED: Row[] = [
  { id: 'i-1', invoiceNo: 'INV-240901', restaurant: 'BurgerLab Kadıköy', date: '2025-09-02', amount: 1450, status: 'Ödendi' },
  { id: 'i-2', invoiceNo: 'INV-240902', restaurant: 'PizzaPort Beşiktaş', date: '2025-09-05', amount: 890, status: 'Beklemede' },
  { id: 'i-3', invoiceNo: 'INV-240903', restaurant: 'SushiGo Ataşehir', date: '2025-09-12', amount: 2130, status: 'Ödendi' },
  { id: 'i-4', invoiceNo: 'INV-240904', restaurant: 'Köfteci Usta Şişli', date: '2025-09-15', amount: 560, status: 'İptal' },
];

export default function RestaurantInvoicesPage() {
  // Filters
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<'' | InvoiceStatus>('');
  const [start, setStart] = React.useState<string>(firstDayOfMonth());
  const [end, setEnd] = React.useState<string>(today());

  // Data
  const [rows] = React.useState<Row[]>(SEED);

  const filtered = React.useMemo(() => {
    const s = start ? new Date(start) : undefined;
    const e = end ? new Date(end) : undefined;

    return rows.filter((r) => {
      const qMatch =
        !q ||
        r.invoiceNo.toLowerCase().includes(q.toLowerCase()) ||
        r.restaurant.toLowerCase().includes(q.toLowerCase());

      const stMatch = !status || r.status === status;

      const d = new Date(r.date);
      const inRange = (!s || d >= s) && (!e || d <= e);

      return qMatch && stMatch && inRange;
    });
  }, [rows, q, status, start, end]);

  const total = filtered.reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Restoran Faturaları</h1>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm soft-card overflow-hidden">
        {/* Filters */}
        <div className="px-4 lg:px-6 py-4 sm:py-6">
          <div className="grid items-end gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-[minmax(240px,1fr)_180px_150px_150px]">
            {/* Search */}
            <div className="sm:col-span-2 md:col-span-1">
              <label className="mb-1 block text-sm font-semibold text-neutral-700">
                Fatura No / Restoran
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Örn: INV-2409 / Restoran adı"
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              />
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus | '')}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              >
                <option value="">Tümü</option>
                <option>Ödendi</option>
                <option>Beklemede</option>
                <option>İptal</option>
              </select>
            </div>

            {/* Start */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Başlangıç</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              />
            </div>

            {/* End */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Bitiş</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none ring-2 ring-transparent transition focus:ring-sky-200"
              />
            </div>
          </div>
        </div>

        {/* Tablo (desktop) */}
        <div className="border-t border-neutral-200/70 hidden sm:block">
          <div className="overflow-x-auto bg-white px-4 lg:px-6">
            <table className="w-full table-fixed">
              <thead>
                <tr className="text-left text-sm text-neutral-500">
                  <th className="px-4 lg:px-6 py-3 font-medium">Fatura No</th>
                  <th className="px-4 lg:px-6 py-3 font-medium">Restoran</th>
                  <th className="px-4 lg:px-6 py-3 font-medium">Tarih</th>
                  <th className="px-4 lg:px-6 py-3 font-medium">Tutar</th>
                  <th className="px-4 lg:px-6 py-3 font-medium">Durum</th>
                  <th className="px-4 lg:px-6 py-3 font-medium w-40">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200/70 hover:bg-neutral-50 align-middle">
                    <td className="px-4 lg:px-6 py-3 font-medium text-neutral-900">{r.invoiceNo}</td>
                    <td className="px-4 lg:px-6 py-3">{r.restaurant}</td>
                    <td className="px-4 lg:px-6 py-3">{new Date(r.date).toLocaleDateString('tr-TR')}</td>
                    <td className="px-4 lg:px-6 py-3 font-semibold">{formatCurrency(r.amount)}</td>
                    <td className="px-4 lg:px-6 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 lg:px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                          onClick={() => alert(`Fatura görüntüle: ${r.invoiceNo}`)}
                        >
                          Görüntüle
                        </button>
                        <button
                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
                          onClick={() => alert(`PDF indir: ${r.invoiceNo}`)}
                        >
                          İndir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>

              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-neutral-200/70">
                    <td className="px-4 lg:px-6 py-3 text-sm text-neutral-600" colSpan={3}>
                      Toplam {filtered.length} fatura
                    </td>
                    <td className="px-4 lg:px-6 py-3 font-semibold">{formatCurrency(total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Kart görünümü (mobil) */}
        <div className="border-t border-neutral-200/70 sm:hidden">
          <div className="px-4 py-4 space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-xl border border-neutral-200/70 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-neutral-900">{r.invoiceNo}</div>
                    <div className="text-xs text-neutral-500">{r.restaurant}</div>
                  </div>
                  <StatusPill status={r.status} />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">{new Date(r.date).toLocaleDateString('tr-TR')}</span>
                  <span className="font-semibold">{formatCurrency(r.amount)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                    onClick={() => alert(`Fatura görüntüle: ${r.invoiceNo}`)}
                  >
                    Görüntüle
                  </button>
                  <button
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
                    onClick={() => alert(`PDF indir: ${r.invoiceNo}`)}
                  >
                    İndir
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-neutral-500">Kayıt bulunamadı.</div>
            )}

            {filtered.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                <span className="text-neutral-600">Toplam {filtered.length} fatura</span>
                <span className="font-semibold">{formatCurrency(total)}</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* --- Small helpers --- */
function StatusPill({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, string> = {
    Ödendi: 'bg-emerald-500 text-white',
    Beklemede: 'bg-amber-500 text-white',
    İptal: 'bg-rose-500 text-white',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${map[status]}`}>
      {status}
    </span>
  );
}

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function firstDayOfMonth() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-01`;
}
function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}
