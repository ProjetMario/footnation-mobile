import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { assertOnline } from "./connectivity";
import { reportError } from "./monitoring";

export function createAppQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => reportError(error, "query"),
    }),
    mutationCache: new MutationCache({
      onMutate: () => assertOnline(),
      onError: (error) => reportError(error, "mutation"),
    }),
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000 },
      // Never queue a write to execute later without another explicit action.
      mutations: { retry: false, networkMode: "always" },
    },
  });
}
