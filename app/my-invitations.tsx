import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { normalizeTeamInvite } from "../src/lib/authReturn";
export default function Alias() {
  const { teamInvite } = useLocalSearchParams();
  const code = normalizeTeamInvite(teamInvite);
  return (
    <Redirect
      href={{
        pathname: "/member/invitations",
        params: code ? { teamInvite: code } : {},
      }}
    />
  );
}
