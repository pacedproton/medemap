import { NextResponse } from 'next/server';
import type { GateResult } from './accessGate';

/** The JSON error response for a failed access-key check. */
export function gateErrorResponse(gate: Extract<GateResult, { ok: false }>) {
  return NextResponse.json(
    { error: gate.error },
    { status: gate.status, headers: gate.retryAfterSec ? { 'Retry-After': String(gate.retryAfterSec) } : undefined }
  );
}
