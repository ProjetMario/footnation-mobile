import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, ErrorState, Field, Loading, useUIStyles } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Option = { source: string; source_team_id: string; team_name: string | null; category: string | null; gender: string | null; request_status: string | null };
export function CoachTeamRequests({ id }: { id: string }) {
 const s=useUIStyles(); const uid=useAuth().session!.user.id; const cache=useQueryClient();
 const now=new Date(); const [season,setSeason]=useState(String(now.getMonth()<6 ? now.getFullYear()-1 : now.getFullYear()));
 const year=Number(season); const valid=/^\d{4}$/.test(season) && year>=2000 && year<=2200;
 const query=useQuery({queryKey:["coach-team-options",id,uid,season],enabled:valid,retry:false,queryFn:async()=>{
  const result=await supabase.rpc("get_native_coach_team_options",{p_club_id:id,p_season:year});
  if(result.error) throw result.error; return result.data as Option[];
 }});
 const send=useMutation({mutationFn:async(row:Option)=>{
  const result=await supabase.rpc("request_native_coach_team",{p_club_id:id,p_season:year,p_source:row.source,p_source_team_id:row.source_team_id});
  if(result.error) throw result.error;
 },onSuccess:()=>{void cache.invalidateQueries({queryKey:["coach-team-options",id]});void cache.invalidateQueries({queryKey:["club-coach-requests",id]});}});
 if ((query.error as {code?:string} | null)?.code==="42501") return null;
 return <View style={s.card}>
  <Text style={s.h2}>Choisir une équipe à encadrer</Text>
  <Text style={s.text}>Votre choix est envoyé à l’administration. L’accès à l’équipe commence après validation.</Text>
  <Field label="Début de saison (année)" value={season} onChangeText={(v)=>{setSeason(v.slice(0,4));send.reset();}} />
  {!valid && <Text style={s.small}>Indiquez une année entre 2000 et 2200.</Text>}
  {valid && query.isPending && <Loading />}
  {!!query.error && <ErrorState error={query.error} retry={()=>void query.refetch()} />}
  {!!send.error && <ErrorState error={send.error} />}
  {query.data?.map(row=><View key={row.source+":"+row.source_team_id} style={s.card}>
   <Text style={s.text}>{row.team_name || "Équipe"} · {row.category || "Catégorie non renseignée"}</Text>
   <Text style={s.small}>Référence de l’équipe : {row.source_team_id}</Text>
   <Text style={s.small}>{row.request_status==="pending" ? "Demande en attente de validation" : row.request_status==="approved" ? "Demande acceptée" : row.request_status==="rejected" ? "Demande refusée" : "Aucune demande"}</Text>
   {row.request_status!=="pending" && <Button title={row.request_status==="rejected" ? "Faire une nouvelle demande" : "Demander cette équipe"} secondary disabled={send.isPending} onPress={()=>send.mutate(row)} />}
  </View>)}
  {!!query.data && !query.data.length && <Empty title="Aucune équipe publiée pour cette saison" />}
 </View>;
}
type Request = { id:string; profile_name:string; requested_role:string; season:number; team_name:string | null; source_team_id:string; team_id:string | null };
export function ClubCoachRequests({ id, onMap }: { id:string; onMap:()=>void }) {
 const s=useUIStyles(); const uid=useAuth().session!.user.id; const cache=useQueryClient();
 const query=useQuery({queryKey:["club-coach-requests",id,uid],queryFn:async()=>{
  const result=await supabase.rpc("get_native_coach_team_requests",{p_club_id:id});if(result.error) throw result.error;return result.data as Request[];
 }});
 const decide=useMutation({mutationFn:async({request,action}:{request:Request;action:"approve"|"reject"})=>{
  const result=await supabase.rpc("decide_native_coach_team_request",{p_club_id:id,p_request_id:request.id,p_action:action});if(result.error) throw result.error;
 },onSuccess:()=>{void cache.invalidateQueries({queryKey:["club-coach-requests",id]});void cache.invalidateQueries({queryKey:["club-organization",id]});void cache.invalidateQueries({queryKey:["coach-team-options",id]});}});
 return <View>
  <Text style={s.h2}>Demandes des coachs et éducateurs</Text>
  {!!query.isPending && <Loading />}
  {!!query.error && <ErrorState error={query.error} retry={()=>void query.refetch()} />}
  {!!decide.error && <ErrorState error={decide.error} />}
  {!!query.data && !query.data.length && <Text style={s.small}>Aucune demande en attente.</Text>}
  {query.data?.map(row=><View key={row.id} style={s.card}>
   <Text style={s.text}>{row.profile_name} · {row.requested_role}</Text>
   <Text style={s.subtitle}>{row.team_name || "Équipe"} · {row.season}–{row.season+1}</Text>
   <Text style={s.small}>Référence de l’équipe : {row.source_team_id}</Text>
   {!row.team_id && <><Text style={s.small}>Associez ou importez d’abord l’équipe pour valider cette demande.</Text><Button title="Associer l’équipe" secondary onPress={onMap} /></>}
   <Button title="Valider l’affectation" disabled={!row.team_id || decide.isPending} onPress={()=>decide.mutate({request:row,action:"approve"})} />
   <Button title="Refuser" secondary disabled={decide.isPending} onPress={()=>decide.mutate({request:row,action:"reject"})} />
  </View>)}
 </View>;
}
