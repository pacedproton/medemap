// lib/features/legalFrameworkEqualitySlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLegalFrameworkEquality = createAsyncThunk('legalFrameworkEquality/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.legal_framework_equality;
});

const legalFrameworkEqualitySlice = createSlice({
  name: 'legalFrameworkEquality',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLegalFrameworkEquality.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLegalFrameworkEquality.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLegalFrameworkEquality.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default legalFrameworkEqualitySlice.reducer;
