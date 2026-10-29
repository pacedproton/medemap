// app/api/selectors/level-two-options/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/server-reldb';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const levelOneId = url.searchParams.get('levelOneId');
  const db = await connectToDatabase();
  const { rows } = await db.query(`
    SELECT DISTINCT mandates.id_mandate, mandates.mandate_name 
    FROM graphv2.mo_constant
    INNER JOIN graphv2.mandates ON mo_constant.mandate = mandates.id_mandate
    WHERE mo_constant.id_sector = $1
    ORDER BY mandates.id_mandate ASC`, [levelOneId]);
  const options = rows.map(row => ({ id: row.id_mandate, name: row.mandate_name }));
  return NextResponse.json(options);
}
