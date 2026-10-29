"use client";

import React, { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logging/logger";
import * as CesiumModule from "cesium";
import "cesium/Source/Widgets/widgets.css";
import "@/styles/cesium-pico.css";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { selectMedeMapData } from "@/lib/features/medemap/medeMapSlice";
import { setLoading, selectIsLoading } from "@/lib/loadingSlice";
import {
  CircularProgress,
  Box,
  Slider,
  Typography,
  Button,
} from "@mui/material";
import { fetchGlobeData } from "@/lib/features/globeData/geocordDataSlice";
import Legend from "@/components/LegendCylindrical";
import { debounce } from "lodash";

const europeanCountries = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Iceland",
  "Ireland",
  "Italy",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Monaco",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
];

const sampleThresholds = {
  low_threshold: 30,
  medium_threshold: 60,
  high_threshold: 90,
};

const hardcodedSelectedOptions = {
  "Health Indicators": [
    {
      value: "life_expectancy",
      label: "Life Expectancy",
    },
  ],
};

const hardcodedColumnOptions = {
  "Health Indicators": [
    {
      value: "life_expectancy",
      label: "Life Expectancy",
      thresholds: sampleThresholds,
    },
  ],
};

const hardcodedData = {
  "Health Indicators": [
    { country: "Austria", life_expectancy: 81 },
    { country: "Belgium", life_expectancy: 82 },
    { country: "Bulgaria", life_expectancy: 75 },
  ],
};

const Cesium = () => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumModule.Viewer | null>(null);
  const dispatch = useAppDispatch();
  const medeMapState = useAppSelector(selectMedeMapData);
  const isLoading = useAppSelector(selectIsLoading);
  const [viewerReady, setViewerReady] = useState(false);

  const geocoordinates = useAppSelector((state: any) => state.globeData?.data) || [];
  const loading = useAppSelector((state: any) => state.globeData?.loading) || false;
  const error = useAppSelector((state: any) => state.globeData?.error) || null;

  const [barSpacing, setBarSpacing] = useState<number>(0.4);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState({ x: 20, y: 20 });
  const [logoBillboard, setLogoBillboard] =
    useState<CesiumModule.Billboard | null>(null);

  const countryEntities: { [key: string]: CesiumModule.Entity[] } = {};

  CesiumModule.Ion.defaultAccessToken =
    process.env.NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN || "";

  useEffect(() => {
    logger.info("Initializing Cesium...", { component: "CylindricalView" });
    dispatch(setLoading(true));
    if (cesiumContainerRef.current && !viewerRef.current) {
      initCesium();
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchGlobeData());
  }, [dispatch]);

  const initCesium = async () => {
    if (cesiumContainerRef.current && !viewerRef.current) {
      logger.info("Creating Cesium viewer...", { component: "CylindricalView" });
      dispatch(setLoading(true));
      CesiumModule.buildModuleUrl.setBaseUrl("/Cesium/");

      try {
        viewerRef.current = new CesiumModule.Viewer(
          cesiumContainerRef.current,
          {
            baseLayerPicker: true,
            geocoder: false,
            homeButton: true,
            infoBox: false,
            navigationHelpButton: true,
            sceneModePicker: true,
            selectedImageryProviderViewModel:
              new CesiumModule.ProviderViewModel({
                name: "Blue Marble",
                iconUrl: CesiumModule.buildModuleUrl(
                  "Widgets/Images/ImageryProviders/blueMarble.png"
                ),
                tooltip: "Blue Marble Next Generation July, 2004",
                creationFunction: () => {
                  return CesiumModule.IonImageryProvider.fromAssetId(3845);
                },
              }),
            sceneMode: CesiumModule.SceneMode.SCENE2D,
          }
        );
        logger.info("Viewer initialized.", { component: "CylindricalView" });

        const imageryLayers =
          viewerRef.current.baseLayerPicker.viewModel.imageryProviderViewModels;

        imageryLayers.push(
          new CesiumModule.ProviderViewModel({
            name: "Earth at Night",
            iconUrl: CesiumModule.buildModuleUrl(
              "Widgets/Images/ImageryProviders/earthAtNight.png"
            ),
            tooltip: "Earth at Night",
            creationFunction: () => {
              return CesiumModule.IonImageryProvider.fromAssetId(3812);
            },
          })
        );

        if (viewerRef.current) {
          viewerRef.current.scene.globe.show = true;
          viewerRef.current.scene.globe.enableLighting = true;
          viewerRef.current.scene.globe.depthTestAgainstTerrain = false;
          viewerRef.current.scene.globe.showGroundAtmosphere = true;
          if (viewerRef.current.scene.skyAtmosphere) {
            viewerRef.current.scene.skyAtmosphere.show = true;
          }
          viewerRef.current.scene.backgroundColor = CesiumModule.Color.BLACK;

          viewerRef.current.camera.flyHome(0);
        }

        setViewerReady(true);
        logger.info("Viewer ready", { component: "CylindricalView" });
        await loadGeoJson();
        renderData(); // Ensure renderData is called after initialization
      } catch (error) {
        logger.error("Failed to initialize Cesium", { component: "CylindricalView", error });
      } finally {
        dispatch(setLoading(false));
      }
    }
  };

  const loadGeoJson = async () => {
    if (!viewerRef.current) return;

    try {
      const geoJsonResponse = await fetch("/geojson/countries.geo.json");

      if (!geoJsonResponse.ok) {
        throw new Error(
          `Failed to fetch GeoJSON: ${geoJsonResponse.status} ${geoJsonResponse.statusText}`
        );
      }

      const geoJsonData = await geoJsonResponse.json();
      logger.info("Total features in GeoJSON", { component: "CylindricalView", featureCount: geoJsonData.features.length });

      const europeanFeatures = geoJsonData.features.filter((feature: any) =>
        europeanCountries.includes(feature.properties.name)
      );
      logger.info("Number of European features", { component: "CylindricalView", europeanFeatureCount: europeanFeatures.length });

      europeanFeatures.forEach((feature: any, index: number) => {
        const countryNameRaw = feature.properties.name;
        const countryName = normalizeCountryName(countryNameRaw);
        logger.info(`Processing GeoJSON feature ${index}`, {
          component: "CylindricalView",
          countryNameRaw,
          countryName,
          index
        });

        if (
          feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon"
        ) {
          let polygons =
            feature.geometry.type === "Polygon"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;

          polygons.forEach((polygonCoords: any, polyIndex: number) => {
            logger.info(`Creating entity for polygon`, {
              component: "CylindricalView",
              countryNameRaw,
              polygonIndex: polyIndex + 1
            });

            const positions = CesiumModule.Cartesian3.fromDegreesArray(
              polygonCoords[0].flat()
            );

            const entity = new CesiumModule.Entity({
              name: `${countryNameRaw} - Part ${polyIndex + 1}`,
              polygon: {
                hierarchy: positions,
                material: new CesiumModule.ColorMaterialProperty(
                  CesiumModule.Color.GRAY.withAlpha(0.2)
                ),
                outline: true,
                outlineColor: CesiumModule.Color.WHITE,
                outlineWidth: 2,
                height: 0,
                heightReference: CesiumModule.HeightReference.NONE,
                fill: true,
              },
            });

            logger.info(`Adding entity to viewer`, {
              component: "CylindricalView",
              countryNameRaw,
              partIndex: polyIndex + 1
            });
            viewerRef.current?.entities.add(entity);

            if (!countryEntities[countryName]) {
              countryEntities[countryName] = [];
            }
            countryEntities[countryName].push(entity);
          });
        } else {
          logger.warning(`Feature is not a polygon`, {
            component: "CylindricalView",
            index,
            countryNameRaw,
            geometryType: feature.geometry.type
          });
        }
      });

      logger.info("All entities added", {
        component: "CylindricalView",
        entityCount: viewerRef.current.entities.values.length
      });

      viewerRef.current.zoomTo(viewerRef.current.entities);

      logger.info("GeoJSON loaded successfully", { component: "CylindricalView" });
      setCesiumReady(true);
      renderData();
    } catch (error) {
      logger.error("Failed to load GeoJSON", { component: "CylindricalView", error });
    }
  };

  const normalizeCountryName = (name: string) => name.trim().toLowerCase();

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        logger.info("Viewer destroyed.", { component: "CylindricalView" });
      }
    };
  }, []);

  useEffect(() => {
    if (
      viewerRef.current &&
      medeMapState.data &&
      geocoordinates &&
      !isLoading &&
      Object.keys(medeMapState.selectedOptions).length > 0 &&
      cesiumReady
    ) {
      logger.info("Rendering data...", { component: "CylindricalView" });
      renderData();
    }
  }, [
    viewerRef.current,
    medeMapState.data,
    geocoordinates,
    isLoading,
    medeMapState.selectedOptions,
    barSpacing,
    cesiumReady,
  ]);

  const { columnOptions, selectedOptions, data } = medeMapState;
  const [chartData, setChartData] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    logger.info("Processing MedeMap state", { component: "CylindricalView", medeMapState });
    processData();
  }, [medeMapState]);

  const getBarColor = (value: number, thresholds: any): string => {
    logger.info("Determining color for value", {
      component: "CylindricalView",
      value,
      thresholds
    });
    if (
      !thresholds ||
      thresholds.low_threshold == null ||
      thresholds.medium_threshold == null ||
      thresholds.high_threshold == null
    ) {
      logger.warning("Thresholds not available or incomplete. Using gray color.", { component: "CylindricalView" });
      return "gray";
    }

    if (value <= thresholds.low_threshold) {
      return "red";
    } else if (value <= thresholds.medium_threshold) {
      return "green";
    } else {
      return "blue";
    }
  };

  const processData = () => {
    if (
      Object.keys(selectedOptions).length === 0 ||
      Object.keys(data).length === 0
    ) {
      return;
    }

    const processedData: any[] = [];
    let currentProgress = 0;

    (Object.entries(selectedOptions) as [string, any[]][]).forEach(
      ([tableName, columns], tableIndex) => {
        if (columns && columns.length > 0) {
          const tableData = data[tableName];
          if (!tableData) {
            logger.error(`No data found for table: ${tableName}`, { component: "CylindricalView" });
            return;
          }

          const thresholdsMap: { [key: string]: any } = {};
          const tableColumnOptions = columnOptions[tableName];
          tableColumnOptions.forEach((option: any) => {
            thresholdsMap[option.value] = option.thresholds;
          });

          logger.info(`Thresholds for table`, { component: "CylindricalView", tableName, thresholds: thresholdsMap });

          const chartDataForTable = tableData.map((row: any) => {
            const chartItem: any = { country: row.country };
            columns.forEach((column: any) => {
              const value = parseFloat(row[column.value]) || 0;
              chartItem[column.value] = value;
              const thresholds = thresholdsMap[column.value];
              chartItem[`${column.value}_color`] = getBarColor(
                value,
                thresholds
              );

              logger.info(`Processing country indicator`, {
                component: "CylindricalView",
                country: row.country,
                indicator: column.value
              });
              logger.info(`Indicator value`, { component: "CylindricalView", value });
              logger.info(`Indicator thresholds`, { component: "CylindricalView", thresholds });
              logger.info(`Assigned color`, {
                component: "CylindricalView",
                color: chartItem[`${column.value}_color`]
              });
            });
            return chartItem;
          });

          const columnsWithFullNames = columns.map((column: any) => ({
            ...column,
            thresholds: thresholdsMap[column.value],
          }));

          processedData.push({
            tableName,
            data: chartDataForTable,
            columns: columnsWithFullNames,
          });
        }
        currentProgress =
          ((tableIndex + 1) / Object.keys(selectedOptions).length) * 100;
        setProgress(currentProgress);
      }
    );

    logger.info("Processed chart data", { component: "CylindricalView", processedData });

    setChartData(processedData);
  };

  const renderData = () => {
    if (loading) {
      logger.info("Loading geocoordinates...", { component: "CylindricalView" });
      return;
    }

    if (error) {
      logger.error("Failed to load geocoordinates", { component: "CylindricalView", error });
      return;
    }

    if (
      !viewerRef.current ||
      !viewerRef.current.scene ||
      !viewerRef.current.scene.globe
    ) {
      logger.error("Cesium viewer not ready", { component: "CylindricalView" });
      return;
    }

    logger.info("Rendering data in Cesium...", { component: "CylindricalView" });
    logger.info("Chart data", { component: "CylindricalView", chartData });

    viewerRef.current?.entities.values.forEach((entity) => {
      if (entity.polygon === undefined) {
        viewerRef.current?.entities.remove(entity);
      }
    });

    chartData.forEach((tableData) => {
      const { data, columns } = tableData;

      data.forEach((item: any) => {
        if (item.country === "metastat") return;

        const countryNameRaw = item.country;
        const countryName = normalizeCountryName(countryNameRaw);
        const countryEntityList = countryEntities[countryName];

        logger.info(
          `Processing country '${countryNameRaw}' (normalized: '${countryName}')`
        );
        if (!countryEntityList) {
          logger.warning(
            `Country entity not found for country: '${countryNameRaw}'`
          );
          logger.info(
            "Available country entities:",
            Object.keys(countryEntities)
          );
        } else {
          logger.info(`Found entity for country: '${countryNameRaw}'`, { component: "CylindricalView" });
        }

        const value = parseFloat(item[columns[0].value]) || 0;
        const thresholds = columns[0].thresholds;

        logger.info(`  Indicator: '${columns[0].value}'`, { component: "CylindricalView" });
        logger.info(`  Value: ${value}`, { component: "CylindricalView" });
        logger.info(`  Thresholds`, { component: "CylindricalView", thresholds });

        const countryColorString = getBarColor(value, thresholds);
        logger.info(`  Assigned color: ${countryColorString}`, { component: "CylindricalView" });

        const countryColor =
          CesiumModule.Color.fromCssColorString(countryColorString).withAlpha(
            1
          );

        if (countryEntityList) {
          countryEntityList.forEach((entity) => {
            logger.info(`  Updating material for '${countryNameRaw}'`, { component: "CylindricalView" });
            if (entity.polygon) {
              entity.polygon.material = new CesiumModule.ColorMaterialProperty(
                countryColor
              );
            }
          });
        }
      });
    });

    logger.info("Total entities after rendering", {
      component: "CylindricalView",
      totalEntities: viewerRef.current.entities.values.length
    });

    viewerRef.current.zoomTo(viewerRef.current.entities);
  };

  const getCountryCoordinates = (countryName: string) => {
    if (!geocoordinates) return null;
    const country = geocoordinates.find(
      (coord: any) => coord.country === countryName
    );
    if (country && country.latitude && country.longitude) {
      return {
        latitude: parseFloat(country.latitude),
        longitude: parseFloat(country.longitude),
      };
    }
    return null;
  };

  const handleBarSpacingChange = (_: Event, newValue: number | number[]) => {
    setBarSpacing(newValue as number);
    renderData();
  };

  const updateLogoBanner = () => {
    if (!viewerRef.current || !showLogo) return;

    if (logoBillboard) {
      viewerRef.current.scene.primitives.remove(logoBillboard);
    }

    const billboards = new CesiumModule.BillboardCollection();
    const newLogoBillboard = billboards.add({
      image: "/images/MeDeMA_logo.png",
      position: CesiumModule.Cartesian3.fromDegrees(0, 0, 10000000),
      horizontalOrigin: CesiumModule.HorizontalOrigin.LEFT,
      verticalOrigin: CesiumModule.VerticalOrigin.TOP,
      scale: 0.5,
      pixelOffset: new CesiumModule.Cartesian2(logoPosition.x, logoPosition.y),
    });

    viewerRef.current.scene.primitives.add(billboards);
    setLogoBillboard(newLogoBillboard);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {(isLoading || !cesiumReady) && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          style={{ transform: "translate(-50%, -50%)" }}
          zIndex={999}
        >
          <CircularProgress size={60} thickness={4} />
        </Box>
      )}
      <div
        ref={cesiumContainerRef}
        className="cesiumContainer cesium-container"
      />
      <Legend
        selectedOptions={medeMapState.selectedOptions}
        columnOptions={medeMapState.columnOptions}
        className="cesium-legend"
        style={{ position: "absolute", bottom: "210px", right: "180px" }}
      />
      <Box className="cesium-bar-spacing-control">
        <Typography gutterBottom>Bar Spacing</Typography>
        <Slider
          value={barSpacing}
          onChange={(_event: any, newValue: any) => setBarSpacing(newValue as number)}
          onChangeCommitted={handleBarSpacingChange as any}
          min={0.01}
          max={0.6}
          step={0.01}
          valueLabelDisplay="auto"
        />
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={renderData}
        style={{
          position: "absolute",
          bottom: "70px",
          right: "180px",
          zIndex: 1000,
        }}
      >
        Refresh View
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => setShowLogo(!showLogo)}
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
        }}
      >
        {showLogo ? "Hide Logo" : "Show Logo"}
      </Button>
    </div>
  );
};

export default Cesium;
