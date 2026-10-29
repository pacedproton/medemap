import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/lib/store';

export type LabelDisplayMode = 'formatted' | 'raw';

interface LabelDisplayState {
  mode: LabelDisplayMode;
}

const initialState: LabelDisplayState = {
  mode: 'raw', // Default to raw database column names
};

export const labelDisplaySlice = createSlice({
  name: 'labelDisplay',
  initialState,
  reducers: {
    setLabelDisplayMode: (state, action: PayloadAction<LabelDisplayMode>) => {
      state.mode = action.payload;
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('labelDisplayMode', action.payload);
      }
    },
    loadLabelDisplayMode: (state) => {
      // Load from localStorage
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('labelDisplayMode') as LabelDisplayMode;
        if (saved === 'formatted' || saved === 'raw') {
          state.mode = saved;
        }
      }
    },
  },
});

export const { setLabelDisplayMode, loadLabelDisplayMode } = labelDisplaySlice.actions;

export const selectLabelDisplayMode = (state: RootState) => state.labelDisplay?.mode || 'raw';

export default labelDisplaySlice.reducer;