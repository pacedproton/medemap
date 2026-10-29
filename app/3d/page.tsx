"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import BottomNavigation from "../components/BottomNavigation";
import PreviewGlobeModal from "../components/PreviewGlobeModal";

const GlobeGL = dynamic(() => import("../components/GlobeGL"), {
  ssr: false, // Disable server-side rendering
  loading: () => <div>Loading 3D View...</div>,
});

export default function ThreeDimensionalView() {
  const [renderGlobe, setRenderGlobe] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      const fetchConfig = async () => {
        try {
          const response = await fetch("/api/config");
          const config = await response.json();
          console.log("Config:", config);
          setIsPreview(config.features.previewGlobeView);
        } catch (error) {
          console.error("Error fetching config:", error);
        }
      };

      fetchConfig();
      setRenderGlobe(true);
    }
  }, []);

  const handleEnableGlobe = () => {
    setIsPreview(false);
  };

  const handleDisableGlobe = () => {
    setIsPreview(true);
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <div
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {renderGlobe && <GlobeGL />}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <BottomNavigation />
      </div>
      {isPreview && (
        <PreviewGlobeModal isOpen={isPreview} onEnable={handleEnableGlobe} onDisable={handleDisableGlobe} />
      )}
    </div>
  );
}
