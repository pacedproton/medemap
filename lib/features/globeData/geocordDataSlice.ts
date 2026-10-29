// lib/features/globeData/geocordDataSlice.ts

import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppState } from '../../store';

export interface GeoCoordinates {
  country: string;
  capitol: string;
  latitude: string;
  longitude: string;
}

export interface GeoCoordinatesState {
  data: GeoCoordinates[];
  loading: boolean;
  error: string | null;
}

const initialState: GeoCoordinatesState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchGlobeData = createAsyncThunk('globeData/fetchData', async () => {
  try {
    const response = await fetch('/api/geocoordinates');
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
      .addCase(fetchGlobeData.fulfilled, (state, action: PayloadAction<GeoCoordinates[]>) => {
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

export const selectGlobeData = (state: AppState) => state.globeData.data;
export const selectGlobeDataLoading = (state: AppState) => state.globeData.loading;
export const selectGlobeDataError = (state: AppState) => state.globeData.error;