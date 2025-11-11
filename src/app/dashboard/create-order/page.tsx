// src/app/dashboards/[role]/admin/orders/create-order/page.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { getAuthToken } from '@/src/utils/auth';

const MapPicker = dynamic(() => import('@/src/components/map/MapPicker'), { ssr: false });

type GeoPoint = { lat: number; lng: number; address?: string };

async function readJson(res: Response) {
  const t = await res.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}
const pickMsg = (d: any, fb: string) =>
  d?.message || d?.title || d?.detail || d?.error?.message || fb;

function decodeJwtPayload(token: string | null | undefined): any | null {
  if (!token) return null;
  const raw = token.replace(/^Bearer\s+/i, '');
  const parts = raw.split('.');
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    // @ts-ignore
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

/* ---------- API alanları ---------- */
type ApiType = 'yerinde' | 'paket_servis' | 'gel_al';

/** Menüden gelecek ürün basiti */
type MenuItem = { id: string; name: string; price: number };

/** Form içi satır: seçilen ürün + adet */
type ItemRow = {
  id: string;          // satır uuid
  menu_id?: string;    // seçili menü id
  product_name: string;
  price: number;
  quantity: number;
};

export default function RestaurantOrderCreate() {
  const [restaurantId, setRestaurantId] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [idErr, setIdErr] = React.useState<string | null>(null);

  // form state
  const [customer, setCustomer] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [deliveryAddress, setDeliveryAddress] = React.useState('');
  const [type, setType] = React.useState<ApiType>('yerinde');
  const [carrierType, setCarrierType] = React.useState('kurye');
  const [vehicleType, setVehicleType] = React.useState<'2_teker_motosiklet'|'3_teker_motosiklet'>('2_teker_motosiklet');
  const [cargoType, setCargoType] = React.useState('');
  const [special, setSpecial] = React.useState('');

  // kullanıcı elle yazdı mı? (otomatik doldurmayı engellemek için)
  const [addressDirty, setAddressDirty] = React.useState(false);
  const [deliveryDirty, setDeliveryDirty] = React.useState(false);

  // MENÜ: ürün ve fiyatlar bu listeden gelir
  const [menu, setMenu] = React.useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = React.useState(false);
  const [menuErr, setMenuErr] = React.useState<string | null>(null);

  // satırlar: sadece ürün seçimi + adet
  const [items, setItems] = React.useState<ItemRow[]>([
    { id: crypto.randomUUID(), product_name: '', price: 0, quantity: 1 },
  ]);

  const [pickup, setPickup] = React.useState<GeoPoint | null>(null);
  const [dropoff, setDropoff] = React.useState<GeoPoint | null>(null);

  const amount = React.useMemo(
    () => items.reduce((s, i) => s + (Number(i.price)||0) * (Number(i.quantity)||0), 0),
    [items]
  );

  const [saving, setSaving] = React.useState(false);
  const [ok, setOk] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // Mount: token’dan userId/restaurantId çıkar, önce LS, ardından profil endpoint’inden pickup’ı getir
  React.useEffect(() => {
    const token = getAuthToken();
    const payload = decodeJwtPayload(token || undefined);

    const uid =
      (payload?.userId && String(payload.userId)) ||
      (payload?.sub && String(payload.sub)) || null;

    const ridFromLS = typeof window !== 'undefined' ? localStorage.getItem('restaurant_id') : null;
    const rid = ridFromLS || uid;

    if (uid) setUserId(uid);
    if (rid) setRestaurantId(rid);
    if (!rid) setIdErr('Token içinde restaurant_id/userId bulunamadı.');
    else setIdErr(null);

    // 1) LocalStorage’dan varsa geçici olarak yükle (hızlı başlangıç)
    try {
      const saved = localStorage.getItem('restaurant_geo');
      if (saved) {
        const g = JSON.parse(saved);
        if (g?.lat && g?.lng) setPickup({ lat: Number(g.lat), lng: Number(g.lng), address: g.address || '' });
      }
    } catch {}
  }, []);

  // 2) Restoran profilinden konumu otomatik çek (profil endpointi)
  React.useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`/yuksi/Restaurant/${restaurantId}/profile`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        });
        const j: any = await readJson(res);
        if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));

        const d = j?.data ?? j?.result ?? j ?? {};
        const lat = d?.latitude != null ? Number(d.latitude) : NaN;
        const lng = d?.longitude != null ? Number(d.longitude) : NaN;

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const addr = [d?.addressLine1, d?.addressLine2].filter(Boolean).join(', ');
          const gp: GeoPoint = { lat, lng, address: addr || undefined };
          setPickup(gp);
          try { localStorage.setItem('restaurant_geo', JSON.stringify(gp)); } catch {}
        }
      } catch {
        /* sessizce geç; LS veya manuel seçim devam eder */
      }
    })();
  }, [restaurantId]);

  // MENÜYÜ YÜKLE
  const loadMenu = React.useCallback(async () => {
    setMenuLoading(true); setMenuErr(null);
    try {
      const token = getAuthToken();
      const res = await fetch('/yuksi/Restaurant/Menu/', {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));

      const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      const mapped: MenuItem[] = (arr as any[]).map((m: any) => ({
        id: String(m?.id ?? ''),
        name: String(m?.name ?? ''),
        price: typeof m?.price === 'number' ? m.price : Number(m?.price ?? 0),
      })).filter(m => m.id && m.name);

      setMenu(mapped);
    } catch (e: any) {
      setMenuErr(e?.message || 'Menü yüklenemedi.');
      setMenu([]);
    } finally {
      setMenuLoading(false);
    }
  }, []);
  React.useEffect(() => { loadMenu(); }, [loadMenu]);

  // satır helpers
  function addItem() {
    setItems(p => [...p, { id: crypto.randomUUID(), product_name: '', price: 0, quantity: 1 }]);
  }
  function selectMenuForRow(rowId: string, menuId: string) {
    const m = menu.find(x => x.id === menuId);
    setItems(p => p.map(x => x.id === rowId
      ? { ...x, menu_id: menuId, product_name: m?.name || '', price: m?.price ?? 0 }
      : x));
  }
  function changeQty(rowId: string, qty: number) {
    setItems(p => p.map(x => x.id === rowId ? { ...x, quantity: Math.max(1, qty || 1) } : x));
  }
  function removeItem(rowId: string) {
    setItems(p => (p.length > 1 ? p.filter(x => x.id !== rowId) : p));
  }

  // ✅ Adres otomatik doldurma
  React.useEffect(() => {
    // Sadece ADRES alanına pickup.address yaz
    if (pickup?.address && !addressDirty) setAddress(pickup.address);

    // Sadece TESLİMAT ADRESİNE dropoff.address yaz
    if (dropoff?.address && !deliveryDirty) setDeliveryAddress(dropoff.address);
  }, [pickup?.address, dropoff?.address, addressDirty, deliveryDirty]);

  // kullanıcı manuel yazarsa dirty bayrağını işaretle
  const onAddressChange = (v: string) => { setAddressDirty(true); setAddress(v); };
  const onDeliveryAddressChange = (v: string) => { setDeliveryDirty(true); setDeliveryAddress(v); };

  // pickup konumunu LS'de tut
  React.useEffect(() => {
    if (!pickup?.lat || !pickup?.lng) return;
    try { localStorage.setItem('restaurant_geo', JSON.stringify(pickup)); } catch {}
  }, [pickup?.lat, pickup?.lng]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null); setErr(null);

    if (!restaurantId) { setErr(idErr || 'Restaurant ID yok.'); return; }
    if (!pickup?.lat || !pickup?.lng) { setErr('Restoran konumunu (pickup) seçin.'); return; }

    const needDrop = type !== 'yerinde';
    const effectiveDropoff: GeoPoint | null = needDrop ? dropoff : (dropoff ?? pickup);
    if (needDrop && (!effectiveDropoff?.lat || !effectiveDropoff?.lng)) {
      setErr('Teslimat konumunu (dropoff) seçin.');
      return;
    }

    const cleanItems = items
      .filter(i => i.menu_id && i.product_name && i.quantity > 0)
      .map(i => ({
        product_name: i.product_name,
        price: +Number(i.price || 0).toFixed(2),
        quantity: Number(i.quantity || 0),
      }));
    if (cleanItems.length === 0) { setErr('En az bir ürün seçin.'); return; }

    setSaving(true);
    try {
      const payload = {
        user_id: userId || restaurantId,
        customer: customer.trim(),
        phone: phone.trim(),
        address: address.trim(),
        // teslimat adresi: dropoff’tan gelen (yoksa address fallback)
        delivery_address: (deliveryAddress || address).trim(),
        pickup_lat: +Number(pickup.lat).toFixed(6),
        pickup_lng: +Number(pickup.lng).toFixed(6),
        dropoff_lat: effectiveDropoff?.lat != null ? +Number(effectiveDropoff.lat).toFixed(6) : undefined,
        dropoff_lng: effectiveDropoff?.lng != null ? +Number(effectiveDropoff.lng).toFixed(6) : undefined,
        type,
        amount: +amount.toFixed(2),
        carrier_type: carrierType || 'kurye',
        vehicle_type: vehicleType,
        cargo_type: cargoType || 'string',
        special_requests: special || '',
        items: cleanItems,
      };

      const token = getAuthToken();
      const res = await fetch(`/yuksi/restaurant/${restaurantId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));

      setOk(data?.message || `Sipariş oluşturuldu (ID: ${data?.data?.id || '—'})`);
      (e.target as HTMLFormElement).reset?.();
      setCustomer(''); setPhone(''); setAddress(''); setDeliveryAddress('');
      setType('yerinde'); setCarrierType('kurye'); setVehicleType('2_teker_motosiklet');
      setCargoType(''); setSpecial('');
      setItems([{ id: crypto.randomUUID(), product_name: '', price: 0, quantity: 1 }]);
      setDropoff(null);
      setAddressDirty(false); setDeliveryDirty(false);
    } catch (ex: any) {
      setErr(ex?.message || 'Sipariş gönderilemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="text-2xl font-semibold">Yeni Sipariş</h1>

      <div className="text-xs text-neutral-600">
        {restaurantId ? <>restaurant_id: <b>{restaurantId}</b></> : <>{idErr}</>}
        {userId && <> • user_id: <b>{userId}</b></>}
      </div>

      {/* Temel alanlar */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Müşteri</label>
            <input value={customer} onChange={e=>setCustomer(e.target.value)} required className="w-full rounded-xl border px-3 py-2"/>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Telefon</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} required className="w-full rounded-xl border px-3 py-2"/>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Restoran Adresi</label>
            <input
              value={address}
              onChange={e=>onAddressChange(e.target.value)}
              required
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Haritadan seçince otomatik dolar"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Teslimat Adresi</label>
            <input
              value={deliveryAddress}
              onChange={e=>onDeliveryAddressChange(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Dropoff haritasından seçince otomatik dolar"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Sipariş Tipi</label>
            <select value={type} onChange={e=>setType(e.target.value as ApiType)} className="w-full rounded-xl border px-3 py-2">
              <option value="yerinde">Yerinde</option>
              <option value="gel_al">Gel-Al</option>
              <option value="paket_servis">Paket Servis</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Taşıyıcı</label>
              <select value={carrierType} onChange={e=>setCarrierType(e.target.value)} className="w-full rounded-xl border px-3 py-2">
                <option value="kurye">kurye</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Araç</label>
              <select value={vehicleType} onChange={e=>setVehicleType(e.target.value as any)} className="w-full rounded-xl border px-3 py-2">
                <option value="2_teker_motosiklet">2_teker_motosiklet</option>
                <option value="3_teker_motosiklet">3_teker_motosiklet</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Kargo Tipi</label>
            <input value={cargoType} onChange={e=>setCargoType(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Özel İstek</label>
            <input value={special} onChange={e=>setSpecial(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
          </div>
        </div>
      </section>

      {/* Konumlar */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <MapPicker
            label="Restoran Konumu (Pickup)"
            value={pickup}
            onChange={(p) => setPickup(p)}
            defaultCenter={{ lat: 41.015137, lng: 28.97953 }}
          />
          <MapPicker
            label="Teslimat Konumu (Dropoff)"
            value={dropoff}
            onChange={(p) => setDropoff(p)}
            defaultCenter={{ lat: pickup?.lat ?? 41.015137, lng: pickup?.lng ?? 28.97953 }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Not: Teslimat adresi haritadan seçilince otomatik dolar; istersen elle değiştirebilirsin.
        </p>
      </section>

      {/* Kalemler */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kalemler</h2>
          <button type="button" onClick={addItem} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50">+ Ekle</button>
        </div>

        {menuErr && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{menuErr}</div>}
        {menuLoading && <div className="mt-3 text-sm text-neutral-500">Menü yükleniyor…</div>}

        <div className="mt-3 grid gap-3">
          {items.map(it => (
            <div key={it.id} className="grid gap-3 sm:grid-cols-[minmax(220px,1fr),140px,140px,100px]">
              <select
                value={it.menu_id || ''}
                onChange={e => selectMenuForRow(it.id, e.target.value)}
                className="rounded-xl border px-3 py-2"
                required
              >
                <option value="">Ürün seçin…</option>
                {menu.map((m: MenuItem) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {Number(m.price).toFixed(2)}₺
                  </option>
                ))}
              </select>

              <input
                value={it.price ? it.price.toFixed(2) : ''}
                readOnly
                placeholder="Fiyat"
                className="rounded-xl border bg-neutral-50 px-3 py-2 text-right"
              />

              <input
                type="number"
                min={1}
                value={it.quantity}
                onChange={e=>changeQty(it.id, Number(e.target.value))}
                className="rounded-xl border px-3 py-2 text-right"
              />

              <div className="flex items-center justify-between">
                <strong className="tabular-nums">{((it.price||0)*(it.quantity||0)).toFixed(2)}₺</strong>
                <button type="button" onClick={()=>removeItem(it.id)} className="rounded-md bg-rose-100 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-200">Sil</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-4">
          <span className="text-sm">Genel Toplam</span>
          <span className="text-base font-bold tabular-nums">{amount.toFixed(2)}₺</span>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Gönderiliyor…' : 'Kaydet'}
        </button>
        {ok && <div className="text-sm text-emerald-600">{ok}</div>}
        {err && <div className="text-sm text-rose-600">{err}</div>}
      </div>
    </form>
  );
}
