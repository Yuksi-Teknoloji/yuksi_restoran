// src/components/map/MapPicker.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

const RLMap = dynamic(() => import('./RLMap'), { ssr: false });

export type GeoPoint = { lat: number; lng: number; address?: string };

export default function MapPicker({
  label = 'Konum',
  value,
  onChange,
  defaultCenter = { lat: 41.015137, lng: 28.97953 }, // İstanbul
}: {
  label?: string;
  value?: GeoPoint | null;
  onChange: (p: GeoPoint) => void;
  defaultCenter?: { lat: number; lng: number };
}) {
  const [q, setQ] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [center, setCenter] = React.useState<[number, number]>([
    value?.lat ?? defaultCenter.lat,
    value?.lng ?? defaultCenter.lng,
  ]);

  React.useEffect(() => {
    if (value?.lat && value?.lng) setCenter([value.lat, value.lng]);
  }, [value?.lat, value?.lng]);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '1');
      url.searchParams.set('q', term);
      const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'tr' } });
      const arr = (await res.json()) as any[];
      if (arr?.length) {
        const r = arr[0];
        const lat = Number(r.lat), lng = Number(r.lon);
        setCenter([lat, lng]); // haritayı buraya uçur
        onChange({ lat, lng, address: r.display_name });
      }
    } finally {
      setBusy(false);
    }
  }

  async function reverse(lat: number, lng: number) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'tr' } });
      const j = await res.json();
      onChange({ lat, lng, address: j?.display_name });
    } finally {
      setCenter([lat, lng]); // tıklanan konuma uçar
    }
  }

  const marker = value?.lat && value?.lng ? ([value.lat, value.lng] as [number, number]) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-semibold text-neutral-700">{label}</label>
          <div className="flex overflow-hidden rounded-xl border border-neutral-300">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
              placeholder="Adres ara (cadde/mahalle, il/ilçe)…"
              className="w-full bg-neutral-100 px-3 py-2 outline-none"
            />
            <button
              type="button"
              onClick={search}
              disabled={busy}
              className="bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
            >
              {busy ? 'Ara…' : 'Ara'}
            </button>
          </div>
        </div>
        <div className="min-w-[160px] text-right text-xs text-neutral-500">
          {value?.lat && value?.lng ? (
            <>
              <div>Lat: <b>{value.lat.toFixed(6)}</b></div>
              <div>Lng: <b>{value.lng.toFixed(6)}</b></div>
            </>
          ) : (
            <div>Haritaya tıkla veya ara</div>
          )}
        </div>
      </div>

      {/* Harita */}
      <RLMap center={center} marker={marker} onPick={reverse} />

      {value?.address && (
        <div className="text-sm text-neutral-700">
          <span className="font-medium">Adres: </span>{value.address}
        </div>
      )}
    </div>
  );
}
