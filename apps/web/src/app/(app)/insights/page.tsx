import type { Metadata } from "next";
import { InsightsScreen } from "@/features/tracking/insights-screen";

export const metadata: Metadata = { title: "Insights | LifeTracker" };
export default function InsightsPage() {
  return <InsightsScreen />;
}
