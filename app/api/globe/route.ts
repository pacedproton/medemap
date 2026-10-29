// app/api/globe/route.ts
// prototype globe plotting

import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '../../../lib/logging/serverLogger';
import connectToDatabase from '../../../lib/server-reldb'; 

export async function GET(req: NextRequest) {
    serverLogger.info('Globe data API called', { component: 'globe-api' });

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
        const { rows } = await db.query('SELECT * FROM public.globe_data');
        return new NextResponse(JSON.stringify(rows), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        serverLogger.error('Failed to fetch globe data', { component: 'globe-api', error });
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch globe data' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
