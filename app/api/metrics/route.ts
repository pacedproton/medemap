import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { register, collectDefaultMetrics } from 'prom-client';

collectDefaultMetrics();

function tokenMatches(header: string | null, token: string): boolean {
  const given = Buffer.from((header ?? '').replace(/^Bearer /, ''));
  const want = Buffer.from(token);
  return header?.startsWith('Bearer ') === true && given.length === want.length && timingSafeEqual(given, want);
}

// Process internals are not public: disabled unless METRICS_TOKEN is set, then bearer-only.
export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return new NextResponse('Not found', { status: 404 });
  if (!tokenMatches(request.headers.get('authorization'), token)) {
    return new NextResponse('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  }

  const metrics = await register.metrics();
  return new NextResponse(metrics, {
    headers: {
      'Content-Type': register.contentType,
    },
  });
}
