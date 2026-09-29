import { useQuery, useQueryClient } from "@tanstack/react-query";

// Memory only. The auth provider clears this cache on logout/account changes.
// Shared between the feed and detail route so profile completion does not lose text.
export function usePostCommentDraft(
  userId: string | undefined,
  postId: string,
) {
  const cache = useQueryClient();
  const key = ["post-comment-draft", userId ?? "guest", postId];
  const { data = "" } = useQuery({
    queryKey: key,
    queryFn: () => "",
    initialData: "",
    enabled: false,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
  const setDraft = (value: string | ((previous: string) => string)) =>
    cache.setQueryData<string>(key, (previous = "") =>
      typeof value === "function" ? value(previous) : value,
    );
  return [data, setDraft] as const;
}
