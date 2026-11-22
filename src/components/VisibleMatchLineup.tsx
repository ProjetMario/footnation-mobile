import { useState } from "react";
import { Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Button, ErrorState, Loading, useUIStyles } from "./ui";
import { LineupPitch } from "./LineupPitch";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
type Visible = { formation: string; players: (string | null)[]; substitutes: string[] };
export function VisibleMatchLineup({ clubId, matchId }: { clubId: string; matchId: string }) {
  const styles = useUIStyles();
  const uid = useAuth().session?.user.id || "public";
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["visible-match-lineup", clubId, matchId, uid], enabled: open, staleTime: 0, refetchOnMount: "always", queryFn: async () => {
    const result = await supabase.rpc("get_visible_native_match_lineup", { p_club_id: clubId, p_match_id: matchId });
    if (result.error) throw result.error;
    return result.data as Visible | null;
  }});
  return <View>
    <Button title={open ? "Masquer la composition" : "Voir la composition"} secondary onPress={() => setOpen((value) => !value)} />
    {open && <>
      {!!query.isFetching && <Loading />}
      {!!query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      {!query.isFetching && !!query.data && <><Text style={styles.text}>Formation : {query.data.formation}</Text><LineupPitch formation={query.data.formation} names={query.data.players} /><Text style={styles.h2}>Remplaçants</Text><Text style={styles.text}>{query.data.substitutes.join(", ") || "Aucun remplaçant renseigné"}</Text></>}
      {!query.isFetching && query.data === null && <Text style={styles.small}>La composition n’est pas disponible.</Text>}
    </>}
  </View>;
}
