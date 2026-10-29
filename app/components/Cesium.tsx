"use client";

import React, { useEffect, useRef, useState } from "react";
import { logger } from "../../lib/logging/logger";
import * as CesiumModule from "cesium";
import { Cartographic, Math as CesiumMath } from "cesium";
import "cesium/Source/Widgets/widgets.css";
import "../styles/cesium-pico.css";
import { useAppDispatch, useAppSelector } from "../../lib/hooks";
import { selectMedeMapData } from "../../lib/features/medemap/medeMapSlice";
import { setLoading, selectIsLoading } from "../../lib/loadingSlice";
import Legend from "./Legend3DView";
import {
  CircularProgress,
  Box,
  Slider,
  Typography,
  Button,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchGlobeData,
  selectGlobeData,
  selectGlobeDataLoading,
  selectGlobeDataError,
} from "../../lib/features/globeData/geocordDataSlice";
import { debounce } from "lodash";
import { RootState } from "@/lib/store";
import {
  selectShowDataLabels,
  selectDataLabelFontSize,
  selectUse3DLogScale,
  setUse3DLogScale,
} from "../../lib/features/settings/settingsSlice";
import PreviewGlobeModal from "./PreviewGlobeModal";

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

const Cesium = () => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumModule.Viewer | null>(null);
  const dispatch = useAppDispatch();
  const medeMapState = useAppSelector(selectMedeMapData);
  const isLoading = useAppSelector(selectIsLoading);
  const showDataLabels = useAppSelector(selectShowDataLabels);
  const dataLabelFontSize = useAppSelector(selectDataLabelFontSize);
  const use3DLogScale = useAppSelector(selectUse3DLogScale);
  const [viewerReady, setViewerReady] = useState(false);
  const geocoordinates =
    useSelector((state: any) => state.globeData?.data) || [];
  const loading =
    useSelector((state: any) => state.globeData?.loading) || false;
  const error = useSelector((state: any) => state.globeData?.error) || null;
  const [barSpacing, setBarSpacing] = useState<number>(0.4);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState({ x: 20, y: 20 });
  const [logoBillboard, setLogoBillboard] =
    useState<CesiumModule.Billboard | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    logger.info("Initializing Cesium...", { component: "Cesium" });
    dispatch(setLoading(true));
    setOverallProgress(0);
    if (cesiumContainerRef.current && !viewerRef.current) {
      initCesium();
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchGlobeData());
  }, [dispatch]);

  useEffect(() => {
    setIsPreviewModalOpen(true);
  }, []);

  const freezeGlobe = () => {
    if (viewerRef.current) {
      viewerRef.current.scene.screenSpaceCameraController.enableRotate = false;
      viewerRef.current.scene.screenSpaceCameraController.enableZoom = false;
      viewerRef.current.scene.screenSpaceCameraController.enableTilt = false;
    }
    setIsPreviewModalOpen(false);
  };

  const initCesium = async () => {
    setOverallProgress(5);
    if (cesiumContainerRef.current && !viewerRef.current) {
      logger.info("Creating Cesium viewer...", { component: "Cesium" });
      dispatch(setLoading(true));
      CesiumModule.buildModuleUrl.setBaseUrl("/Cesium/");

      try {
        setOverallProgress(10);
        // Create the viewer with default imagery provider
        viewerRef.current = new CesiumModule.Viewer(
          cesiumContainerRef.current,
          {
            baseLayerPicker: true,
            geocoder: false,
            homeButton: true,
            infoBox: false,
            navigationHelpButton: true,
            sceneModePicker: true,
            imageryProviderViewModels: [
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
            ],
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
            sceneMode: CesiumModule.SceneMode.SCENE3D,
          }
        );
        logger.info("Viewer initialized.", { component: "Cesium" });

        setOverallProgress(30);
        // Add additional layers to the base layer picker
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

        setOverallProgress(50);
        // Enhance globe appearance
        if (viewerRef.current) {
          viewerRef.current.scene.globe.show = true;
          viewerRef.current.scene.globe.enableLighting = true;
          viewerRef.current.scene.globe.depthTestAgainstTerrain = false;
          viewerRef.current.scene.globe.showGroundAtmosphere = true;
          if (viewerRef.current.scene.skyAtmosphere) {
            viewerRef.current.scene.skyAtmosphere.show = true;
          }
          viewerRef.current.scene.backgroundColor = CesiumModule.Color.BLACK;

          // Set the view to show the entire globe
          viewerRef.current.camera.flyHome(0);
        }

        setViewerReady(true);
        logger.info("Viewer ready", { component: "Cesium" });
        setOverallProgress(70);
        await loadGeoJson();
        setOverallProgress(90);
        await renderData(); // Ensure renderData is called after initialization and wait for it to complete
        setInitializationComplete(true);

        const handleLogoDrag = (event: React.DragEvent<HTMLImageElement>) => {
          const newX = event.clientX;
          const newY = event.clientY;
          setLogoPosition({ x: newX, y: newY });
        };

        const handler = new CesiumModule.ScreenSpaceEventHandler(
          viewerRef.current.scene.canvas
        );
        handler.setInputAction((movement: any) => {
          const pickedObject = viewerRef.current?.scene.pick(movement.position);
          if (
            CesiumModule.defined(pickedObject) &&
            pickedObject.primitive === logoBillboard
          ) {
            const cartesian = viewerRef.current?.camera.pickEllipsoid(
              movement.position
            );
            if (cartesian) {
              const cartographic = Cartographic.fromCartesian(cartesian);
              const longitude = CesiumMath.toDegrees(cartographic.longitude);
              const latitude = CesiumMath.toDegrees(cartographic.latitude);
              setLogoPosition({ x: longitude, y: latitude });
            }
          }
        }, CesiumModule.ScreenSpaceEventType.LEFT_CLICK);
      } catch (error) {
        logger.error("Failed to initialize Cesium", {
          component: "Cesium",
          error,
        });
      } finally {
        dispatch(setLoading(false));
      }
    }
  };

  useEffect(() => {
    if (viewerRef.current && cesiumReady) {
      updateLogoBanner();
    }
  }, [showLogo, logoPosition, cesiumReady]);

  const loadGeoJson = async () => {
    if (!viewerRef.current) return;

    try {
      setOverallProgress(45);
      const geoJsonResponse = await fetch("/geojson/countries.geo.json");
      const geoJsonData = await geoJsonResponse.json();
      logger.info("Total features", {
        component: "Cesium",
        featureCount: geoJsonData.features.length,
      });

      setOverallProgress(50);
      // Filter for European countries
      const europeanFeatures = geoJsonData.features.filter((feature: any) =>
        europeanCountries.includes(feature.properties.name)
      );
      logger.info("European features", {
        component: "Cesium",
        europeanFeatureCount: europeanFeatures.length,
      });

      setOverallProgress(55);
      // Process European features
      europeanFeatures.forEach((feature: any, index: number) => {
        const countryName = feature.properties.name;
        logger.info(`Processing feature ${index}: ${countryName}`, {
          component: "Cesium",
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
              component: "Cesium",
              countryName,
              polygonIndex: polyIndex + 1,
            });

            const positions = CesiumModule.Cartesian3.fromDegreesArray(
              polygonCoords[0].flat()
            );

            const entity = new CesiumModule.Entity({
              name: `${countryName} - Part ${polyIndex + 1}`,
              polygon: {
                hierarchy: positions,
                material: CesiumModule.Color.fromRandom({ alpha: 0.05 }),
                outline: true,
                outlineColor: CesiumModule.Color.WHITE,
                outlineWidth: 2,
                height: 0,
                heightReference: CesiumModule.HeightReference.NONE,
              },
            });

            logger.info(`Adding entity to viewer`, {
              component: "Cesium",
              countryName,
              partIndex: polyIndex + 1,
            });
            viewerRef.current?.entities.add(entity);
          });
        } else {
          logger.warning(`Feature is not a polygon`, {
            component: "Cesium",
            index,
            countryName,
            geometryType: feature.geometry.type,
          });
        }
      });

      logger.info("All entities added", {
        component: "Cesium",
        entityCount: viewerRef.current.entities.values.length,
      });

      viewerRef.current.zoomTo(viewerRef.current.entities);

      logger.info("GeoJSON and billboard loaded successfully", {
        component: "Cesium",
      });
      setOverallProgress(65);
      setCesiumReady(true);
    } catch (error) {
      logger.error("Failed to load GeoJSON or add billboard", {
        component: "Cesium",
        error,
      });
    }
  };

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        logger.info("Viewer destroyed.", { component: "Cesium" });
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
      logger.info("Rendering data...", { component: "Cesium" });
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
    showDataLabels,
    dataLabelFontSize,
    use3DLogScale,
  ]);

  useEffect(() => {
    if (viewerRef.current && showDataLabels) {
      viewerRef.current.entities.values.forEach((entity) => {
        if (entity.label) {
          entity.label.font = new CesiumModule.ConstantProperty(
            `${dataLabelFontSize}pt monospace`
          );
        }
      });
    }
  }, [dataLabelFontSize, showDataLabels]);

  const renderData = () => {
    logger.info("renderData called", { component: "Cesium" });
    if (loading) {
      logger.info("Loading geocoordinates...", { component: "Cesium" });
      return;
    }

    if (error) {
      logger.error("Failed to load geocoordinates", {
        component: "Cesium",
        error,
      });
      return;
    }

    if (
      !viewerRef.current ||
      !viewerRef.current.scene ||
      !viewerRef.current.scene.globe
    ) {
      logger.error("Cesium viewer not ready", { component: "Cesium" });
      return;
    }

    logger.info("Rendering data in Cesium...", { component: "Cesium" });
    logger.info("Selected options in Cesium", {
      component: "Cesium",
      selectedOptions: medeMapState.selectedOptions,
    });
    logger.info("Data in Cesium", {
      component: "Cesium",
      data: medeMapState.data,
    });

    // Log detailed information about selected options
    (Object.entries(medeMapState.selectedOptions) as [string, any][]).forEach(
      ([table, columns]) => {
        logger.info(`Table: ${table}`, { component: "Cesium" });
        logger.info(`Selected columns`, {
          component: "Cesium",
          table,
          columns,
        });
        if (medeMapState.data[table]) {
          logger.info(`Sample data`, {
            component: "Cesium",
            table,
            sampleData: medeMapState.data[table][0],
          });
        } else {
          logger.info(`No data found for table: ${table}`, {
            component: "Cesium",
          });
        }
      }
    );

    // Remove existing entities except for country polygons
    viewerRef.current?.entities.values.forEach((entity) => {
      if (entity.polygon === undefined) {
        viewerRef.current?.entities.remove(entity);
      }
    });

    const selectedOptions = medeMapState.selectedOptions;
    const data = medeMapState.data;

    // Find the maximum value for each selected option to normalize the data
    const maxValues: Record<string, number> = {};
    (Object.entries(selectedOptions) as [string, any][]).forEach(
      ([table, columns]) => {
        columns.forEach((column: any) => {
          if (data[table]) {
            maxValues[column.value] = Math.max(
              ...data[table].map(
                (item: any) => parseFloat(item[column.value]) || 0
              )
            );
            logger.info(`Max value calculated`, {
              component: "Cesium",
              table,
              column: column.value,
              maxValue: maxValues[column.value],
            });
          } else {
            logger.error(`No data found for table: ${table}`, {
              component: "Cesium",
            });
          }
        });
      }
    );

    const totalColumns = Object.values(selectedOptions).flat().length;
    logger.info("Total columns to render", {
      component: "Cesium",
      totalColumns,
    });
    const angleStep = (2 * Math.PI) / totalColumns;

    setOverallProgress(75);

    (Object.entries(selectedOptions) as [string, any][]).forEach(
      ([table, columns], tableIndex) => {
        if (!data[table]) {
          logger.error(`No data found for table: ${table}`, {
            component: "Cesium",
          });
          return;
        }

        data[table].forEach((item: any, itemIndex: number) => {
          if (item.country === "metastat") {
            logger.info("Skipping metastat dummy country", {
              component: "Cesium",
            });
            return;
          }

          const coordinates = getCountryCoordinates(item.country);

          if (coordinates) {
            const { latitude, longitude } = coordinates;

            columns.forEach((column: any, columnIndex: number) => {
              const value = parseFloat(item[column.value]) || 0;
              let normalizedValue = value / maxValues[column.value];

              // Apply log scale if enabled
              if (use3DLogScale && value > 0) {
                // Use log10(value + 1) to handle zero values and scale appropriately
                const logValue = Math.log10(value + 1);
                const maxLogValue = Math.log10(maxValues[column.value] + 1);
                normalizedValue = logValue / maxLogValue;
              }

              const height = normalizedValue * 500000; // Max height of 500km

              const angle =
                (tableIndex * columns.length + columnIndex) * angleStep;
              const offsetDistance = barSpacing;
              const offsetLon = longitude + Math.cos(angle) * offsetDistance;
              const offsetLat = latitude + Math.sin(angle) * offsetDistance;

              const position = CesiumModule.Cartesian3.fromDegrees(
                offsetLon,
                offsetLat,
                height / 2
              );

              logger.info(`Adding entity for country`, {
                component: "Cesium",
                country: item.country,
                table,
                column: column.value,
                value,
              });
              const entity = viewerRef.current?.entities.add({
                position: position,
                cylinder: {
                  length: height,
                  topRadius: 20000,
                  bottomRadius: 20000,
                  material: CesiumModule.Color.fromHsl(
                    (tableIndex * columns.length + columnIndex) / totalColumns,
                    1,
                    0.5,
                    0.8
                  ),
                  outline: false, // Set this to false to remove the outline
                },
                label: showDataLabels
                  ? {
                      text: `${Math.ceil(value)}`,
                      font: `${dataLabelFontSize}pt monospace`,
                      style: CesiumModule.LabelStyle.FILL_AND_OUTLINE,
                      outlineWidth: 2,
                      verticalOrigin: CesiumModule.VerticalOrigin.TOP + 100,
                      pixelOffset: new CesiumModule.Cartesian2(0, 5),
                      fillColor: CesiumModule.Color.WHITE,
                      outlineColor: CesiumModule.Color.BLACK,
                      show: true,
                    }
                  : undefined,
              });
            });
          } else {
            logger.warning(
              `Coordinates not found for country: ${item.country}`,
              { component: "Cesium" }
            );
          }
        });
        const progress =
          75 + (24 * (tableIndex + 1)) / Object.keys(selectedOptions).length;
        setOverallProgress(Math.min(progress, 99));
      }
    );

    logger.info("Total entities added", {
      component: "Cesium",
      totalEntities: viewerRef.current?.entities.values.length,
    });
    // Set the camera to view all entities
    viewerRef.current?.zoomTo(viewerRef.current?.entities).then(() => {
      setOverallProgress(100);
      setInitializationComplete(true);
    });
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
      {(isLoading || overallProgress < 100 || !initializationComplete) && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          style={{ transform: "translate(-50%, -50%)" }}
          zIndex={999}
        >
          <CircularProgress
            size={60}
            thickness={4}
            variant="determinate"
            value={overallProgress}
          />
          <Typography variant="caption" component="div" color="text.secondary">
            {`${Math.round(overallProgress)}%`}
          </Typography>
        </Box>
      )}
      <div
        ref={cesiumContainerRef}
        className="cesiumContainer cesium-container"
      />
      <Legend selectedOptions={medeMapState.selectedOptions} />
      <Box className="cesium-bar-spacing-control">
        <Typography gutterBottom>Bar Spacing</Typography>
        <Slider
          value={barSpacing}
          onChange={(_event: any, newValue: any) =>
            setBarSpacing(newValue as number)
          }
          onChangeCommitted={handleBarSpacingChange as any}
          min={0.01}
          max={0.6}
          step={0.01}
          valueLabelDisplay="auto"
        />
        <FormControlLabel
          control={
            <Switch
              checked={use3DLogScale}
              onChange={(e) => {
                dispatch(setUse3DLogScale(e.target.checked));
                localStorage.setItem(
                  "use3DLogScale",
                  e.target.checked.toString()
                );
                renderData();
              }}
              color="primary"
            />
          }
          label="Use Logarithmic Scale"
          style={{ marginTop: "10px" }}
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
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
        <PreviewGlobeModal
          isOpen={isPreviewModalOpen}
          onEnable={() => setIsPreviewModalOpen(false)}
          onDisable={freezeGlobe}
        />
        {/* Other components and JSX */}
      </div>
    </div>
  );
};

export default Cesium;
