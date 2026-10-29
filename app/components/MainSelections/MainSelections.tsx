// app/components/MainSelections/MainSelections.tsx
"use client";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Select, { MultiValue, SingleValue } from "react-select";
import {
  Box,
  Button,
  Typography,
  Grid,
  Paper,
  Chip,
  Modal,
  LinearProgress,
} from "@mui/material";
import { Joyride, CallBackProps, EVENTS, STATUS } from "react-joyride";
import { useTranslation } from "react-i18next";
import {
  fetchMedeMapData,
  setSelectedOptions,
  selectMedeMapData,
  selectMedeMapLoading,
  selectMedeMapError,
  selectDataset,
} from "../../../lib/features/medemap/medeMapSlice";
import {
  selectRunTutorial,
  setRunTutorial,
} from "../../../lib/features/tutorial/tutorialSlice";
import { AppDispatch } from "../../../lib/store";
import styles from "./MainSelections.module.css";
import SplashScreen from "../SplashScreen";
import { selectEmphasisMode } from "../../../lib/features/settings/settingsSlice";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

interface Thresholds {
  eu_average: number | null;
  eu_standard_deviation: number | null;
  high_medium_threshold: number | null;
  medium_low_threshold: number | null;
  year_of_validity: number | null;
  indicator: string | null;
  source: string | null;
  original_name: string | null;
}

interface ColumnOption {
  value: string;
  label: string;
  thresholds?: Thresholds | null;
}

const MainSelections = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const medeMapState = useSelector(selectMedeMapData);
  const loading = useSelector(selectMedeMapLoading);
  const error = useSelector(selectMedeMapError);
  const emphasisMode = useSelector(selectEmphasisMode);
  const dataset = useSelector(selectDataset);
  const [localSelectedOptions, setLocalSelectedOptions] = useState<{
    [key: string]: ColumnOption[];
  }>({});
  const [feedback, setFeedback] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const runTutorial = useSelector(selectRunTutorial);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showSplashScreen, setShowSplashScreen] = useState(false);

  // Year selection for v2
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string>("all");

  const tableOrder = [
    "democracy",
    "legal_framework_human_dignity",
    "legal_framework_freedom",
    "legal_framework_pluralism",
    "legal_framework_equality",
    "legal_framework_rule_of_law",
    "supply_side",
    "demand_side_media_use",
    "demand_side_trust_in_media",
  ];

  const steps = [
    {
      target: ".data-selection-title",
      content: t("Quickstart: Select 1-3 indicators to process"),
      title: "Tutorial",
      disableBeacon: false,
    },
    {
      target: ".select-box",
      content: t("Each category group contains multiple indicators"),
      disableBeacon: true,
    },
    {
      target: ".submit-button",
      content: t("Press Submit to process the selected indicators"),
      disableBeacon: true,
    },
    {
      target: ".selected-options",
      content: t("The selected indicators will appear here"),
      disableBeacon: true,
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setShowTutorial(false);
      dispatch(setRunTutorial(false));
    }
  };

  const handleSplashScreenFinished = () => {
    setShowSplashScreen(false);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Show splash screen on client-side mount
    setShowSplashScreen(true);

    const tutorialShown = localStorage.getItem("tutorialShown");
    if (!tutorialShown) {
      setShowTutorial(true);
      dispatch(setRunTutorial(true));
      localStorage.setItem("tutorialShown", "true");
    }
  }, [dispatch]);

  useEffect(() => {
    if (!medeMapState.data || Object.keys(medeMapState.data).length === 0) {
      setShowProgress(true);
      dispatch(fetchMedeMapData());
      setTimeout(() => {
        setShowProgress(false);
      }, 2000);
    }

    const savedSelections = localStorage.getItem("selectedOptions");
    if (savedSelections) {
      const parsedSelections = JSON.parse(savedSelections);
      setLocalSelectedOptions(parsedSelections);
      dispatch(setSelectedOptions(parsedSelections));
    }
  }, [dispatch, medeMapState.data]);

  // Re-fetch data when profile changes
  useEffect(() => {
    const handleProfileChange = () => {
      console.log('[Profile Change] Re-fetching data with new profile');
      setShowProgress(true);
      dispatch(fetchMedeMapData());
      setTimeout(() => {
        setShowProgress(false);
      }, 2000);
    };

    window.addEventListener('profileChanged', handleProfileChange);
    return () => {
      window.removeEventListener('profileChanged', handleProfileChange);
    };
  }, [dispatch]);

  useEffect(() => {
    // Derive available years from current columnOptions (v2 only)
    if (dataset === "v2" && medeMapState.columnOptions) {
      const years = new Set<string>();
      Object.values(medeMapState.columnOptions).forEach((opts: any) => {
        (opts || []).forEach((o: any) => {
          const m = String(o.value).match(/^(\d{4})_/);
          if (m) years.add(m[1]);
        });
      });
      const sorted = Array.from(years).filter(y => y !== '2021').sort();
      setAvailableYears(sorted);
      if (
        sorted.length > 0 &&
        yearFilter !== "all" &&
        !sorted.includes(yearFilter)
      ) {
        setYearFilter("all");
      }
    }
  }, [dataset, medeMapState.columnOptions]);

  useEffect(() => {
    console.log("MedeMap state updated:", medeMapState);
  }, [medeMapState]);

  useEffect(() => {
    if (runTutorial) {
      setShowTutorial(true);
    }
  }, [runTutorial]);

  const handleOptionChange = (
    tableName: string,
    selectedOptions: SingleValue<ColumnOption> | MultiValue<ColumnOption>
  ) => {
    const selectedOptionsArr: ColumnOption[] = Array.isArray(selectedOptions)
      ? (selectedOptions as ColumnOption[])
      : selectedOptions
      ? [selectedOptions as ColumnOption]
      : [];

    const currentTotal = Object.values(localSelectedOptions).flat().length;
    const newTotal =
      currentTotal -
      (localSelectedOptions[tableName]?.length || 0) +
      selectedOptionsArr.length;

    const maxIndicators = emphasisMode ? 1 : 3;
    let nextSelections: { [key: string]: ColumnOption[] } = {
      ...localSelectedOptions,
    };

    if (emphasisMode) {
      if (selectedOptionsArr.length === 0) {
        nextSelections[tableName] = [];
      } else {
        const last = selectedOptionsArr[
          selectedOptionsArr.length - 1
        ] as ColumnOption;
        nextSelections = { [tableName]: [last] };
      }
    } else {
      if (newTotal > maxIndicators) {
        setIsModalOpen(true);
        return;
      }
      nextSelections[tableName] = selectedOptionsArr as ColumnOption[];
    }

    setLocalSelectedOptions(nextSelections);
    dispatch(setSelectedOptions(nextSelections as any));
    localStorage.setItem("selectedOptions", JSON.stringify(nextSelections));

    const selectedCount = Object.values(nextSelections).flat().length;
    setFeedback(`Selected ${selectedCount} indicators for processing.`);
  };

  const handleSubmit = () => {
    const selectedCount = Object.values(localSelectedOptions).flat().length;
    setFeedback(
      `Explicitly submitted ${selectedCount} indicators for processing.`
    );
  };

  const createSelectBox = (tableName: string, options: ColumnOption[]) => {
    if (tableName === "basic_data") {
      return null;
    }

    let filteredOptions = options.filter(
      (option) => !["year", "country"].includes(option.value)
    );

    // Apply v2 year filter if a specific year is selected
    if (dataset === "v2" && yearFilter !== "all") {
      filteredOptions = filteredOptions.filter((opt) =>
        new RegExp(`^${yearFilter}_`).test(opt.value)
      );
    }

    filteredOptions = filteredOptions.map((option) => {
      const newOption = {
        ...option,
        label: option.thresholds?.indicator || option.label,
      };
      return newOption;
    });

    return (
      <Box width="100%" marginBottom={2} key={tableName}>
        <Typography variant="body1" marginBottom={1}>
          {(() => {
            switch (tableName) {
              case "basic_data":
                return "Basic Data";
              case "democracy":
                return "Democracy & Participation";
              case "legal_framework_human_dignity":
                return "Legal Framework: Human Dignity";
              case "legal_framework_freedom":
                return "Legal Framework: Freedom";
              case "legal_framework_pluralism":
                return "Legal Framework: Pluralism";
              case "legal_framework_equality":
                return "Legal Framework: Equality";
              case "legal_framework_rule_of_law":
                return "Legal Framework: Rule of Law";
              case "supply_side":
                return "Supply Side";
              case "demand_side_media_use":
                return "Demand Side: Media Use";
              case "demand_side_trust_in_media":
                return "Demand Side: Trust in Media";
              default:
                return tableName.replace(/_/g, " ").toUpperCase();
            }
          })()}
        </Typography>
        <Select
          options={filteredOptions}
          value={
            emphasisMode
              ? localSelectedOptions[tableName]?.[0] ?? null
              : localSelectedOptions[tableName] || []
          }
          onChange={(selectedOptions) =>
            handleOptionChange(tableName, selectedOptions)
          }
          placeholder={`Select columns from ${tableName.replace(/_/g, " ")}`}
          isMulti={!emphasisMode}
          isClearable
          isSearchable
          isLoading={loading}
          isDisabled={loading || !!error}
          className={styles.selectBox}
          getOptionValue={(option) => option.value}
          getOptionLabel={(option) => option.label}
          styles={{
            menu: (base) => ({
              ...base,
              minWidth: '400px',
              maxWidth: '600px',
              width: 'max-content',
            }),
            option: (base) => ({
              ...base,
              whiteSpace: 'normal',
              wordWrap: 'break-word',
            }),
            multiValue: (base) => ({
              ...base,
              maxWidth: '100%',
            }),
            multiValueLabel: (base) => ({
              ...base,
              whiteSpace: 'normal',
              overflow: 'visible',
            }),
          }}
        />
      </Box>
    );
  };

  const renderSelectedOptions = () => (
    <Box mt={2} maxWidth="800px" mx="auto" pb={4}>
      <Typography variant="h6" gutterBottom>
        {t("Selected Indicator Columns")}
      </Typography>
      <Grid container spacing={2}>
        {Object.entries(localSelectedOptions).map(([tableName, columns]) => (
          <Grid size={{ xs: 12, sm: 6 }} key={tableName}>
            <Paper elevation={3} sx={{ p: 2, height: "100%" }}>
              <Typography
                variant="subtitle1"
                gutterBottom
                className={styles.chartTitle}
              >
                {tableName.replace(/_/g, " ").toUpperCase()}
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                {columns.map((column) => {
                  const indicatorName =
                    column.thresholds?.indicator || column.label;
                  return (
                    <Chip
                      key={column.value}
                      label={indicatorName}
                      color="primary"
                      variant="outlined"
                      onDelete={() => handleDeleteChip(tableName, column)}
                      sx={{
                        maxWidth: "100%",
                        height: "auto",
                        "& .MuiChip-label": {
                          whiteSpace: "normal",
                          padding: "4px 24px 4px 12px",
                        },
                        "& .MuiChip-deleteIcon": {
                          position: "absolute",
                          right: 5,
                        },
                      }}
                    />
                  );
                })}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const handleDeleteChip = (
    tableName: string,
    columnToDelete: ColumnOption
  ) => {
    const updatedSelections = {
      ...localSelectedOptions,
      [tableName]: localSelectedOptions[tableName].filter(
        (column) => column.value !== columnToDelete.value
      ),
    };
    setLocalSelectedOptions(updatedSelections);
    localStorage.setItem("selectedOptions", JSON.stringify(updatedSelections));
  };

  const handleClearSelections = () => {
    setLocalSelectedOptions({});
    dispatch(setSelectedOptions({}));
    localStorage.removeItem("selectedOptions");
    setFeedback(t("All selections cleared."));
  };

  if (!isClient) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }

  return (
    <>
      {showSplashScreen ? (
        <SplashScreen onFinished={handleSplashScreenFinished} />
      ) : (
        <Box display="flex" flexDirection="column" gap={2} p={2} sx={{ maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
            <Joyride
              callback={handleJoyrideCallback}
              continuous
              run={showTutorial}
              scrollToFirstStep
              showSkipButton
              steps={steps}
              disableOverlayClose
              styles={{
                options: {
                  primaryColor: "#1976d2",
                  zIndex: 10000,
                  overlayColor: "rgba(0, 0, 0, 0.5)",
                },
                buttonNext: {
                  backgroundColor: "#1976d2",
                  fontSize: "16px",
                  padding: "12px 24px",
                },
                buttonBack: {
                  marginRight: 10,
                  fontSize: "16px",
                },
                buttonSkip: {
                  fontSize: "14px",
                },
                tooltip: {
                  fontSize: "16px",
                  padding: "24px",
                },
                tooltipTitle: {
                  fontSize: "18px",
                  fontWeight: "bold",
                },
                spotlight: {
                },
                beacon: {
                  display: "block",
                  width: 200,
                  height: 200,
                },
                beaconInner: {
                  backgroundColor: "#1976d2",
                  width: 120,
                  height: 120,
                },
                beaconOuter: {
                  borderColor: "#1976d2",
                  backgroundColor: "rgba(25, 118, 210, 0.2)",
                  width: 200,
                  height: 200,
                },
              }}
              floaterProps={{
                disableAnimation: false,
              }}
              spotlightClicks
              locale={{
                last: "Finish",
                next: "Next",
                skip: "Skip",
                close: "Exit",
              }}
              showProgress
            />
          {dataset === "v2" && availableYears.length > 0 && (
            <Paper elevation={3} className={styles.paperContainer}>
              <Typography variant="subtitle1" gutterBottom>
                {t("Year filter (v2)")}
              </Typography>
              <ToggleButtonGroup
                value={yearFilter}
                exclusive
                onChange={(_, val) => setYearFilter(val || "all")}
                size="small"
              >
                <ToggleButton value="all">{t("All years")}</ToggleButton>
                {availableYears.map((y) => (
                  <ToggleButton key={y} value={y}>
                    {y}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Paper>
          )}
          <Paper elevation={3} className={styles.paperContainer} sx={{ maxWidth: '100%', width: '100%' }}>
            <Typography
              variant="h5"
              gutterBottom
              className="data-selection-title"
            >
              {t("Indicator Selection")}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              gutterBottom
              sx={{ mb: 2, fontStyle: "italic" }}
            >
              {emphasisMode
                ? "Emphasis Mode is on: select exactly 1 indicator"
                : t("Please select up to 3 indicators")}
            </Typography>
            {showProgress && (
              <Box mb={2}>
                <LinearProgress />
                <Typography variant="caption" color="textSecondary" mt={1}>
                  {t("Loading data...")}
                </Typography>
              </Box>
            )}
            {error && (
              <Typography color="error">
                {t("Error")}: {error}
              </Typography>
            )}
            {!loading && !error && (
              <>
                {console.log('MainSelections: Full columnOptions:', medeMapState.columnOptions)}
                {console.log('MainSelections: Available tables:', Object.keys(medeMapState.columnOptions || {}))}
                <Grid container spacing={2}>
                  {medeMapState.columnOptions &&
                    (() => {
                      // Get all available tables from the API response
                      const availableTables = Object.keys(medeMapState.columnOptions);

                      // Sort tables: first use tableOrder for known tables, then append any additional tables alphabetically
                      const sortedTables = [
                        ...tableOrder.filter(t => availableTables.includes(t)),
                        ...availableTables.filter(t => !tableOrder.includes(t)).sort()
                      ];

                      return sortedTables.map((tableName) => {
                        const options = medeMapState.columnOptions[tableName];
                        console.log(`MainSelections: Table ${tableName} has options:`, options);

                        if (options && options.length > 0) {
                          return (
                            <Grid size={{ xs: 12, sm: 12, md: 6 }} key={tableName}>
                              <div className="select-box">
                                {createSelectBox(tableName, options)}
                              </div>
                            </Grid>
                          );
                        } else {
                          console.warn(`MainSelections: No options available for table ${tableName}`);
                          return null;
                        }
                      });
                    })()}
                </Grid>
                <Box
                  mt={2}
                  display="flex"
                  justifyContent="flex-start"
                  alignItems="center"
                  gap={2}
                >
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    className="submit-button"
                  >
                    {t("Submit")}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleClearSelections}
                  >
                    {t("Clear all Selections")}
                  </Button>
                </Box>
                {feedback && (
                  <Typography color="primary" style={{ marginTop: "1rem" }}>
                    {feedback}
                  </Typography>
                )}
              </>
            )}
            <div className="selected-options">{renderSelectedOptions()}</div>
          </Paper>
          <Modal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            aria-labelledby="indicator-limit-modal"
            aria-describedby="indicator-limit-description"
          >
            <Box className={`${styles.modalContent} ${styles.picoAlert}`}>
              <Typography
                id="indicator-limit-modal"
                variant="h6"
                component="h2"
                className={styles.modalTitle}
              >
                {t("Indicator Limit")}
              </Typography>
              <Typography
                id="indicator-limit-description"
                className={styles.modalDescription}
              >
                {t("Select up to 3 indicators")}
              </Typography>
              <Button
                onClick={() => setIsModalOpen(false)}
                className={styles.modalCloseButton}
              >
                {t("Close")}
              </Button>
            </Box>
          </Modal>
        </Box>
      )}
    </>
  );
};

export default MainSelections;
