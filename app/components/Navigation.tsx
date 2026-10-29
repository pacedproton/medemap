"use client";

import { useState, useEffect } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import LinkTab from "./LinkTab";
import Typography from "@mui/material/Typography";
import { useDispatch, useSelector } from "react-redux";
import { setRunTutorial } from "../../lib/features/tutorial/tutorialSlice";
import { useTranslation } from "react-i18next";
import { RootState } from "../../lib/store";
import { setLoading } from "../../lib/loadingSlice";
import { setOverallProgress } from "../../lib/progressSlice";
import { CircularProgress } from "@mui/material";
import { selectIsLoading } from "../../lib/loadingSlice";
import { selectOverallProgress } from "../../lib/progressSlice";
import UserMenu from "./UserMenu";
import ProfileSelector from "./ProfileSelector";

const Navigation = () => {
  const [value, setValue] = useState(0);
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const currentLanguage = useSelector(
    (state: RootState) => state.language.currentLanguage
  );
  const isLoading = useSelector(selectIsLoading);
  const overallProgress = useSelector(selectOverallProgress);

  useEffect(() => {
    i18n.changeLanguage(currentLanguage);
  }, [currentLanguage, i18n]);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleTutorialClick = () => {
    dispatch(setRunTutorial(true));
  };

  return (
    <Box>
      <Typography
        variant="h6"
        component="div"
        sx={{
          textAlign: "center",
          padding: "10px 0",
          backgroundColor: "#e8f1ff",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        {t("mapTitle")}
      </Typography>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "0 16px",
        }}
      >
        <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center" }}>
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="navigation tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ maxWidth: "100%" }}
          >
            <LinkTab label={t("indicatorSelection")} href="/" />
            <LinkTab label={t("choropleth")} href="/view_choropleth" />
            <LinkTab label={t("descriptiveGraphViews")} href="/view_charts" />
            <LinkTab label={t("histograms")} href="/view_histograms" />
            <LinkTab label={t("Surface View")} href="/view_3d_mesh" />
            <LinkTab
              label={t("3dView")}
              href="/3d"
              onClick={() => {
                dispatch(setLoading(true));
                dispatch(setOverallProgress(0));
              }}
            />
            <LinkTab label={t("Data Envelopment Analysis")} href="/view_dea" />
            <LinkTab label={t("totalTableView")} href="/view_table" />
            <LinkTab label={t("Circular Views")} href="/view_stacked_bar" />
            <LinkTab
              label={t("Correlation Heatmap")}
              href="/view_correlation_matrix"
            />
            <LinkTab label={t("Eigenvalue Decomposition")} href="/view_pca" />
          </Tabs>
        </Box>
        <Tab
          label={
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: "1.1em",
              }}
            >
              {t("tutorial")}
            </Typography>
          }
          onClick={handleTutorialClick}
          sx={{ flexShrink: 0 }}
        />
        {isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", ml: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {Math.round(overallProgress)}%
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, ml: 2 }}>
          <ProfileSelector />
          <UserMenu />
        </Box>
      </Box>
    </Box>
  );
};

export default Navigation;
