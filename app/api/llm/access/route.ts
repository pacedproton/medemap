import { NextRequest, NextResponse } from 'next/server';
import { aiAccessGate, ACCESS_KEY_HEADER, clientIp } from '../../../../lib/security/accessGate';
import { gateErrorResponse } from '../../../../lib/security/gateResponse';

// Lets the browser check a typed-in access key without spending any model tokens.
export async function GET(request: NextRequest) {
  const gate = aiAccessGate.check(clientIp(request.headers), request.headers.get(ACCESS_KEY_HEADER));
  if (!gate.ok) return gateErrorResponse(gate);
  return NextResponse.json({ ok: true });
}
