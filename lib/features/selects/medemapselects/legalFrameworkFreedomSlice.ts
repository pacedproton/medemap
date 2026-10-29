// lib/features/legalFrameworkFreedomSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLegalFrameworkFreedom = createAsyncThunk('legalFrameworkFreedom/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.legal_framework_freedom;
});

const legalFrameworkFreedomSlice = createSlice({
  name: 'legalFrameworkFreedom',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLegalFrameworkFreedom.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLegalFrameworkFreedom.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLegalFrameworkFreedom.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default legalFrameworkFreedomSlice.reducer;
