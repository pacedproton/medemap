// lib/features/selects/medemapselects/demandSideTrustInMediaSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchDemandSideTrustInMedia = createAsyncThunk('demandSideTrustInMedia/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.demand_side_trust_in_media;
});

const demandSideTrustInMediaSlice = createSlice({
  name: 'demandSideTrustInMedia',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDemandSideTrustInMedia.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDemandSideTrustInMedia.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDemandSideTrustInMedia.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default demandSideTrustInMediaSlice.reducer;
