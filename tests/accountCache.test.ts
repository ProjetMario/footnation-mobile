import { it, expect } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
it("a remounted observer does not retain the previous account snapshot", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await client.fetchQuery({
    queryKey: ["personal-data"],
    queryFn: async () => "account-a",
  });
  client.clear();
  const observer = new QueryObserver(client, {
    queryKey: ["personal-data"],
    queryFn: async () => "account-b",
  });
  expect(observer.getCurrentResult().data).toBeUndefined();
  const unsubscribe = observer.subscribe(() => {});
  await observer.refetch();
  expect(observer.getCurrentResult().data).toBe("account-b");
  unsubscribe();
  client.clear();
});
it("a late request cannot repopulate the next account cache", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let finish!: (value: string) => void;
  const previous = client
    .fetchQuery({
      queryKey: ["personal-data"],
      queryFn: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    })
    .catch(() => undefined);
  client.clear();
  await client.fetchQuery({
    queryKey: ["personal-data"],
    queryFn: async () => "account-b",
  });
  finish("account-a");
  await previous;
  expect(client.getQueryData(["personal-data"])).toBe("account-b");
  client.clear();
});
