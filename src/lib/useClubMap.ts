import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { type ClubMapPoint, validMapLocation } from "./clubMap";
export function useClubMap(enabled: boolean) {
  return useQuery({
    queryKey: ["club-map-points"],
    enabled,
    staleTime: 30 * 60_000,
    queryFn: async ({ signal }) => {
      const points: ClubMapPoint[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("fff_clubs")
          .select(
            "id,name,short_name,city,department_code,latitude,longitude,logo_url,type,metadata",
          )
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("id")
          .range(offset, offset + 999)
          .abortSignal(signal);
        if (error) throw error;
        for (const row of data || []) {
          const metadata = row.metadata as Record<string, unknown> | null;
          const point: ClubMapPoint = {
            id: row.id,
            name: row.name,
            short_name: row.short_name,
            city: row.city,
            department_code: row.department_code,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            logo_url:
              row.logo_url ||
              (typeof metadata?.logo === "string" ? metadata.logo : null),
            type:
              row.type === "five_center" ||
              metadata?.type === "five_center" ||
              /five|soccer|urban|foot indoor|futsal/i.test(row.name)
                ? "five_center"
                : "club",
          };
          if (validMapLocation(point)) points.push(point);
        }
        if (!data || data.length < 1000) return points;
      }
    },
  });
}
