// app/api/selectors/level-one-options/route.ts

import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/server-reldb';

export async function GET() {
  const db = await connectToDatabase();
  const { rows } = await db.query('SELECT id_sector, sector_name FROM graphv2.sectors ORDER BY id_sector ASC');
  const options = rows.map(row => ({ id: row.id_sector, name: row.sector_name }));
  return NextResponse.json(options);
}
