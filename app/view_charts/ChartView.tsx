"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector } from "@/lib/hooks";
import { selectMedeMapData } from "@/lib/features/medemap/medeMapSlice";
import { selectLabelDisplayMode } from "@/lib/features/settings/labelDisplaySlice";
import { formatChartTitle } from "@/lib/utils/labelFormatter";
import { Box, Typography, LinearProgress, Paper } from "@mui/material";
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;
import styles from "./ChartView.module.css";
import { getTableOrder, getTableDisplayName } from "../lib/config";

const ChartView = () => {
  const medeMapState = useAppSelector(selectMedeMapData);
  const { columnOptions, selectedOptions, data } = medeMapState;
  const labelDisplayMode = useAppSelector(selectLabelDisplayMode);
  const [chartData, setChartData] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    console.log("MedeMapState in ChartView:", medeMapState);
    processData();
  }, [medeMapState]);

  const getBarColor = (value: number, thresholds: any): string => {
    if (
      !thresholds ||
      thresholds.medium_low_threshold == null ||
      thresholds.high_medium_threshold == null
    ) {
      return "gray"; // Default color when thresholds are not available
    }

    if (value <= thresholds.medium_low_threshold) {
      return "red";
    } else if (value <= thresholds.high_medium_threshold) {
      return "orange";
    } else {
      return "green";
    }
  };

  const processData = () => {
    if (
      Object.keys(selectedOptions).length === 0 ||
      Object.keys(data).length === 0
    ) {
      return;
    }

    const processedData: Array<{
      tableName: string;
      data: any[];
      columns: any[];
    }> = [];
    let currentProgress = 0;

    // Use the table order from config
    const tableOrder = getTableOrder();

    // Process tables in the correct order
    tableOrder.forEach((tableName, tableIndex) => {
      if (selectedOptions[tableName] && selectedOptions[tableName].length > 0) {
        const columns = selectedOptions[tableName];
        const tableData = data[tableName];
        if (!tableData) {
          console.error(`No data found for table: ${tableName}`);
          return;
        }

        // Create a mapping from indicator value to its thresholds
        const thresholdsMap: { [key: string]: any } = {};
        const tableColumnOptions = columnOptions[tableName];
        tableColumnOptions.forEach((option: any) => {
          thresholdsMap[option.value] = option.thresholds;
        });

        const chartDataForTable = tableData.map((row: any) => {
          const chartItem: any = { country: row.country };
          columns.forEach((column: any) => {
            const value = parseFloat(row[column.value]) || 0;
            chartItem[column.value] = value;
            const thresholds = thresholdsMap[column.value];
            chartItem[`${column.value}_color`] = getBarColor(value, thresholds);
          });
          return chartItem;
        });

        const columnsWithFullNames = columns.map((column: any) => ({
          ...column,
          thresholds: thresholdsMap[column.value],
        }));

        // Generate a separate chart for each indicator is user's request
        columnsWithFullNames.forEach((col: any) => {
          processedData.push({
            tableName,
            data: chartDataForTable,
            columns: [col], 
          });
        });
      }
      currentProgress = ((tableIndex + 1) / tableOrder.length) * 100;
      setProgress(currentProgress);
    });

    setChartData(processedData);
  };

  return (
    <Box sx={{ width: "100%", padding: 2 }}>
      <Typography variant="h6" gutterBottom>
        Descriptive Graph Views
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ marginBottom: 2 }}
      />

      {chartData.length === 0 && (
        <Typography>
          No data to display. Please select some indicators.
        </Typography>
      )}

      {chartData.map((tableChart, index) => (
        <Box
          key={`${tableChart.tableName}-${index}`}
          className={styles.chartContainer}
          sx={{ width: "100%", height: 500 }}
        >
          <Paper elevation={3} className={styles.chartTitlePaper}>
            <Typography variant="h5" className={styles.chartTitle}>
              {formatChartTitle(
                labelDisplayMode,
                tableChart.tableName,
                tableChart.columns,
                getTableDisplayName
              )}
            </Typography>
          </Paper>
          {tableChart.data.length > 0 ? (
            <Plot
              data={tableChart.columns.map((column: any) => {
                const x = tableChart.data.map((item: any) => item.country);
                const y = tableChart.data.map(
                  (item: any) => item[column.value]
                );
                const markerColors = tableChart.data.map(
                  (item: any) => item[`${column.value}_color`]
                );
                return {
                  x,
                  y,
                  type: "bar",
                  name: column.label,
                  marker: {
                    color: markerColors,
                  },
                };
              })}
              layout={{
                width: 900,
                height: 500,
                margin: { t: 50, b: 150, l: 80, r: 80 },
                barmode: "group",
                xaxis: {
                  title: "Country",
                  tickangle: 45,
                  automargin: true,
                },
                yaxis: {
                  title: "Normalized Indicator",
                },
                legend: {
                  orientation: "h",
                  x: 0,
                  y: -0.2,
                },
              }}
              config={{ responsive: true }}
            />
          ) : (
            <Typography>No data available for this table.</Typography>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default ChartView;
