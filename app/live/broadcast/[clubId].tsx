import { Redirect, useLocalSearchParams } from "expo-router";
import { liveLinkId } from "../../../src/lib/liveLinkResolver";

export default function LegacyLiveBroadcast() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const requestedClub = liveLinkId(clubId);
  // This is preparation only. Club membership and the user's explicit choice
  // are checked by the create screen before opening the studio.
  return (
    <Redirect
      href={{
        pathname: "/live/create",
        params: {
          mode: "match",
          ...(requestedClub ? { clubId: requestedClub } : {}),
        },
      }}
    />
  );
}
