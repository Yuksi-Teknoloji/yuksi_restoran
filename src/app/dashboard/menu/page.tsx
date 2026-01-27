'use client';

import * as React from 'react';
import { Plus, RefreshCcw, Search, Loader2, Pencil, Trash2 } from 'lucide-react';
import { getAuthToken } from '@/src/utils/auth';

/* ================= Helpers ================= */
type HeadersDict = HeadersInit;
function bearerHeaders(token?: string | null): HeadersDict {
  const h: HeadersDict = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}
async function readJson<T = any>(res: Response): Promise<T> {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : (null as any);
  } catch {
    return t as any;
  }
}
const msg = (d: any, fb: string) => d?.message || d?.detail || d?.title || fb;

/* ================= Types ================= */
type MenuRow = {
  id: string;
  name: string;
  info?: string | null;
  price?: number | null;
  image_url?: string | null;
  restaurant_id?: string | null; // API dönüyorsa gösteririz; zorunlu değil
};

type MenuBody = {
  name: string;
  info?: string;
  price?: number;
  image_url?: string;
};

/* ================= Page ================= */
export default function RestaurantMenusPage() {
  const token = React.useMemo(getAuthToken, []);
  const headers = React.useMemo<HeadersDict>(() => bearerHeaders(token), [token]);

  /* ---- list ---- */
  const [menus, setMenus] = React.useState<MenuRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');

  const loadMenus = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // YETKİLİ RESTORAN: Token'dan geliyor → path param yok
      const res = await fetch('/yuksi/Restaurant/Menu', { headers, cache: 'no-store' });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));
      const list: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const mapped: MenuRow[] = list
        .map((m: any) => ({
          id: String(m?.id ?? ''),
          name: String(m?.name ?? ''),
          info: m?.info ?? null,
          price:
            typeof m?.price === 'number' ? m.price : m?.price != null ? Number(m.price) : null,
          image_url: m?.image_url ?? null,
          restaurant_id: m?.restaurant_id ?? null,
        }))
        .filter((m) => m.id);
      setMenus(mapped);
    } catch (e: any) {
      setMenus([]);
      setError(e?.message || 'Menüler alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  React.useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  const menusFiltered = React.useMemo(() => {
    if (!q.trim()) return menus;
    const s = q.toLowerCase();
    return menus.filter(
      (m) =>
        m.name.toLowerCase().includes(s) ||
        (m.info ?? '').toLowerCase().includes(s) ||
        (m.price != null ? String(m.price) : '').includes(s) ||
        m.id.toLowerCase().includes(s)
    );
  }, [menus, q]);

  /* ---- create ---- */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [createOk, setCreateOk] = React.useState<string | null>(null);
  const [cForm, setCForm] = React.useState<MenuBody>({ name: '', info: '', price: undefined, image_url: '' });

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateErr(null);
    setCreateOk(null);
    try {
      const body: MenuBody = {
        name: cForm.name,
        info: cForm.info?.trim() ? cForm.info : undefined,
        price: cForm.price != null ? Number(cForm.price) : undefined,
        image_url: cForm.image_url?.trim() ? cForm.image_url : undefined,
      };
      const res = await fetch('/yuksi/Restaurant/Menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));
      setCreateOk(j?.message || 'Menü oluşturuldu.');
      setCForm({ name: '', info: '', price: undefined, image_url: '' });
      await loadMenus();
    } catch (e: any) {
      setCreateErr(e?.message || 'Oluşturma başarısız.');
    } finally {
      setCreating(false);
    }
  }

  /* ---- edit ---- */
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editLoading, setEditLoading] = React.useState(false);
  const [editErr, setEditErr] = React.useState<string | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);
  const [eForm, setEForm] = React.useState<MenuBody>({ name: '', info: '', price: undefined, image_url: '' });

  async function openEdit(id: string) {
    setEditId(id);
    setEditLoading(true);
    setEditErr(null);
    try {
      const res = await fetch(`/yuksi/Restaurant/Menu/${id}`, { headers, cache: 'no-store' });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));
      const m = j?.data ?? j;
      setEForm({
        name: String(m?.name ?? ''),
        info: m?.info ?? '',
        price: typeof m?.price === 'number' ? m.price : m?.price != null ? Number(m.price) : undefined,
        image_url: m?.image_url ?? '',
      });
    } catch (e: any) {
      setEditErr(e?.message || 'Menü getirilemedi.');
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    setEditErr(null);
    try {
      const body: MenuBody = {
        name: eForm.name,
        info: eForm.info?.trim() ? eForm.info : undefined,
        price: eForm.price != null ? Number(eForm.price) : undefined,
        image_url: eForm.image_url?.trim() ? eForm.image_url : undefined,
      };
      const res = await fetch(`/yuksi/Restaurant/Menu/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));
      setEditId(null);
      await loadMenus();
    } catch (e: any) {
      setEditErr(e?.message || 'Güncelleme başarısız.');
    } finally {
      setEditSaving(false);
    }
  }

  /* ---- delete ---- */
  const [removingId, setRemovingId] = React.useState<string>('');
  async function removeMenu(id: string) {
    if (!confirm('Bu menüyü silmek istiyor musunuz?')) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/yuksi/Restaurant/Menu/${id}`, { method: 'DELETE', headers });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(msg(j, `HTTP ${res.status}`));
      await loadMenus();
    } catch (e: any) {
      alert(e?.message || 'Silme başarısız.');
    } finally {
      setRemovingId('');
    }
  }

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menü Yönetimi</h1>
          <p className="text-sm text-neutral-600">Bu sayfada yalnızca yetkili olduğunuz restoranın menüsü listelenir.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Yeni Menü
          </button>
          <button
            onClick={loadMenus}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <RefreshCcw className="h-4 w-4" /> Yenile
          </button>
        </div>
      </div>

      {/* Arama */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Menü ara… (ad, bilgi, id)"
              className="w-full sm:w-72 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 pl-8 text-sm outline-none focus:ring-2 focus:ring-sky-200"
            />
            <Search className="pointer-events-none absolute left-2 top-1.5 h-4 w-4 text-neutral-400" />
          </div>
        </div>
      </section>

      {/* Create form */}
      {createOpen && (
        <section className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
          <form onSubmit={submitCreate} className="grid gap-3 text-sm sm:grid-cols-2">
            <label className="grid gap-1">
              <span>Ad *</span>
              <input
                required
                value={cForm.name}
                onChange={(e) => setCForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="grid gap-1">
              <span>Fiyat</span>
              <input
                type="number"
                step="0.01"
                value={cForm.price ?? ''}
                onChange={(e) =>
                  setCForm((f) => ({ ...f, price: e.target.value === '' ? undefined : Number(e.target.value) }))
                }
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="sm:col-span-2 grid gap-1">
              <span>Bilgi</span>
              <input
                value={cForm.info ?? ''}
                onChange={(e) => setCForm((f) => ({ ...f, info: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <label className="sm:col-span-2 grid gap-1">
              <span>Görsel URL</span>
              <input
                value={cForm.image_url ?? ''}
                onChange={(e) => setCForm((f) => ({ ...f, image_url: e.target.value }))}
                className="rounded-lg border border-neutral-300 px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ekle
              </button>
              {createErr && <span className="text-rose-700">{createErr}</span>}
              {createOk && <span className="text-emerald-700">{createOk}</span>}
            </div>
          </form>
        </section>
      )}

      {/* Table */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        {/* Tablo (desktop) */}
        <div className="max-h-[560px] overflow-auto hidden sm:block">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Ad</th>
                <th className="px-4 py-2">Bilgi</th>
                <th className="px-4 py-2">Fiyat</th>
                <th className="px-4 py-2">Görsel</th>
                <th className="px-4 py-2 w-40">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {menusFiltered.map((m) => (
                <tr key={m.id} className="border-t text-sm">
                  <td className="px-4 py-2">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-[11px] text-neutral-500">{m.id}</div>
                  </td>
                  <td className="px-4 py-2">{m.info || '—'}</td>
                  <td className="px-4 py-2">{m.price != null ? m.price : '—'}</td>
                  <td className="px-4 py-2">{m.image_url ? <a className="text-sky-700 underline" href={m.image_url} target="_blank">görsel</a> : '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openEdit(m.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                      >
                        <Pencil className="h-4 w-4" /> Düzenle
                      </button>
                      <button
                        onClick={() => removeMenu(m.id)}
                        disabled={removingId === m.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-60"
                      >
                        {removingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {menusFiltered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-500">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Kart görünümü (mobil) */}
        <div className="sm:hidden max-h-[560px] overflow-auto px-4 py-3 space-y-3">
          {menusFiltered.map((m) => (
            <div key={m.id} className="rounded-xl border border-neutral-200/70 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-neutral-900">{m.name}</div>
                  <div className="text-[11px] text-neutral-500">{m.id}</div>
                </div>
                {m.price != null && (
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-700">
                    {m.price} ₺
                  </span>
                )}
              </div>

              {m.info && <div className="text-sm text-neutral-600">{m.info}</div>}

              {m.image_url && (
                <a className="text-xs text-sky-700 underline" href={m.image_url} target="_blank">
                  Görseli Aç
                </a>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openEdit(m.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                >
                  <Pencil className="h-4 w-4" /> Düzenle
                </button>
                <button
                  onClick={() => removeMenu(m.id)}
                  disabled={removingId === m.id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700 disabled:opacity-60"
                >
                  {removingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Sil
                </button>
              </div>
            </div>
          ))}
          {menusFiltered.length === 0 && (
            <div className="py-6 text-center text-sm text-neutral-500">Kayıt yok.</div>
          )}
        </div>

        {loading && <div className="px-4 py-2 text-xs text-neutral-500">Yükleniyor…</div>}
        {error && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-2 sm:p-4" onClick={() => setEditId(null)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-4 py-3 font-semibold">Menü Düzenle</div>
            <div className="p-4">
              {editLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
              {editErr && (
                <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {editErr}
                </div>
              )}
              {!editLoading && (
                <form onSubmit={saveEdit} className="grid gap-3 text-sm">
                  <label className="grid gap-1">
                    <span>Ad *</span>
                    <input
                      required
                      value={eForm.name}
                      onChange={(e) => setEForm((f) => ({ ...f, name: e.target.value }))}
                      className="rounded-lg border border-neutral-300 px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span>Fiyat</span>
                    <input
                      type="number"
                      step="0.01"
                      value={eForm.price ?? ''}
                      onChange={(e) =>
                        setEForm((f) => ({ ...f, price: e.target.value === '' ? undefined : Number(e.target.value) }))
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span>Bilgi</span>
                    <input
                      value={eForm.info ?? ''}
                      onChange={(e) => setEForm((f) => ({ ...f, info: e.target.value }))}
                      className="rounded-lg border border-neutral-300 px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span>Görsel URL</span>
                    <input
                      value={eForm.image_url ?? ''}
                      onChange={(e) => setEForm((f) => ({ ...f, image_url: e.target.value }))}
                      className="rounded-lg border border-neutral-300 px-3 py-2"
                    />
                  </label>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
                    >
                      {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                    >
                      Kapat
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
