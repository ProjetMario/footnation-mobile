import { useState } from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, Empty, ErrorState, Loading, SearchField, useUIStyles } from "../components/ui";
import { useAuth } from "../lib/auth";
import { loadCalendarEditorContext } from "../lib/calendarManagement";
import { useDebounced } from "../lib/data";
import { supabase } from "../lib/supabase";

type Player = { profile_id: string; member_name: string; team_status: string | null; team_role: string | null; team_active: boolean | null };
export default function CoachTeamPlayers({ id }: { id: string }) {
 const styles=useUIStyles(); const uid=useAuth().session!.user.id; const cache=useQueryClient();
 const [selected,setSelected]=useState<string | null>(null); const [search,setSearch]=useState(""); const term=useDebounced(search);
 const teams=useQuery({queryKey:["assignable-coach-teams",id,uid],queryFn:async()=>{
  const editor=await loadCalendarEditorContext(id,uid);
  const checks=await Promise.all(editor.teams.map(async team=>{
   const result=await supabase.rpc("can_assign_native_team_players",{p_club_id:id,p_team_id:team.id});
   if(result.error) throw result.error; return result.data===true ? team : null;
  }));
  return checks.filter((team): team is NonNullable<typeof team> => !!team);
 }});
 const players=useInfiniteQuery({queryKey:["team-assignable-players",id,uid,selected,term],enabled:!!selected,initialPageParam:0,queryFn:async({pageParam})=>{
  const result=await supabase.rpc("get_native_team_assignable_players",{p_club_id:id,p_team_id:selected,p_search:term,p_offset:pageParam});
  if(result.error) throw result.error; return result.data as Player[];
 },getNextPageParam:(last,pages)=>last.length===30 ? pages.length*30 : undefined});
 const add=useMutation({mutationFn:async(player:Player)=>{
  const result=await supabase.rpc("add_native_team_player",{p_club_id:id,p_team_id:selected,p_profile_id:player.profile_id});
  if(result.error) throw result.error;
 },onSuccess:()=>{
  void cache.invalidateQueries({queryKey:["team-assignable-players",id]});
  void cache.invalidateQueries({queryKey:["club-organization",id]});
  void cache.invalidateQueries({queryKey:["club-member-context",id]});
  void cache.invalidateQueries({queryKey:["member-space"]});
  void cache.invalidateQueries({queryKey:["member-calendar",id]});
 }});
 return <>
  <Text style={styles.h2}>Affecter des joueurs</Text>
  <Text style={styles.text}>Choisissez une de vos équipes, puis un joueur approuvé du club. Ses autres équipes sont conservées.</Text>
  {!!teams.isPending && <Loading />}
  {!!teams.error && <ErrorState error={teams.error} retry={()=>void teams.refetch()} />}
  {!!teams.data && !teams.data.length && <Empty title="Aucune équipe que vous pouvez gérer" />}
  <View style={[styles.row,{flexWrap:"wrap"}]}>{teams.data?.map(team=><Chip key={team.id} label={team.name} selected={selected===team.id} disabled={add.isPending} onPress={()=>{setSelected(team.id);setSearch("");add.reset();}} />)}</View>
  {!!selected && <>
   <SearchField value={search} onChangeText={(value)=>setSearch(value.slice(0,100))} placeholder="Rechercher un joueur approuvé" />
   {!!players.isPending && <Loading />}
   {!!players.error && <ErrorState error={players.error} retry={()=>void players.refetch()} />}
   {!!add.error && <ErrorState error={add.error} />}
   {players.data?.pages.flat().map(player=><View style={styles.card} key={player.profile_id}>
    <Text style={styles.h2}>{player.member_name}</Text>
    {player.team_status===null ? <Button title="Ajouter à cette équipe" disabled={add.isPending} onPress={()=>add.mutate(player)} /> :
     player.team_status==="approved" && player.team_active ? <Text style={styles.text}>Déjà membre de cette équipe</Text> :
     <Text style={styles.small}>Une affectation existe déjà : demandez à l’administration de la vérifier.</Text>}
   </View>)}
   {!!players.data && !players.data.pages.flat().length && <Empty title="Aucun joueur approuvé trouvé" />}
   {!!players.hasNextPage && <Button title="Charger la suite" busy={players.isFetchingNextPage} onPress={()=>void players.fetchNextPage()} />}
  </>}
 </>;
}
