//src/components/map/RLMap.tsx
'use client';

import * as React from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet';

type Props = {
  center: [number, number];
  marker: [number, number] | null;
  zoom?: number;
  onPick: (lat: number, lng: number) => void;
};

function Recenter({ center, zoom = 15 }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (!center[0] || !center[1]) return;
    map.flyTo(center, zoom, { animate: true, duration: 0.6 });
  }, [center, zoom, map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function RLMap({ center, marker, zoom = 13, onPick }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ width: '100%', height: 280, borderRadius: 12 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Recenter center={center} />
      {marker && <CircleMarker center={marker} radius={10} weight={2} opacity={0.9} fillOpacity={0.8} />}
      <ClickHandler onPick={onPick} />
    </MapContainer>
  );
}
