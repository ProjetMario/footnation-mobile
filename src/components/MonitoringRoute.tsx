import { useEffect } from "react";
import { useSegments } from "expo-router";
import { setMonitoringScreen } from "../lib/monitoring";
import { screenTemplate } from "../lib/monitoringPrivacy";
export function MonitoringRoute() {
  const screen = screenTemplate(useSegments());
  useEffect(() => setMonitoringScreen(screen), [screen]);
  return null;
}
