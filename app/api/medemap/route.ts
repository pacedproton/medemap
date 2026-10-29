import { NextRequest, NextResponse } from 'next/server';
import { serverLogger } from '../../../lib/logging/serverLogger';
import connectToDatabase from '../../../lib/server-reldb';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getProfileFiltersForRequest, filterTables, filterIndicators } from '../../../lib/profiles/filterHelper';

// This route needs to be dynamic due to database queries and query parameters
export const dynamic = 'force-dynamic';

function getTargetSchema(req: NextRequest): string {
  try {
    // Use nextUrl instead of constructing new URL
    const ds = req.nextUrl.searchParams.get('dataset');
    if (ds === 'v1') return 'medemap_aug';
    return 'medemap_aug_v2';
  } catch {
    return 'medemap_aug_v2';
  }
}

function getColumnQuery(schema: string): string {
  return `
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = '${schema}'
  AND table_name = $1
  ORDER BY ordinal_position
`;
}

async function discoverTablesInOrder(db: any, schema: string): Promise<string[]> {
  // Load order from config.yaml if available
  let order: string[] = [];
  try {
    const configPath = path.join(process.cwd(), 'app', 'config.yaml');
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg: any = yaml.load(raw);
    order = Array.isArray(cfg?.tables?.order) ? cfg.tables.order : [];
  } catch (e) {
    // ignore if config cannot be read
  }

  // Fetch tables that actually exist in schema
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
    [schema]
  );
  const existing = new Set((rows as any[]).map((r: any) => r.table_name as string));

  // Exclude non-indicator tables
  const blacklist = new Set(['application_logs', 'geocoordinates', 'basic_data']);

  // Preferred order from config; fallback to alphabetical of remaining
  const ordered = order.filter(t => existing.has(t) && !blacklist.has(t));
  const remaining = Array.from(existing)
    .filter(t => !ordered.includes(t) && !blacklist.has(t))
    .sort();
  return [...ordered, ...remaining];
}

function getTableGroupMap(): { [tableName: string]: string } {
  // In MeDeMAP, table names ARE the group identifiers
  // e.g., "democracy" table belongs to "democracy" group
  try {
    const configPath = path.join(process.cwd(), 'app', 'config.yaml');
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg: any = yaml.load(raw);
    const order = Array.isArray(cfg?.tables?.order) ? cfg.tables.order : [];

    // Simple mapping: table name -> itself as group
    const map: { [key: string]: string } = {};
    for (const tableName of order) {
      map[tableName] = tableName;
    }
    return map;
  } catch (e) {
    serverLogger.warning('Could not load table group mapping', { component: "medemap-api", error: e });
    return {};
  }
}

export async function GET(req: NextRequest) {
  serverLogger.info('GET request received for /api/medemap', { component: "medemap-api" });
  try {
    const schema = getTargetSchema(req);
    const columnQuery = getColumnQuery(schema);

    const db = await connectToDatabase();

    // Debug 1: Check connection
    try {
      const ping = await db.query('SELECT current_database(), current_user, version()');
      serverLogger.info('[API Debug] DB Connection verified', {
        component: "medemap-api",
        info: ping.rows[0]
      });
    } catch (e: any) {
      serverLogger.error('[API Debug] DB Connection FAILED', {
        component: "medemap-api",
        error: e.message
      });
      throw e; // Fail fast
    }

    const responseData: { [key: string]: any } = {};
    const columnData: { [key: string]: any[] } = {};

    // Get all tables
    const allTables = await discoverTablesInOrder(db, schema);
    serverLogger.info('[API Debug] Discovery results', {
      component: "medemap-api",
      schema,
      tableCount: allTables.length,
      tables: allTables
    });

    // Load profile filters (checks permissions automatically)
    let filters = null;
    try {
      // Get profile ID from query params
      const profileId = req.nextUrl.searchParams.get('profile');
      filters = await getProfileFiltersForRequest(profileId || undefined);
      serverLogger.info('[Profile Filter] Filters loaded', { component: "medemap-api", filters });
    } catch (error: any) {
      serverLogger.error('Profile filter error loading filters', { component: "medemap-api", errorMessage: error.message });
      // If user doesn't have access, return 403
      if (error.message.includes('does not have access')) {
        return NextResponse.json(
          { error: 'Access to this profile is not allowed' },
          { status: 403 }
        );
      }
      // Otherwise continue without filters (show all data)
    }

    // Apply profile filtering
    const tableGroupMap = getTableGroupMap();
    const tables = filterTables(allTables, filters, tableGroupMap);
    serverLogger.info('[Profile Filter] Filtered tables', { component: "medemap-api", tables });

    for (const table of tables) {
      try {
        serverLogger.info(`Processing table: ${table} (schema: ${schema})`);

        let columnNames = [];
        try {
          // Use simple string interpolation to avoid any prepared statement/driver issues
          const columnQuery = `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}' ORDER BY ordinal_position`;

          // Fetch column names (using interpolation)
          const res = await db.query(columnQuery);
          columnNames = res.rows as any[];

          serverLogger.info(`[API Debug] Columns for ${table}`, {
            component: "medemap-api",
            count: columnNames.length,
            firstFew: columnNames.slice(0, 3)
          });
        } catch (err: any) {
          const columnQuery = `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}' ORDER BY ordinal_position`;
          serverLogger.error(`[API Debug] Failed to fetch columns for ${table}`, {
            component: "medemap-api",
            error: err.message,
            query: columnQuery,
            params: []
          });
          continue; // Skip this table if we can't get columns
        }

        // Restore missing queries for data and metadata
        // Fetch the meta data row
        let metaRow = {};
        try {
          const { rows: metaRows }: { rows: any[] } = await db.query(`SELECT * FROM "${schema}"."${table}" WHERE country = 'metastat'`);
          metaRow = (metaRows as any[])[0] || {};
          serverLogger.info(`Meta data row for ${table}`, { component: "medemap-api", metaRow });
        } catch (err: any) {
          serverLogger.error(`[API Debug] Failed to fetch metadata for ${table}`, { error: err.message });
        }

        // Fetch table data excluding the meta data row
        let dataRows: any[] = [];
        try {
          const { rows: rows }: { rows: any[] } = await db.query(`SELECT * FROM "${schema}"."${table}" WHERE country != 'metastat'`);
          dataRows = rows;
          serverLogger.info(`Sample data fetched for ${table}`, { component: "medemap-api", sampleData: (dataRows as any[])[0] });
          responseData[table] = [...(dataRows as any[])];
        } catch (err: any) {
          serverLogger.error(`[API Debug] Failed to fetch data for ${table}`, { error: err.message });
        }

        // Derive visible (non-null) indicators: retain only columns that have at least one non-null value
        const nonMetaColumns: string[] = (columnNames as any[])
          .filter((row: any) => !String(row.column_name).startsWith('meta_'))
          .map((r: any) => String(r.column_name));
        let visibleColumns: string[] = nonMetaColumns.filter(col => (dataRows as any[]).some((r: any) => r[col] !== null && r[col] !== undefined));

        // Exclude specific indicators
        const excludedIndicators = ['2024_RIGHT_INFORMATION_II'];
        visibleColumns = visibleColumns.filter(col => !excludedIndicators.includes(col));

        serverLogger.info(`[Profile Filter] Table ${table} - ALL ${visibleColumns.length} visible columns`, { component: "medemap-api", visibleColumns });
        serverLogger.info(`[Profile Filter] Table ${table} - Columns containing 'eiu' (lowercase):`, visibleColumns.filter(c => c.toLowerCase().includes('eiu')));
        serverLogger.info(`[Profile Filter] Table ${table} - Columns containing '_EIU_' (uppercase):`, visibleColumns.filter(c => c.includes('_EIU_')));

        // Apply profile indicator filtering
        const beforeFilterCount = visibleColumns.length;
        visibleColumns = filterIndicators(visibleColumns, filters);
        serverLogger.info(`[Profile Filter] Filtered indicators for ${table}: ${beforeFilterCount} -> ${visibleColumns.length}`, { component: "medemap-api", visibleColumns });

        columnData[table] = visibleColumns
          .map(columnName => {
            const metaColumnName = `meta_${columnName}`;
            const metaDataRaw = metaRow ? metaRow[metaColumnName] : null;
            let metaData = null;

            if (metaDataRaw) {
              try {
                metaData = typeof metaDataRaw === 'string' ? JSON.parse(metaDataRaw) : metaDataRaw;
              } catch (e) {
                serverLogger.error('Error parsing JSON', { component: "medemap-api", metaColumnName, error: e });
              }
            }

            // Label overrides: correct display names without touching database metadata
            const labelOverrides: Record<string, string> = {
              'Right to information (index)': 'Access to information',
              'Right to Information II': 'Access to information',
              'State regulation of resources and support to the media sector (%)': 'Non-discrimination in and transparency of allocating state subsidies and state advertising (%)',
              'Political independence of the media (%)': 'Non-discrimination in and transparency of allocating state subsidies and state advertising (%)',
              'Equality in the media (%)': 'Gender equality in the media (%)',
              'Basic or above basic digital skills (%)': 'At least basic digital skills (%)',
              'Fair representation of minorities in the media (%)': 'Representation of minorities in the media (%)',
              'Fair representation of minorities, women': 'Representation of minorities, women',
            };

            // Extract verbose label when available
            let verbose = (metaData && (metaData as any).indicator) ? String((metaData as any).indicator) : undefined;
            // Apply label override if matched (before year tag is appended)
            // Checks exact match first, then startsWith for partial matches
            if (verbose) {
              let overrideMatch = labelOverrides[verbose];
              if (!overrideMatch) {
                const key = Object.keys(labelOverrides).find(k => verbose!.startsWith(k));
                if (key) {
                  overrideMatch = labelOverrides[key] + verbose.slice(key.length);
                }
              }
              if (overrideMatch) {
                serverLogger.info(`[Label Override] "${verbose}" -> "${overrideMatch}"`, { component: "medemap-api", columnName });
                verbose = overrideMatch;
              }
            }
            // For v2 wide columns, append year part from the column name so users can pick specific years
            if (schema === 'medemap_aug_v2') {
              const yearMatch = columnName.match(/^(\d{4})/);
              const yearTag = yearMatch ? yearMatch[1] : undefined;
              if (verbose && yearTag) {
                verbose = `${verbose} (${yearTag})`;
              } else {
                // Fallback formatting of header
                const base = columnName.replace(/^(\d{4})([A-Za-z]?_)?/, '').replace(/_/g, ' ').trim();
                verbose = yearTag ? `${base} (${yearTag})` : base;
              }
              if (metaData) {
                (metaData as any).indicator = verbose;
              }
            } else if (!verbose) {
              // Legacy fallback label formatting
              verbose = columnName.replace(/_/g, ' ');
            }

            return {
              value: columnName,
              label: verbose as string,
              meta: metaData || null,
            };
          });

        serverLogger.info(`Processed column data for ${table}`, { component: "medemap-api", columnData: columnData[table] });
      } catch (tableError: any) {
        serverLogger.error(`CRITICAL ERROR processing table ${table}`, {
          component: "medemap-api",
          error: tableError.message,
          stack: tableError.stack
        });
        // Continue to next table
      }
    }

    // Add column data to the response
    responseData.columnOptions = { ...columnData };

    serverLogger.info('Response data prepared. Sending response.', { component: "medemap-api" });
    // Check if caching is disabled via query parameter
    const disableCache = req.nextUrl.searchParams.get('nocache') === 'true';

    const headers: Record<string, string> = {};

    if (disableCache) {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
      headers['ETag'] = `"${Date.now()}"`;
    } else {
      headers['Cache-Control'] = 'public, max-age=300'; // 5 minute cache
    }

    return NextResponse.json(responseData, { headers });
  } catch (error) {
    serverLogger.error('Error fetching data', { component: "medemap-api", error });
    return NextResponse.json({ error: 'Error fetching data', details: (error as any).message }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}