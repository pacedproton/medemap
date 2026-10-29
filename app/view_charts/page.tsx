"use client";

import React from "react";
import dynamic from "next/dynamic";
import { CircularProgress } from "@mui/material";

const DynamicChartView = dynamic(() => import("./ChartView"), {
  ssr: false,
  loading: () => <CircularProgress />,
});

export default function Page() {
  return <DynamicChartView />;
}
