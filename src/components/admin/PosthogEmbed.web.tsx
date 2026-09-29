import React from "react";

export default function PosthogEmbed({ url }: { url: string }) {
  return (
    <iframe
      title="Statistiques FootNation — PostHog"
      src={url}
      loading="lazy"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{ width: "100%", height: 650, border: 0, borderRadius: 12 }}
    />
  );
}
