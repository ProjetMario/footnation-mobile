import { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, Empty, ErrorState, Field, Loading, useUIStyles } from "../components/ui";
import { useAuth } from "../lib/auth";
import { requireAttendanceAdmin } from "./ClubAttendanceSessions";
import { supabase } from "../lib/supabase";
type Source = { source: string; source_team_id: string; team_name: string | null; category: string | null; gender: string | null; team_id: string | null };
type Team = { id: string; name: string; category: string; season: string };
type Action = { source: Source; team: Team | null; id: string };
export default function ClubSourceTeams({ id, close }: { id: string; close: () => void }) {
 const s = useUIStyles(); const uid=useAuth().session!.user.id; const cache=useQueryClient();
 const now=new Date(); const [season,setSeason]=useState(String(now.getMonth()<6 ? now.getFullYear()-1 : now.getFullYear()));
 const year=Number(season); const valid=/^\d{4}$/.test(season) && year>=2000 && year<=2200;
 const [action,setAction]=useState<Action | null>(null);
 const query=useQuery({queryKey:["club-source-team-mapping",id,uid,season],enabled:valid,queryFn:async()=>{
  await requireAttendanceAdmin(id,uid);
  const [source,managed]=await Promise.all([
   supabase.rpc("get_native_sports_team_choices",{p_club_id:id,p_season:year}),
   supabase.from("teams").select("id,name,category,season").eq("club_id",id).eq("is_active",true).order("name"),
  ]);
  if(source.error) throw source.error; if(managed.error) throw managed.error;
  const seasons=[season,`${season}-${year+1}`,`${season}-${String(year+1).slice(-2)}`];
  return {sources:source.data as Source[],teams:(managed.data as Team[]).filter(team=>seasons.includes(team.season))};
 }});
 const save=useMutation({mutationFn:async (a:Action)=>{
  await requireAttendanceAdmin(id,uid);
  const result=a.team ? await supabase.rpc("map_native_sports_team",{p_club_id:id,p_season:year,p_source:a.source.source,p_source_team_id:a.source.source_team_id,p_team_id:a.team.id,p_expected_team_id:null}) : await supabase.rpc("import_native_sports_team",{p_club_id:id,p_season:year,p_source:a.source.source,p_source_team_id:a.source.source_team_id,p_team_id:a.id});
  if(result.error) throw result.error;
 },onSuccess:()=>{setAction(null);void cache.invalidateQueries({queryKey:["club-source-team-mapping",id]});void cache.invalidateQueries({queryKey:["club-organization-teams",id]});void cache.invalidateQueries({queryKey:["club-admin-records",id,"teams"]});void cache.invalidateQueries({queryKey:["club-coach-requests",id]});}});
 return <>
  <Button title="Retour aux affectations" secondary onPress={close} />
  <Text style={s.h2}>Équipes de la fiche du club</Text>
  <Text style={s.text}>Importez une équipe de la fiche publique ou associez-la explicitement à une équipe gérée de la même saison. Les membres existants ne sont pas déplacés.</Text>
  <Field label="Début de saison (année)" value={season} onChangeText={(v)=>{setSeason(v.slice(0,4));setAction(null);save.reset();}} />
  {!valid && <Text style={s.small}>Indiquez une année entre 2000 et 2200.</Text>}
  {query.isPending && valid && <Loading />}
  {!!query.error && <ErrorState error={query.error} retry={()=>void query.refetch()} />}
  {!!save.error && <ErrorState error={save.error} />}
  {query.data?.sources.map((source)=><View key={`${source.source}:${source.source_team_id}`} style={s.card}>
   <Text style={s.h2}>{source.team_name || "Nom non renseigné"}</Text>
   <Text style={s.subtitle}>{source.category || "Catégorie non renseignée"} · {source.gender || "Genre non renseigné"} · {source.source}</Text>
   <Text style={s.small}>Référence de l’équipe : {source.source_team_id}</Text>
   {source.team_id ? <Text style={s.text}>Associée à {query.data.teams.find(t=>t.id===source.team_id)?.name || "une équipe gérée"}</Text> : <>
    <Button title="Importer comme nouvelle équipe" secondary onPress={()=>{save.reset();setAction({source,team:null,id:randomUUID()});}} />
    {!!query.data.teams.length && <Text style={s.label}>Ou choisir une équipe gérée existante :</Text>}
    <View style={[s.row,{flexWrap:"wrap"}]}>{query.data.teams.map(team=><Chip key={team.id} label={`${team.name} · ${team.category}`} selected={action?.source.source_team_id===source.source_team_id && action.team?.id===team.id} onPress={()=>{save.reset();setAction({source,team,id:randomUUID()});}} />)}</View>
    {action?.source.source===source.source && action.source.source_team_id===source.source_team_id && <View style={s.card}>
     <Text style={s.text}>{action.team ? `Associer ${source.team_name} à ${action.team.name} ?` : `Importer ${source.team_name} pour ${season}–${year+1} ?`}</Text>
     <Button title="Confirmer" busy={save.isPending} onPress={()=>save.mutate(action)} />
     <Button title="Annuler" secondary disabled={save.isPending} onPress={()=>{setAction(null);save.reset();}} />
    </View>}
   </>}
  </View>)}
  {!!query.data && !query.data.sources.length && <Empty title="Aucune équipe publique pour cette saison" />}
 </>;
}
