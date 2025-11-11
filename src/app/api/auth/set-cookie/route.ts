import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token, exp } = await req.json();

  const res = NextResponse.json({ ok: true });

  res.cookies.set('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(exp ? { expires: new Date(exp * 1000) } : {}),
  });

  return res;
}
