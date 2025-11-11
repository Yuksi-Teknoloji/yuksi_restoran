'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';

/* ========== Auth helper (verdiğin) ========== */
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

/* ========== küçük yardımcılar ========== */
const readJson = async (res: Response) => {
  const t = await res.text();
  try { return t ? JSON.parse(t) : null; } catch { return t as any; }
};
const pickMsg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('tr-TR') : '-');

/* ========== API modelleri (Swagger’a göre) ========== */
// GET /api/Ticket/my elemanları
type TicketItem = {
  id: number;
  user_id?: string;
  email?: string | null;
  restaurant_name?: string | null;
  subject: string;
  message: string;
  status?: 'answered' | 'pending' | string;
  reply?: string | null;
  created_at?: string | null;
  replied_at?: string | null;
};

/* UI satırı */
type Row = {
  id: number;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  repliedAt: string;
  email: string;
  restaurant: string;
  reply?: string | null;
};

function statusBadgeCls(s: string) {
  const v = (s || '').toLowerCase();
  if (v === 'answered' || v === 'onaylandı' || v === 'resolved') return 'bg-emerald-100 text-emerald-700';
  if (v === 'pending' || v === 'open' || v === 'inceleme_bekleniyor') return 'bg-amber-100 text-amber-800';
  if (v === 'closed' || v === 'reddedildi') return 'bg-neutral-200 text-neutral-700';
  return 'bg-neutral-200 text-neutral-700';
}

/* ========== Sayfa ========== */
export default function RestaurantSupportsPage() {
  const { role } = useParams<{ role: string }>();

  const token = React.useMemo(() => getAuthToken(), []);
  const headers = React.useMemo<HeadersInit>(() => {
    const h: HeadersInit = { Accept: 'application/json' };
    if (token) (h as any).Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [openCreate, setOpenCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const [detail, setDetail] = React.useState<Row | null>(null);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // REWRITE: /yuksi/:path* -> https://www.yuksi.dev/api/:path*
      const res = await fetch('/yuksi/Ticket/my', { headers, cache: 'no-store' });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const list: TicketItem[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const mapped: Row[] = list.map(t => ({
        id: Number(t.id),
        subject: t.subject,
        message: t.message,
        status: t.status || 'pending',
        createdAt: fmt(t.created_at ?? undefined),
        repliedAt: fmt(t.replied_at ?? undefined),
        email: t.email || '-',
        restaurant: t.restaurant_name || '-',
        reply: t.reply ?? null,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || 'Talepler alınamadı.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  React.useEffect(() => { load(); }, [load, role]);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/yuksi/Ticket/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ subject: subject.trim(), message: body.trim() }),
      });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setOpenCreate(false);
      setSubject(''); setBody('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Talep oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }

  async function removeTicket(id: number) {
    if (!confirm('Bu talebi silmek istiyor musun?')) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/yuksi/Ticket/delete/${id}`, { method: 'DELETE', headers });
      const j = await readJson(res);
      if (!res.ok || j?.success === false) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      setRows(p => p.filter(r => r.id !== id));
      if (detail?.id === id) setDetail(null);
    } catch (e: any) {
      alert(e?.message || 'Silinemedi.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Destek Talepleri</h1>
        <button
          className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-300"
          onClick={() => setOpenCreate(true)}
        >
          Yeni Talep Oluştur
        </button>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        {error && <div className="px-6 pt-4 text-sm text-rose-600">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full border-t border-neutral-200/70">
            <thead>
              <tr className="text-left text-sm text-neutral-500">
                <th className="px-4 py-3 font-medium">Konu</th>
                <th className="px-4 py-3 font-medium w-[180px]">E-posta</th>
                <th className="px-4 py-3 font-medium w-[160px]">Restoran</th>
                <th className="px-4 py-3 font-medium w-[120px]">Durum</th>
                <th className="px-4 py-3 font-medium w-[180px]">Oluşturma</th>
                <th className="px-4 py-3 font-medium w-[180px]">Cevap</th>
                <th className="px-4 py-3 font-medium w-[140px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-neutral-500">Yükleniyor…</td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-neutral-500">
                    Henüz talep yok. Sağ üstten <strong>“Yeni Talep Oluştur”</strong>.
                  </td>
                </tr>
              )}

              {!loading && rows.map(r => (
                <tr key={r.id} className="border-t border-neutral-200/70 align-top hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-neutral-900">{r.subject}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-neutral-600">{r.message}</div>
                  </td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.restaurant}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeCls(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.createdAt}</td>
                  <td className="px-4 py-3">{r.repliedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDetail(r)}
                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-600"
                      >
                        Görüntüle
                      </button>
                      <button
                        onClick={() => removeTicket(r.id)}
                        disabled={deleting === r.id}
                        className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-50"
                      >
                        {deleting === r.id ? 'Siliniyor…' : 'Sil'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Oluştur modalı */}
      {openCreate && (
        <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-xl font-semibold">Yeni Talep</h3>
              <button className="rounded-full p-2 hover:bg-neutral-100" onClick={() => setOpenCreate(false)} aria-label="Kapat">✕</button>
            </div>

            <form onSubmit={createTicket} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Konu</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                  placeholder="Örn: Kurye bildirimi ulaşmıyor"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Mesaj</label>
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                  placeholder="Detaylıca anlatın…"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
                  onClick={() => setOpenCreate(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creating || !subject.trim() || !body.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? 'Gönderiliyor…' : 'Talep Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detay modalı */}
      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-start overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold">{detail.subject}</h3>
                <div className="mt-1 text-xs text-neutral-500">{detail.email} • {detail.restaurant}</div>
              </div>
              <button className="rounded-full p-2 hover:bg-neutral-100" onClick={() => setDetail(null)} aria-label="Kapat">✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="text-xs text-neutral-500">Durum</div>
                <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeCls(detail.status)}`}>
                  {detail.status}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Oluşturma">{detail.createdAt}</Field>
                <Field label="Cevap Tarihi">{detail.repliedAt}</Field>
              </div>

              <Field label="Gönderilen Mesaj">
                <div className="whitespace-pre-wrap">{detail.message}</div>
              </Field>

              <Field label="Yanıt">
                <div className="whitespace-pre-wrap">{detail.reply || '—'}</div>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={() => removeTicket(detail.id)}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-600"
              >
                Talebi Sil
              </button>
              <button
                onClick={() => setDetail(null)}
                className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
        {children}
      </div>
    </div>
  );
}
