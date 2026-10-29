// lib/features/legalFrameworkHumanDignitySlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLegalFrameworkHumanDignity = createAsyncThunk('legalFrameworkHumanDignity/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.legal_framework_human_dignity;
});

const legalFrameworkHumanDignitySlice = createSlice({
  name: 'legalFrameworkHumanDignity',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLegalFrameworkHumanDignity.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLegalFrameworkHumanDignity.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLegalFrameworkHumanDignity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default legalFrameworkHumanDignitySlice.reducer;
