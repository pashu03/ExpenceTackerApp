import type { Metadata } from "next";
import { CalendarScreen } from "@/features/tracking/calendar-screen";

export const metadata: Metadata = { title: "Calendar | LifeTracker" };
export default function CalendarPage() {
  return <CalendarScreen />;
}
