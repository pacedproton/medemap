"use client";

import React from "react";
import dynamic from "next/dynamic";
import { CircularProgress } from "@mui/material";

const DynamicHistogramView = dynamic(() => import("./HistogramView"), {
  ssr: false,
  loading: () => <CircularProgress />,
});

export default function Page() {
  return <DynamicHistogramView />;
}
