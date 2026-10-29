// lib/store.ts

import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import globeDataReducer, { GlobeDataState } from './features/globeData/globeDataSlice';
import drawerReducer from './features/drawer/drawerSlice';
import loadReducer from './loadingSlice';
import selectsReducer from './features/selects/selectsSlice';
import medeMapReducer from './features/medemap/medeMapSlice';
import tutorialReducer from './features/tutorial/tutorialSlice';
import languageReducer from './features/language/languageSlice';
import settingsReducer from './features/settings/settingsSlice';
import progressReducer from './progressSlice';
import labelDisplayReducer from './features/settings/labelDisplaySlice';

import {
  demandSideTrustInMediaSlice,
  basicDataSlice,
  demandSideMediaUseSlice,
  democracySlice,
  legalFrameworkEqualitySlice,
  legalFrameworkFreedomSlice,
  legalFrameworkHumanDignitySlice,
  legalFrameworkPluralismSlice,
  legalFrameworkRuleOfLawSlice,
  supplySideSlice,
} from './features/selects/medemapselects/';

import { loadState, saveState } from './localStorage';
import throttle from 'lodash/throttle';

// Load persisted state only on client-side and with extra safety
const persistedState = (() => {
  try {
    // Only load state on client side and when window is fully available
    if (typeof window === 'undefined' || !window.localStorage) {
      return undefined;
    }
    return loadState();
  } catch (error) {
    // If anything goes wrong, return undefined to avoid SSR issues
    console.warn('Failed to load persisted state:', error);
    return undefined;
  }
})();

export const store = configureStore({
  reducer: {
    globeData: globeDataReducer as any,
    drawer: drawerReducer,
    loading: loadReducer,
    medemapData: medeMapReducer,
    selects: selectsReducer,
    demandSideTrustInMedia: demandSideTrustInMediaSlice,
    basicData: basicDataSlice,
    demandSideMediaUse: demandSideMediaUseSlice,
    democracy: democracySlice,
    legalFrameworkEquality: legalFrameworkEqualitySlice,
    legalFrameworkFreedom: legalFrameworkFreedomSlice,
    legalFrameworkHumanDignity: legalFrameworkHumanDignitySlice,
    legalFrameworkPluralism: legalFrameworkPluralismSlice,
    legalFrameworkRuleOfLaw: legalFrameworkRuleOfLawSlice,
    supplySide: supplySideSlice,
    medeMap: medeMapReducer,
    tutorial: tutorialReducer,
    language: languageReducer,
    settings: settingsReducer,
    progress: progressReducer,
    labelDisplay: labelDisplayReducer,
  } as any,
  preloadedState: persistedState,
});

store.subscribe(throttle(() => {
  saveState({
    medeMap: store.getState().medeMap
  });
}, 1000));

// Export types for RootState and AppDispatch to be used throughout the application
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;  // Defines the type for the store itself
export type AppState = ReturnType<typeof store.getState>;  // Defines the type for the state managed by the store
