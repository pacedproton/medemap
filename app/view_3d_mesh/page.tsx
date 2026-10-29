"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../lib/hooks";
import { selectMedeMapData } from "../../lib/features/medemap/medeMapSlice";
import { Box, Typography } from "@mui/material";
import dynamic from "next/dynamic";
import styles from "./styles.module.css";
import { log, logVerbose } from "../../lib/clientlogging";
import { useTranslation } from "react-i18next";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

/**
 * Interface representing a column in the data
 */
interface Column {
  label: string;
  value: string;
}

/**
 * Interface representing the processed data for the 3D mesh plot
 */
interface ProcessedData {
  countries: string[];
  indicators: string[];
  zValues: (number | null)[][];
}

/**
 * ThreeDMeshView Component
 *
 * This component renders a 3D surface mesh view of selected indicators across countries.
 * It processes the data from the MedeMap state and visualizes it using Plotly.
 */
const ThreeDMeshView: React.FC = () => {
  const { t } = useTranslation();
  const medeMapState = useAppSelector(selectMedeMapData);
  const [plotData, setPlotData] = useState<ProcessedData[]>([]);

  // Effect to process data when MedeMap state changes
  useEffect(() => {
    log("Rendering 3D Mesh View");
    logVerbose("3d-mesh", "MedeMapState in 3D Mesh View:", medeMapState);
    logVerbose(
      "3d-mesh",
      "Selected options in 3D Mesh View:",
      medeMapState.selectedOptions
    );
    logVerbose("3d-mesh", "Data in 3D Mesh View:", medeMapState.data);
    processData();
  }, [medeMapState]);

  // Effect to log processed plot data
  useEffect(() => {
    if (plotData.length > 0) {
      logVerbose("3d-mesh", "Countries being plotted:", plotData[0].countries);
      logVerbose(
        "3d-mesh",
        "Indicators being plotted:",
        plotData[0].indicators
      );
      logVerbose("3d-mesh", "Z-values being plotted:", plotData[0].zValues);
    }
  }, [plotData]);

  /**
   * Processes the raw data from MedeMap state into a format suitable for 3D mesh plotting
   */
  const processData = () => {
    log("Processing data for 3D Mesh");
    const { data, selectedOptions, columnOptions } = medeMapState;

    if (
      Object.keys(selectedOptions).length === 0 ||
      Object.keys(data).length === 0
    ) {
      log(
        "No data or options selected for 3D Mesh. Skipping processing.",
        "warn"
      );
      return;
    }

    const allCountries = new Set<string>();
    const indicators: string[] = [];
    const zValues: Record<string, Record<string, number>> = {};

    // Collect all unique countries
    Object.entries(data).forEach(([tableName, tableData]) => {
      if (Array.isArray(tableData)) {
        logVerbose("3d-mesh", `Processing countries from table: ${tableName}`);
        tableData.forEach((row) => {
          logVerbose(
            "3d-mesh",
            `Adding country from ${tableName}:`,
            row.country
          );
          const beforeSize = allCountries.size;
          allCountries.add(row.country);
          if (allCountries.size === beforeSize) {
            logVerbose(
              "3d-mesh",
              `Duplicate country found in ${tableName}:`,
              row.country
            );
          }
        });
      }
    });

    logVerbose(
      "3d-mesh",
      "All countries after initial processing:",
      Array.from(allCountries)
    );

    // Process selected options and data
    Object.entries(selectedOptions).forEach(([tableName, columns]) => {
      logVerbose("3d-mesh", `Processing table for 3D Mesh: ${tableName}`);
      if (Array.isArray(columns) && columns.length > 0) {
        const tableData = data[tableName];
        if (!Array.isArray(tableData)) {
          log(
            `No valid data found for table in 3D Mesh: ${tableName}`,
            "error"
          );
          return;
        }

        logVerbose("3d-mesh", `Selected columns for ${tableName}:`, columns);
        (columns as Column[]).forEach((column: Column) => {
          const columnOption = columnOptions[tableName].find(
            (opt: any) => opt.value === column.value
          );
          const indicatorName =
            columnOption?.thresholds?.indicator ||
            t(columnOption?.label || column.label);
          logVerbose("3d-mesh", `Processing indicator: ${indicatorName}`);
          indicators.push(indicatorName);
          zValues[indicatorName] = {};
          tableData.forEach((row) => {
            const value = parseFloat(row[column.value]);
            if (!isNaN(value) && value !== 0) {
              if (zValues[indicatorName][row.country] !== undefined) {
                logVerbose(
                  "3d-mesh",
                  `Duplicate value for country ${row.country} in indicator ${indicatorName}`
                );
              }
              zValues[indicatorName][row.country] = value;
            }
          });
        });
      }
    });

    // Prepare final data for plotting
    const sortedCountries = Array.from(allCountries).sort();
    logVerbose("3d-mesh", "Sorted countries:", sortedCountries);
    const processedZValues = indicators.map((indicator) =>
      sortedCountries.map((country) => {
        const value = zValues[indicator][country];
        return value === undefined ? null : value;
      })
    );

    const processedData: ProcessedData = {
      countries: sortedCountries,
      indicators,
      zValues: processedZValues,
    };

    logVerbose("3d-mesh", "Processed Data for 3D Mesh:", processedData);
    setPlotData([processedData]);
  };

  return (
    <Box className={styles.container}>
      {plotData.length === 0 && (
        <Typography>
          {t("No data to display. Please select some indicators.")}
        </Typography>
      )}

      {plotData.length > 0 && (
        <Box className={styles.chartContainer}>
          <Plot
            data={plotData[0].indicators.map((indicator, indicatorIndex) => ({
              type: "scatter3d",
              name: indicator,
              x: plotData[0].countries,
              y: new Array(plotData[0].countries.length).fill(
                plotData[0].indicators[indicatorIndex]
              ),
              z: plotData[0].zValues[indicatorIndex],
              mode: "lines+markers",
              line: {
                width: 6,
                color: plotData[0].zValues[indicatorIndex],
              },
              marker: {
                size: 4,
                color: plotData[0].zValues[indicatorIndex],
                colorscale: [
                  [0, "rgb(255,50,50)"],
                  [0.33, "rgb(255,150,50)"],
                  [0.66, "rgb(150,255,50)"],
                  [1, "rgb(50,255,50)"],
                ],
              },
              showscale: false,
              hovertemplate:
                t("Country") +
                ": %{x}<br>" +
                t("Indicator") +
                ": %{y}<br>" +
                t("Value") +
                ": %{z}<extra></extra>",
            }))}
            layout={{
              width: 1400,
              height: 1100,
              autosize: false,
              scene: {
                xaxis: {
                  title: t("Country"),
                  tickangle: 45,
                  tickfont: { size: 8 },
                  nticks: plotData[0].countries.length,
                  autorange: true,
                  showticklabels: true,
                  ticktext: plotData[0].countries,
                  tickvals: plotData[0].countries.map((_, i) => i),
                  showgrid: true,
                  gridcolor: "rgb(200,200,200)",
                  gridwidth: 2,
                },
                yaxis: {
                  title: "",
                  tickangle: 0,
                  tickfont: { size: 12 },
                  tickmode: "array",
                  tickvals: plotData[0].indicators.map((_, i) => i),
                  ticktext: plotData[0].indicators,
                  autorange: true,
                  showgrid: true,
                  gridcolor: "rgb(200,200,200)",
                  gridwidth: 2,
                },
                zaxis: {
                  title: t("Normalized Metric"),
                  titlefont: { size: 12 },
                  showgrid: true,
                  gridcolor: "rgb(200,200,200)",
                  gridwidth: 2,
                },
                camera: {
                  eye: { x: 2.2, y: 2.2, z: 1.8 },
                  center: { x: 0.2, y: 0.2, z: 0 },
                  up: { x: 0, y: 0, z: 1 },
                },
                aspectratio: { x: 2, y: 1, z: 0.8 },
                domain: {
                  x: [0, 1],
                  y: [0.1, 1],
                },
              },
              margin: {
                l: 20,
                r: 20,
                b: 120,
                t: 100,
                pad: 0,
              },
              title: t("3D Surface Mesh View of Selected Indicators"),
              annotations: [
                {
                  text: t("Zoom"),
                  x: 0.5,
                  y: 0.97,
                  xref: "paper",
                  yref: "paper",
                  showarrow: false,
                  font: { size: 12 },
                },
                {
                  text: t("Low"),
                  x: 0.7,
                  y: 0.89,
                  xref: "paper",
                  yref: "paper",
                  showarrow: false,
                  font: { size: 10 },
                },
                {
                  text: t("High"),
                  x: 0.3,
                  y: 0.89,
                  xref: "paper",
                  yref: "paper",
                  showarrow: false,
                  font: { size: 10 },
                },
              ],
              sliders: [
                {
                  active: 4,
                  currentvalue: {
                    visible: false,
                  },
                  pad: { t: 50 },
                  len: 0.4,
                  x: 0.3,
                  xanchor: "left",
                  y: 0.92,
                  yanchor: "middle",
                  steps: Array.from({ length: 9 }, (_, i) => ({
                    method: "relayout" as const,
                    args: [
                      "scene.camera.eye",
                      { x: 3.4 - i * 0.2, y: 3.4 - i * 0.2, z: 2.4 - i * 0.15 },
                    ],
                    label: "",
                  })),
                },
              ],
            }}
            config={{
              displayModeBar: true,
              scrollZoom: true,
              displaylogo: false,
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ThreeDMeshView;
