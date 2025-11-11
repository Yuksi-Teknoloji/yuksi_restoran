"use client";

import { Suspense } from "react";
import OrderHistory from "./OrderHistory";

export default function UserListPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <OrderHistory />
    </Suspense>
  );
}