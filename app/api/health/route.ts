import { NextResponse } from 'next/server';
import connectToDatabase from '../../../lib/server-reldb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get('probe');

  switch (probe) {
    case 'readiness':
      // ready when the database answers a query
      try {
        await connectToDatabase().query('SELECT 1');
        return NextResponse.json({ status: 'ready' }, { status: 200 });
      } catch (error) {
        return NextResponse.json({ status: 'not ready', message: (error as Error).message }, { status: 503 });
      }

    case 'liveness':
      // assume the app is alive if this endpoint is reachable
      return NextResponse.json({ status: 'alive' }, { status: 200 });

    case 'startup':
      // check if the server is running, which it is if this endpoint is reachable
      return NextResponse.json({ status: 'started' }, { status: 200 });

    default:
      return NextResponse.json({ error: 'Invalid probe type' }, { status: 400 });
  }
}