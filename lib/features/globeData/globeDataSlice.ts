// lib/features/globeData/globeDataSlice.ts

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store';

export interface GlobeData {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  value: number;
}

export interface GlobeDataState {
  data: GlobeData[];
  loading: boolean;
  error: string | null;
}

const initialState: GlobeDataState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchGlobeData = createAsyncThunk('globeData/fetchData', async () => {
  try {
    const response = await fetch('/api/medemap');
    const data = await response.json();
    console.log("Fetched data:", data);  // Log the fetched data
    return data;
  } catch (error) {
    console.error('Failed to fetch globe data:', error);
    throw error;
  }
});

const globeDataSlice = createSlice({
  name: 'globeData',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGlobeData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGlobeData.fulfilled, (state, action: PayloadAction<GlobeData[]>) => {
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

export default globeDataSlice.reducer;

export const selectGlobeData = (state: RootState) => state.globeData.data;
export const selectGlobeDataLoading = (state: RootState) => state.globeData.loading;
export const selectGlobeDataError = (state: RootState) => state.globeData.error;