import React from "react";
import { PublicLinkShare } from "./PublicLinkShare";
import { publicTalentUrl } from "../lib/professionalContact";
export function PublicProfileShare({
  id,
  slug,
  name,
}: {
  id: string;
  slug?: string | null;
  name: string;
}) {
  return (
    <PublicLinkShare
      key={id}
      url={publicTalentUrl({ id, slug })}
      name={name}
      label="Partager ce profil"
    />
  );
}
