// src/app/dashboards/[role]/restaurants/notifications/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { getAuthToken } from '@/src/utils/auth';

type NotificationType = 'system' | 'order' | 'payout' | 'marketing';
type NotificationStatus = 'unread' | 'read';

type NotificationItem = {
  id: string;
  title: string;
  bodyHtml: string;
  type: NotificationType;
  status: NotificationStatus;   // backend’den gelmediği için sadece görüntü amaçlı
  createdAt: Date;
  meta?: { orderId?: string; amount?: number };
};

// helpers
const fmtDate = (d: Date) => d.toLocaleString('tr-TR');
const typeLabel = (t: NotificationType) =>
  t === 'order' ? 'Sipariş' :
  t === 'payout' ? 'Ödeme' :
  t === 'system' ? 'Sistem' : 'Duyuru';

const statusBadgeClasses = (s: NotificationStatus) =>
  s === 'unread' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700';

const stripHtml = (html: string) => {
  if (!html) return '';
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
};

// API tipleri
type ApiNotification = {
  id: number;
  type: 'bulk' | 'single';
  target_email: string | null;
  user_type: 'all' | 'restaurant' | 'courier' | 'customer';
  subject: string;
  message: string;
  created_at: string;
};

export default function RestaurantNotificationsPage() {
  const { role } = useParams<{ role: string }>();

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'all' | NotificationType>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | NotificationStatus>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [detail, setDetail] = React.useState<NotificationItem | null>(null);

  const [page, setPage] = React.useState(1);
  const pageSize = 6;

  // Listeyi çek
  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        if (!token) throw new Error('Oturum bulunamadı. Lütfen giriş yapınız.');

        const res = await fetch('/yuksi/Notification/list', {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const txt = await res.text();
        let json: any = null;
        try { json = txt ? JSON.parse(txt) : null; } catch {}

        if (!res.ok || json?.success === false) {
          const msg = json?.message || `Liste alınamadı (HTTP ${res.status})`;
          throw new Error(msg);
        }

        const arr: ApiNotification[] = Array.isArray(json?.data) ? json.data : [];
        const mapped: NotificationItem[] = arr.map((n) => ({
          id: String(n.id),
          title: (n.subject ?? '').trim() || '—',
          bodyHtml: String(n.message ?? ''),
          type: 'marketing',
          status: 'unread', // backend okumuyor; sadece rozet için
          createdAt: new Date(n.created_at),
        }));

        if (!alive) return;
        setItems(mapped);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Bildirimler alınamadı.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [role]);

  // Filtre & sayfalama
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((n) => {
      const byText = !q || (n.title + ' ' + stripHtml(n.bodyHtml)).toLowerCase().includes(q);
      const byType = typeFilter === 'all' || n.type === typeFilter;
      const byStatus = statusFilter === 'all' || n.status === statusFilter;
      return byText && byType && byStatus;
    });
  }, [items, query, typeFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  React.useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  // Seçimler
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll(currentPageIds: string[]) {
    setSelectedIds(prev => {
      const allSelected = currentPageIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) currentPageIds.forEach(id => next.delete(id));
      else currentPageIds.forEach(id => next.add(id));
      return next;
    });
  }

  // SİLME — tekli/çoklu
  async function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    if (!confirm(`${ids.length > 1 ? 'Seçili bildirimler' : 'Bildirim'} silinsin mi?`)) return;

    const token = getAuthToken();
    if (!token) {
      alert('Oturum bulunamadı.');
      return;
    }

    // optimistic: önce düş, sonra deneyip hatalıları geri al
    const prevItems = items;
    setItems(prev => prev.filter(n => !ids.includes(n.id)));
    setSelectedIds(new Set());

    try {
      const results = await Promise.allSettled(
        ids.map(id =>
          fetch(`/yuksi/Notification/delete/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          }).then(async (res) => {
            const t = await res.text();
            let j: any = null; try { j = t ? JSON.parse(t) : null; } catch {}
            if (!res.ok || j?.success === false) {
              throw new Error(j?.message || `Silinemedi (HTTP ${res.status})`);
            }
            return true;
          })
        )
      );

      const failed = results
        .map((r, i) => ({ r, id: ids[i] }))
        .filter(x => x.r.status === 'rejected');

      if (failed.length) {
        // başarısız olanları geri ekle
        const failedIds = new Set(failed.map(f => f.id));
        setItems(curr => [
          ...curr,
          ...prevItems.filter(n => failedIds.has(n.id)),
        ].sort((a, b) => +a.createdAt - +b.createdAt));
        alert(`Silinemeyen ${failed.length} kayıt var.`);
      }
    } catch (e: any) {
      // genel hata -> rollback
      setItems(prevItems);
      alert(e?.message || 'Silme işlemi başarısız.');
    }
  }

  function clearFilters() {
    setQuery(''); setTypeFilter('all'); setStatusFilter('all'); setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bildirimler</h1>
        {/* “Tümünü Okundu Yap” KALDIRILDI */}
      </div>

      {/* Filters */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara: başlık veya içerik…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-sky-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Tür</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
            >
              <option value="all">Tümü</option>
              <option value="order">Sipariş</option>
              <option value="payout">Ödeme</option>
              <option value="system">Sistem</option>
              <option value="marketing">Duyuru</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-600">Durum</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
            >
              <option value="all">Tümü</option>
              <option value="unread">Okunmadı</option>
              <option value="read">Okundu</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <div className="text-xs text-neutral-500">
            {loading ? 'Yükleniyor…' : error ? <span className="text-rose-600">{error}</span> :
              <>Toplam <strong>{filtered.length}</strong> bildirim</>}
          </div>
          <button
            onClick={clearFilters}
            className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-300"
          >
            Filtreleri Sıfırla
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        {/* Tablo (desktop) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full border-t border-neutral-200/70">
            <thead>
              <tr className="text-left text-sm text-neutral-500">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Sayfadaki tümünü seç"
                    checked={paged.length > 0 && paged.every(n => selectedIds.has(n.id))}
                    onChange={() => toggleSelectAll(paged.map(n => n.id))}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Başlık</th>
                <th className="px-4 py-3 font-medium w-[140px]">Tür</th>
                <th className="px-4 py-3 font-medium w-[120px]">Durum</th>
                <th className="px-4 py-3 font-medium w-[180px]">Tarih</th>
                <th className="px-4 py-3 font-medium w-[220px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">Yükleniyor…</td>
                </tr>
              )}

              {!loading && !error && paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-500">Kayıt yok.</td>
                </tr>
              )}

              {!loading && !error && paged.map((n) => (
                <tr key={n.id} className="border-t border-neutral-200/70 hover:bg-neutral-50">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      aria-label="Seç"
                      checked={selectedIds.has(n.id)}
                      onChange={() => toggleSelect(n.id)}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-neutral-900">{n.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-neutral-600">
                      {stripHtml(n.bodyHtml)}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">{typeLabel(n.type)}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(n.status)}`}>
                      {n.status === 'unread' ? 'Okunmadı' : 'Okundu'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">{fmtDate(n.createdAt)}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetail(n)}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-600"
                      >
                        Görüntüle
                      </button>
                      <button
                        onClick={() => deleteIds([n.id])}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-600"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kart görünümü (mobil) */}
        <div className="md:hidden border-t border-neutral-200/70">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
            <input
              type="checkbox"
              aria-label="Sayfadaki tümünü seç"
              checked={paged.length > 0 && paged.every(n => selectedIds.has(n.id))}
              onChange={() => toggleSelectAll(paged.map(n => n.id))}
            />
            <span className="text-xs text-neutral-500">Tümünü seç</span>
          </div>

          <div className="px-4 py-3 space-y-3">
            {loading && (
              <div className="py-10 text-center text-neutral-500">Yükleniyor…</div>
            )}

            {!loading && !error && paged.length === 0 && (
              <div className="py-10 text-center text-neutral-500">Kayıt yok.</div>
            )}

            {!loading && !error && paged.map((n) => (
              <div key={n.id} className="rounded-xl border border-neutral-200/70 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label="Seç"
                    checked={selectedIds.has(n.id)}
                    onChange={() => toggleSelect(n.id)}
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-neutral-900">{n.title}</div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(n.status)}`}>
                        {n.status === 'unread' ? 'Okunmadı' : 'Okundu'}
                      </span>
                    </div>
                    <div className="line-clamp-2 text-sm text-neutral-600">{stripHtml(n.bodyHtml)}</div>
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{typeLabel(n.type)}</span>
                      <span>{fmtDate(n.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDetail(n)}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-600"
                      >
                        Görüntüle
                      </button>
                      <button
                        onClick={() => deleteIds([n.id])}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-600"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer: Seçilileri Sil + Sayfalama */}
        {!loading && !error && paged.length > 0 && (
          <div className="border-t border-neutral-200/70">
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteIds(Array.from(selectedIds))}
                  disabled={selectedIds.size === 0}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-50"
                >
                  Seçilileri Sil
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-300 disabled:opacity-50"
                >
                  Önceki
                </button>
                <span className="text-sm text-neutral-700">
                  Sayfa <strong>{page}</strong> / {pageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="rounded-lg bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-300 disabled:opacity-50"
                >
                  Sonraki
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {detail && (
        <DetailDrawer
          item={detail}
          onClose={() => setDetail(null)}
          onDelete={() => {
            deleteIds([detail.id]);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Detail Drawer ---------- */
function DetailDrawer({
  item, onClose, onDelete,
}: {
  item: NotificationItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid bg-black/40">
      <div className="ml-auto h-full w-full max-w-xl bg-white shadow-2xl animate-in slide-in-from-right overflow-y-auto">
        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold truncate">{item.title}</h3>
            <div className="mt-1 text-xs text-neutral-500">{fmtDate(item.createdAt)}</div>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="rounded-full p-2 hover:bg-neutral-100">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(item.status)}`}>
              {item.status === 'unread' ? 'Okunmadı' : 'Okundu'}
            </span>
            <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700">
              {typeLabel(item.type)}
            </span>
          </div>

          {/* HTML içeriği */}
          <div
            className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-900 prose max-w-none"
            dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          {/* “Okundu İşaretle” BUTONU KALDIRILDI */}
          <button onClick={onDelete} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600">
            Sil
          </button>
          <button onClick={onClose} className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
