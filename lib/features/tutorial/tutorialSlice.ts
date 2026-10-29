import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store';

interface TutorialState {
  runTutorial: boolean;
}

const initialState: TutorialState = {
  runTutorial: false,
};

export const tutorialSlice = createSlice({
  name: 'tutorial',
  initialState,
  reducers: {
    setRunTutorial: (state, action: PayloadAction<boolean>) => {
      state.runTutorial = action.payload;
    },
  },
});

export const { setRunTutorial } = tutorialSlice.actions;

export const selectRunTutorial = (state: RootState) => state.tutorial.runTutorial;

export default tutorialSlice.reducer;