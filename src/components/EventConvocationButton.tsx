import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Button, ErrorState } from "./ui";
import { supabase } from "../lib/supabase";
export function EventConvocationButton({ clubId, eventId, kind }: { clubId: string; eventId: string; kind: "match" | "session" }) {
  const create = useMutation({ mutationFn: async () => {
    const result = await supabase.rpc("create_native_event_convocation", { p_club_id: clubId, p_event_id: eventId, p_kind: kind });
    if (result.error) throw result.error;
    if (typeof result.data !== "string") throw new Error("Convocation inaccessible.");
    return result.data;
  }, onSuccess: (convocation) => router.push(`/club-admin/${clubId}/convocation/${convocation}?attendance=1`) });
  return <><Button title="Convoquer des membres" secondary busy={create.isPending} onPress={() => create.mutate()} />{!!create.error && <ErrorState error={create.error} />}</>;
}
