//src/app/dashboard/list-load/page.tsx
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const ListLoad = dynamic(() => import("./ListLoad"), {
  ssr: false,
});

export default function ListLoadPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <ListLoad />
    </Suspense>
  );
}
