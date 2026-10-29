import React, { useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  IconButton,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import styles from "./SettingsDialog.module.css";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  setSelectedOptions,
  fetchMedeMapData,
} from "../../lib/features/medemap/medeMapSlice";
import {
  setVerboseLogging,
  setConsoleLogLevel,
  setDatabaseLogLevel,
  getConsoleLogLevel,
  getDatabaseLogLevel,
  type LogLevel,
} from "../../lib/clientlogging";
import {
  setShowDataLabels,
  selectShowDataLabels,
  setDataLabelFontSize,
  selectDataLabelFontSize,
  setUse3DLogScale,
  selectUse3DLogScale,
  setEmphasisMode,
  selectEmphasisMode,
  setVideoSoundEnabled,
  selectVideoSoundEnabled,
} from "../../lib/features/settings/settingsSlice";
import {
  setLabelDisplayMode,
  selectLabelDisplayMode,
  loadLabelDisplayMode,
} from "../../lib/features/settings/labelDisplaySlice";


interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsDialog = ({ isOpen, onClose }: SettingsDialogProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [verboseLogging, setVerboseLoggingState] = React.useState(false);
  const [consoleLogLevel, setConsoleLogLevelState] = React.useState<LogLevel>('info');
  const [databaseLogLevel, setDatabaseLogLevelState] = React.useState<LogLevel>('error');
  const showDataLabels = useSelector(selectShowDataLabels);
  const dataLabelFontSize = useSelector(selectDataLabelFontSize);
  const use3DLogScale = useSelector(selectUse3DLogScale);
  const emphasisMode = useSelector(selectEmphasisMode);
  const videoSoundEnabled = useSelector(selectVideoSoundEnabled);
  const labelDisplayMode = useSelector(selectLabelDisplayMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedVerboseLogging = localStorage.getItem("verboseLogging");
      setVerboseLoggingState(storedVerboseLogging === "true");

      const storedConsoleLogLevel = localStorage.getItem("consoleLogLevel");
      setConsoleLogLevelState(storedConsoleLogLevel ? JSON.parse(storedConsoleLogLevel) : 'info');

      const storedDatabaseLogLevel = localStorage.getItem("databaseLogLevel");
      setDatabaseLogLevelState(storedDatabaseLogLevel ? JSON.parse(storedDatabaseLogLevel) : 'error');
      const storedShowDataLabels = localStorage.getItem("showDataLabels");
      if (storedShowDataLabels !== null) {
        dispatch(setShowDataLabels(storedShowDataLabels === "true"));
      }
      const storedDataLabelFontSize = localStorage.getItem("dataLabelFontSize");
      if (storedDataLabelFontSize !== null) {
        const fontSize = parseInt(storedDataLabelFontSize, 10);
        dispatch(setDataLabelFontSize(fontSize));
      }
      const storedUse3DLogScale = localStorage.getItem("use3DLogScale");
      if (storedUse3DLogScale !== null) {
        dispatch(setUse3DLogScale(storedUse3DLogScale === "true"));
      }
      const storedEmphasisMode = localStorage.getItem("emphasisMode");
      if (storedEmphasisMode !== null) {
        dispatch(setEmphasisMode(storedEmphasisMode === "true"));
      }
      const storedVideoSoundEnabled = localStorage.getItem("videoSoundEnabled");
      if (storedVideoSoundEnabled !== null) {
        dispatch(setVideoSoundEnabled(storedVideoSoundEnabled === "true"));
      }
      // Load label display mode preference
      dispatch(loadLabelDisplayMode());
    }
  }, [dispatch]);

  const clearLocalStorage = () => {
    if (typeof window !== 'undefined' && confirm(t("confirmClearLocalStorage"))) {
      localStorage.clear();
      alert(t("localStorageCleared"));
      dispatch(setSelectedOptions({}));
      setVerboseLoggingState(false);
      dispatch(setShowDataLabels(false));
      dispatch(setDataLabelFontSize(14));
      dispatch(setUse3DLogScale(false));
      dispatch(setEmphasisMode(false));
      dispatch(setVideoSoundEnabled(true));
      dispatch(setLabelDisplayMode('raw'));
      dispatch(fetchMedeMapData() as any);
    }
  };

  // Cache management state and functions
  const [cacheEnabled, setCacheEnabled] = React.useState(() => {
    const stored = localStorage.getItem("cacheEnabled");
    return stored !== null ? stored === "true" : true; // Default to enabled
  });

  const clearAllCaches = async () => {
    if (confirm("Clear all browser caches? This will:\n- Clear localStorage\n- Clear sessionStorage\n- Clear browser cache\n- Reload fresh data")) {
      try {
        // Clear localStorage
        localStorage.clear();

        // Clear sessionStorage
        sessionStorage.clear();

        // Clear browser caches if available
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
        }

        // Force reload data with no-cache
        dispatch(fetchMedeMapData() as any);

        alert("All caches cleared successfully!");
      } catch (error) {
        console.error("Error clearing caches:", error);
        alert("Cache clearing completed with some errors. Check console for details.");
      }
    }
  };

  const handleCacheToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setCacheEnabled(newValue);
    localStorage.setItem("cacheEnabled", newValue.toString());
  };

  const handleVerboseLoggingChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    setVerboseLoggingState(newValue);
    try {
      setVerboseLogging(newValue);
      localStorage.setItem("verboseLogging", newValue.toString());
    } catch (error) {
      console.error("[ERROR] Failed to set verbose logging:", error);
    }
  };

  const handleConsoleLogLevelChange = (
    event: SelectChangeEvent<LogLevel>
  ) => {
    const newValue = event.target.value as LogLevel;
    setConsoleLogLevelState(newValue);
    try {
      setConsoleLogLevel(newValue);
      localStorage.setItem("consoleLogLevel", JSON.stringify(newValue));
    } catch (error) {
      console.error("[ERROR] Failed to set console log level:", error);
    }
  };

  const handleDatabaseLogLevelChange = (
    event: SelectChangeEvent<LogLevel>
  ) => {
    const newValue = event.target.value as LogLevel;
    setDatabaseLogLevelState(newValue);
    try {
      setDatabaseLogLevel(newValue);
      localStorage.setItem("databaseLogLevel", JSON.stringify(newValue));
    } catch (error) {
      console.error("[ERROR] Failed to set database log level:", error);
    }
  };

  const handleShowDataLabelsChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    dispatch(setShowDataLabels(newValue));
    localStorage.setItem("showDataLabels", newValue.toString());
  };

  const handleDataLabelFontSizeChange = (newValue: number) => {
    dispatch(setDataLabelFontSize(newValue));
    localStorage.setItem("dataLabelFontSize", newValue.toString());
  };

  const handleUse3DLogScaleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    dispatch(setUse3DLogScale(newValue));
    localStorage.setItem("use3DLogScale", newValue.toString());
  };

  const handleEmphasisModeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    dispatch(setEmphasisMode(newValue));
    localStorage.setItem("emphasisMode", newValue.toString());
  };

  const handleVideoSoundEnabledChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.checked;
    dispatch(setVideoSoundEnabled(newValue));
    localStorage.setItem("videoSoundEnabled", newValue.toString());
  };

  const handleLabelDisplayModeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newMode = event.target.checked ? 'formatted' : 'raw';
    dispatch(setLabelDisplayMode(newMode));
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="settings-dialog-title"
      className={styles.dialog}
    >
      <DialogTitle
        id="settings-dialog-title"
        className={styles.dialogTitle}
      >
        {t("Settings")}
        <IconButton
          aria-label="close"
          className={styles.closeButton}
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers className={styles.dialogContent}>
        <Box className={styles.settingsSection}>
          <Typography variant="h6" gutterBottom className={styles.sectionTitle}>
            {t("Visualization Settings")}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={showDataLabels}
                onChange={handleShowDataLabelsChange}
              />
            }
            label={t("Show 3D Globe Data Labels")}
            className={styles.settingsOption}
          />
          <Box mt={2}>
            <Typography variant="body2">
              {t("3D Globe Data Label Font Size")}
            </Typography>
            <Slider
              value={dataLabelFontSize}
              onChange={(_, newValue) =>
                handleDataLabelFontSizeChange(newValue as number)
              }
              min={8}
              max={24}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
          </Box>
          <Box mt={2}>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={use3DLogScale}
                  onChange={handleUse3DLogScaleChange}
                />
              }
              label={t("Use Logarithmic Scale for 3D Bars")}
              className={styles.settingsOption}
            />
          </Box>
          <Box mt={2}>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={emphasisMode}
                  onChange={handleEmphasisModeChange}
                />
              }
              label={t("Emphasis Mode")}
              className={styles.settingsOption}
            />
            <Typography
              variant="caption"
              display="block"
              sx={{ ml: 4, mt: 0.5 }}
            >
              {t(
                "Lifts country polygons based on values, colors top 10% green and bottom 10% red"
              )}
            </Typography>
          </Box>
          <Box mt={2}>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={labelDisplayMode === 'formatted'}
                  onChange={handleLabelDisplayModeChange}
                />
              }
              label={t("Indicator Label Formats")}
              className={styles.settingsOption}
            />
            <Typography
              variant="caption"
              display="block"
              sx={{ ml: 4, mt: 0.5 }}
            >
              {labelDisplayMode === 'formatted'
                ? t("Showing: Verbose indicator labels (e.g., 'Fundamental rights (index) (2022)')")
                : t("Showing: Compact indicator labels (e.g., '2022_FUNDAMENT_RIGHTS')")
              }
            </Typography>
          </Box>
          <Box mt={2}>
            <FormControlLabel
              control={
                <Switch
                  color="primary"
                  checked={videoSoundEnabled}
                  onChange={handleVideoSoundEnabledChange}
                />
              }
              label={t("Enable Video Sound")}
              className={styles.settingsOption}
            />
            <Typography
              variant="caption"
              display="block"
              sx={{ ml: 4, mt: 0.5 }}
            >
              {t("Enable or disable sound for videos in 3D views")}
            </Typography>
          </Box>
        </Box>
        <Box className={styles.settingsSection}>
          <Typography variant="h6" gutterBottom className={styles.sectionTitle}>
            {t("Logging")}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={verboseLogging}
                onChange={handleVerboseLoggingChange}
              />
            }
            label={t("Verbose Log Messages")}
            className={styles.settingsOption}
          />
          <Box mt={2}>
            <FormControl fullWidth className={styles.settingsOption}>
              <InputLabel>Console Log Level</InputLabel>
              <Select
                value={consoleLogLevel}
                onChange={handleConsoleLogLevelChange}
                label="Console Log Level"
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
                <MenuItem value="debug-detail">Debug Detail</MenuItem>
              </Select>
            </FormControl>
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 0.5, ml: 0.5 }}
            >
              Controls which messages appear in the browser console
            </Typography>
          </Box>
          <Box mt={2}>
            <FormControl fullWidth className={styles.settingsOption}>
              <InputLabel>Database Log Level</InputLabel>
              <Select
                value={databaseLogLevel}
                onChange={handleDatabaseLogLevelChange}
                label="Database Log Level"
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="debug">Debug</MenuItem>
                <MenuItem value="debug-detail">Debug Detail</MenuItem>
              </Select>
            </FormControl>
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 0.5, ml: 0.5 }}
            >
              Controls which messages are sent to the database for server-side logging
            </Typography>
          </Box>
        </Box>
        <Box
          className={styles.settingsSection}
          display="flex"
          flexDirection="column"
          alignItems="center"
        >
          <Typography variant="h6" gutterBottom className={styles.sectionTitle}>
            {t("Browser Storage & Cache")}
          </Typography>

          {/* Cache toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={cacheEnabled}
                onChange={handleCacheToggle}
                color="primary"
              />
            }
            label="Enable data caching (recommended for performance)"
            className={styles.settingsOption}
          />

          {/* Storage buttons */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button
              variant="outlined"
              color="warning"
              onClick={clearLocalStorage}
              className={styles.clearStorageButton}
            >
              {t("Clear Local Storage")}
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={clearAllCaches}
              className={styles.clearStorageButton}
            >
              Clear All Caches
            </Button>
          </Box>

          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
            Use "Clear All Caches" if you're not seeing updated data after database changes.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
