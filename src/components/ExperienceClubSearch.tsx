import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useClubs } from "../lib/data";
import type { Club } from "../lib/models";
import { useTheme } from "../theme";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "./ui";

export function ExperienceClubSearch({
  initialName,
  onSelect,
  onClose,
}: {
  initialName: string;
  onSelect: (club: Pick<Club, "id" | "name">) => void;
  onClose: () => void;
}) {
  const s = useUIStyles();
  const { mode } = useTheme();
  const [search, setSearch] = useState(initialName);
  const query = useClubs(search, "");
  return (
    <Screen
      title="Choisir un club"
      back={false}
      scroll={false}
      right={<Button title="Fermer" secondary onPress={onClose} />}
    >
      <FlatList
        data={query.data?.pages.flatMap((page) => page.rows) || []}
        keyExtractor={(club) => club.id}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        indicatorStyle={mode === "dark" ? "white" : "black"}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Nom du club ou ville"
            />
            <Text style={s.small}>
              Choisissez la bonne fiche en vérifiant sa ville. Si le club est
              absent, fermez cette recherche et conservez son nom dans votre
              parcours.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choisir ${item.name}, ${[item.city, item.department_code].filter(Boolean).join(" · ")}`}
            style={s.card}
            onPress={() => onSelect(item)}
          >
            <Text style={s.h2}>{item.name}</Text>
            <Text style={s.small}>
              {[item.city, item.department_code].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <Empty
              title="Aucun club trouvé"
              description="Essayez un nom plus court ou la ville du club."
            />
          )
        }
        ListFooterComponent={
          query.data?.pages.some((page) => page.rows.length) ? (
            <View style={{ gap: 12 }}>
              {!!query.isError && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
              {!!query.hasNextPage && (
                <Button
                  title="Voir plus de clubs"
                  secondary
                  busy={query.isFetchingNextPage}
                  onPress={() => {
                    if (!query.isFetching) void query.fetchNextPage();
                  }}
                />
              )}
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
