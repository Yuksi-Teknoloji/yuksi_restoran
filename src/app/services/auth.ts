
// service katmanı UI->JSON MOCK (ŞIMDILIK) 

import { LoginInput, RegisterInput, MockResult } from "@/src/types/auth";

// küçük yardımcılar
const now = () => new Date().toISOString();
const toJsonResult = <T>(endpoint: string, payload: T): MockResult<T> => ({
  ok: true,
  endpoint,
  payload,
  createdAt: now(),
  json: JSON.stringify(payload, null, 2),
});

// basit normalize (istenirse genişletilir)
const normalizePhone = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, "");
  // Başında 0 varsa at; TR için +90 ekleyelim (uygun değilse sadece rakamları döndür)
  if (digits.startsWith("0") && digits.length >= 10) return `+90${digits.slice(-10)}`;
  if (digits.startsWith("90") && digits.length >= 12) return `+${digits}`;
  return digits;
};

export async function loginService(input: LoginInput): Promise<MockResult<LoginInput>> {
  const payload: LoginInput = {
    email: input.email.trim(),
    password: input.password,
  };
  return toJsonResult("/auth/login", payload);
}

export async function registerService(input: RegisterInput): Promise<MockResult<RegisterInput>> {
  const payload: RegisterInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: normalizePhone(input.phone),
    email: input.email.trim(),
    password: input.password,
    acceptedTos: !!input.acceptedTos,
  };
  return toJsonResult("/auth/register", payload);
}
