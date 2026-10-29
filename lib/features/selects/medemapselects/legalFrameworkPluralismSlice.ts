// lib/features/legalFrameworkPluralismSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLegalFrameworkPluralism = createAsyncThunk('legalFrameworkPluralism/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.legal_framework_pluralism;
});

const legalFrameworkPluralismSlice = createSlice({
  name: 'legalFrameworkPluralism',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLegalFrameworkPluralism.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLegalFrameworkPluralism.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLegalFrameworkPluralism.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default legalFrameworkPluralismSlice.reducer;
