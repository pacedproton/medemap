"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "../../lib/hooks";
import {
  selectMedeMapData,
  fetchMedeMapData,
} from "../../lib/features/medemap/medeMapSlice";
import { selectLabelDisplayMode } from "../../lib/features/settings/labelDisplaySlice";
import { formatIndicatorLabel } from "../../lib/utils/labelFormatter";
import { Box, Typography, Paper } from "@mui/material";
import dynamic from "next/dynamic";
import styles from "./CorrelationMatrixView.module.css";
import { log, logVerbose } from "../../lib/clientlogging";
import { useTranslation } from "react-i18next";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;

interface CorrelationData {
  labels: string[];
  correlationMatrix: number[][];
}

const CorrelationMatrixView: React.FC = () => {
  const { t } = useTranslation();
  const medeMapState = useAppSelector(selectMedeMapData);
  const labelDisplayMode = useAppSelector(selectLabelDisplayMode);
  const [correlationData, setCorrelationData] =
    useState<CorrelationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useAppDispatch();

  useEffect(() => {
    log("Rendering Correlation Matrix View");
    logVerbose(
      "correlation-matrix",
      "MedeMapState in Correlation Matrix View:",
      medeMapState
    );

    if (Object.keys(medeMapState.data).length === 0) {
      dispatch(fetchMedeMapData());
    } else {
      processData();
    }
  }, [medeMapState, dispatch, labelDisplayMode]);

  const processData = () => {
    setIsLoading(true);
    log("Processing data for Correlation Matrix");
    const { data, columnOptions } = medeMapState;

    if (Object.keys(data).length === 0) {
      log(
        "No data available for Correlation Matrix. Skipping processing.",
        "warn"
      );
      setIsLoading(false);
      return;
    }

    const allIndicators: { [key: string]: number[] } = {};
    const labels: string[] = [];

    // Keep track of countries and years for each value to ensure proper pairing
    const valuesByCountryYear: { [key: string]: { [key: string]: number } } =
      {};

    Object.entries(data).forEach(([tableName, tableData]) => {
      if (
        Array.isArray(tableData) &&
        tableData.length > 0 &&
        tableName !== "basic_data"
      ) {
        let columns = Object.keys(tableData[0]).filter(
          (key) =>
            !["country", "year"].includes(key) && !key.startsWith("meta_")
        );

        tableData.forEach((row) => {
          const key = `${row.country}_${row.year}`;
          valuesByCountryYear[key] = valuesByCountryYear[key] || {};

          columns.forEach((column) => {
            const columnOption = columnOptions[tableName].find(
              (opt: any) => opt.value === column
            );
            const indicatorName = formatIndicatorLabel(
              labelDisplayMode,
              columnOption || { value: column },
              tableName
            );
            if (!labels.includes(indicatorName)) {
              labels.push(indicatorName);
            }
            const value = parseFloat(row[column]);
            if (!isNaN(value)) {
              valuesByCountryYear[key][indicatorName] = value;
            }
          });
        });
      }
    });

    // Create aligned arrays for correlation calculation
    const alignedIndicators: { [key: string]: number[] } = {};
    labels.forEach((label) => {
      alignedIndicators[label] = [];
    });

    // Fill arrays with aligned values
    Object.values(valuesByCountryYear).forEach((countryYearData) => {
      labels.forEach((label) => {
        alignedIndicators[label].push(countryYearData[label] || NaN);
      });
    });

    const correlationMatrix = calculateCorrelationMatrix(alignedIndicators);
    setCorrelationData({ labels, correlationMatrix });
    setTimeout(() => setIsLoading(false), 100);
  };

  const calculateCorrelationMatrix = (indicators: {
    [key: string]: number[];
  }) => {
    const keys = Object.keys(indicators);
    const matrix = keys.map(() => new Array(keys.length).fill(0));

    for (let i = 0; i < keys.length; i++) {
      for (let j = i; j < keys.length; j++) {
        const correlation = calculateCorrelation(
          indicators[keys[i]],
          indicators[keys[j]]
        );
        matrix[i][j] = correlation;
        matrix[j][i] = correlation;
      }
    }

    return matrix;
  };

  const calculateCorrelation = (x: number[], y: number[]) => {
    // Filter out pairs where either value is NaN or zero
    const validPairs = x
      .map((val, idx) => [val, y[idx]])
      .filter(
        (pair) =>
          !isNaN(pair[0]) &&
          !isNaN(pair[1]) &&
          pair[0] !== null &&
          pair[1] !== null
      );

    if (validPairs.length < 2) return NaN; // Need at least 2 pairs for correlation

    // Check if all values in either array are identical
    const xAllSame = validPairs.every((pair) => pair[0] === validPairs[0][0]);
    const yAllSame = validPairs.every((pair) => pair[1] === validPairs[0][1]);
    if (xAllSame || yAllSame) return NaN; // Can't calculate correlation if no variation

    const xValues = validPairs.map((pair) => pair[0]);
    const yValues = validPairs.map((pair) => pair[1]);

    const n = xValues.length;
    let sum_x = 0,
      sum_y = 0,
      sum_xy = 0,
      sum_x2 = 0,
      sum_y2 = 0;

    for (let i = 0; i < n; i++) {
      sum_x += xValues[i];
      sum_y += yValues[i];
      sum_xy += xValues[i] * yValues[i];
      sum_x2 += xValues[i] * xValues[i];
      sum_y2 += yValues[i] * yValues[i];
    }

    const numerator = n * sum_xy - sum_x * sum_y;
    const denominator = Math.sqrt(
      (n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y)
    );

    return denominator === 0 ? NaN : numerator / denominator;
  };

  return (
    <Box className={styles.container}>
      <Typography variant="h6" gutterBottom>
        {t("Correlation Matrix")}
      </Typography>

      {isLoading && (
        <Box className={styles.loadingContainer}>
          <Typography>{t("Loading data, please wait...")}</Typography>
        </Box>
      )}

      {!isLoading && !correlationData && (
        <Typography>
          {t("No data to display. Please select some indicators.")}
        </Typography>
      )}

      {!isLoading && correlationData && (
        <Paper
          elevation={3}
          className={styles.chartContainer}
          sx={{ opacity: 1, transition: "opacity 0.5s ease-in" }}
        >
          <Plot
            data={[
              {
                z: correlationData.correlationMatrix,
                x: correlationData.labels,
                y: correlationData.labels,
                type: "heatmap",
                colorscale: "RdBu",
                zmin: -1,
                zmax: 1,
                hoverongaps: false,
              } as any,
            ]}
            layout={{
              width: 1200,
              height: 1200,
              title: t("Cross-Correlation Matrix of All Indicators"),
              xaxis: {
                tickangle: -45,
                automargin: true,
              },
              yaxis: {
                automargin: true,
              },
            }}
            config={{
              displayModeBar: true,
              scrollZoom: false,
              displaylogo: false,
              responsive: true,
            }}
          />
        </Paper>
      )}
    </Box>
  );
};

export default CorrelationMatrixView;
