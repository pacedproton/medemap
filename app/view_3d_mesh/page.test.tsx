import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Provider } from "react-redux";
import configureStore from "redux-mock-store";
import ThreeDMeshView from "./page";

// Mock next/router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock react-i18next
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the Redux hooks
jest.mock("../../lib/hooks", () => ({
  useAppSelector: jest.fn(),
}));

// Import the mocked hook
import { useAppSelector } from "../../lib/hooks";

// Mock the dynamic import of Plotly
jest.mock("next/dynamic", () => () => {
  const DynamicComponent = () => null;
  DynamicComponent.displayName = "Plot";
  return DynamicComponent;
});

// Mock the clientlogging functions
jest.mock("../../lib/clientlogging", () => ({
  log: jest.fn(),
  logVerbose: jest.fn(),
}));

// Mock the useAppSelector hook
jest.mock("../../lib/hooks", () => ({
  useAppSelector: jest.fn(),
}));

const mockStore = configureStore([]);

describe("ThreeDMeshView", () => {
  it("renders no data message when plotData is empty", () => {
    const mockState = {
      data: {},
      selectedOptions: {},
      columnOptions: {},
      columnOrder: {},
      selectedCountries: [],
      loading: false,
      error: null,
      dataset: "v2",
    };

    (
      useAppSelector as jest.MockedFunction<typeof useAppSelector>
    ).mockReturnValue(mockState);

    render(
      <Provider store={mockStore({})}>
        <ThreeDMeshView />
      </Provider>
    );

    expect(
      screen.getByText("No data to display. Please select some inidcators.")
    ).toBeInTheDocument();
  });

  it("renders Plot component when data is available", () => {
    const mockState = {
      data: {
        table1: [
          { country: "Country1", value1: "10" },
          { country: "Country2", value1: "20" },
        ],
      },
      selectedOptions: {
        table1: [{ label: "Value 1", value: "value1" }],
      },
      columnOptions: {
        table1: [{ label: "Value 1", value: "value1" }],
      },
      columnOrder: {},
      selectedCountries: [],
      loading: false,
      error: null,
      dataset: "v2",
    };

    (
      useAppSelector as jest.MockedFunction<typeof useAppSelector>
    ).mockReturnValue(mockState);

    render(
      <Provider store={mockStore({})}>
        <ThreeDMeshView />
      </Provider>
    );

    // Verify that the "no data" message is not shown when data is available
    expect(
      screen.queryByText("No data to display. Please select some inidcators.")
    ).not.toBeInTheDocument();
  });
});
