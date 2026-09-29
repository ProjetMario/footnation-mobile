import { supabase } from "../supabase";
import {
  adminError,
  objectValue,
  parsePage,
  validateCommand,
  type Command,
  type Filters,
  type Overview,
  type Resource,
  type Receipt,
} from "./contracts";

// Every request uses the captured account's token. A session change never sends
// an old administrator's intent using the new account's credentials.
export function createAdminApi(uid: string, client = supabase) {
  async function token() {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== uid)
      throw new Error("La session a changé. Rouvrez l’administration.");
    return data.session.access_token;
  }
  async function rpc(name: string, args = {}) {
    const jwt = await token();
    const result = await client
      .rpc(name, args)
      .setHeader("Authorization", `Bearer ${jwt}`);
    await token();
    if (result.error) throw adminError(result.error);
    return result.data;
  }
  async function access() {
    if ((await rpc("can_review_content")) !== true)
      throw new Error(
        "Cet espace est réservé aux administrateurs actifs de FootNation.",
      );
    return true;
  }
  return {
    access,
    async page(resource: Resource, filters: Filters = {}, offset = 0) {
      return parsePage(
        await rpc("admin_console_page", {
          p_resource: resource,
          p_filters: filters,
          p_offset: offset,
          p_limit: 30,
        }),
      );
    },
    async overview(period = "day"): Promise<Overview> {
      const data = await rpc("admin_console_overview", { p_period: period });
      if (!data || !data.counts || !Array.isArray(data.signups))
        throw new Error("Les indicateurs sont indisponibles.");
      return data;
    },
    async mutate(command: Command): Promise<Receipt> {
      const result = await rpc(
        "admin_console_mutate",
        validateCommand(command),
      );
      if (
        !result?.id ||
        result.action !== command.action ||
        result.target_id !== command.record.id
      )
        throw new Error(
          "La modification n’a pas été confirmée. Actualisez avant de réessayer.",
        );
      return result;
    },
    async edge(
      name: "ga4-analytics" | "get-mobile-stats" | "admin-console-account",
      body: Record<string, unknown>,
    ) {
      await access();
      const jwt = await token();
      const result = await client.functions.invoke(name, {
        body,
        headers: { Authorization: `Bearer ${jwt}` },
      });
      await token();
      if (result.error) {
        if (
          name === "admin-console-account" &&
          result.error.context instanceof Response
        ) {
          const body = await result.error.context
            .clone()
            .json()
            .catch(() => null);
          if (typeof body?.error === "string" && body.error.length <= 500)
            throw new Error(body.error);
        }
        throw new Error(
          "Le service demandé est indisponible ou l’accès a été refusé.",
        );
      }
      if (result.data?.error)
        throw new Error(
          typeof result.data.error === "string"
            ? result.data.error
            : "Le service n’a pas confirmé l’opération.",
        );
      return objectValue(result.data);
    },
    async sports(season: string) {
      await access();
      const jwt = await token();
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/club-sport-data?view=status&season=${encodeURIComponent(season)}`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          signal: AbortSignal.timeout(15000),
        },
      );
      await token();
      if (!response.ok)
        throw new Error("Le suivi des données sportives est indisponible.");
      return objectValue(await response.json());
    },
  };
}
export type AdminApi = ReturnType<typeof createAdminApi>;
