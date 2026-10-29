// lib/features/demandSideMediaUseSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchDemandSideMediaUse = createAsyncThunk('demandSideMediaUse/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.demand_side_media_use;
});

const demandSideMediaUseSlice = createSlice({
  name: 'demandSideMediaUse',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDemandSideMediaUse.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDemandSideMediaUse.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDemandSideMediaUse.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default demandSideMediaUseSlice.reducer;
