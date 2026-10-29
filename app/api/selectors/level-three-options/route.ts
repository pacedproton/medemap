// app/api/selectors/level-three-options/route.ts

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/server-reldb';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const levelOneId = url.searchParams.get('levelOneId');
  const levelTwoId = url.searchParams.get('levelTwoId');
  const db = await connectToDatabase();
  const { rows } = await db.query(`
    SELECT mo_title 
    FROM graphv2.mo_constant
    WHERE id_sector = $1 AND mandate = $2
    ORDER BY id_mo ASC`, [levelOneId, levelTwoId]);
  const options = rows.map(row => ({ id: row.mo_title, name: row.mo_title }));
  return NextResponse.json(options);
}
