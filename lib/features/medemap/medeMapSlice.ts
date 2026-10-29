/**
 * @file medeMapSlice.ts
 * @description Redux slice for managing MeDeMAP data, including fetching, state management, and selection of options.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../../store';

export interface ColumnOption {
  value: string;
  label: string;
  thresholds: any;
}

export interface MedeMapState {
  data: Record<string, any[]>;
  columnOptions: Record<string, ColumnOption[]>;
  columnOrder: Record<string, string[]>;
  selectedOptions: Record<string, any[]>;
  selectedCountries: string[];
  loading: boolean;
  error: string | null;
  dataset: string;
}

/**
 * @typedef {Object} MedeMapData
 * @description Object containing arrays of data for each table in the MeDeMAP database.
 */

/**
 * @typedef {Object} ColumnOption
 * @property {string} value - The column name.
 * @property {string} label - The display label for the column.
 * @property {Object} thresholds - Threshold values for the column.
 * @property {number} thresholds.medium_low_threshold - The medium-low threshold value.
 * @property {number} thresholds.high_medium_threshold - The high-medium threshold value.
 * @property {number} thresholds.eu_average - The EU average value.
 * @property {number} thresholds.eu_standard_deviation - The EU standard deviation value.
 */

/**
 * @typedef {Object} MedeMapState
 * @property {MedeMapData} data - The fetched MeDeMAP data.
 * @property {Object.<string, ColumnOption[]>} columnOptions - Available column options for each table.
 * @property {Object.<string, ColumnOption[]>} selectedOptions - User-selected options for each table.
 * @property {boolean} loading - Indicates if data is being fetched.
 * @property {string|null} error - Error message if data fetch fails.
 * @property {Object.<string, string[]>} columnOrder - Order of columns for each table.
 * @property {'v1'|'v2'} dataset - Selected dataset version.
 */

/**
 * @type {MedeMapState}
 * @description Initial state for the MedeMap slice.
 */
const initialState: MedeMapState = {
  data: {},
  columnOptions: {},
  columnOrder: {},
  selectedOptions: {},
  selectedCountries: [], // Add country filtering
  loading: false,
  error: null,
  dataset: 'v2',
};

/**
 * @function fetchMedeMapData
 * @description Async thunk for fetching MedeMap data from the API.
 * @returns {Promise<MedeMapData>} The fetched MedeMap data.
 */
export const fetchMedeMapData = createAsyncThunk(
  'medeMap/fetchData',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const dataset = state.medeMap.dataset || 'v2';
    const ts = Date.now();

    // Check if caching is disabled (SSR safe)
    const cacheEnabled = typeof window !== 'undefined' ? localStorage.getItem("cacheEnabled") : null;
    const shouldDisableCache = cacheEnabled === "false";

    // Get active profile from localStorage (set by ProfileContext) - SSR safe
    const activeProfile = typeof window !== 'undefined' ? localStorage.getItem("selectedProfile") : null;

    let url = `/api/medemap?dataset=${encodeURIComponent(dataset)}&_=${ts}`;

    // Add profile parameter if available
    if (activeProfile) {
      url += `&profile=${encodeURIComponent(activeProfile)}`;
    }

    if (shouldDisableCache) {
      url += '&nocache=true';
    }

    const response = await axios.get(url);
    return response.data;
  }
);

/**
 * @const medeMapSlice
 * @description Redux slice for MedeMap data management.
 */
const medeMapSlice = createSlice({
  name: 'medeMap',
  initialState,
  reducers: {
    /**
     * @function setSelectedOptions
     * @description Sets the selected options in the state.
     */
    setSelectedOptions: (state, action: PayloadAction<{ [key: string]: ColumnOption[] }>) => {
      state.selectedOptions = action.payload;
    },
    /**
     * @function setDataset
     * @description Sets the active dataset version.
     */
    setDataset: (state, action: PayloadAction<'v1' | 'v2'>) => {
      state.dataset = action.payload;
    },
    /**
     * @function setSelectedCountries
     * @description Sets the selected countries for filtering.
     */
    setSelectedCountries: (state, action: PayloadAction<string[]>) => {
      state.selectedCountries = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMedeMapData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMedeMapData.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null; // Clear any previous errors
        state.data = action.payload;
        state.columnOptions = Object.entries(action.payload.columnOptions).reduce((acc, [key, value]) => {
          console.log(`Redux slice: Processing table ${key}, value type:`, typeof value, 'isArray:', Array.isArray(value));
          if (Array.isArray(value)) {
            acc[key] = value.map(column => ({
              value: column.value,
              label: column.label,
              thresholds: column.meta
            }));
            console.log(`Redux slice: Added ${value.length} columns for table ${key}`);
          } else {
            console.warn(`Redux slice: Skipping table ${key} because value is not an array:`, value);
          }
          return acc;
        }, {} as Record<string, ColumnOption[]>);
        state.columnOrder = action.payload.columnOrder || {};
      })
      .addCase(fetchMedeMapData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch MeDeMAP data';
      });
  },
});

export const { setSelectedOptions, setDataset, setSelectedCountries } = medeMapSlice.actions;

/**
 * @function selectMedeMapData
 * @description Selector to get the entire MedeMap state.
 */
export const selectMedeMapData = (state: RootState) => state.medeMap;
export const selectDataset = (state: RootState) => state.medeMap.dataset;
export const selectMedeMapLoading = (state: RootState) => state.medeMap.loading;
export const selectMedeMapError = (state: RootState) => state.medeMap.error;

export default medeMapSlice.reducer;