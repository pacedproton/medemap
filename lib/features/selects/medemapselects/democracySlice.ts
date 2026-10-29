import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchDemocracy = createAsyncThunk('democracy/fetchData', async () => {
  const response = await axios.get('/api/medemap');
  return response.data.democracy;
});

const democracySlice = createSlice({
  name: 'democracy',
  initialState: { data: [], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDemocracy.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDemocracy.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDemocracy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch data';
      });
  },
});

export default democracySlice.reducer;
