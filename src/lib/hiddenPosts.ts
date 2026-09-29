import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { hiddenPostStore as store } from "./hiddenPostStorage";

export function useHiddenPosts() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const key = ["hidden-posts", uid];
  const query = useQuery({
    queryKey: key,
    enabled: !!uid,
    staleTime: Infinity,
    queryFn: () => store.list(uid!),
  });
  const hide = async (id: string) => {
    if (!uid) throw new Error("Connectez-vous pour masquer ce contenu.");
    const ids = await store.hide(uid, id);
    cache.setQueryData(key, ids);
  };
  return { ...query, ids: query.data || [], hide };
}
