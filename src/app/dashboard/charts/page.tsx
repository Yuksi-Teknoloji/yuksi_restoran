"use client";

import { Suspense } from "react";
import Charts from "./Charts";

export default function UserListPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <Charts />
    </Suspense>
  );
}