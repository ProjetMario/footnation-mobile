// The web build is a layout preview. Calls run through the native module on devices.
import React from "react";
import type { CallMode, CallPeer } from "../lib/calls";
export function CallProvider({
  children,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  return <>{children}</>;
}
export function useCalls() {
  return {
    available: false,
    busy: false,
    startCall: (_peer: CallPeer, _mode: CallMode) => Promise.resolve(),
  };
}
