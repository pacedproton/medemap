// lib/features/globeData/medemapDataSlice.ts

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppState } from '../../store';

export interface MeDeMAP {
  country: string;
  eu_abbr: string;
  accession: Date;
  population: number;
  area: number;
  largest_city: string;
  gdp_usd_m_2023: number;
  currency: string;
  hdi_2021: number;
  meps_2020: number;
  meps_2024: number;
  official_languages: string;
  capitol: string;
  longitude: number;
  latitude: number;
}

export interface MeDeMAPState {
  data: MeDeMAP[];
  loading: boolean;
  error: string | null;
}

const initialState: MeDeMAPState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchGlobeData = createAsyncThunk('globeData/fetchData', async () => {
  try {
    const response = await fetch('/api/medemap');
    const data = await response.json();
    console.log("Fetched MeDeMAP data:", data);  
    return data;
  } catch (error) {
    console.error('Failed to fetch MeDeMAP data:', error);
    throw error;
  }
});

const medemapDataSlice = createSlice({
  name: 'globeData',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGlobeData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGlobeData.fulfilled, (state, action: PayloadAction<MeDeMAP[]>) => {
        state.loading = false;
        state.data = action.payload;
        console.log("Data loaded into state:", state.data);
      })
      .addCase(fetchGlobeData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch globe data';
      });
  },
});

export default medemapDataSlice.reducer;

export const selectGlobeData = (state: AppState) => state.medemapData.data;
export const selectGlobeDataLoading = (state: AppState) => state.medemapData.loading;
export const selectGlobeDataError = (state: AppState) => state.medemapData.error;