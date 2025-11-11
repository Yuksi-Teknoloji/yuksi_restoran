// src/types/roles.ts
export const ROLES = ["admin", "dealer", "restaurant", "corporate", "marketing"] as const;
export type Role = typeof ROLES[number];

export type NavItem = { label: string; href: string };
export type NavGroup = { title: string; items: NavItem[] };

// Type guard
export function isRole(v: string): v is Role {
  return (ROLES as readonly string[]).includes(v);
}
