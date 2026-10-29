import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface LanguageState {
  currentLanguage: string;
}

const initialState: LanguageState = {
  currentLanguage: 'en',
};

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguage: (state, action: PayloadAction<string>) => {
      if (['en', 'de', 'fr', 'la'].includes(action.payload)) {
        state.currentLanguage = action.payload;
      }
    },
  },
});

export const { setLanguage } = languageSlice.actions;
export default languageSlice.reducer;