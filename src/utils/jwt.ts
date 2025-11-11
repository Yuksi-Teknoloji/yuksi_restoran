// src/utils/jwt.ts
export type JwtClaims = {
  sub?: string;
  unique_name?: string;
  userId?: string;
  email?: string;
  userType?: "restaurant" | "driver" | "admin" | "customer" | "dealer" | string;
  nbf?: number; exp?: number; iat?: number;
  iss?: string; aud?: string;
};

// base64url -> json decode (imza doğrulaması yapmıyoruz)
export function decodeJwt<T = JwtClaims>(token?: string): T | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = typeof atob === "function"
      ? atob(payload)
      : Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isExpired(claims: { exp?: number } | null): boolean {
  if (!claims?.exp) return true;
  // exp saniye cinsinden (unix)
  const nowSec = Math.floor(Date.now() / 1000);
  return claims.exp <= nowSec;
}

export function roleSegment(userType?: string): string | null {
  if (!userType) return null;
  // gerekirse map uygula (örn: "restaurantOwner" -> "restaurant")
  const map: Record<string, string> = {
    restaurant: "restaurant",
    driver: "driver",
    admin: "admin",
    customer: "customer",
    dealer: "dealer"
  };
  return map[userType] ?? userType; // bilinmeyenleri de geçir
}