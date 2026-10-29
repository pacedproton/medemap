"use client";

import React, { useEffect, useRef, useState } from "react";

// Globe is dynamically imported in initGlobe to avoid D3.VERTEX conflict
import type { GlobeInstance } from "globe.gl";
import * as THREE from "three";
import "../../styles/globe.css";
import { useAppDispatch, useAppSelector } from "../../lib/hooks";
import {
  selectMedeMapData,
  setSelectedOptions,
} from "../../lib/features/medemap/medeMapSlice";
import { setLoading, selectIsLoading } from "../../lib/loadingSlice";
import Legend from "./Legend3DView";
import Select from "react-select";
import {
  CircularProgress,
  Box,
  Slider,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
} from "@mui/material";
import { useSelector } from "react-redux";
import { fetchGlobeData } from "../../lib/features/globeData/geocordDataSlice";
import { RootState } from "../../lib/store";
import {
  selectShowDataLabels,
  selectDataLabelFontSize,
  setShowDataLabels,
  selectUse3DLogScale,
  setUse3DLogScale,
  selectEmphasisMode,
  setEmphasisMode,
  selectVideoSoundEnabled,
} from "../../lib/features/settings/settingsSlice";
// Draggable removed for React 19 compatibility - using custom SimpleDraggable workaround
import { logger } from "../../lib/logging/logger";

// Simple Draggable Workaround for React 19
const SimpleDraggable = ({
  children,
  handle,
  defaultPos = { x: 0, y: 0 },
  onStop,
  style,
  className,
}: {
  children: React.ReactNode;
  handle?: string;
  defaultPos?: { x: number; y: number };
  onStop?: (pos: { x: number; y: number }) => void;
  style?: React.CSSProperties;
  className?: string;
}) => {
  const [pos, setPos] = useState(defaultPos);
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging || !rel) return;
      const newPos = {
        x: e.clientX - rel.x,
        y: e.clientY - rel.y,
      };
      setPos(newPos);
    };

    const onMouseUp = () => {
      if (dragging) {
        setDragging(false);
        if (onStop) onStop(pos);
      }
    };

    if (dragging) {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, rel, pos, onStop]);

  const onMouseDown = (e: React.MouseEvent) => {
    // Only allow drag from handle if specified
    if (handle) {
      const target = e.target as HTMLElement;
      if (!target.closest(handle)) return;
    }
    
    setDragging(true);
    setRel({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className={className}
      style={{
        ...style,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        cursor: handle ? "auto" : "move",
      }}
    >
      {children}
    </div>
  );
};

// YouTube URL processing utilities
const processVideoUrl = (url: string): { processedUrl: string; needsIframe: boolean } => {
  if (!url) return { processedUrl: url, needsIframe: false };

  // Check if it's a YouTube URL
  const youtubeRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/s]{11})/;
  const match = url.match(youtubeRegex);

  if (match) {
    const videoId = match[1];
    // Return embed URL for iframe usage with controls enabled and no forced muting
    return {
      processedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=1&modestbranding=1&rel=0`,
      needsIframe: true
    };
  }

  // For non-YouTube URLs, return as-is for direct video element usage
  return { processedUrl: url, needsIframe: false };
};

// Helper function to sanitize and correct video URLs
const sanitizeVideoUrl = (url: string): string => {
  if (!url) return url;

  // Handle localhost URLs - replace with relative path for local files
  if (url.includes('localhost:3001/video/') || url.includes('http://localhost:3001/video/')) {
    // Extract the filename and create a relative path
    const filename = url.split('/video/').pop();
    return `/video/${filename}`;
  }

  // Force HTTPS for absolute URLs (except localhost)
  if (url.startsWith('http://') && !url.includes('localhost')) {
    return url.replace('http://', 'https://');
  }

  // If it's already a relative path or HTTPS URL, return as-is
  return url;
};

interface SelectOption {
  value: string;
  label: string;
  tableId: string;
  columnId: string;
}

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
  "Ireland",
  "Italy",
  "Latvia",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
];

const GlobeGL = () => {
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const dispatch = useAppDispatch();
  const medeMapState = useAppSelector(selectMedeMapData);
  const isLoading = useAppSelector(selectIsLoading);
  const showDataLabels = useAppSelector(selectShowDataLabels);
  const dataLabelFontSize = useAppSelector(selectDataLabelFontSize);
  const use3DLogScale = useAppSelector(selectUse3DLogScale);
  const emphasisMode = useAppSelector(selectEmphasisMode);
  const videoSoundEnabled = useAppSelector(selectVideoSoundEnabled);
  const geocoordinates =
    useSelector((state: RootState) => state.globeData.data) || [];
  const loading =
    useSelector((state: RootState) => state.globeData.loading) || false;
  const error =
    useSelector((state: RootState) => state.globeData.error) || null;
  const [barSpacing, setBarSpacing] = useState<number>(0.4);
  const [barScale, setBarScale] = useState<number>(10.0);
  const [labelPosition, setLabelPosition] = useState<number>(1.0);
  const [labelSize, setLabelSize] = useState<number>(1.0);
  const [globeReady, setGlobeReady] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [colorPalette, setColorPalette] = useState<string>("default");
  const [spectrumStart, setSpectrumStart] = useState<number>(60); // Start from dark yellow
  const [spectrumEnd, setSpectrumEnd] = useState<number>(240); // End at blue
  const [numericLabelsOnly, setNumericLabelsOnly] = useState<boolean>(false);
  const [perCountrySelections, setPerCountrySelections] = useState<{
    [country: string]: { tableId: string; columnId: string }[];
  }>({});
  const [showCountrySelector, setShowCountrySelector] = useState(true);
  const [emphasisWarning, setEmphasisWarning] = useState<string | null>(null);
  const [emphasisWarningOpen, setEmphasisWarningOpen] = useState(false);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const videoAnimationFrameRef = useRef<number | null>(null);
  const [showVideoOverlay, setShowVideoOverlay] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoOpacity, setVideoOpacity] = useState<number>(0.8);
  const [videoOverlayWidth, setVideoOverlayWidth] = useState<number>(480);
  const [videoOverlayPosition, setVideoOverlayPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 20, y: 380 });
  const [videoPlacementMode, setVideoPlacementMode] =
    useState<string>("overlayCanvas");
  const [videoCountryA, setVideoCountryA] = useState<string>("Germany");
  const [videoCountryB, setVideoCountryB] = useState<string>("France");
  const [videoBillboardWidth, setVideoBillboardWidth] = useState<number>(1.0);
  const [videoHaloInner, setVideoHaloInner] = useState<number>(0.12);
  const [videoHaloOuter, setVideoHaloOuter] = useState<number>(0.17);
  const threeVideoElRef = useRef<HTMLVideoElement | null>(null);
  const threeVideoTextureRef = useRef<THREE.VideoTexture | null>(null);
  const threeObjectsRef = useRef<THREE.Object3D[]>([]);
  const tooltipVideoElRef = useRef<HTMLVideoElement | null>(null);
  const threeAnimationFrameRef = useRef<number | null>(null);
  const threeVideoLayerRef = useRef<THREE.Group | null>(null);
  const [videoCurvedPatchDegrees, setVideoCurvedPatchDegrees] =
    useState<number>(12);
  const [billboardRotationX, setBillboardRotationX] = useState<number>(0);
  const [billboardRotationY, setBillboardRotationY] = useState<number>(0);
  const [billboardRotationZ, setBillboardRotationZ] = useState<number>(0);
  const [dataBillboards, setDataBillboards] = useState<boolean>(false);

  useEffect(() => {
    logger.info("Initializing Globe...", { component: "GlobeGL" });
    dispatch(setLoading(true));
    setOverallProgress(0);
    if (globeContainerRef.current && !globeRef.current) {
      initGlobe();
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchGlobeData());
  }, [dispatch]);

  const initGlobe = async () => {
    setOverallProgress(5);
    if (globeContainerRef.current && !globeRef.current) {
      try {
        setOverallProgress(10);

        // Dynamically import globe.gl to avoid D3.VERTEX conflict
        const { default: Globe } = await import('globe.gl');

        // Initialize Globe.gl with additional settings
        const world = new Globe(globeContainerRef.current)
          .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
          .bumpImageUrl(
            "//unpkg.com/three-globe/example/img/earth-topology.png"
          )
          .backgroundImageUrl(
            "//unpkg.com/three-globe/example/img/night-sky.png"
          )
          .width(globeContainerRef.current.clientWidth)
          .height(globeContainerRef.current.clientHeight)
          .polygonsData([])
          .polygonAltitude(0.01)
          .polygonCapColor(() => "rgba(200, 200, 200, 0.3)")
          .polygonSideColor(() => "rgba(150, 150, 150, 0.4)")
          .polygonStrokeColor(() => "#ffffff")
          .customThreeObject((d: any) => {
            if (!d) return null;

            // Handle regular country bars
            const geometry = new THREE.CylinderGeometry(
              barSpacing / 2,
              barSpacing / 2,
              1,
              16
            );
            // Create enhanced materials for benchmark countries
            let material;
            if (d.isBenchmark === "top") {
              // Top performers: Gold with enhanced properties
              material = new THREE.MeshPhongMaterial({
                color: new THREE.Color("#ffd700"),
                transparent: true,
                opacity: 0.9,
                emissive: new THREE.Color("#ffaa00"),
                emissiveIntensity: 0.5,
                shininess: 100,
              });
            } else if (d.isBenchmark === "bottom") {
              // Bottom performers: Red with warning appearance
              material = new THREE.MeshPhongMaterial({
                color: new THREE.Color("#ff4444"),
                transparent: true,
                opacity: 0.7,
                emissive: new THREE.Color("#cc0000"),
                emissiveIntensity: 0.4,
              });
            } else {
              // Regular countries: Standard appearance
              material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(d.color),
                transparent: true,
                opacity: 0.8,
                emissive: new THREE.Color(d.color),
                emissiveIntensity: 0.3,
              });
            }
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.y = d.height * 20 * barScale;
            return mesh;
          })
          .customThreeObjectUpdate((obj: any, d: any) => {
            if (!obj || !d) return;
            const pos = world.getCoords(d.lat, d.lng, 0);
            obj.position.x = pos.x;
            obj.position.y = pos.y;
            obj.position.z = pos.z;

            // Handle regular country bars
            if (!d.currentScale) {
              obj.scale.y = d.height * 20 * barScale;
            }
            obj.lookAt(0, 0, 0);
            obj.rotateX(Math.PI / 2);
          });

        // Enable auto-rotation
        world.controls().autoRotate = true;
        world.controls().autoRotateSpeed = 0.3;

        // Set initial camera position for better view of Europe
        world.pointOfView({ lat: 50, lng: 10, altitude: 2.5 });

        globeRef.current = world;

        setOverallProgress(30);
        await loadGeoJson();
        setOverallProgress(95);

        // Wait for globe to be ready
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setGlobeReady(true);
        setOverallProgress(100);
        setInitializationComplete(true);
        dispatch(setLoading(false));
      } catch (error) {
        logger.error("Failed to initialize Globe", { component: "GlobeGL", error });
        setInitializationComplete(true);
        dispatch(setLoading(false));
      }
    }
  };

  const loadGeoJson = async () => {
    try {
      setOverallProgress(45);
      const response = await fetch("/geojson/countries.geo.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
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
        globeRef.current.polygonsData(europeanFeatures);
      }

      setOverallProgress(65);
    } catch (error) {
      logger.error("Failed to load GeoJSON", { component: "GlobeGL", error });
      setInitializationComplete(true);
      dispatch(setLoading(false));
    }
  };

  useEffect(() => {
    return () => {
      if (globeRef.current) {
        // Clean up Globe.gl instance
        globeRef.current._destructor();
      }
      // Stop video drawing and cleanup
      if (videoAnimationFrameRef.current) {
        cancelAnimationFrame(videoAnimationFrameRef.current);
        videoAnimationFrameRef.current = null;
      }
      if (videoElementRef.current) {
        try {
          videoElementRef.current.pause();
          videoElementRef.current.src = "";
          videoElementRef.current.load();
        } catch (_) {
          /* noop */
        }
        videoElementRef.current = null;
      }
    };
  }, []);

  // Handle creating/tearing down the off-DOM video element and draw loop (overlayCanvas mode)
  useEffect(() => {
    const stop = () => {
      if (videoAnimationFrameRef.current) {
        cancelAnimationFrame(videoAnimationFrameRef.current);
        videoAnimationFrameRef.current = null;
      }
      if (videoElementRef.current) {
        try {
          videoElementRef.current.pause();
          videoElementRef.current.src = "";
          videoElementRef.current.load();
        } catch (_) {
          /* noop */
        }
        videoElementRef.current = null;
      }
    };

    if (
      !showVideoOverlay ||
      !videoUrl ||
      videoPlacementMode !== "overlayCanvas"
    ) {
      stop();
      return;
    }

    // Check if this is a YouTube URL - if so, skip video element creation as we use iframe
    const { needsIframe } = processVideoUrl(videoUrl);
    if (needsIframe) {
      stop();
      return;
    }

    const sanitizedUrl = sanitizeVideoUrl(videoUrl);
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.autoplay = true;
    video.muted = !videoSoundEnabled;
    video.loop = true;
    (video as any).playsInline = true;
    video.src = sanitizedUrl;
    videoElementRef.current = video;

    const drawFrame = () => {
      const canvas = videoCanvasRef.current;
      const v = videoElementRef.current;
      if (!canvas || !v) {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      const dpr = window.devicePixelRatio || 1;
      const width = videoOverlayWidth;
      const height = Math.round((videoOverlayWidth * 9) / 16);
      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      // Clear and draw
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      try {
        ctx.drawImage(v, 0, 0, width, height);
      } catch (_) {
        // ignore draw errors while loading
      }
      videoAnimationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    const onPlay = () => {
      if (videoAnimationFrameRef.current) {
        cancelAnimationFrame(videoAnimationFrameRef.current);
        videoAnimationFrameRef.current = null;
      }
      videoAnimationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("loadeddata", () => {
      // kick off draw loop if autoplay didn't trigger immediately
      onPlay();
    });

    // Attempt to play; ignore failures (e.g., autoplay policies) since we mute
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("play", onPlay);
      stop();
    };
  }, [showVideoOverlay, videoUrl, videoOverlayWidth, videoPlacementMode, videoSoundEnabled]);

  // Helper to create a VideoTexture for 3D modes
  // Shared video element and texture cache
  const videoTextureCache = useRef<Map<string, { video: HTMLVideoElement; texture: THREE.VideoTexture }>>(new Map());

  const createThreeVideoTexture = (
    url: string
  ): Promise<THREE.VideoTexture> => {
    return new Promise((resolve, reject) => {
      const sanitizedUrl = sanitizeVideoUrl(url);
      logger.info("[VideoTexture] Creating texture for URL", { component: "GlobeGL", sanitizedUrl });

      // Check if we already have this video texture cached
      const cached = videoTextureCache.current.get(sanitizedUrl);
      if (cached && cached.video.readyState >= cached.video.HAVE_CURRENT_DATA) {
        logger.info("[VideoTexture] Using cached texture", { component: "GlobeGL" });
        resolve(cached.texture);
        return;
      }

      const el = document.createElement("video");
      el.crossOrigin = "anonymous";
      el.autoplay = true;
      el.muted = !videoSoundEnabled;
      el.loop = true;
      (el as any).playsInline = true;

      // Add error handler
      el.addEventListener("error", (e) => {
        logger.error("Video texture load failed", { component: "GlobeGL", error: e });
        reject(new Error(`Failed to load video: ${sanitizedUrl}`));
      });

      el.src = sanitizedUrl;

      // Wait for video to be ready before creating texture
      el.addEventListener(
        "loadeddata",
        () => {
          logger.info("[VideoTexture] Video loaded successfully", { component: "GlobeGL", readyState: el.readyState });

          // Ensure video is truly ready
          if (el.readyState < el.HAVE_CURRENT_DATA) {
            logger.info("[VideoTexture] Video not ready yet, waiting...", { component: "GlobeGL" });
            setTimeout(() => resolve(createTextureFromVideo(el)), 100);
            return;
          }

          resolve(createTextureFromVideo(el));
        },
        { once: true }
      );

      const createTextureFromVideo = (videoEl: HTMLVideoElement) => {
        const tex = new THREE.VideoTexture(videoEl);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.format = THREE.RGBAFormat;

        // Cache the texture for reuse
        videoTextureCache.current.set(sanitizedUrl, { video: videoEl, texture: tex });

        // Start animation loop™™
        const animate = () => {
          if (videoEl.readyState >= videoEl.HAVE_CURRENT_DATA) {
            tex.needsUpdate = true;
          }
          threeAnimationFrameRef.current = requestAnimationFrame(animate);
        };
        animate();

        threeVideoElRef.current = videoEl;
        threeVideoTextureRef.current = tex;
        return tex;
      };

      el.play().catch(() => {});
    });
  };

  // Cleanup helper for 3D video objects
  const cleanupThreeVideoObjects = () => {
    // remove objects from scene
    if (
      globeRef.current &&
      globeRef.current._scene &&
      threeObjectsRef.current.length > 0
    ) {
      threeObjectsRef.current.forEach((obj) =>
        globeRef.current._scene.remove(obj)
      );
    }

    // Clean up video texture cache
    videoTextureCache.current.forEach(({ video, texture }) => {
      video.pause();
      video.src = '';
      texture.dispose();
    });
    videoTextureCache.current.clear();

    // Note: elegantMulti mode now uses direct scene manipulation via threeVideoLayerRef
    // remove and dispose video layer group
    if (
      globeRef.current &&
      globeRef.current._scene &&
      threeVideoLayerRef.current
    ) {
      globeRef.current._scene.remove(threeVideoLayerRef.current);
      threeVideoLayerRef.current.children.forEach((child: any) => {
        if (child.material && child.material.map) {
          try {
            child.material.map.dispose();
          } catch (_) {
            /* noop */
          }
        }
        if (child.material) {
          try {
            child.material.dispose();
          } catch (_) {
            /* noop */
          }
        }
        if (child.geometry) {
          try {
            child.geometry.dispose();
          } catch (_) {
            /* noop */
          }
        }
      });
      threeVideoLayerRef.current = null;
    }
    threeObjectsRef.current = [];
    if (threeAnimationFrameRef.current) {
      cancelAnimationFrame(threeAnimationFrameRef.current);
      threeAnimationFrameRef.current = null;
    }
    // pause and clear video element
    if (threeVideoElRef.current) {
      try {
        threeVideoElRef.current.pause();
        threeVideoElRef.current.src = "";
        threeVideoElRef.current.load();
      } catch (_) {
        /* noop */
      }
      threeVideoElRef.current = null;
    }
    // dispose texture
    if (threeVideoTextureRef.current) {
      try {
        threeVideoTextureRef.current.dispose();
      } catch (_) {
        /* noop */
      }
      threeVideoTextureRef.current = null;
    }
    // reset background and globe visibility if skybox was used
    if (globeRef.current) {
      try {
        const scene = globeRef.current.scene();
        if (scene && scene.background instanceof THREE.Texture) {
          scene.background = null;

          // Restore globe material and visibility
          const globeMesh = scene.children.find(
            (child: THREE.Object3D) =>
              child.type === "Mesh" && (child as THREE.Mesh).geometry?.type === "SphereGeometry"
          ) as THREE.Mesh | undefined;
          if (globeMesh && (globeMesh as any).originalMaterial) {
            globeMesh.material = (globeMesh as any).originalMaterial;
            delete (globeMesh as any).originalMaterial;
          }
          globeRef.current.showGlobe(true);
          logger.info("Restored globe material and cleared background", { component: "GlobeGL" });
        }
      } catch (e) {
        /* noop */
      }
    }
  };

  // Implement 3D placement modes using Globe.gl's native object layers
  useEffect(() => {
    logger.info("[Video Effect] Triggered with:", {
      showVideoOverlay,
      videoUrl: videoUrl || "(empty)",
      videoPlacementMode,
      globeReady: !!globeRef.current
    });

    cleanupThreeVideoObjects();
    if (!showVideoOverlay || !videoUrl) {
      logger.info("[Video Effect] Skipping - overlay not enabled or no URL", { component: "GlobeGL" });
      return;
    }
    if (!globeRef.current) {
      logger.info("[Video Effect] Skipping - globe not ready", { component: "GlobeGL" });
      return;
    }
    if (
      [
        "overlayCanvas",
        "hud",
        "tooltip",
        "timeline",
        "pip",
        "contextualOverlay",
        "dataTooltip",
      ].includes(videoPlacementMode)
    ) {
      // handled elsewhere
      return;
    }

    // Use Globe.gl's native object layers instead of manual THREE scene manipulation
    // Debug: check what methods are available on globe instance
    logger.info("Globe methods debug", {
      component: "GlobeGL",
      methods: Object.getOwnPropertyNames(globeRef.current)
    });
    logger.info("Available background setter debug", {
      component: "GlobeGL",
      sceneType: typeof globeRef.current.scene
    });

    const sanitizedUrl = sanitizeVideoUrl(videoUrl);
    logger.info("[Video Mode] Video placement mode set", { component: "GlobeGL", videoPlacementMode, sanitizedUrl });

    // Create video texture asynchronously to avoid WebGL errors
    createThreeVideoTexture(sanitizedUrl)
      .then((tex) => {
        if (
          videoPlacementMode === "skybox" ||
          videoPlacementMode === "ambientSkybox"
        ) {
          // Background approach with better video texture handling
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.flipY = false; // Important for video textures
          tex.colorSpace = THREE.SRGBColorSpace; // Ensure proper color space

          try {
            const scene = globeRef.current.scene();

            if (videoPlacementMode === "ambientSkybox") {
              // Ambient mode: Keep globe visible but add subtle video background
              const globeMesh = scene.children.find(
                (child: THREE.Object3D) =>
                  child.type === "Mesh" &&
                  (child as THREE.Mesh).geometry?.type === "SphereGeometry"
              ) as THREE.Mesh | undefined;
              if (globeMesh && globeMesh.material) {
                if (!(globeMesh as any).originalMaterial) {
                  (globeMesh as any).originalMaterial = Array.isArray(globeMesh.material)
                    ? globeMesh.material.map(m => m.clone())
                    : globeMesh.material.clone();
                }
                // Make globe semi-transparent for ambient effect
                if (Array.isArray(globeMesh.material)) {
                  globeMesh.material.forEach(m => {
                    (m as any).transparent = true;
                    (m as any).opacity = 0.7;
                  });
                } else {
                  (globeMesh.material as any).transparent = true;
                  (globeMesh.material as any).opacity = 0.7;
                }
                logger.info("[Ambient Skybox] Made globe semi-transparent", { component: "GlobeGL" });
              }
              // Set background at lower opacity for ambient effect
              scene.background = tex;
              logger.info("[Ambient Skybox] Subtle video background set", { component: "GlobeGL" });
            } else {
              // Full skybox mode: Make globe transparent to reveal video
              try {
                const globeMesh = scene.children.find(
                  (child: THREE.Object3D) =>
                    child.type === "Mesh" &&
                    (child as THREE.Mesh).geometry?.type === "SphereGeometry"
                ) as THREE.Mesh | undefined;
                if (globeMesh && globeMesh.material) {
                  if (!(globeMesh as any).originalMaterial) {
                    (globeMesh as any).originalMaterial = Array.isArray(globeMesh.material)
                      ? globeMesh.material.map(m => m.clone())
                      : globeMesh.material.clone();
                  }
                  if (Array.isArray(globeMesh.material)) {
                    globeMesh.material.forEach(m => {
                      (m as any).transparent = true;
                      (m as any).opacity = 0.1;
                    });
                  } else {
                    (globeMesh.material as any).transparent = true;
                    (globeMesh.material as any).opacity = 0.1;
                  }
                  logger.info("[Skybox] Made globe transparent", { component: "GlobeGL" });
                }
              } catch (materialError) {
                logger.info("Could not modify globe material", {
                  component: "GlobeGL",
                  error: materialError
                });
                globeRef.current.showGlobe(false);
              }
              globeRef.current.showAtmosphere(true);
              scene.background = tex;
            }

            logger.info("[Skybox] Set video background with improved settings", { component: "GlobeGL" });
            logger.info("[Skybox] Video texture mapping", { component: "GlobeGL", textureMapping: tex.mapping });
            logger.info("Video ready state", {
              component: "GlobeGL",
              readyState: threeVideoElRef.current?.readyState
            });

            // Alternative approach: Also try setting globe background image URL
            try {
              // First try direct scene background (primary approach)
              scene.background = tex;

              // Backup: Also try globe's background methods if available
              if (globeRef.current.globeImageUrl) {
                // Store original for restoration later
                const originalBg = globeRef.current.globeImageUrl();
                logger.info("[Skybox] Original globe background", { component: "GlobeGL", originalBg });
              }

              logger.info("[Skybox] Final background set", {
                component: "GlobeGL",
                isVideoTexture: scene.background instanceof THREE.VideoTexture
              });
            } catch (altError) {
              logger.info("[Skybox] Alternative approach failed", { component: "GlobeGL", altError });
            }
          } catch (e) {
            logger.error("Skybox creation failed", { component: "GlobeGL", error: e });
            logger.info("[Skybox] Scene available", { component: "GlobeGL", sceneAvailable: !!globeRef.current?.scene });
            logger.info("[Skybox] Video texture", { component: "GlobeGL", textureAvailable: !!tex });
          }
        } else if (videoPlacementMode === "curvedPatch") {
          // Follow the exact working pattern from the forum
          const coords = getCountryCoordinates(videoCountryA);
          if (coords) {
            const testSphere = {
              lat: coords.latitude,
              lng: coords.longitude,
              avatarUrl: videoUrl, // Following their sprite pattern
            };

            // Use customLayerData like the working example
            globeRef.current.customLayerData([testSphere]);

            // Store current customThreeObject function to avoid conflicts
            const currentCustomThreeObject =
              globeRef.current.customThreeObject();

            globeRef.current
              .customThreeObject((d: any) => {
                logger.info("[Curved Patch] Creating object", { component: "GlobeGL", data: d });

                // Create larger video-textured sphere for better visibility
                const patchSize = videoCurvedPatchDegrees; // Use the slider value
                const geom = new THREE.SphereGeometry(patchSize, 32, 32);
                const mat = new THREE.MeshBasicMaterial({
                  map: tex, // Use the already-loaded texture from Promise
                  transparent: true,
                  opacity: videoOpacity,
                  side: THREE.DoubleSide, // Show video on both sides
                });
                const mesh = new THREE.Mesh(geom, mat);

                logger.info("[Curved Patch] Created video sphere mesh with size", {
                  component: "GlobeGL",
                  patchSize
                });
                return mesh;
              })
              .customThreeObjectUpdate((obj: any, d: any) => {
                // CRITICAL: Position the object correctly on the globe
                const coords = globeRef.current.getCoords(d.lat, d.lng, 0.01);
                if (coords) {
                  Object.assign(obj.position, coords);
                  logger.info(
                    "[Curved Patch] Positioned sphere at:",
                    obj.position
                  );
                }
              });

            logger.info(
              "[Curved Patch] Set customLayerData with test sphere at",
              coords
            );
          }
        } else if (videoPlacementMode === "billboard") {
          logger.info("[Billboard] Starting billboard mode", { component: "GlobeGL" });
          logger.info("[Billboard] Video texture", { component: "GlobeGL", textureAvailable: !!tex });
          logger.info("[Billboard] Data billboards enabled", { component: "GlobeGL", dataBillboards });

          if (dataBillboards) {
            // Data-proportional billboards for all countries with data
            const currentData = globeRef.current.customLayerData() || [];
            logger.info("[Billboard] Current layer data", { component: "GlobeGL", layerDataCount: currentData.length });

            const countryBillboards = currentData
              .filter((d: any) => d.lat && d.lng && d.value) // Only countries with data
              .map((d: any) => ({
                lat: d.lat,
                lng: d.lng,
                avatarUrl: sanitizedUrl,
                dataValue: d.value, // Store data value for proportional sizing
                originalData: d, // Keep original bar data
              }));

            logger.info("[Billboard] Filtered billboards", { component: "GlobeGL", billboardCount: countryBillboards.length });

            if (countryBillboards.length > 0) {
              logger.info("[Billboard] Setting data billboards using objectsData", { component: "GlobeGL", countryBillboards });
              globeRef.current.objectsData(countryBillboards);

              globeRef.current.objectThreeObject((d: any) => {
                if (!d.avatarUrl) {
                  logger.info("[Billboard] Data mode: No avatarUrl in object data", { component: "GlobeGL" });
                  return null;
                }

                // Size proportional to data value
                const baseSize = videoBillboardWidth;
                const normalizedSize = Math.max(
                  0.2,
                  Math.min(2.0, d.dataValue || 1.0)
                );
                const finalSize = baseSize * normalizedSize;

                const geom = new THREE.PlaneGeometry(
                  finalSize,
                  (finalSize * 9) / 16
                );
                const mat = new THREE.MeshBasicMaterial({
                  map: tex,
                  transparent: true,
                  opacity: videoOpacity,
                  side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geom, mat);

                mesh.rotation.x = (billboardRotationX * Math.PI) / 180;
                mesh.rotation.y = (billboardRotationY * Math.PI) / 180;
                mesh.rotation.z = (billboardRotationZ * Math.PI) / 180;

                return mesh;
              });

              // Set up position for objects
              globeRef.current.objectLat((d: any) => d.lat);
              globeRef.current.objectLng((d: any) => d.lng);
              globeRef.current.objectAltitude(0.05);

              logger.info(
                `[Billboard] Created ${countryBillboards.length} data-proportional billboards`
              );
            }
          } else {
            // Single billboard mode
            logger.info("[Billboard] Single billboard mode for country", { component: "GlobeGL", videoCountryA });
            const country = getCountryCoordinates(videoCountryA);
            logger.info("[Billboard] Country coordinates", { component: "GlobeGL", country });

            if (country) {
              const sprite = {
                lat: country.latitude,
                lng: country.longitude,
                avatarUrl: sanitizedUrl,
              };

              logger.info("[Billboard] Setting single sprite using objectsData", { component: "GlobeGL", sprite });
              globeRef.current.objectsData([sprite]);

              globeRef.current.objectThreeObject((d: any) => {
                logger.info("[Billboard] Single objectThreeObject called", { component: "GlobeGL", data: d });

                if (!d.avatarUrl) {
                  logger.info("[Billboard] No avatarUrl in object data", { component: "GlobeGL" });
                  return null;
                }

                const geom = new THREE.PlaneGeometry(
                  videoBillboardWidth,
                  (videoBillboardWidth * 9) / 16
                );
                const mat = new THREE.MeshBasicMaterial({
                  map: tex,
                  transparent: true,
                  opacity: videoOpacity,
                  side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geom, mat);

                mesh.rotation.x = (billboardRotationX * Math.PI) / 180;
                mesh.rotation.y = (billboardRotationY * Math.PI) / 180;
                mesh.rotation.z = (billboardRotationZ * Math.PI) / 180;

                logger.info("[Billboard] Single billboard mesh created with texture", { component: "GlobeGL", hasTexture: !!mat.map });
                return mesh;
              });

              // Set up position and update for objects
              globeRef.current.objectLat((d: any) => d.lat);
              globeRef.current.objectLng((d: any) => d.lng);
              globeRef.current.objectAltitude(0.02);

              logger.info("[Billboard] Single billboard at", { component: "GlobeGL", country });
            }
          }
        } else if (videoPlacementMode === "elegantMulti") {
          // Elegant Multi-Video: Use direct scene manipulation
          logger.info("[Elegant Multi] Starting elegant multi-video mode", { component: "GlobeGL" });
          logger.info("[Elegant Multi] Video texture available", { component: "GlobeGL", textureAvailable: !!tex });
          logger.info("[Elegant Multi] Video URL", { component: "GlobeGL", videoUrl });

          // Get the actual bar data from customLayerData to read current data values
          const barData = globeRef.current.customLayerData() || [];
          logger.info("[Elegant Multi] Available bar data", { component: "GlobeGL", barDataCount: barData.length });

          // Debug first few items to understand structure
          if (barData.length > 0) {
            logger.info("[Elegant Multi] Sample data item", { component: "GlobeGL", sampleData: barData[0] });
            logger.info(
              "[Elegant Multi] Sample data keys:",
              Object.keys(barData[0])
            );
          }

          // Filter and process data for video billboards
          const videoCountries = barData
            .filter((d: any) => {
              // Check if this data point has coordinates and a height value (representing data)
              const hasCoords = d.lat !== undefined && d.lng !== undefined;
              const hasValue = d.height !== undefined && d.height > 0; // 'height' is the correct property
              return hasCoords && hasValue;
            })
            .sort((a: any, b: any) => (b.height || 0) - (a.height || 0)) // Sort by height (data value)
            .slice(0, 8) // Limit to top 8 for visual clarity
            .map((d: any, index: number) => {
              const normalizedValue = Math.max(0, Math.min(1, d.height || 0)); // Normalize height to 0-1
              return {
                lat: d.lat,
                lng: d.lng,
                dataValue: d.height || 0,
                elegantSize: Math.max(
                  0.4,
                  Math.min(1.5, 0.5 + normalizedValue * 0.8)
                ), // Elegant size scaling
                elegantOpacity: Math.max(
                  0.4,
                  Math.min(0.8, 0.4 + normalizedValue * 0.4)
                ), // Opacity based on data
                isTopTier: index < 3, // Mark top 3 for special styling
              };
            });

          logger.info(
            "[Elegant Multi] Filtered video countries:",
            videoCountries.length
          );

          // Fallback: If no data available, create test billboards at known locations
          let finalVideoCountries = videoCountries;
          if (videoCountries.length === 0) {
            logger.info(
              "[Elegant Multi] No bar data found, using fallback locations"
            );
            finalVideoCountries = [
              {
                lat: 52.52,
                lng: 13.405,
                dataValue: 0.8,
                elegantSize: 1.2,
                elegantOpacity: 0.8,
                isTopTier: true,
              }, // Berlin
              {
                lat: 48.8566,
                lng: 2.3522,
                dataValue: 0.7,
                elegantSize: 1.0,
                elegantOpacity: 0.7,
                isTopTier: true,
              }, // Paris
              {
                lat: 51.5074,
                lng: -0.1278,
                dataValue: 0.6,
                elegantSize: 0.9,
                elegantOpacity: 0.6,
                isTopTier: true,
              }, // London
              {
                lat: 41.9028,
                lng: 12.4964,
                dataValue: 0.5,
                elegantSize: 0.8,
                elegantOpacity: 0.5,
                isTopTier: false,
              }, // Rome
              {
                lat: 40.4168,
                lng: -3.7038,
                dataValue: 0.4,
                elegantSize: 0.7,
                elegantOpacity: 0.4,
                isTopTier: false,
              }, // Madrid
            ];
          }

          if (finalVideoCountries.length > 0) {
            logger.info(
              "[Elegant Multi] Using countries:",
              finalVideoCountries.map((d: any) => ({
                lat: d.lat,
                lng: d.lng,
                height: d.dataValue,
              }))
            );
            // Create video billboards and add directly to threeVideoLayerRef to avoid conflicts
            if (!threeVideoLayerRef.current) {
              threeVideoLayerRef.current = new THREE.Group();
              globeRef.current.scene().add(threeVideoLayerRef.current);
              logger.info("[Elegant Multi] Created and added video layer group to scene", { component: "GlobeGL" });
            }

            finalVideoCountries.forEach((d: any) => {
              // Elegant sizing - tasteful proportions
              const finalSize = videoBillboardWidth * d.elegantSize;

              const geom = new THREE.PlaneGeometry(
                finalSize,
                (finalSize * 9) / 16
              );

              // Use MeshLambertMaterial for emissive properties support
              const material = new THREE.MeshLambertMaterial({
                map: tex,
                transparent: true,
                opacity: d.elegantOpacity,
                side: THREE.DoubleSide,
              });

              // Subtle glow for top-tier countries
              if (d.isTopTier) {
                material.emissive = new THREE.Color(0x002244); // Subtle blue glow
                material.emissiveIntensity = 0.2;
              }

              const mesh = new THREE.Mesh(geom, material);

              // Elegant rotation with subtle variation
              mesh.rotation.x = (billboardRotationX * Math.PI) / 180;
              mesh.rotation.y =
                (billboardRotationY * Math.PI) / 180 +
                (Math.random() - 0.5) * 0.2;
              mesh.rotation.z = (billboardRotationZ * Math.PI) / 180;

              // Position the billboard
              const altitude = d.isTopTier ? 0.06 : 0.03;
              const coords = globeRef.current.getCoords(d.lat, d.lng, altitude);
              if (coords) {
                mesh.position.set(coords.x, coords.y, coords.z);
                // Camera facing for better readability
                mesh.lookAt(globeRef.current.camera().position);
              }

              // Add to our video layer group
              threeVideoLayerRef.current.add(mesh);
              threeObjectsRef.current.push(mesh);
            });

            logger.info(
              `[Elegant Multi] Created ${finalVideoCountries.length} elegant video billboards using direct scene manipulation`
            );
          }
        } else if (videoPlacementMode === "halo") {
          // Use customLayerData for halo
          const coords = getCountryCoordinates(videoCountryA);
          if (coords) {
            const haloData = {
              lat: coords.latitude,
              lng: coords.longitude,
              avatarUrl: videoUrl,
              type: "halo",
            };

            globeRef.current.customLayerData([haloData]);

            globeRef.current
              .customThreeObject((d: any) => {
                const geom = new THREE.RingGeometry(
                  videoHaloInner,
                  videoHaloOuter,
                  32
                );
                const mat = new THREE.MeshBasicMaterial({
                  map: tex, // Use the already-loaded texture
                  transparent: true,
                  side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geom, mat);
                // Rotate to lay flat on globe surface
                mesh.rotation.x = -Math.PI / 2;
                logger.info("[Halo] Created video halo", { component: "GlobeGL" });
                return mesh;
              })
              .customThreeObjectUpdate((obj: any, d: any) => {
                const coords = globeRef.current.getCoords(d.lat, d.lng, 0.01);
                if (coords) {
                  Object.assign(obj.position, coords);
                }
              });

            logger.info("[Halo] Added via customLayerData at", { component: "GlobeGL", coords });
          }
        } else if (videoPlacementMode === "ribbon") {
          // Ribbon mode: Create a curved ribbon connecting two countries
          const coordsA = getCountryCoordinates(videoCountryA);
          const coordsB = getCountryCoordinates(videoCountryB);

          if (coordsA && coordsB) {
            const ribbonData = [];
            const steps = 20;

            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              const lat = coordsA.latitude + t * (coordsB.latitude - coordsA.latitude);
              const lng = coordsA.longitude + t * (coordsB.longitude - coordsB.longitude);
              const altitude = 0.02 + Math.sin(t * Math.PI) * 0.03;

              ribbonData.push({
                lat: lat,
                lng: lng,
                altitude: altitude,
                size: 0.8
              });
            }

            globeRef.current.objectsData(ribbonData);
            globeRef.current.objectThreeObject(() => {
              const geometry = new THREE.PlaneGeometry(1, 0.3);
              const material = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                side: THREE.DoubleSide
              });
              return new THREE.Mesh(geometry, material);
            });

            logger.info("[Ribbon] Created video ribbon between countries", { component: "GlobeGL" });
          }
        } else if (videoPlacementMode === "region") {
          // Region mode: Display video over a specific geographic region
          const coords = getCountryCoordinates(videoCountryA);
          if (coords) {
            const regionData = [{
              lat: coords.latitude,
              lng: coords.longitude,
              altitude: 0.01,
              size: 2.0
            }];

            globeRef.current.objectsData(regionData);
            globeRef.current.objectThreeObject(() => {
              const geometry = new THREE.PlaneGeometry(2, 1.5);
              const material = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.9
              });
              return new THREE.Mesh(geometry, material);
            });

            logger.info("[Region] Displaying video over region", { component: "GlobeGL" });
          }
        } else if (videoPlacementMode === "timeline") {
          // Timeline mode: Create temporal video display
          const coords = getCountryCoordinates(videoCountryA);
          if (coords) {
            const timelineData = [];
            const segments = 5;

            for (let i = 0; i < segments; i++) {
              timelineData.push({
                lat: coords.latitude,
                lng: coords.longitude + (i - 2) * 0.5,
                altitude: 0.02 + i * 0.01,
                segment: i
              });
            }

            globeRef.current.objectsData(timelineData);
            globeRef.current.objectThreeObject((d: any) => {
              const geometry = new THREE.PlaneGeometry(0.8, 0.6);
              const material = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.8 - d.segment * 0.15
              });
              const mesh = new THREE.Mesh(geometry, material);
              mesh.position.setY(d.segment * 0.3);
              return mesh;
            });

            logger.info("[Timeline] Created video timeline display", { component: "GlobeGL" });
          }
        } else if (videoPlacementMode === "contextualOverlay") {
          // Contextual overlay: Video appears when hovering over data points
          if (globeRef.current.pointsData().length > 0) {
            const overlayData = [{
              lat: 40, // Default position
              lng: 0,
              altitude: 0.05,
              contextual: true
            }];

            globeRef.current.objectsData(overlayData);
            globeRef.current.objectThreeObject(() => {
              const geometry = new THREE.PlaneGeometry(1.5, 1);
              const material = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.9
              });
              return new THREE.Mesh(geometry, material);
            });

            logger.info("[ContextualOverlay] Created contextual video overlay", { component: "GlobeGL" });
          }
        } else if (videoPlacementMode === "dataTooltip") {
          // Data tooltip: Video integrated with data point tooltips
          const existingPoints = globeRef.current.pointsData();
          if (existingPoints.length > 0) {
            // Use existing points but add video tooltip capability
            const tooltipData = existingPoints.slice(0, 3).map((point: any, index: number) => ({
              lat: point.lat,
              lng: point.lng,
              altitude: 0.03,
              originalPoint: point,
              tooltipIndex: index
            }));

            globeRef.current.objectsData(tooltipData);
            globeRef.current.objectThreeObject((d: any) => {
              const geometry = new THREE.PlaneGeometry(1, 0.7);
              const material = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                opacity: 0.85
              });
              const mesh = new THREE.Mesh(geometry, material);
              mesh.lookAt(0, 0, 0); // Face towards center
              return mesh;
            });

            logger.info("[DataTooltip] Created video tooltips for data points", { component: "GlobeGL" });
          }
        } else {
          // Clear both objects and points
          try {
            globeRef.current.objectsData([]);
          } catch (e) {
            /* noop */
          }
          globeRef.current.pointsData([]);

          // Clear custom layer data for video modes
          try {
            globeRef.current.customLayerData([]);
          } catch (e) {
            /* noop */
          }
        }
      })
      .catch((error) => {
        logger.error("Failed to create video texture", { component: "GlobeGL", error });
        logger.info("[Video Mode] Video URL attempted", { component: "GlobeGL", sanitizedUrl });
        logger.info("[Video Mode] Placement mode", { component: "GlobeGL", videoPlacementMode });
      });

    return () => {
      cleanupThreeVideoObjects();
    };
  }, [
    showVideoOverlay,
    videoUrl,
    videoPlacementMode,
    videoCountryA,
    videoCountryB,
    videoBillboardWidth,
    videoHaloInner,
    videoHaloOuter,
    videoOpacity,
    geoJsonData,
    billboardRotationX,
    billboardRotationY,
    billboardRotationZ,
    dataBillboards,
  ]);

  // Tooltip mode (DOM video following cursor over globe container)
  useEffect(() => {
    const container = globeContainerRef.current;
    if (!container) return;
    const cleanup = () => {
      if (tooltipVideoElRef.current) {
        try {
          tooltipVideoElRef.current.pause();
          tooltipVideoElRef.current.src = "";
          tooltipVideoElRef.current.load();
        } catch (_) {
          /* noop */
        }
        tooltipVideoElRef.current.remove();
        tooltipVideoElRef.current = null;
      }
    };
    cleanup();
    if (!(showVideoOverlay && videoUrl && videoPlacementMode === "tooltip")) {
      return cleanup;
    }
    // Check if this is a YouTube URL and handle appropriately
    const { processedUrl, needsIframe } = processVideoUrl(videoUrl);
    const sanitizedUrl = sanitizeVideoUrl(videoUrl);

    let tip: HTMLElement;

    if (needsIframe) {
      // For YouTube URLs in tooltip mode, create an iframe
      tip = document.createElement("iframe");
      (tip as HTMLIFrameElement).src = processedUrl;
      tip.setAttribute("allow", "autoplay; encrypted-media");
      tip.setAttribute("allowfullscreen", "true");
      (tip as HTMLIFrameElement).style.border = "none";
    } else {
      // For direct video URLs, use video element
      const videoTip = document.createElement("video");
      videoTip.src = sanitizedUrl;
      videoTip.muted = !videoSoundEnabled;
      videoTip.autoplay = true;
      videoTip.loop = true;
      (videoTip as any).playsInline = true;
      tip = videoTip;
    }
    Object.assign(tip.style, {
      position: "absolute",
      width: `${Math.round(videoOverlayWidth * 0.6)}px`,
      height: `${Math.round((videoOverlayWidth * 0.6 * 9) / 16)}px`,
      borderRadius: "6px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      zIndex: "1200",
      pointerEvents: "none",
      opacity: String(videoOpacity),
      display: "none",
    } as CSSStyleDeclaration);
    tooltipVideoElRef.current = tip as HTMLVideoElement;
    container.appendChild(tip);

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + 12;
      const y = e.clientY - rect.top + 12;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    };
    const onEnter = () => {
      tip.style.display = "block";
    };
    const onLeave = () => {
      tip.style.display = "none";
    };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseenter", onEnter);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseenter", onEnter);
      container.removeEventListener("mouseleave", onLeave);
      cleanup();
    };
  }, [
    showVideoOverlay,
    videoUrl,
    videoPlacementMode,
    videoOverlayWidth,
    videoOpacity,
  ]);

  useEffect(() => {
    if (
      globeRef.current &&
      medeMapState.data &&
      geocoordinates &&
      !isLoading &&
      globeReady
    ) {
      logger.info("Rendering data...", { component: "GlobeGL" });
      logger.info("Selected options", { component: "GlobeGL", selectedOptions: medeMapState.selectedOptions });
      logger.info("Data", { component: "GlobeGL", data: medeMapState.data });
      logger.info("Geocoordinates", { component: "GlobeGL", geocoordinates });

      // Check if we have any selections
      const hasGlobalSelections =
        Object.keys(medeMapState.selectedOptions).length > 0;
      const hasCountrySelections = Object.keys(perCountrySelections).length > 0;

      if (hasGlobalSelections || hasCountrySelections) {
        renderData();
      } else {
        // Clear the globe when no selections
        logger.info("No selections - clearing globe", { component: "GlobeGL" });
        globeRef.current.customLayerData([]);
        globeRef.current.labelsData([]);
      }
    } else {
      logger.info("Not ready to render:", {
        hasGlobe: !!globeRef.current,
        hasData: !!medeMapState.data,
        hasGeocoordinates: !!geocoordinates,
        isLoading,
        hasSelectedOptions:
          Object.keys(medeMapState.selectedOptions).length > 0,
        globeReady,
      });
    }
  }, [
    medeMapState.data,
    geocoordinates,
    isLoading,
    medeMapState.selectedOptions,
    perCountrySelections,
    barSpacing,
    globeReady,
    showDataLabels,
    dataLabelFontSize,
    use3DLogScale,
  ]);

  const getCountryCoordinates = (countryName: string) => {
    if (!geocoordinates || !Array.isArray(geocoordinates)) return null;
    const country = geocoordinates.find(
      (coord) => coord.country === countryName
    );
    if (country && country.latitude && country.longitude) {
      return {
        latitude: parseFloat(country.latitude),
        longitude: parseFloat(country.longitude),
      };
    }
    logger.info(`No coordinates found for ${countryName}`, { component: "GlobeGL" });
    return null;
  };

  const handleBarSpacingChange = (_: Event, newValue: number | number[]) => {
    setBarSpacing(newValue as number);
  };

  const handleLabelToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setShowDataLabels(event.target.checked));
  };

  const getColorFromPalette = (tableIndex: number, totalTables: number) => {
    const t = tableIndex / (totalTables - 1 || 1);

    // Always use the selected palette, even for single indicators
    let hue: number;
    switch (colorPalette) {
      case "rainbow":
        return `hsl(${t * 300}, 70%, 50%)`; // 0 to 300 for better differentiation
      case "heat":
        return `hsl(${60 - t * 60}, 85%, ${45 + t * 25}%)`; // More saturated yellow to red
      case "cool":
        return `hsl(${180 + t * 60}, 70%, 50%)`; // Cyan to blue
      case "sunset":
        return `hsl(${30 + t * 30}, ${80 - t * 20}%, ${60 - t * 20}%)`; // Orange to purple
      case "forest":
        return `hsl(${120 + t * 60}, ${70 - t * 20}%, ${45 + t * 15}%)`; // Green to teal
      case "ocean":
        return `hsl(${200 + t * 40}, ${75 - t * 15}%, ${45 + t * 15}%)`; // Light blue to dark blue
      default:
        // Custom palette - dark yellow to blue through green
        hue = spectrumStart + t * (spectrumEnd - spectrumStart);
        return `hsl(${hue}, 85%, ${45 + t * 10}%)`; // Slightly darker and more saturated
    }
  };

  // Format number with European decimal comma
  const formatNumber = (value: number) => {
    return value.toFixed(2).replace(".", ",");
  };

  const renderData = () => {
    if (loading || !globeRef.current) {
      logger.info("Cannot render: globe not ready or loading", { component: "GlobeGL" });
      return;
    }
    if (error) {
      logger.error("Failed to load geocoordinates", { component: "GlobeGL", error });
      return;
    }

    logger.info("Rendering data in Globe...", { component: "GlobeGL" });
    logger.info("Selected options", { component: "GlobeGL", selectedOptions: medeMapState.selectedOptions });
    logger.info("Per-country selections", { component: "GlobeGL", perCountrySelections });
    logger.info("Raw data", { component: "GlobeGL", rawData: medeMapState.data });
    logger.info("Emphasis mode", { component: "GlobeGL", emphasisMode });

    const data = medeMapState.data;
    if (!data || Object.keys(data).length === 0) {
      logger.info("No data to render", { component: "GlobeGL" });
      globeRef.current.customLayerData([]);
      return;
    }

    const pointsData = [];
    
    // Unified Color Map to ensure consistent colors across Global and Per-Country selections
    const colorMap = new Map<string, number>();
    let nextColorIndex = 0;
    
    // Calculate total global items for color denominator (matches Legend)
    const totalGlobalItems = Object.values(medeMapState.selectedOptions as Record<string, any[]>).reduce(
        (sum, cols) => sum + (cols?.length || 0), 0
    ) || 1;
    
    // Pre-populate map with Global selections to match Legend order
    Object.entries(medeMapState.selectedOptions as Record<string, any[]>).forEach(([tableId, columns]) => {
        columns?.forEach(column => {
            const key = `${tableId}:${column.value}`;
            if (!colorMap.has(key)) {
                colorMap.set(key, nextColorIndex++);
            }
        });
    });

    // First, process global selections for all countries
    if (Object.keys(medeMapState.selectedOptions).length > 0) {
      europeanCountries.forEach((country) => {
        // Skip if this country has specific selections
        if (perCountrySelections[country]?.length > 0) return;

        const coordinates = getCountryCoordinates(country);
        if (!coordinates) return;

        if (!coordinates) return;

        // selectionIndex is now derived from colorMap

        Object.entries(
          medeMapState.selectedOptions as Record<string, any[]>
        ).forEach(([tableId, columns]) => {
          if (!data[tableId] || !columns || columns.length === 0) return;

          columns.forEach((column: any) => {
            const columnId = column.value;
            const countryData = data[tableId].find(
              (d: any) => d.country === country
            );
            if (!countryData) return;

            const value = parseFloat(countryData[columnId]);
            if (isNaN(value)) return;

            // Find max value for this indicator
            const maxValue = Math.max(
              ...(data[tableId] as any[])
                .map((item) => parseFloat(item[columnId]) || 0)
                .filter((val) => !isNaN(val))
            );

            // Enhanced scaling for better visual differentiation
            const minValue = Math.min(
              ...(data[tableId] as any[])
                .map((item) => parseFloat(item[columnId]) || 0)
                .filter((val) => val > 0)
            );
            
            const key = `${tableId}:${columnId}`;
            // Use existing index from map (guaranteed to exist for global)
            const colorIdx = colorMap.get(key) ?? 0;
            const barColor = getColorFromPalette(colorIdx, totalGlobalItems);


            let normalizedValue;

            if (use3DLogScale && value > 0) {
              // Enhanced logarithmic scaling with better differentiation
              const range = maxValue - minValue;
              const normalizedInput = (value - minValue) / (range || 1);

              // Use a combination of log and power scaling for better contrast
              // This formula amplifies differences in the middle range
              const logComponent =
                Math.log10(1 + normalizedInput * 9) / Math.log10(10);
              const powerComponent = Math.pow(normalizedInput, 0.5);

              // Weighted combination for optimal visual differentiation
              normalizedValue = 0.3 * logComponent + 0.7 * powerComponent;

              // Apply additional contrast enhancement
              // This stretches the middle values while keeping extremes
              normalizedValue = Math.pow(normalizedValue, 0.8);

              // Ensure minimum height for visibility
              normalizedValue = Math.max(0.1, normalizedValue);
            } else {
              // Linear scaling with enhanced contrast
              const range = maxValue - minValue;
              normalizedValue = (value - minValue) / (range || 1);

              // Apply subtle power curve even in linear mode for better differentiation
              normalizedValue = Math.pow(normalizedValue, 0.85);

              // Ensure minimum height for visibility
              normalizedValue = Math.max(0.05, normalizedValue);
            }



            // Calculate offset position
            const angle = (colorIdx / totalGlobalItems) * 2 * Math.PI;
            const offsetDistance = barSpacing;
            const offsetLat =
              coordinates.latitude + Math.sin(angle) * offsetDistance;
            const offsetLng =
              coordinates.longitude + Math.cos(angle) * offsetDistance;

            const label = numericLabelsOnly
              ? formatNumber(value)
              : `${country}: ${
                  column.thresholds?.indicator || columnId
                } - ${formatNumber(value)}`;

            pointsData.push({
              lat: offsetLat,
              lng: offsetLng,
              height: normalizedValue,
              color: barColor,
              name: country,
              label: label,
              value: value,
            });


          });
        });
      });
    }

    // Then process countries that have specific selections
    // Calculate total selections across all countries for consistent coloring
    const totalCountrySelections = Object.values(perCountrySelections).reduce(
      (sum, selections) => sum + selections.length,
      0
    );
    let globalSelectionIndex = 0; // Track global index for consistent coloring

    Object.entries(perCountrySelections).forEach(([country, selections]) => {
      if (selections.length === 0) return;

      const coordinates = getCountryCoordinates(country);
      if (!coordinates) return;

      selections.forEach((selection, index) => {
        const { tableId, columnId } = selection;
        if (!data[tableId]) return;

        const countryData = data[tableId].find((d: any) => d.country === country);
        if (!countryData) return;

        const value = parseFloat(countryData[columnId]);
        if (isNaN(value)) return;

        // Find max value for this indicator
        const maxValue = Math.max(
          ...(data[tableId] as any[])
            .map((item) => parseFloat(item[columnId]) || 0)
            .filter((val) => !isNaN(val))
        );

        // Enhanced scaling for better visual differentiation (same as global selections)
        const minValue = Math.min(
          ...(data[tableId] as any[])
            .map((item) => parseFloat(item[columnId]) || 0)
            .filter((val) => val > 0)
        );

        let normalizedValue;

        if (use3DLogScale && value > 0) {
          // Enhanced logarithmic scaling with better differentiation
          const range = maxValue - minValue;
          const normalizedInput = (value - minValue) / (range || 1);

          // Use a combination of log and power scaling for better contrast
          // This formula amplifies differences in the middle range
          const logComponent =
            Math.log10(1 + normalizedInput * 9) / Math.log10(10);
          const powerComponent = Math.pow(normalizedInput, 0.5);

          // Weighted combination for optimal visual differentiation
          normalizedValue = 0.3 * logComponent + 0.7 * powerComponent;

          // Apply additional contrast enhancement
          // This stretches the middle values while keeping extremes
          normalizedValue = Math.pow(normalizedValue, 0.8);

          // Ensure minimum height for visibility
          normalizedValue = Math.max(0.1, normalizedValue);
        } else {
          // Linear scaling with enhanced contrast
          const range = maxValue - minValue;
          normalizedValue = (value - minValue) / (range || 1);

          // Apply subtle power curve even in linear mode for better differentiation
          normalizedValue = Math.pow(normalizedValue, 0.85);

          // Ensure minimum height for visibility
          normalizedValue = Math.max(0.05, normalizedValue);
        }
        const barColor = getColorFromPalette(
          globalSelectionIndex,
          totalCountrySelections
        );

        // Calculate offset position
        const totalSelections = selections.length;
        const angleStep = (2 * Math.PI) / totalSelections;
        const angle = index * angleStep;

        // Calculate offset from the center point
        const offsetDistance = barSpacing;
        const offsetLat =
          coordinates.latitude + Math.sin(angle) * offsetDistance;
        const offsetLng =
          coordinates.longitude + Math.cos(angle) * offsetDistance;

        const columnInfo = medeMapState.columnOptions?.[tableId]?.find(
          (col: any) => col.value === columnId
        );

        const label = numericLabelsOnly
          ? `${formatNumber(value)}${columnInfo?.unit || ""}`
          : `${columnInfo?.thresholds?.indicator || columnId}: ${formatNumber(
              value
            )}`;

        pointsData.push({
          lat: offsetLat,
          lng: offsetLng,
          height: normalizedValue,
          color: barColor,
          name: country,
          label: label,
          value: value,
        });

      });
    });
    
    // Process country-specific selections
    if (Object.keys(perCountrySelections).length > 0) {
      const totalCountrySelections = Object.values(perCountrySelections).reduce(
        (sum, list) => sum + list.length,
        0
      );
      let globalCountrySelectionIndex = 0;

      Object.entries(perCountrySelections).forEach(([country, selections]) => {
        // Skip consistency check (europeanCountries) to verify functionality first, or keep it strict? 
        // Strict is safer:
        if (!europeanCountries.includes(country)) return;

        const coordinates = getCountryCoordinates(country);
        if (!coordinates) return;

        const totalSelections = selections.length;
        if (totalSelections === 0) return;

        const angleStep = (2 * Math.PI) / totalSelections;

        selections.forEach((selection, index) => {
          const { tableId, columnId } = selection;
          if (!data[tableId]) return;

          const countryData = data[tableId].find((d: any) => d.country === country);
          if (!countryData) return;

          const value = parseFloat(countryData[columnId]);
          if (isNaN(value)) return;

          // Find max/min for this indicator (across entire dataset for consistency)
          const maxValue = Math.max(
            ...(data[tableId] as any[])
              .map((item) => parseFloat(item[columnId]) || 0)
              .filter((val) => !isNaN(val))
          );
          
          const minValue = Math.min(
            ...(data[tableId] as any[])
              .map((item) => parseFloat(item[columnId]) || 0)
              .filter((val) => val > 0)
          );

          let normalizedValue;
          if (use3DLogScale && value > 0) {
             const range = maxValue - minValue;
             const normalizedInput = (value - minValue) / (range || 1);
             const logComponent = Math.log10(1 + normalizedInput * 9) / Math.log10(10);
             const powerComponent = Math.pow(normalizedInput, 0.5);
             normalizedValue = 0.3 * logComponent + 0.7 * powerComponent;
             normalizedValue = Math.pow(normalizedValue, 0.8);
             normalizedValue = Math.max(0.1, normalizedValue);
          } else {
             const range = maxValue - minValue;
             normalizedValue = (value - minValue) / (range || 1);
             normalizedValue = Math.pow(normalizedValue, 0.85);
             normalizedValue = Math.max(0.05, normalizedValue);
          }

          const key = `${tableId}:${columnId}`;
          let colorIdx = colorMap.get(key);
          if (colorIdx === undefined) {
             // New unique indicator found in overrides
             colorIdx = nextColorIndex++;
             colorMap.set(key, colorIdx);
          }
          // Use Global Total as base denominator for consistency
          const barColor = getColorFromPalette(colorIdx, totalGlobalItems);
          
          // Calculate offset
          const angle = index * angleStep;
          const offsetDistance = barSpacing;
          const offsetLat = coordinates.latitude + Math.sin(angle) * offsetDistance;
          const offsetLng = coordinates.longitude + Math.cos(angle) * offsetDistance;

          const columnInfo = medeMapState.columnOptions?.[tableId]?.find(
             (col: any) => col.value === columnId
          );
          
          const label = numericLabelsOnly
            ? `${formatNumber(value)}${columnInfo?.unit || ""}`
            : `${columnInfo?.thresholds?.indicator || columnId}: ${formatNumber(value)}`;

           pointsData.push({
              lat: offsetLat,
              lng: offsetLng,
              height: normalizedValue,
              color: barColor,
              name: country,
              label: label,
              value: value,
           });

          });
        });
    }



    // Update the globe with all points data
    logger.info(`Rendering ${pointsData.length} points on the globe`, { component: "GlobeGL" });

    // Apply emphasis mode if enabled
    if (emphasisMode) {
      // Emphasis uses a single indicator: prefer the first globally selected column
      // Emphasis uses a normalized value comparison across countries
      // We build a map of Country -> Value, respecting specific overrides
      const countryToValue = new Map<string, number>();

      const globalSelection = (() => {
          const entries = Object.entries(medeMapState.selectedOptions || {});
          for (const [tableId, columns] of entries as [string, any[]][]) {
            if (columns && columns.length > 0) {
              return { tableId, columnId: columns[0].value };
            }
          }
          return null;
      })();

      europeanCountries.forEach((country) => {
         let selection = null;
         // Prefer specific selection
         if (perCountrySelections[country]?.length > 0) {
            selection = perCountrySelections[country][0];
         } else {
            selection = globalSelection;
         }

         if (selection) {
            const { tableId, columnId } = selection;
            const tableData = data[tableId];
            if (tableData) {
               const row = tableData.find((d: any) => d.country === country);
               if (row) {
                  const val = parseFloat(row[columnId]);
                  if (!isNaN(val)) {
                      countryToValue.set(country, val);
                  }
               }
            }
         }
      });

      if (countryToValue.size === 0) {
         // Nothing to emphasize
         if (globeRef.current) {
            globeRef.current
             .polygonsData(geoJsonData?.features || [])
             .polygonAltitude(0.01)
             .polygonCapColor(() => "rgba(200, 200, 200, 0.3)")
             .polygonSideColor(() => "rgba(150, 150, 150, 0.4)")
             .polygonStrokeColor(() => "#ffffff");
         }
      } else {
         // Sort and determine top/bottom 10%
         // Note: We use the already populated countryToValue map instead of re-processing

        // Logic to sort countryToValue entries


        const sorted = Array.from(countryToValue.entries()).sort(
          (a, b) => b[1] - a[1]
        );
        const count = sorted.length;
        const groupSize = Math.max(1, Math.ceil(count * 0.1));
        const topCountries = new Set(
          sorted.slice(0, groupSize).map(([c]) => c)
        );
        const bottomCountries = new Set(
          sorted.slice(-groupSize).map(([c]) => c)
        );

        // Prepare features: elevate only top/bottom 10% and color them
        const baseAltitude = 0.01;
        const topAltitude = 0.12;
        const bottomAltitude = 0.08;
        const updatedFeatures = (geoJsonData.features || []).map(
          (feature: any) => {
            const countryName =
              feature.properties?.name || feature.properties?.NAME;
            let altitude = baseAltitude;
            let capColor = "rgba(200, 200, 200, 0.3)";
            if (topCountries.has(countryName)) {
              altitude = topAltitude;
              capColor = "rgba(0, 200, 83, 0.9)"; // green
            } else if (bottomCountries.has(countryName)) {
              altitude = bottomAltitude;
              capColor = "rgba(229, 57, 53, 0.9)"; // red
            }
            return { ...feature, altitude, capColor };
          }
        );

        globeRef.current
          .polygonsData(updatedFeatures)
          .polygonAltitude((d: any) => d.altitude || baseAltitude)
          .polygonCapColor((d: any) => d.capColor || "rgba(200, 200, 200, 0.3)")
          .polygonSideColor((d: any) => {
            const cap = d.capColor || "rgba(200, 200, 200, 0.3)";
            return cap.replace("0.9)", "0.6)").replace("0.3)", "0.2)");
          })
          .polygonStrokeColor(() => "#ffffff");
      }
    } else if (!emphasisMode && geoJsonData && geoJsonData.features) {
      // Reset to default polygon visualization when emphasis mode is off
      logger.info("Emphasis mode off - reset polygons", { component: "GlobeGL" });
      globeRef.current
        .polygonsData(geoJsonData.features)
        .polygonAltitude(0.01)
        .polygonCapColor(() => "rgba(200, 200, 200, 0.3)")
        .polygonSideColor(() => "rgba(150, 150, 150, 0.4)")
        .polygonStrokeColor(() => "#ffffff");
    }

    globeRef.current.customLayerData(pointsData);

    // Update labels if enabled
    if (showDataLabels) {
      try {
        // First clear any existing labels
        globeRef.current.labelsData([]);

        // Create simplified label data
        const labelData = pointsData.map((d) => ({
          lat: d.lat,
          lng: d.lng,
          text: d.label,
          value: d.value,
          color: d.color,
          altitude: d.height * labelPosition + 0.01,
        }));

        // Set up labels
        globeRef.current
          .labelsData(labelData)
          .labelLat("lat")
          .labelLng("lng")
          .labelText("text")
          .labelAltitude("altitude")
          .labelSize(() => labelSize * 0.8)
          .labelDotRadius(0.3)
          .labelColor((d: any) => d.color)
          .labelResolution(3)
          .labelIncludeDot(true)
          .labelDotOrientation(() => "bottom")
          .labelsTransitionDuration(1000)
          .labelLabel((d: any) => ({
            text: d.text,
            color: d.color,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            padding: 3,
            borderRadius: 3,
          }));

        // Create a new layer for the connection lines
        const lineLayer = new THREE.Group();
        pointsData.forEach((d) => {
          const startPos = globeRef.current.getCoords(
            d.lat,
            d.lng,
            d.height * 20 * barScale
          );
          const endPos = globeRef.current.getCoords(
            d.lat,
            d.lng,
            d.height * labelPosition + 0.01
          );

          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array([
            startPos.x,
            startPos.y,
            startPos.z,
            endPos.x,
            endPos.y,
            endPos.z,
          ]);
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
          );

          const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(d.color),
            transparent: true,
            opacity: 0.6,
          });

          const line = new THREE.Line(geometry, material);
          lineLayer.add(line);
        });

        // Add the line layer to the globe scene
        if (globeRef.current._scene) {
          // Remove any existing line layer
          const existingLineLayer =
            globeRef.current._scene.getObjectByName("lineLayer");
          if (existingLineLayer) {
            globeRef.current._scene.remove(existingLineLayer);
          }
          lineLayer.name = "lineLayer";
          globeRef.current._scene.add(lineLayer);
        }
      } catch (error) {
        logger.error("Failed to set up labels", { component: "GlobeGL", error });
      }
    } else {
      globeRef.current.labelsData([]);
      // Remove line layer if it exists
      if (globeRef.current._scene) {
        const existingLineLayer =
          globeRef.current._scene.getObjectByName("lineLayer");
        if (existingLineLayer) {
          globeRef.current._scene.remove(existingLineLayer);
        }
      }
    }
  };

  useEffect(() => {
    logger.info("showDataLabels changed", { component: "GlobeGL", showDataLabels });
  }, [showDataLabels]);

  useEffect(() => {
    if (globeReady) {
      logger.info("Emphasis mode changed", { component: "GlobeGL", emphasisMode });
      logger.info("GeoJsonData available", { component: "GlobeGL", geoJsonDataAvailable: !!geoJsonData });
      logger.info("Globe ready", { component: "GlobeGL", globeReady });
      renderData();
    }
  }, [
    globeReady, 
    medeMapState.data, 
    medeMapState.selectedOptions, 
    perCountrySelections, 
    emphasisMode, 
    showDataLabels, 
    use3DLogScale, 
    barSpacing, 
    barScale,
    colorPalette,
    numericLabelsOnly
  ]);

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
      {!isLoading &&
        initializationComplete &&
        Object.keys(medeMapState.selectedOptions).length === 0 &&
        Object.keys(perCountrySelections).length === 0 && (
          <Box
            position="absolute"
            top="50%"
            left="50%"
            style={{ transform: "translate(-50%, -50%)" }}
            zIndex={999}
            textAlign="center"
            bgcolor="rgba(0, 0, 0, 0.7)"
            p={3}
            borderRadius={2}
          >
            <Typography variant="h6" color="white" gutterBottom>
              No Data Selected
            </Typography>
            <Typography variant="body1" color="white">
              Please select indicators from the data selection panel to
              visualize data on the globe.
            </Typography>
          </Box>
        )}
      <div
        ref={globeContainerRef}
        className="globe-container"
        style={{ width: "100%", height: "100%" }}
      />
      <SimpleDraggable
          handle=".drag-handle"
          style={{
            position: "absolute",
            bottom: "210px",
            right: "50px",
            background: "rgba(255, 255, 255, 0.9)",
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          <div
            className="drag-handle"
            style={{
              padding: "5px",
              marginBottom: "5px",
              background: "#f0f0f0",
              borderRadius: "4px",
              textAlign: "center",
              fontSize: "12px",
              cursor: "move",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>⋮ Country Indicators (drag to move)</span>
            <Button
              size="small"
              onClick={() => setShowCountrySelector((prev) => !prev)}
              style={{ minWidth: "30px", padding: "2px" }}
            >
              {showCountrySelector ? "−" : "+"}
            </Button>
          </div>
          <Legend
            selectedOptions={medeMapState.selectedOptions}
            perCountrySelections={perCountrySelections}
            colorPalette={colorPalette}
            spectrumStart={spectrumStart}
            spectrumEnd={spectrumEnd}
          />
      </SimpleDraggable>
      <SimpleDraggable
          handle=".drag-handle"
          style={{
            position: "absolute",
            top: "20px",
            right: "50px",
            background: "rgba(255, 255, 255, 0.9)",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            zIndex: 1000,
            width: "250px",
          }}
        >
          <div
            className="drag-handle"
            style={{
              padding: "5px",
              marginBottom: "10px",
              background: "#f0f0f0",
              borderRadius: "4px",
              textAlign: "center",
              fontSize: "12px",
              cursor: "move",
            }}
          >
            ⋮ Settings (drag to move)
          </div>
          <div style={{ padding: "0 8px" }}>
            <Typography gutterBottom>Color Palette</Typography>
            <div style={{ marginBottom: "16px" }}>
              <select
                value={colorPalette}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
                onChange={(e) => {
                  setColorPalette(e.target.value);
                }}
              >
                <option value="default">Default</option>
                <option value="custom">Custom Palette</option>
                <option value="rainbow">Rainbow</option>
                <option value="heat">Heat Map</option>
                <option value="cool">Cool Colors</option>
                <option value="sunset">Sunset</option>
                <option value="forest">Forest</option>
                <option value="ocean">Ocean</option>
              </select>
              {colorPalette === "custom" && (
                <div style={{ marginTop: "8px", marginBottom: "8px" }}>
                  <Typography variant="caption">Spectrum</Typography>
                  <div
                    style={{ display: "flex", gap: "8px", marginBottom: "4px" }}
                  >
                    <Slider
                      value={[spectrumStart, spectrumEnd]}
                      onChange={(_, newValue) => {
                        const [start, end] = newValue as number[];
                        setSpectrumStart(start);
                        setSpectrumEnd(end);
                      }}
                      min={0}
                      max={360}
                      step={1}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${value}`}
                      style={{
                        marginLeft: 8,
                        marginRight: 8,
                        width: "calc(100% - 16px)",
                      }}
                    />
                  </div>
                </div>
              )}
              <div
                style={{
                  width: "100%",
                  height: "24px",
                  borderRadius: "4px",
                  overflow: "hidden",
                  display: "flex",
                  marginTop: "8px",
                  background:
                    "linear-gradient(to right, " +
                    Array.from({ length: 50 })
                      .map((_, i) => getColorFromPalette(i, 50))
                      .join(", ") +
                    ")",
                }}
              />
            </div>
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
              style={{ marginTop: "16px", marginBottom: "16px" }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={emphasisMode}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    if (newValue) {
                      const uniqueIndicators = new Set<string>();
                      // Count global
                      Object.entries(medeMapState.selectedOptions as Record<string, any[]>).forEach(([tid, cols]) => {
                          cols?.forEach((c: any) => uniqueIndicators.add(`${tid}:${c.value}`));
                      });
                      // Count local
                      Object.values(perCountrySelections).forEach((cols: any[]) => {
                          cols?.forEach((c: any) => uniqueIndicators.add(`${c.tableId}:${c.columnId}`));
                      });
                      
                      const selectedCount = uniqueIndicators.size;
                      if (selectedCount !== 1) {
                        const message =
                          selectedCount === 0
                            ? "Emphasis Mode requires at least one indicator."
                            : `Emphasis Mode requires a single unique indicator type for valid comparison (currently ${selectedCount} different indicators selected).`;
                        setEmphasisWarning(message);
                        setEmphasisWarningOpen(true);
                        // prevent enabling
                        return;
                      }
                    }
                    dispatch(setEmphasisMode(newValue));
                    localStorage.setItem("emphasisMode", newValue.toString());
                    renderData();
                  }}
                  color="primary"
                />
              }
              label="Emphasis Mode"
              style={{ marginBottom: "8px" }}
            />
            <Typography
              variant="caption"
              display="block"
              style={{
                marginLeft: "32px",
                marginBottom: "16px",
                color: "#666",
              }}
            >
              Lifts countries by value, colors top/bottom 10%
            </Typography>
            <Typography gutterBottom>Bar Spacing</Typography>
            <Slider
              value={barSpacing}
              onChange={(_, newValue) => setBarSpacing(newValue as number)}
              onChangeCommitted={handleBarSpacingChange}
              min={0.01}
              max={0.6}
              step={0.01}
              valueLabelDisplay="auto"
            />
            <Typography gutterBottom style={{ marginTop: "16px" }}>
              Bar Height Scale
            </Typography>
            <Slider
              value={barScale}
              onChange={(_, newValue) => {
                const newScale = newValue as number;
                setBarScale(newScale);
                if (globeRef.current && globeReady) {
                  const objects = globeRef.current.customLayerData();
                  objects.forEach((d: any) => {
                    if (d.__threeObjCustom) {
                      const newHeight = d.height * 20 * newScale;
                      d.__threeObjCustom.scale.y = newHeight;
                      d.currentScale = newHeight;
                    }
                  });
                  // Update without re-render
                  globeRef.current.customLayerData(objects);
                }
              }}
              min={1.0}
              max={20.0}
              step={0.5}
              valueLabelDisplay="auto"
              marks={[
                { value: 1, label: "Min" },
                { value: 10, label: "Mid" },
                { value: 20, label: "Max" },
              ]}
              style={{
                marginLeft: 8,
                marginRight: 8,
                width: "calc(100% - 16px)",
              }}
            />
            <Typography gutterBottom style={{ marginTop: "16px" }}>
              Label Z Distance
            </Typography>
            <Slider
              value={labelPosition}
              onChange={(_, newValue) => {
                setLabelPosition(newValue as number);
              }}
              min={0.01}
              max={2}
              step={0.01}
              valueLabelDisplay="auto"
              marks={[
                { value: 0.01, label: "Close" },
                { value: 1, label: "Mid" },
                { value: 2, label: "Far" },
              ]}
              style={{
                marginLeft: 8,
                marginRight: 8,
                width: "calc(100% - 16px)",
              }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showDataLabels}
                  onChange={handleLabelToggle}
                  name="showLabels"
                  color="primary"
                />
              }
              label="Show Labels"
              style={{ marginTop: "16px", display: "block" }}
            />
            {showDataLabels && (
              <>
                <Typography gutterBottom style={{ marginTop: "16px" }}>
                  Label Size
                </Typography>
                <Slider
                  value={labelSize}
                  onChange={(_, newValue) => {
                    setLabelSize(newValue as number);
                  }}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={numericLabelsOnly}
                      onChange={(e) => {
                        setNumericLabelsOnly(e.target.checked);
                      }}
                      name="numericLabels"
                      color="primary"
                    />
                  }
                  label="Numeric Labels"
                  style={{ marginTop: "8px", display: "block" }}
                />
              </>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={renderData}
              style={{
                width: "100%",
                marginTop: "16px",
              }}
            >
              Refresh View
            </Button>
            <div
              style={{ height: "1px", background: "#e0e0e0", margin: "16px 0" }}
            />
            <Typography gutterBottom>Video Overlay</Typography>
            <div style={{ marginBottom: "8px" }}>
              <Typography
                variant="caption"
                display="block"
                style={{ marginBottom: "4px" }}
              >
                Placement Mode
              </Typography>
              <select
                value={videoPlacementMode}
                onChange={(e) => setVideoPlacementMode(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="overlayCanvas">Overlay Canvas (2D)</option>
                <option value="hud">HUD Window (2D)</option>
                <option value="curvedPatch">Curved Patch (3D PoC)</option>
                {/* Disabled modes - code kept for future use */}
                {/* <option value="pip">Picture-in-Picture (Clean)</option> */}
                {/* <option value="contextualOverlay">Contextual Overlay (Clean)</option> */}
                {/* <option value="billboard">Single Billboard (3D)</option> */}
                {/* <option value="elegantMulti">Elegant Multi-Video (Data-Driven)</option> */}
                {/* <option value="ambientSkybox">Ambient Skybox (Subtle)</option> */}
                {/* <option value="dataTooltip">Data-Driven Tooltip</option> */}
              </select>
            </div>
            <FormControlLabel
              control={
                <Switch
                  checked={showVideoOverlay}
                  onChange={(e) => setShowVideoOverlay(e.target.checked)}
                  color="primary"
                />
              }
              label="Enable Video Overlay"
              style={{ marginBottom: "8px" }}
            />
            {showVideoOverlay && (
              <>
                <Typography
                  variant="caption"
                  display="block"
                  style={{ marginBottom: "4px" }}
                >
                  Video URL
                </Typography>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="/video/16mm.mp4 or YouTube URL or https://.../video.mp4"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    marginBottom: "12px",
                  }}
                />
                <Typography gutterBottom>Overlay Opacity</Typography>
                <Slider
                  value={videoOpacity}
                  onChange={(_, val) => setVideoOpacity(val as number)}
                  min={0.0}
                  max={1.0}
                  step={0.01}
                  valueLabelDisplay="auto"
                />
                {(videoPlacementMode === "overlayCanvas" ||
                  videoPlacementMode === "hud" ||
                  videoPlacementMode === "tooltip") && (
                  <>
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      Overlay Width
                    </Typography>
                    <Slider
                      value={videoOverlayWidth}
                      onChange={(_, val) => setVideoOverlayWidth(val as number)}
                      min={240}
                      max={1280}
                      step={10}
                      valueLabelDisplay="auto"
                      marks={[
                        { value: 240, label: "Min" },
                        { value: 640, label: "Med" },
                        { value: 1280, label: "Max" },
                      ]}
                      style={{
                        marginLeft: 8,
                        marginRight: 8,
                        width: "calc(100% - 16px)",
                      }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      Height auto-calculated to 16:9
                    </Typography>
                  </>
                )}
                {videoPlacementMode === "billboard" && (
                  <>
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      Billboard Country
                    </Typography>
                    <select
                      value={videoCountryA}
                      onChange={(e) => setVideoCountryA(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        marginBottom: "8px",
                      }}
                    >
                      {europeanCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Typography gutterBottom>
                      Billboard Width (world units)
                    </Typography>
                    <Slider
                      value={videoBillboardWidth}
                      onChange={(_, val) =>
                        setVideoBillboardWidth(val as number)
                      }
                      min={0.4}
                      max={20.0}
                      step={0.2}
                      valueLabelDisplay="auto"
                    />
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      3D Rotation Controls
                    </Typography>
                    <Typography variant="caption">
                      X-Axis Rotation (degrees)
                    </Typography>
                    <Slider
                      value={billboardRotationX}
                      onChange={(_, val) =>
                        setBillboardRotationX(val as number)
                      }
                      min={-180}
                      max={180}
                      step={5}
                      valueLabelDisplay="auto"
                      style={{ marginBottom: "8px" }}
                    />
                    <Typography variant="caption">
                      Y-Axis Rotation (degrees)
                    </Typography>
                    <Slider
                      value={billboardRotationY}
                      onChange={(_, val) =>
                        setBillboardRotationY(val as number)
                      }
                      min={-180}
                      max={180}
                      step={5}
                      valueLabelDisplay="auto"
                      style={{ marginBottom: "8px" }}
                    />
                    <Typography variant="caption">
                      Z-Axis Rotation (degrees)
                    </Typography>
                    <Slider
                      value={billboardRotationZ}
                      onChange={(_, val) =>
                        setBillboardRotationZ(val as number)
                      }
                      min={-180}
                      max={180}
                      step={5}
                      valueLabelDisplay="auto"
                    />
                  </>
                )}
                {videoPlacementMode === "ribbon" && (
                  <>
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      From Country
                    </Typography>
                    <select
                      value={videoCountryA}
                      onChange={(e) => setVideoCountryA(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        marginBottom: "8px",
                      }}
                    >
                      {europeanCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Typography gutterBottom>To Country</Typography>
                    <select
                      value={videoCountryB}
                      onChange={(e) => setVideoCountryB(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      {europeanCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {videoPlacementMode === "halo" && (
                  <>
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      Country
                    </Typography>
                    <select
                      value={videoCountryA}
                      onChange={(e) => setVideoCountryA(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        marginBottom: "8px",
                      }}
                    >
                      {europeanCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Typography gutterBottom>Halo Inner Radius</Typography>
                    <Slider
                      value={videoHaloInner}
                      onChange={(_, v) => setVideoHaloInner(v as number)}
                      min={0.05}
                      max={0.3}
                      step={0.005}
                      valueLabelDisplay="auto"
                    />
                    <Typography gutterBottom style={{ marginTop: "8px" }}>
                      Halo Outer Radius
                    </Typography>
                    <Slider
                      value={videoHaloOuter}
                      onChange={(_, v) => setVideoHaloOuter(v as number)}
                      min={0.06}
                      max={0.35}
                      step={0.005}
                      valueLabelDisplay="auto"
                    />
                  </>
                )}
                {videoPlacementMode === "curvedPatch" && (
                  <>
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      Country
                    </Typography>
                    <select
                      value={videoCountryA}
                      onChange={(e) => setVideoCountryA(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        marginBottom: "8px",
                      }}
                    >
                      {europeanCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <Typography gutterBottom>Patch Size (degrees)</Typography>
                    <Slider
                      value={videoCurvedPatchDegrees}
                      onChange={(_, v) =>
                        setVideoCurvedPatchDegrees(v as number)
                      }
                      min={4}
                      max={40}
                      step={1}
                      valueLabelDisplay="auto"
                    />
                  </>
                )}
                {videoPlacementMode === "region" && (
                  <>
                    <Typography gutterBottom style={{ marginTop: "12px" }}>
                      Country
                    </Typography>
                    <select
                      value={videoCountryA}
                      onChange={(e) => setVideoCountryA(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      {europeanCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {videoPlacementMode === "timeline" && (
                  <div style={{ marginTop: "12px" }}>
                    <Typography
                      variant="caption"
                      display="block"
                      style={{ marginBottom: "6px" }}
                    >
                      Timeline Preview
                    </Typography>
                    {(() => {
                      const { processedUrl, needsIframe } = processVideoUrl(videoUrl);
                      const sanitizedUrl = sanitizeVideoUrl(videoUrl);
                      if (needsIframe) {
                        return (
                          <iframe
                            src={processedUrl}
                            style={{ width: 420, height: 236, borderRadius: 6, border: "none" }}
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                          />
                        );
                      } else {
                        return (
                          <video
                            src={sanitizedUrl}
                            controls
                            playsInline
                            style={{ width: 420, height: 236, borderRadius: 6 }}
                          />
                        );
                      }
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
      </SimpleDraggable>
      
      {/* Floating button to open Country-Specific Indicators when closed */}
      {!showCountrySelector && (
        <Button
          variant="contained"
          size="small"
          onClick={() => setShowCountrySelector(true)}
          style={{
            position: "absolute",
            top: "80px",
            left: "20px",
            zIndex: 1000,
            background: "#2196f3",
            color: "white",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          Country Indicators
        </Button>
      )}
      
      <SimpleDraggable
          handle=".drag-handle"
          style={{
            position: "absolute",
            top: "80px",
            left: "20px",
            background: "rgba(255, 255, 255, 0.95)",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            zIndex: 1000,
            width: "350px",
            display: showCountrySelector ? "block" : "none",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
        >
          <div
            className="drag-handle"
            style={{
              padding: "8px",
              marginBottom: "12px",
              background: "#2196f3",
              color: "white",
              borderRadius: "4px",
              textAlign: "center",
              fontSize: "14px",
              cursor: "move",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Country-Specific Indicators</span>
            <Button
              size="small"
              onClick={() => setShowCountrySelector(false)}
              style={{
                minWidth: "30px",
                padding: "2px",
                color: "white",
                border: "1px solid white",
              }}
              title="Close panel"
            >
              ✕
            </Button>
          </div>
          <div style={{ padding: "0 8px" }}>
            <Typography
              variant="body2"
              style={{ marginBottom: "16px", color: "#666" }}
            >
              Select different indicators for each country. Countries without
              specific selections will use the global indicators.
            </Typography>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  dispatch(setSelectedOptions({}));
                  // Don't call renderData manually - useEffect will handle it
                }}
                style={{ flex: 1 }}
              >
                Clear Global Selections
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setPerCountrySelections({});
                  // Don't call renderData manually - useEffect will handle it
                }}
                style={{ flex: 1 }}
              >
                Clear Country Selections
              </Button>
            </div>
            {europeanCountries.map((country) => (
              <div
                key={country}
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  background: "rgba(0,0,0,0.03)",
                  borderRadius: "4px",
                  border: "1px solid rgba(0,0,0,0.1)",
                }}
              >
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  style={{ fontWeight: "bold" }}
                >
                  {country}
                </Typography>
                <Select<SelectOption, true>
                  isMulti
                  options={(() => {
                    const sectionOrder = [
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
                    const entries = Object.entries(medeMapState.columnOptions || {});
                    entries.sort(([a], [b]) => {
                      const ia = sectionOrder.indexOf(a);
                      const ib = sectionOrder.indexOf(b);
                      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                    });
                    return entries.flatMap(([tableId, columns]) =>
                      (columns as any[])
                        .filter((col) => !["year", "country"].includes(col.value))
                        .map((col) => ({
                          value: `${tableId}:${col.value}`,
                          label: col.thresholds?.indicator || col.label,
                          tableId,
                          columnId: col.value,
                        }))
                    );
                  })()}
                  value={
                    perCountrySelections[country]?.map((sel) => ({
                      value: `${sel.tableId}:${sel.columnId}`,
                      label:
                        medeMapState.columnOptions?.[sel.tableId]?.find(
                          (col: any) => col.value === sel.columnId
                        )?.thresholds?.indicator || sel.columnId,
                      tableId: sel.tableId,
                      columnId: sel.columnId,
                    })) || []
                  }
                  onChange={(newValue) => {
                    setPerCountrySelections((prev) => ({
                      ...prev,
                      [country]: (newValue as SelectOption[]).map((v) => ({
                        tableId: v.tableId,
                        columnId: v.columnId,
                      })),
                    }));
                  }}
                  placeholder={`Select indicators for ${country}`}
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "36px",
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: "rgba(33, 150, 243, 0.1)",
                    }),
                  }}
                />
              </div>
            ))}
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                renderData();
                // Add a small delay to ensure the data is rendered
                setTimeout(() => {
                  if (globeRef.current) {
                    globeRef.current.controls().autoRotate = false;
                  }
                }, 100);
              }}
              style={{
                width: "100%",
                marginTop: "16px",
                marginBottom: "8px",
                background: "#2196f3",
                fontWeight: "bold",
              }}
            >
              Apply Country Selections
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setPerCountrySelections({});
                // Clear the globe data immediately
                if (globeRef.current) {
                  globeRef.current.customLayerData([]);
                  globeRef.current.labelsData([]);
                  // Remove line layer if it exists
                  if (globeRef.current._scene) {
                    const existingLineLayer =
                      globeRef.current._scene.getObjectByName("lineLayer");
                    if (existingLineLayer) {
                      globeRef.current._scene.remove(existingLineLayer);
                    }
                  }
                }
              }}
              style={{
                width: "100%",
                marginTop: "8px",
              }}
            >
              Clear All Country Selections
            </Button>
          </div>
      </SimpleDraggable>
      {showVideoOverlay && videoPlacementMode === "overlayCanvas" && (
        <div
            style={{
              position: "absolute",
              zIndex: 950,
              background: "rgba(0,0,0,0.6)",
              borderRadius: "6px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              className="drag-handle"
              style={{
                background: "#2e3b4e",
                color: "white",
                padding: "6px 10px",
                fontSize: "12px",
                cursor: "move",
                userSelect: "none",
              }}
            >
              Video Overlay (drag to move)
            </div>
            {(() => {
              const { processedUrl, needsIframe } = processVideoUrl(videoUrl);

              if (needsIframe) {
                // YouTube videos need iframe
                return (
                  <iframe
                    src={processedUrl}
                    style={{
                      width: `${videoOverlayWidth}px`,
                      height: `${Math.round((videoOverlayWidth * 9) / 16)}px`,
                      border: "none",
                      opacity: videoOpacity,
                      background: "black",
                    }}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                );
              } else {
                // Direct video files use canvas
                return (
                  <canvas
                    ref={videoCanvasRef}
                    style={{
                      width: `${videoOverlayWidth}px`,
                      height: `${Math.round((videoOverlayWidth * 9) / 16)}px`,
                      display: "block",
                      opacity: videoOpacity,
                      background: "black",
                    }}
                  />
                );
              }
            })()}
          </div>
      )}
      {showVideoOverlay && videoPlacementMode === "hud" && (
        <div
            style={{
              position: "absolute",
              zIndex: 950,
              background: "rgba(0,0,0,0.6)",
              borderRadius: "6px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              className="drag-handle"
              style={{
                background: "#2e3b4e",
                color: "white",
                padding: "6px 10px",
                fontSize: "12px",
                cursor: "move",
                userSelect: "none",
              }}
            >
              HUD Video (drag to move)
            </div>
            {(() => {
              const { processedUrl, needsIframe } = processVideoUrl(videoUrl);
              const sanitizedUrl = sanitizeVideoUrl(videoUrl);
              if (needsIframe) {
                return (
                  <iframe
                    src={processedUrl}
                    style={{
                      width: `${videoOverlayWidth}px`,
                      height: `${Math.round((videoOverlayWidth * 9) / 16)}px`,
                      display: "block",
                      opacity: videoOpacity,
                      border: "none",
                    }}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                );
              } else {
                return (
                  <video
                    src={sanitizedUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                      width: `${videoOverlayWidth}px`,
                      height: `${Math.round((videoOverlayWidth * 9) / 16)}px`,
                      display: "block",
                      opacity: videoOpacity,
                      background: "black",
                    }}
                  />
                );
              }
            })()}
          </div>
      )}
      {showVideoOverlay && videoPlacementMode === "pip" && (
        <SimpleDraggable
          handle=".drag-handle"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 1000,
            background: "rgba(0,0,0,0.9)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            overflow: "hidden",
            maxWidth: "300px",
            border: "2px solid #333",
          }}
        >
          <div
            className="drag-handle"
            style={{
              background: "#1a1a1a",
              color: "white",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: "500",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "move",
            }}
          >
            <span>Picture-in-Picture</span>
            <button
              onClick={() => setShowVideoOverlay(false)}
              style={{
                background: "none",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                fontSize: "14px",
                padding: "2px",
              }}
            >
              ✕
            </button>
          </div>
          <video
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            controls
            style={{
              width: "100%",
              display: "block",
              opacity: videoOpacity,
              background: "black",
            }}
          />
          <div
            style={{
              background: "#1a1a1a",
              color: "#ccc",
              padding: "6px 12px",
              fontSize: "10px",
              borderTop: "1px solid #333",
            }}
          >
            Always visible during navigation
          </div>
        </SimpleDraggable>
      )}
      <Snackbar
        open={emphasisWarningOpen}
        autoHideDuration={5000}
        onClose={() => setEmphasisWarningOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setEmphasisWarningOpen(false)}
          severity="warning"
          sx={{ width: "100%" }}
        >
          {emphasisWarning}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default GlobeGL;
