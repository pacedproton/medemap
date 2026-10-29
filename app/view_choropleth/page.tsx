"use client";

import React from "react";
import dynamic from "next/dynamic";
import { CircularProgress } from "@mui/material";

const DynamicChoroplethView = dynamic(() => import("./ChoroplethView"), {
  ssr: false,
  loading: () => <CircularProgress />,
});

export default function Page() {
  return <DynamicChoroplethView />;
}
