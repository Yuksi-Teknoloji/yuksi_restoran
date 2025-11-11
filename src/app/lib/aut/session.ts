// src/lib/auth/session.ts
import { cookies } from "next/headers";
import type { Role } from "@/src/types/auth";

const DEFAULT_ROLE: Role = "admin";

export async function getRole(): Promise<Role> {
   const cookieStore = await cookies();
   const c = cookieStore.get("role")?.value as Role | undefined;

   if (c == "admin" || c == "dealer" || c == "carrier") return c;


   return DEFAULT_ROLE;
 }
