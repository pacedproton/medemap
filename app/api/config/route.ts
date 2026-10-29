import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '../../../lib/logging/serverLogger';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET(req: NextRequest) {
  const configPath = path.join(process.cwd(), 'app/config.yaml');
  let config;

  try {
    config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    serverLogger.error('Failed to load configuration', { component: 'config-api', error });
    return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 });
  }
} 