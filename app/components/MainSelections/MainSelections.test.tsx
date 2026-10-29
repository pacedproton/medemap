import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

// Type declaration for screen
declare const screen: any;
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import MainSelections from './MainSelections';

const mockStore = configureStore([]);

describe('MainSelections', () => {
  let store: ReturnType<typeof mockStore>;

  beforeEach(() => {
    store = mockStore({
      medeMap: {
        data: {},
        loading: false,
        error: null,
      },
    });
  });

  it('renders without crashing', () => {
    render(
      <Provider store={store}>
        <MainSelections />
      </Provider>
    );
    expect(screen.getByText('Data Selection')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    store = mockStore({
      medeMap: {
        data: {},
        loading: true,
        error: null,
      },
    });
    render(
      <Provider store={store}>
        <MainSelections />
      </Provider>
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});