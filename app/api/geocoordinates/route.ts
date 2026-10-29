// app/api/geo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '../../../lib/logging/serverLogger';
import connectToDatabase from '../../../lib/server-reldb'; 

export async function GET(req: NextRequest) {
    serverLogger.info('Geocoordinates API called', { component: 'geocoordinates-api' });

    if (req.method !== 'GET') {
        return new NextResponse(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    try {
        const db = await connectToDatabase();
        const { rows } = await db.query('SELECT * FROM medemap_aug.geocoordinates');
        return new NextResponse(JSON.stringify(rows), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        serverLogger.error('Failed to fetch geocoordinates data', { component: 'geocoordinates-api', error });
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch globe data' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
