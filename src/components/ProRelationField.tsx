import React, { useState } from "react";
import { Modal, Text, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "./ui";
type Row = {
  id: string;
  name?: string;
  opponent?: string;
  match_date?: string;
  category?: string | null;
  season?: string | null;
};
function label(row: Row) {
  return row.name
    ? [row.name, row.category, row.season].filter(Boolean).join(" · ")
    : `${row.opponent || "Match"} · ${new Date(row.match_date!).toLocaleString("fr-FR")}`;
}
export function ProRelationField({
  pageId,
  kind,
  value,
  onChange,
  disabled = false,
}: {
  pageId: string;
  kind: "team" | "match";
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const s = useUIStyles();

  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const uid = useAuth().session!.user.id;
  const table = kind === "team" ? "pro_page_teams" : "pro_page_matches";
  const title = kind === "team" ? "Équipe associée" : "Match associé";
  const columns =
    kind === "team" ? "id,name,category,season" : "id,opponent,match_date";
  const selected = useQuery({
    queryKey: ["pro-relation-selected", pageId, kind, value, uid],
    enabled: !!value,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq("page_id", pageId)
        .eq("id", value)
        .maybeSingle();
      if (error) throw error;
      return data as Row | null;
    },
  });
  const query = useInfiniteQuery({
    queryKey: ["pro-relation-options", pageId, kind, search, uid],
    enabled: open,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from(table)
        .select(columns)
        .eq("page_id", pageId)
        .order(kind === "team" ? "name" : "match_date", {
          ascending: kind === "team",
        })
        .order("id");
      if (search.trim())
        request = request.ilike(
          kind === "team" ? "name" : "opponent",
          `%${search.trim().replace(/[\\%_]/g, "")}%`,
        );
      const { data, error } = await request.range(pageParam, pageParam + 19);
      if (error) throw error;
      return data as unknown as Row[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <View>
      <Text style={s.label}>{title}</Text>
      <Button
        title={
          value
            ? selected.data
              ? label(selected.data)
              : selected.isPending
                ? "Chargement…"
                : "Association indisponible"
            : "Aucune association"
        }
        secondary
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      {!!selected.error && (
        <ErrorState
          error={selected.error}
          retry={() => void selected.refetch()}
        />
      )}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Screen
          title={title}
          back={false}
          right={
            <Button title="Fermer" secondary onPress={() => setOpen(false)} />
          }
        >
          <SearchField value={search} onChangeText={setSearch} />
          <Button
            title="Aucune association"
            secondary
            onPress={() => {
              onChange("");
              setOpen(false);
            }}
          />
          {!!query.isPending && <Loading />}
          {!!query.error && (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          )}
          {query.data?.pages.flat().map((row) => (
            <Button
              key={row.id}
              title={label(row)}
              secondary={value !== row.id}
              onPress={() => {
                onChange(row.id);
                setOpen(false);
              }}
            />
          ))}
          {!!(query.data && !query.data.pages.flat().length) && (
            <Empty title="Aucun résultat sur cette page" />
          )}
          {!!query.hasNextPage && (
            <Button
              title="Charger la suite"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </Screen>
      </Modal>
    </View>
  );
}
