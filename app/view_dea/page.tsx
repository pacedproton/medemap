"use client";

import React from "react";
import DEAAnalysisView from "./DEAAnalysisView";
import BottomNavigation from "../components/BottomNavigation";

const DEAPage = () => {
  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw" }}>
      <div style={{ height: "calc(100vh - 120px)", overflowY: "auto" }}>
        <DEAAnalysisView />
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <BottomNavigation />
      </div>
    </div>
  );
};

export default DEAPage;