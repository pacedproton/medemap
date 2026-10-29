
"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../lib/hooks";
import { useDispatch } from "react-redux";
import {
  selectMedeMapData,
  fetchMedeMapData,
} from "../../lib/features/medemap/medeMapSlice";
import { selectLabelDisplayMode } from "../../lib/features/settings/labelDisplaySlice";
import { formatIndicatorLabel } from "../../lib/utils/labelFormatter";
import {
  Box,
  Typography,
  LinearProgress,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Paper,
} from "@mui/material";
import dynamic from "next/dynamic";
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false }) as any;
import styles from "./HistogramsView.module.css";
import { logVerbose } from "../../lib/clientlogging";

interface HistogramDataItem {
  binStart: number;
  binEnd: number;
  count: number;
  binColor?: string;
}

interface ProcessedHistogramData {
  tableName: string;
  columnName: string;
  data: HistogramDataItem[];
  columns?: any;
}

const HistogramView: React.FC = () => {
  const dispatch = useDispatch();
  const medeMapState = useAppSelector(selectMedeMapData);
  const labelDisplayMode = useAppSelector(selectLabelDisplayMode);
  const [histogramData, setHistogramData] = useState<ProcessedHistogramData[]>(
    []
  );
  const [progress, setProgress] = useState<number>(0);
  const [colorRange, setColorRange] = useState<[number, number]>([30, 70]);
  const [colorHue, setColorHue] = useState<number>(210); // Default blue hue
  const [binCount, setBinCount] = useState<number>(10);
  const [colorMode, setColorMode] = useState<"hue" | "thresholds">("hue");

  useEffect(() => {
    console.log("MedeMapState in HistogramView:", medeMapState);
    if (!medeMapState.data || Object.keys(medeMapState.data).length === 0) {
      dispatch(fetchMedeMapData() as any);
    } else if (Object.keys(medeMapState.selectedOptions).length > 0) {
      processData();
    }
  }, [
    dispatch,
    medeMapState.data,
    medeMapState.selectedOptions,
    binCount,
    colorRange,
    colorHue,
    colorMode,
  ]);

  const processData = () => {
    logVerbose("histogram-process", "Processing data for histograms...");
    const { data, selectedOptions, columnOptions } = medeMapState;
    logVerbose("histogram-options", "Selected options:", selectedOptions);
    logVerbose("histogram-data", "Available data:", data);
    const processedData: ProcessedHistogramData[] = [];
    let currentProgress = 0;

    Object.entries(selectedOptions).forEach(
      ([tableName, columns], tableIndex) => {
        if (Array.isArray(columns) && columns.length > 0) {
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

          columns.forEach((column: { value: string }) => {
            logVerbose(
              "histogram-column",
              `Processing column: ${column.value}`
            );
            const values = tableData
              .map((row: any) => parseFloat(row[column.value]) || 0)
              .filter((val: number) => !isNaN(val));
            const histogram = calculateHistogram(values, binCount);

            const thresholds = thresholdsMap[column.value];
            const indicatorName = formatIndicatorLabel(labelDisplayMode, { value: column.value, thresholds, label: (column as any).label });

            histogram.forEach((bin) => {
              let binColor = "gray";
              const binMidpoint = (bin.binStart + bin.binEnd) / 2;
              if (colorMode === "thresholds" && thresholds) {
                binColor = getBinColor(binMidpoint, thresholds);
              } else if (colorMode === "hue") {
                const minValue = Math.min(...values);
                const maxValue = Math.max(...values);
                binColor = generateColor(binMidpoint, minValue, maxValue);
              }
              bin.binColor = binColor;
            });

            processedData.push({
              tableName,
              columnName: indicatorName,
              data: histogram,
            });
            logVerbose(
              "histogram-result",
              `Histogram for ${indicatorName}:`,
              histogram
            );
          });
        }
        currentProgress =
          ((tableIndex + 1) / Object.keys(selectedOptions).length) * 100;
        setProgress(currentProgress);
      }
    );

    logVerbose("histogram-final", "Processed Histogram Data:", processedData);
    setHistogramData(processedData);
  };

  const calculateHistogram = (
    data: number[],
    binCount: number
  ): HistogramDataItem[] => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / binCount;
    const bins = Array(binCount).fill(0);

    data.forEach((value) => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        binCount - 1
      );
      bins[binIndex]++;
    });

    return bins.map((count, index) => ({
      binStart: min + index * binWidth,
      binEnd: min + (index + 1) * binWidth,
      count: count,
    }));
  };

  const generateColor = (
    value: number,
    minValue: number,
    maxValue: number
  ): string => {
    const [minLightness, maxLightness] = colorRange;
    const lightnessRange = maxLightness - minLightness;
    const valueRatio = (value - minValue) / (maxValue - minValue);
    // Invert the valueRatio to make higher values darker
    const lightness = maxLightness - valueRatio * lightnessRange;
    return `hsl(${colorHue}, 70%, ${lightness}%)`;
  };

  const getBinColor = (value: number, thresholds: any): string => {
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

  const handleBinCountChange = (event: Event, newValue: number | number[]) => {
    setBinCount(newValue as number);
    logVerbose("histogram", `Bin count changed to: ${newValue}`);
  };

  return (
    <Box className={styles.container}>
      <Typography variant="h6" gutterBottom>
        Histogram View
      </Typography>
      <LinearProgress
        variant="determinate"
        value={progress}
        className={styles.progressBar}
      />

      <Box className={styles.colorModeContainer}>
        <FormControl fullWidth>
          <InputLabel>Color Mode</InputLabel>
          <Select
            value={colorMode}
            label="Color Mode"
            onChange={(e: SelectChangeEvent<string>) =>
              setColorMode(e.target.value as "hue" | "thresholds")
            }
          >
            <MenuItem value="hue">Hue and Color Range</MenuItem>
            <MenuItem value="thresholds">
              Thresholds (Red/Orange/Green)
            </MenuItem>
          </Select>
        </FormControl>
      </Box>

      {colorMode === "hue" && (
        <>
          <Box className={styles.colorRangeContainer}>
            <Typography gutterBottom>Color Range</Typography>
            <Slider
              value={colorRange}
              onChange={(_, newValue) =>
                setColorRange(newValue as [number, number])
              }
              valueLabelDisplay="auto"
              min={0}
              max={100}
            />
          </Box>

          <Box className={styles.colorRangeContainer}>
            <FormControl fullWidth>
              <InputLabel>Color Hue</InputLabel>
              <Select
                value={colorHue.toString()}
                label="Color Hue"
                onChange={(e: SelectChangeEvent<string>) =>
                  setColorHue(Number(e.target.value))
                }
              >
                <MenuItem value={210}>Blue</MenuItem>
                <MenuItem value={120}>Green</MenuItem>
                <MenuItem value={0}>Red</MenuItem>
                <MenuItem value={270}>Purple</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </>
      )}

      <Box className={styles.binCountContainer}>
        <Typography gutterBottom>Number of Bins</Typography>
        <Slider
          value={binCount}
          onChange={handleBinCountChange}
          valueLabelDisplay="auto"
          min={5}
          max={30}
          step={1}
        />
      </Box>

      {histogramData.length === 0 && (
        <Typography>No data to display. Please select some indicators.</Typography>
      )}

      {histogramData.map((histogram, index) => (
        <Paper
          key={`${histogram.tableName}-${histogram.columnName}-${index}`}
          className={styles.chartTitlePaper}
        >
          <Typography variant="h6" gutterBottom className={styles.chartTitle}>
            {`${(() => {
              switch (histogram.tableName) {
                case "basic_data":
                  return "Basic Data";
                case "democracy":
                  return "Democracy & Participation";
                case "legal_framework_human_dignity":
                  return "Legal Framework : Human Dignity";
                case "legal_framework_freedom":
                  return "Legal Framework : Freedom";
                case "legal_framework_pluralism":
                  return "Legal Framework : Pluralism";
                case "legal_framework_equality":
                  return "Legal Framework : Equality";
                case "legal_framework_rule_of_law":
                  return "Legal Framework : Rule of Law";
                case "supply_side":
                  return "Supply Side";
                case "demand_side_media_use":
                  return "Demand Side : Media Use";
                case "demand_side_trust_in_media":
                  return "Demand Side : Trust in Media";
                default:
                  return histogram.tableName.replace(/_/g, " ").toUpperCase();
              }
            })()}: ${histogram.columnName}`}
          </Typography>
          <Box
            className={styles.chartContainer}
            sx={{ width: "100%", height: 500 }}
          >
            <Plot
              data={[
                {
                  x: histogram.data.map(
                    (item) =>
                      `${item.binStart.toFixed(2)} - ${item.binEnd.toFixed(2)}`
                  ),
                  y: histogram.data.map((item) => item.count),
                  type: "bar",
                  marker: {
                    color: histogram.data.map((item) => item.binColor),
                  },
                },
              ]}
              layout={{
                width: 900,
                height: 500,
                margin: { t: 50, b: 150, l: 80, r: 80 },
                xaxis: {
                  title: "Bin Range",
                  tickangle: 45,
                  automargin: true,
                },
                yaxis: {
                  title: "Frequency",
                },
              }}
              config={{ responsive: true }}
            />
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

export default HistogramView;
