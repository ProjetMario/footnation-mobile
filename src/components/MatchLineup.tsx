import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { LineupPitch } from "./LineupPitch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, ErrorState, Loading, useUIStyles } from "./ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Player = { id: string; name: string };
type Lineup = { formation: string; players: (string | null)[]; substitutes: string[]; visible_to_players: boolean; visible_to_public: boolean; revision: number };
type Result = { lineup: Lineup | null; candidates: Player[] };
const formations = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"];
export function MatchLineup({ clubId, matchId, close }: { clubId: string; matchId: string; close: () => void }) {
  const uid = useAuth().session!.user.id;
  const key = ["match-lineup", clubId, matchId, uid];
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const result = await supabase.rpc("get_native_match_lineup_editor", { p_club_id: clubId, p_match_id: matchId });
    if (result.error) throw result.error;
    return result.data as Result;
  }});
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  return <LineupEditor key={`${matchId}:${query.data.lineup?.revision || 0}`} clubId={clubId} matchId={matchId} data={query.data} queryKey={key} close={close} />;
}
function LineupEditor({ clubId, matchId, data, queryKey, close }: { clubId: string; matchId: string; data: Result; queryKey: string[]; close: () => void }) {
  const styles = useUIStyles();
  const cache = useQueryClient();
  const [formation, setFormation] = useState(data.lineup?.formation || "4-4-2");
  const [players, setPlayers] = useState<(string | null)[]>(data.lineup?.players || Array(11).fill(null));
  const [substitutes, setSubstitutes] = useState<string[]>(data.lineup?.substitutes || []);
  const [visiblePlayers, setVisiblePlayers] = useState(data.lineup?.visible_to_players || false);
  const [visiblePublic, setVisiblePublic] = useState(data.lineup?.visible_to_public || false);
  const [slot, setSlot] = useState<number | null>(null);
  const save = useMutation({ mutationFn: async () => {
    const result = await supabase.rpc("save_native_match_lineup_published", { p_club_id: clubId, p_match_id: matchId, p_formation: formation, p_players: players, p_substitutes: substitutes, p_visible_to_players: visiblePlayers, p_visible_to_public: visiblePublic, p_expected_revision: data.lineup?.revision ?? null });
    if (result.error) throw result.error;
  }, onSuccess: () => { void cache.invalidateQueries({ queryKey }); void cache.invalidateQueries({ queryKey: ["visible-match-lineup", clubId, matchId] }); close(); } });
  const lines = formation.split("-");
  const labels = ["Gardien", ...lines.flatMap((count, line) => {
    const role = line === 0 ? "Défenseur" : line === lines.length - 1 ? "Attaquant" : "Milieu";
    return Array.from({ length: Number(count) }, (_, n) => `${role} ${n + 1} · ligne ${line + 1}`);
  })];
  return <View style={styles.card}>
    <Text style={styles.h2}>Composition tactique</Text>
    <Text style={styles.small}>Choisissez une formation, puis les joueurs pour chaque poste.</Text>
    <View style={[styles.row, { flexWrap: "wrap" }]}>{formations.map((item) => <Chip key={item} label={item} selected={formation === item} onPress={() => setFormation(item)} />)}</View>
    <LineupPitch formation={formation} names={players.map((id) => data.candidates.find((p) => p.id === id)?.name || null)} onSelect={setSlot} />
    {slot !== null && <View style={styles.card}>
      <Text style={styles.text}>{labels[slot]} : choisissez un joueur</Text>
      <Button title="Retirer de ce poste" secondary onPress={() => { setPlayers((old) => old.map((value, i) => i === slot ? null : value)); setSlot(null); }} />
      {data.candidates.filter((p) => (!players.includes(p.id) || players[slot] === p.id) && !substitutes.includes(p.id)).map((p) => <Button key={p.id} title={p.name} secondary onPress={() => { setPlayers((old) => old.map((value, i) => i === slot ? p.id : value)); setSlot(null); }} />)}
      <Button title="Fermer la sélection" secondary onPress={() => setSlot(null)} />
    </View>}
    <Text style={styles.h2}>Remplaçants ({substitutes.length}/12)</Text>
    <Text style={styles.small}>Sélectionnez les joueurs à ajouter ou retirer.</Text>
    <View style={[styles.row, { flexWrap: "wrap" }]}>{data.candidates.filter((p) => !players.includes(p.id)).map((p) => <Chip key={p.id} label={p.name} selected={substitutes.includes(p.id)} onPress={() => setSubstitutes((old) => old.includes(p.id) ? old.filter((id) => id !== p.id) : old.length < 12 ? [...old, p.id] : old)} />)}</View>
    <View style={styles.row}><Text style={styles.text}>Publier aux joueurs de l’équipe</Text><Switch accessibilityLabel="Publier aux joueurs de l’équipe" value={visiblePlayers} onValueChange={setVisiblePlayers} /></View>
    <View style={styles.row}><Text style={styles.text}>Rendre visible au public</Text><Switch accessibilityLabel="Rendre visible au public" value={visiblePublic} onValueChange={setVisiblePublic} /></View>
    {!!save.error && <ErrorState error={save.error} retry={() => void cache.invalidateQueries({ queryKey })} />}
    <Button title="Enregistrer la composition" busy={save.isPending} onPress={() => save.mutate()} />
    <Button title="Fermer" secondary disabled={save.isPending} onPress={close} />
  </View>;
}
