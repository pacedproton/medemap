// app/page.tsx

import type { Metadata } from "next";
import MainSelections from "./components/MainSelections/MainSelections";

export default function MainPage() {
  return <MainSelections />;
}

export const metadata: Metadata = {
  title: "MeDeMAP Dashboard",
};

// Force dynamic rendering to avoid SSR localStorage issues
export const dynamic = 'force-dynamic';
