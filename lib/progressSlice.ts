import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

interface ProgressState {
  overallProgress: number;
}

const initialState: ProgressState = {
  overallProgress: 0,
};

const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    setOverallProgress: (state, action: PayloadAction<number>) => {
      state.overallProgress = action.payload;
    },
  },
});

export const { setOverallProgress } = progressSlice.actions;
export const selectOverallProgress = (state: RootState) => state.progress.overallProgress;
export default progressSlice.reducer;