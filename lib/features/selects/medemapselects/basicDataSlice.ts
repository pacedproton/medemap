// lib/features/basicDataSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchBasicData= createAsyncThunk('basicData/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.demand_side_trust_in_media;
});

const basicDataSlice = createSlice({
  name: 'basicData',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBasicData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBasicData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchBasicData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default basicDataSlice.reducer;
