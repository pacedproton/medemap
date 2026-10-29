// lib/features/selects/selectsSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export interface SelectState {
  levelOneOptions: any[];
  levelTwoOptions: any[];
  levelThreeOptions: any[];
  loading: boolean;
  error: string | null;
}

const initialState: SelectState = {
  levelOneOptions: [],
  levelTwoOptions: [],
  levelThreeOptions: [],
  loading: false,
  error: null,
};

// Async thunks for fetching data
export const fetchLevelOneOptions = createAsyncThunk('selects/fetchLevelOneOptions', async () => {
  const response = await axios.get('/api/selectors/level-one-options');
  return response.data;
});

export const fetchLevelTwoOptions = createAsyncThunk('selects/fetchLevelTwoOptions', async (levelOneId: string) => {
  const response = await axios.get(`/api/selectors/level-two-options?levelOneId=${levelOneId}`);
  return response.data;
});

export const fetchLevelThreeOptions = createAsyncThunk('selects/fetchLevelThreeOptions', async ({ levelOneId, levelTwoId }: { levelOneId: string; levelTwoId: string }) => {
  const response = await axios.get(`/api/selectors/level-three-options?levelOneId=${levelOneId}&levelTwoId=${levelTwoId}`);
  return response.data;
});

const selectsSlice = createSlice({
  name: 'selects',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLevelOneOptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLevelOneOptions.fulfilled, (state, action) => {
        state.loading = false;
        state.levelOneOptions = action.payload;
      })
      .addCase(fetchLevelOneOptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch level one options';
      })
      .addCase(fetchLevelTwoOptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLevelTwoOptions.fulfilled, (state, action) => {
        state.loading = false;
        state.levelTwoOptions = action.payload;
      })
      .addCase(fetchLevelTwoOptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch level two options';
      })
      .addCase(fetchLevelThreeOptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLevelThreeOptions.fulfilled, (state, action) => {
        state.loading = false;
        state.levelThreeOptions = action.payload;
      })
      .addCase(fetchLevelThreeOptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch level three options';
      });
  },
});

export default selectsSlice.reducer;
