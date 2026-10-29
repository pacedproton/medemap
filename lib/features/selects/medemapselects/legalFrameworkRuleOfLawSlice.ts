// lib/features/legalFrameworkRuleOfLawSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchLegalFrameworkRuleOfLaw = createAsyncThunk('legalFrameworkRuleOfLaw/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.legal_framework_rule_of_law;
});

const legalFrameworkRuleOfLawSlice = createSlice({
  name: 'legalFrameworkRuleOfLaw',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLegalFrameworkRuleOfLaw.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchLegalFrameworkRuleOfLaw.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchLegalFrameworkRuleOfLaw.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default legalFrameworkRuleOfLawSlice.reducer;
