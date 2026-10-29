# Profile Data Filtering Integration Guide

## Overview

This guide shows how to integrate profile-based data filtering into your existing API routes.

## How It Works

```
User selects profile in UI → ProfileSelector sets activeProfile
  ↓
Frontend passes profileId to API
  ↓
API checks user permissions + loads profile config
  ↓
API filters tables/indicators based on YAML config
  ↓
Returns filtered data to frontend
```

## Step 1: Update Frontend to Pass Profile ID

### Option A: Add to Query Parameters

```typescript
// In your data fetching code
import { useProfile } from '@/lib/profiles/ProfileContext';

function MyComponent() {
  const { activeProfile } = useProfile();

  const fetchData = async () => {
    const url = activeProfile
      ? `/api/medemap?profile=${activeProfile}`
      : '/api/medemap';

    const response = await fetch(url);
    // ...
  };

  // Re-fetch when profile changes
  useEffect(() => {
    fetchData();
  }, [activeProfile]);
}
```

### Option B: Add to Request Headers

```typescript
const fetchData = async () => {
  const response = await fetch('/api/medemap', {
    headers: {
      'X-Profile-Id': activeProfile || '',
    },
  });
};
```

## Step 2: Update API Route to Apply Filters

### Example: app/api/medemap/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../lib/server-reldb';
import { getProfileFiltersForRequest, filterTables, filterIndicators } from '@/lib/profiles/filterHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Get profile ID from query params or header
    const profileId = req.nextUrl.searchParams.get('profile') ||
                      req.headers.get('X-Profile-Id');

    // 2. Load profile filters (checks permissions automatically)
    const filters = await getProfileFiltersForRequest(profileId || undefined);

    // 3. Connect to database and get all tables
    const db = await connectToDatabase();
    const schema = getTargetSchema(req);
    const allTables = await discoverTablesInOrder(db, schema);

    // 4. Filter tables based on profile
    // You need to create a map of table names to their groups from config.yaml
    const tableGroupMap = getTableGroupMap(); // See helper below
    const allowedTables = filterTables(allTables, filters, tableGroupMap);

    // 5. Fetch data only for allowed tables
    const responseData: { [key: string]: any } = {};
    const columnData: { [key: string]: any[] } = {};

    for (const table of allowedTables) {
      // Fetch columns
      const { rows: columnNameRows } = await db.query(columnQuery, [table]);
      const allColumns = columnNameRows.map(r => r.column_name);

      // Fetch data
      const { rows: dataRows } = await db.query(
        `SELECT * FROM ${schema}.${table} WHERE country != 'metastat'`
      );

      // Get visible columns
      const visibleColumns = allColumns.filter(col =>
        dataRows.some(r => r[col] !== null && r[col] !== undefined)
      );

      // 6. Filter indicators/columns based on profile
      const allowedColumns = filterIndicators(visibleColumns, filters);

      // Store filtered data
      responseData[table] = dataRows;
      columnData[table] = allowedColumns.map(columnName => {
        // Build column metadata...
        return {
          name: columnName,
          // ... other metadata
        };
      });
    }

    return NextResponse.json({
      data: responseData,
      columns: columnData,
      activeProfile: profileId,
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('does not have access') ? 403 : 500 }
    );
  }
}
```

### Helper: Get Table Group Mapping

Add this function to load table-to-group mapping from config:

```typescript
// In app/api/medemap/route.ts or a shared helper

function getTableGroupMap(): { [tableName: string]: string } {
  try {
    const configPath = path.join(process.cwd(), 'app', 'config.yaml');
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg: any = yaml.load(raw);

    // Build reverse mapping: table name -> group
    const map: { [key: string]: string } = {};

    // Assuming your config.yaml has structure like:
    // tables:
    //   displayNames:
    //     democracy: "Democracy & Participation"
    //     supply_side: "Supply Side"
    //   groups:
    //     democracy: ["some_table_1", "some_table_2"]
    //     supply_side: ["supply_side"]

    // For now, simple heuristic: table name often matches group name
    // You may need to customize this based on your actual config structure

    const displayNames = cfg?.tables?.displayNames || {};
    for (const [tableName, displayName] of Object.entries(displayNames)) {
      // Map table to its group (using table name as group identifier)
      // Adjust this logic based on your actual config structure
      map[tableName] = getGroupFromTableName(tableName, displayNames);
    }

    return map;
  } catch (e) {
    console.warn('Could not load table group mapping:', e);
    return {};
  }
}

function getGroupFromTableName(tableName: string, displayNames: any): string {
  // Example heuristic:
  if (tableName.includes('demand_side')) return 'demand_side';
  if (tableName.includes('supply_side')) return 'supply_side';
  if (tableName.includes('democracy')) return 'democracy';
  if (tableName.includes('legal_framework')) {
    if (tableName.includes('equality')) return 'legal_framework_equality';
    if (tableName.includes('freedom')) return 'legal_framework_freedom';
    if (tableName.includes('dignity')) return 'legal_framework_human_dignity';
    if (tableName.includes('pluralism')) return 'legal_framework_pluralism';
    if (tableName.includes('rule_of_law')) return 'legal_framework_rule_of_law';
  }
  if (tableName.includes('basic_data')) return 'basic_data';

  // Default: table name is group name
  return tableName;
}
```

## Step 3: Update Profile YAML Configs

Make sure your YAML configs use the correct group names:

```yaml
# config/profiles/democracy-focus.yaml
profile:
  id: democracy-focus
  name: "Democracy & Participation"

  # Groups match the values returned by getGroupFromTableName()
  groups:
    - democracy
    - demand_side_trust_in_media
    - basic_data

  # Or specify exact table names
  tables:
    - supply_side

  # Filter specific indicators (columns)
  indicators:
    - voter_turnout
    - freedom_of_press
    # Leave empty [] to include all indicators from selected tables
```

## Step 4: Test the Integration

1. **Login as a user with limited profile access**
   ```bash
   # Create test user
   node scripts/create-admin-user.js researcher@test.com password123

   # Grant limited access
   psql -h your-db-host -U postgres -d cmc -c \
     "UPDATE user_profiles SET role = 'researcher', allowed_profiles = '{democracy-focus}' WHERE email = 'researcher@test.com';"
   ```

2. **Login and select profile**
   - Go to `/login`
   - Login with `researcher@test.com`
   - Select "Democracy & Participation" from profile dropdown

3. **Verify filtered data**
   - Open browser DevTools → Network tab
   - Navigate to a data view
   - Check API request: should include `?profile=democracy-focus`
   - Check response: should only contain allowed tables/indicators

## Step 5: Update Redux/State Management (Optional)

If you're using Redux to store fetched data, update your slices to track the active profile:

```typescript
// lib/features/medemap/medeMapSlice.ts

const medeMapSlice = createSlice({
  name: 'medeMap',
  initialState: {
    data: {},
    columns: {},
    activeProfile: null,
    // ...
  },
  reducers: {
    setActiveProfile(state, action) {
      state.activeProfile = action.payload;
    },
    setData(state, action) {
      state.data = action.payload.data;
      state.columns = action.payload.columns;
      state.activeProfile = action.payload.activeProfile;
    },
  },
});
```

## Troubleshooting

### User sees "does not have access" error

- Check `user_profiles.allowed_profiles` contains the profile ID
- Check profile is not `public: false` (requires explicit permission)
- Admins bypass this check

### No data filtering happening

- Verify `profileId` is being passed to API
- Check `getTableGroupMap()` is returning correct mappings
- Add console.log in API to debug filter values
- Verify YAML group names match your table group mappings

### Profile selector not showing

- Check user is authenticated (need to login)
- Verify SessionProvider wraps the app
- Check ProfileProvider wraps client components
- User might not have access to any profiles (check `allowed_profiles`)

## Advanced: Dynamic Profile Creation

Allow admins to create profiles via UI (future enhancement):

```typescript
// app/admin/profiles/page.tsx
async function createProfile(config: ProfileConfig) {
  const response = await fetch('/api/admin/profiles', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}
```

For now, create profiles by adding YAML files to `config/profiles/`.

## Summary

**What's integrated:**
- User authentication and permissions
- Profile selection UI (dropdown)
- Profile access control (who can see which profiles)
- Helper functions to filter data

**What you need to do:**
- [ ] Update your API routes to use `getProfileFiltersForRequest()`
- [ ] Update frontend data fetching to pass `profileId`
- [ ] Implement `getTableGroupMap()` based on your config structure
- [ ] Test with users having different profile access
- [ ] Update YAML configs with correct group/table names

**Next steps:**
1. Start with one API route (e.g., `/api/medemap`)
2. Test thoroughly
3. Apply same pattern to other data routes
4. Create more profile configurations as needed

Need help with a specific integration? Check existing code or ask!
