import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import StackedBarView from './page';

// Mock next/router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the Redux hooks
jest.mock('../../lib/hooks', () => ({
  useAppSelector: jest.fn(),
}));

// Mock useDispatch to avoid async thunk issues
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => jest.fn(),
}));

// Import the mocked hook
import { useAppSelector } from '../../lib/hooks';

// Mock the dynamic import of Plotly
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = 'Plot';
  return DynamicComponent;
});

// Mock the clientlogging functions
jest.mock('../../lib/clientlogging', () => ({
  log: jest.fn(),
  logVerbose: jest.fn(),
}));

// Mock the useAppSelector hook
jest.mock('../../lib/hooks', () => ({
  useAppSelector: jest.fn(),
}));

const mockStore = configureStore([]);

describe('StackedBarView', () => {
  it('renders no data message when plotData is null', () => {
    const mockState = {
      data: {},
      selectedOptions: {},
      columnOptions: {
        some_table: [{ label: 'Value 1', value: 'value1' }, { label: 'Value 2', value: 'value2' }],
      },
      columnOrder: {},
      selectedCountries: [],
      loading: false,
      error: null,
      dataset: 'v2',
    };

    (useAppSelector as jest.MockedFunction<typeof useAppSelector>).mockReturnValue(mockState);

    render(
      <Provider store={mockStore({})}>
        <StackedBarView />
      </Provider>
    );

    expect(screen.getByText('No data to display. Please wait for data to load.')).toBeInTheDocument();
  });

  it('renders Plot component when data is available', () => {
    const mockState = {
      data: {
        some_table: [
          { country: 'Country1', value1: '10', value2: '20' },
          { country: 'Country2', value1: '20', value2: '30' },
        ],
      },
      selectedOptions: {},
      columnOptions: {
        some_table: [{ label: 'Value 1', value: 'value1' }, { label: 'Value 2', value: 'value2' }],
      },
      columnOrder: {},
      selectedCountries: [],
      loading: false,
      error: null,
      dataset: 'v2',
    };

    (useAppSelector as jest.MockedFunction<typeof useAppSelector>).mockReturnValue(mockState);

    render(
      <Provider store={mockStore({})}>
        <StackedBarView />
      </Provider>
    );

    // Verify that the "no data" message is not shown when data is available
    expect(screen.queryByText('No data to display. Please wait for data to load.')).not.toBeInTheDocument();
  });

  it('renders reset button when data is available', () => {
    const mockState = {
      data: {
        some_table: [
          { country: 'Country1', value1: '10', value2: '20' },
          { country: 'Country2', value1: '20', value2: '30' },
        ],
      },
      selectedOptions: {},
      columnOptions: {
        some_table: [{ label: 'Value 1', value: 'value1' }, { label: 'Value 2', value: 'value2' }],
      },
      columnOrder: {},
      selectedCountries: [],
      loading: false,
      error: null,
      dataset: 'v2',
    };

    (useAppSelector as jest.MockedFunction<typeof useAppSelector>).mockReturnValue(mockState);

    render(
      <Provider store={mockStore({})}>
        <StackedBarView />
      </Provider>
    );

    expect(screen.getByText('Reset Views')).toBeInTheDocument();
  });
});