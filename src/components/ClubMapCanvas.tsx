"use dom";
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ClubMapPoint, MapLocation } from "../lib/clubMap";

export default function ClubMapCanvas({
  token,
  points,
  location,
  focusKey,
  onSelect,
  height = 380,
}: {
  token: string;
  points: ClubMapPoint[];
  location: MapLocation | null;
  focusKey: string;
  onSelect: (id: string) => Promise<void>;
  height?: number;
  dom?: import("expo/dom").DOMProps;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    setReady(false);
    setFailed(false);
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: container.current,
        accessToken: token,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [2.35, 46.6],
        zoom: 4.7,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      map.on("load", () => {
        map.addSource("clubs", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 40,
        });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "clubs",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#087CFF",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              19,
              100,
              25,
              1000,
              32,
            ],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#fff",
          },
        });
        map.addLayer({
          id: "counts",
          type: "symbol",
          source: "clubs",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: { "text-color": "#fff" },
        });
        map.addLayer({
          id: "clubs-points",
          type: "circle",
          source: "clubs",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "match",
              ["get", "kind"],
              "five_center",
              "#a855f7",
              "#087CFF",
            ],
            "circle-radius": 7,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        map.on("click", "clusters", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          (
            map.getSource("clubs") as mapboxgl.GeoJSONSource
          ).getClusterExpansionZoom(
            feature.properties!.cluster_id,
            (error, zoom) => {
              if (!error && zoom != null)
                map.easeTo({
                  center: (feature.geometry as GeoJSON.Point).coordinates as [
                    number,
                    number,
                  ],
                  zoom,
                });
            },
          );
        });
        map.on("click", "clubs-points", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") void select.current(id);
        });
        for (const layer of ["clusters", "clubs-points"]) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
        setReady(true);
      });
      map.on("error", () => {
        if (!map.isStyleLoaded()) setFailed(true);
      });
    } catch {
      setFailed(true);
      return;
    }
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [token, revision]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (mapRef.current.getSource("clubs") as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
        properties: { id: p.id, kind: p.type },
      })),
    });
  }, [points, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (location) {
      if (!marker.current)
        marker.current = new mapboxgl.Marker({ color: "#0cba91" })
          .setLngLat([location.longitude, location.latitude])
          .addTo(map);
      else marker.current.setLngLat([location.longitude, location.latitude]);
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: 10,
        duration: 650,
      });
    } else {
      marker.current?.remove();
      marker.current = null;
      if (focusKey && points.length) {
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach((p) => bounds.extend([p.longitude, p.latitude]));
        map.fitBounds(bounds, { padding: 50, maxZoom: 12, duration: 650 });
      } else map.flyTo({ center: [2.35, 46.6], zoom: 4.7, duration: 650 });
    }
  }, [ready, location, focusKey, points.length]);
  return (
    <div
      style={{
        width: "100%",
        height,
        position: "relative",
        background: "#edf2f7",
        fontFamily: "system-ui",
      }}
    >
      <div
        ref={container}
        role="region"
        aria-label="Carte des clubs FootNation"
        style={{ width: "100%", height: "100%" }}
      />
      {failed && (
        <div
          role="alert"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            gap: 12,
            textAlign: "center",
            padding: 24,
            background: "#f7f9fc",
          }}
        >
          <span>La carte n’a pas pu se charger.</span>
          <button onClick={() => setRevision((r) => r + 1)}>
            Réessayer la carte
          </button>
        </div>
      )}
    </div>
  );
}
