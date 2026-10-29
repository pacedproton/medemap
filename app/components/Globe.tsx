"use client";

import React, { useEffect, useRef, useState } from "react";
import Globe from "globe.gl";
import * as THREE from "three";
import "../../styles/globe.css";
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
} from "@mui/material";
import { useSelector } from "react-redux";
import { fetchGlobeData } from "../../lib/features/globeData/geocordDataSlice";
import { RootState } from "@/lib/store";
import {
  selectShowDataLabels,
  selectDataLabelFontSize,
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

const GlobeComponent = () => {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const dispatch = useAppDispatch();
  const medeMapState = useAppSelector(selectMedeMapData);
  const isLoading = useAppSelector(selectIsLoading);
  const showDataLabels = useAppSelector(selectShowDataLabels);
  const dataLabelFontSize = useAppSelector(selectDataLabelFontSize);
  const geocoordinates =
    useSelector((state: any) => state.globeData?.data) || [];
  const loading =
    useSelector((state: any) => state.globeData?.loading) || false;
  const error = useSelector((state: any) => state.globeData?.error) || null;
  const [barSpacing, setBarSpacing] = useState<number>(0.4);
  const [globeReady, setGlobeReady] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  useEffect(() => {
    console.log("Initializing Globe...");
    dispatch(setLoading(true));
    setOverallProgress(0);
    if (globeContainerRef.current && !globeRef.current) {
      initGlobe();
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchGlobeData());
  }, [dispatch]);

  useEffect(() => {
    setIsPreviewModalOpen(true);
  }, []);

  const freezeGlobe = () => {
    if (globeRef.current) {
      globeRef.current.controls().enabled = false;
    }
    setIsPreviewModalOpen(false);
  };

  const initGlobe = async () => {
    setOverallProgress(5);
    if (globeContainerRef.current && !globeRef.current) {
      try {
        setOverallProgress(10);

        // Initialize Globe.gl
        globeRef.current = (Globe as any)()(globeContainerRef.current)
          .globeImageUrl(
            "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          )
          .bumpImageUrl(
            "//unpkg.com/three-globe/example/img/earth-topology.png"
          )
          .backgroundColor("rgba(0,0,0,0)")
          .width(globeContainerRef.current.clientWidth)
          .height(globeContainerRef.current.clientHeight);

        // Set initial camera position
        globeRef.current.pointOfView({ lat: 40, lng: 0, altitude: 2.5 });

        setOverallProgress(30);
        await loadGeoJson();
        setOverallProgress(90);
        await renderData();
        setInitializationComplete(true);
        setGlobeReady(true);
      } catch (error) {
        console.error("Error initializing Globe:", error);
      } finally {
        dispatch(setLoading(false));
      }
    }
  };

  const loadGeoJson = async () => {
    try {
      setOverallProgress(45);
      const response = await fetch("/geojson/countries.geo.json");
      const data = await response.json();

      // Filter for European countries
      const europeanFeatures = data.features.filter((feature: any) =>
        europeanCountries.includes(feature.properties.name)
      );

      setGeoJsonData({
        ...data,
        features: europeanFeatures,
      });

      if (globeRef.current) {
        globeRef.current
          .polygonsData(europeanFeatures)
          .polygonCapColor(() => "rgba(200, 200, 200, 0.05)")
          .polygonSideColor(() => "rgba(150, 150, 150, 0.05)")
          .polygonStrokeColor(() => "#ffffff")
          .polygonAltitude(0.01);
      }

      setOverallProgress(65);
    } catch (error) {
      console.error("Error loading GeoJSON:", error);
    }
  };

  useEffect(() => {
    return () => {
      if (globeRef.current) {
        // Clean up Globe.gl instance
        globeRef.current._destructor();
      }
    };
  }, []);

  useEffect(() => {
    if (
      globeRef.current &&
      medeMapState.data &&
      geocoordinates &&
      !isLoading &&
      Object.keys(medeMapState.selectedOptions).length > 0 &&
      globeReady
    ) {
      console.log("Rendering data...");
      renderData();
    }
  }, [
    medeMapState.data,
    geocoordinates,
    isLoading,
    medeMapState.selectedOptions,
    barSpacing,
    globeReady,
    showDataLabels,
    dataLabelFontSize,
  ]);

  const renderData = () => {
    if (loading || !globeRef.current) return;
    if (error) {
      console.error("Error loading geocoordinates:", error);
      return;
    }

    console.log("Rendering data in Globe...");
    console.log("Selected options:", medeMapState.selectedOptions);
    console.log("Data:", medeMapState.data);

    // Clear existing bars
    globeRef.current.customLayerData([]);

    const selectedOptions = medeMapState.selectedOptions;
    const data = medeMapState.data;

    // Find max values for normalization
    const maxValues: Record<string, number> = {};
    (Object.entries(selectedOptions) as [string, any[]][]).forEach(
      ([table, columns]) => {
        columns.forEach((column) => {
          if (data[table]) {
            maxValues[column.value] = Math.max(
              ...data[table].map(
                (item: any) => parseFloat(item[column.value]) || 0
              )
            );
          }
        });
      }
    );

    const totalColumns = Object.values(selectedOptions).flat().length;
    const angleStep = (2 * Math.PI) / totalColumns;

    // Prepare bar data
    const barsData: any[] = [];

    (Object.entries(selectedOptions) as [string, any[]][]).forEach(
      ([table, columns], tableIndex) => {
        if (!data[table]) return;

        data[table].forEach((item: any) => {
          if (item.country === "metastat") return;

          const coordinates = getCountryCoordinates(item.country);
          if (!coordinates) return;

          const { latitude, longitude } = coordinates;

          columns.forEach((column, columnIndex) => {
            const value = parseFloat(item[column.value]) || 0;
            const normalizedValue = value / maxValues[column.value];
            const height = normalizedValue * 0.5; // Max height in globe units

            const angle =
              (tableIndex * columns.length + columnIndex) * angleStep;
            const offsetDistance = barSpacing;
            const offsetLon = longitude + Math.cos(angle) * offsetDistance;
            const offsetLat = latitude + Math.sin(angle) * offsetDistance;

            const color = `hsl(${
              ((tableIndex * columns.length + columnIndex) / totalColumns) * 360
            }, 100%, 50%)`;

            barsData.push({
              lat: offsetLat,
              lng: offsetLon,
              height,
              color,
              value,
              name: item.country,
              indicator: column.label,
            });
          });
        });
      }
    );

    // Add bars to globe
    globeRef.current
      .customLayerData(barsData)
      .customThreeObject((d: any) => {
        const geometry = new THREE.BoxGeometry(0.1, 0.1, d.height);
        const material = new THREE.MeshPhongMaterial({ color: d.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = d.height / 2;
        return mesh;
      })
      .customThreeObjectUpdate((obj: THREE.Object3D, d: any) => {
        Object.assign(
          obj.position,
          globeRef.current.getCoords(d.lat, d.lng, d.height / 2)
        );
        obj.lookAt(globeRef.current.getCoords(d.lat, d.lng, 0));
      });

    if (showDataLabels) {
      globeRef.current
        .labelsData(barsData)
        .labelText((d: any) => `${Math.round(d.value)}`)
        .labelSize(dataLabelFontSize)
        .labelDotRadius(0.5)
        .labelColor(() => "#ffffff")
        .labelAltitude((d: any) => d.height + 0.1);
    }
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
        ref={globeContainerRef}
        className="globe-container"
        style={{ width: "100%", height: "100%" }}
      />
      <Legend
        selectedOptions={medeMapState.selectedOptions}
        style={{ position: "absolute", bottom: "210px", right: "180px" }}
      />
      <Box className="globe-bar-spacing-control">
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
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
        <PreviewGlobeModal
          isOpen={isPreviewModalOpen}
          onEnable={() => setIsPreviewModalOpen(false)}
          onDisable={freezeGlobe}
        />
      </div>
    </div>
  );
};

export default GlobeComponent;
