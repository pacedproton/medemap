import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../store';

// Safe localStorage access for SSR compatibility
const getLocalStorageItem = (key: string, defaultValue: string = ''): string => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
};

const setLocalStorageItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Silently fail if localStorage is not available
  }
};

interface SettingsState {
        showDataLabels: boolean;
        dataLabelFontSize: number;
        use3DLogScale: boolean;
        emphasisMode: boolean;
        videoSoundEnabled: boolean;
        // Logging configuration
        logLevel: 'debug' | 'info' | 'warning' | 'error';
        logToConsole: boolean;
        logToDatabase: boolean;
        verboseLogging: boolean; // deprecated but kept for compatibility
}

const initialState: SettingsState = {
        showDataLabels: false,
        dataLabelFontSize: 14,
        use3DLogScale: false,
        emphasisMode: false,
        videoSoundEnabled: true,
        // Logging configuration - initialize from localStorage (SSR safe)
        logLevel: (getLocalStorageItem('logLevel') as SettingsState['logLevel']) || 'info',
        logToConsole: getLocalStorageItem('logToConsole', 'true') !== 'false', // default true
        logToDatabase: getLocalStorageItem('logToDatabase', 'true') !== 'false', // default true
        verboseLogging: getLocalStorageItem('verboseLogging', 'false') === 'true', // default false
};

const settingsSlice = createSlice({
        name: 'settings',
        initialState,
        reducers: {
                setShowDataLabels: (state, action: PayloadAction<boolean>) => {
                        state.showDataLabels = action.payload;
                },
                setDataLabelFontSize: (state, action: PayloadAction<number>) => {
                        state.dataLabelFontSize = action.payload;
                },
                setUse3DLogScale: (state, action: PayloadAction<boolean>) => {
                        state.use3DLogScale = action.payload;
                },
                setEmphasisMode: (state, action: PayloadAction<boolean>) => {
                        state.emphasisMode = action.payload;
                },
                setVideoSoundEnabled: (state, action: PayloadAction<boolean>) => {
                        state.videoSoundEnabled = action.payload;
                },
                setLogLevel: (state, action: PayloadAction<SettingsState['logLevel']>) => {
                        state.logLevel = action.payload;
                        setLocalStorageItem('logLevel', action.payload);
                },
                setLogToConsole: (state, action: PayloadAction<boolean>) => {
                        state.logToConsole = action.payload;
                        setLocalStorageItem('logToConsole', action.payload.toString());
                },
                setLogToDatabase: (state, action: PayloadAction<boolean>) => {
                        state.logToDatabase = action.payload;
                        setLocalStorageItem('logToDatabase', action.payload.toString());
                },
                setVerboseLogging: (state, action: PayloadAction<boolean>) => {
                        state.verboseLogging = action.payload;
                        setLocalStorageItem('verboseLogging', action.payload.toString());
                },
        },
});


export const {
  setShowDataLabels,
  setDataLabelFontSize,
  setUse3DLogScale,
  setEmphasisMode,
  setVideoSoundEnabled,
  setLogLevel,
  setLogToConsole,
  setLogToDatabase,
  setVerboseLogging
} = settingsSlice.actions;

// Selectors
export const selectShowDataLabels = (state: RootState) =>
  state.settings.showDataLabels;
export const selectDataLabelFontSize = (state: RootState) =>
  state.settings.dataLabelFontSize;
export const selectUse3DLogScale = (state: RootState) =>
  state.settings.use3DLogScale;
export const selectEmphasisMode = (state: RootState) =>
  state.settings.emphasisMode;
export const selectVideoSoundEnabled = (state: RootState) =>
  state.settings.videoSoundEnabled;

// Logging selectors
export const selectLogLevel = (state: RootState) =>
  state.settings.logLevel;
export const selectLogToConsole = (state: RootState) =>
  state.settings.logToConsole;
export const selectLogToDatabase = (state: RootState) =>
  state.settings.logToDatabase;
export const selectVerboseLogging = (state: RootState) =>
  state.settings.verboseLogging;

export default settingsSlice.reducer;