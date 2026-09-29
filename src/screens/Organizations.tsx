import React, { useCallback, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  organizationPayload,
  organizationTypes,
  type OrganizationForm,
} from "../lib/organizationForm";
import { createProContent } from "../lib/proContentSave";
export default function Organizations() {
  const uid = useAuth().session?.user.id;
  return <OrganizationsContent key={uid || "public"} uid={uid} />;
}
function OrganizationsContent({ uid }: { uid?: string }) {
  const s = useUIStyles();

  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="Organisations">
      <View style={s.row}>
        <Chip
          label="Parcourir"
          selected={!create}
          onPress={() => {
            if (!busy) setCreate(false);
          }}
        />
        <Chip
          label="Créer une organisation"
          selected={create}
          onPress={() => {
            if (!busy) setCreate(true);
          }}
        />
      </View>
      {create ? (
        <AuthGate>
          {!!uid && (
            <CreateOrganization
              uid={uid}
              done={() => setCreate(false)}
              setBusy={setBusy}
            />
          )}
        </AuthGate>
      ) : (
        <OrganizationList />
      )}
    </Screen>
  );
}
function OrganizationList() {
  const s = useUIStyles();

  const [linkError, setLinkError] = useState<unknown>(null);
  const query = useInfiniteQuery({
    queryKey: ["organizations"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await supabase
        .from("organizations")
        .select(
          "id,name,type,logo_url,description,website,department,address,contact_email,verified",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      return result.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  return (
    <>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!linkError && <ErrorState error={linkError} />}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.flat().length && (
            <Empty title="Aucune organisation pour le moment" />
          )}
          {query.data?.pages.flat().map((org) => (
            <View key={org.id} style={s.card}>
              <Avatar uri={org.logo_url} name={org.name} />
              <Text style={s.h2}>{org.name}</Text>
              <Text style={s.small}>
                {organizationTypes[
                  org.type as keyof typeof organizationTypes
                ] || org.type}
              </Text>
              {org.verified === true && (
                <Text style={s.small}>Organisation vérifiée</Text>
              )}
              {!!org.description && (
                <Text style={s.text}>{org.description}</Text>
              )}
              {!!org.address && <Text style={s.small}>{org.address}</Text>}
              {!!org.department && (
                <Text style={s.small}>Département {org.department}</Text>
              )}
              {!!org.website && (
                <ExternalLinkButton title="Site web" url={org.website} />
              )}
              {!!org.contact_email && (
                <Button
                  secondary
                  title={org.contact_email}
                  onPress={() => {
                    setLinkError(null);
                    void Linking.openURL(
                      `mailto:${encodeURIComponent(org.contact_email)}`,
                    ).catch(() =>
                      setLinkError(
                        new Error(
                          "Impossible d’ouvrir votre application email.",
                        ),
                      ),
                    );
                  }}
                />
              )}
            </View>
          ))}
          {!!query.hasNextPage && (
            <Button
              title="Afficher davantage"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </>
  );
}
function CreateOrganization({
  uid,
  done,
  setBusy,
}: {
  uid: string;
  done: () => void;
  setBusy: (value: boolean) => void;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [id] = useState(randomUUID);
  const [form, setForm] = useState<OrganizationForm>({
    name: "",
    type: "club",
    description: "",
    website: "",
    department: "",
    address: "",
    contact_email: "",
  });
  const [snapshot, setSnapshot] = useState<ReturnType<
    typeof organizationPayload
  > | null>(null);
  const [validation, setValidation] = useState<unknown>(null);
  const mutation = useMutation({
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    mutationFn: async (payload: ReturnType<typeof organizationPayload>) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez cet écran.");
      await createProContent(
        {
          read: async (key) => {
            const r = await supabase
              .from("organizations")
              .select(
                "id,created_by,name,type,description,website,department,address,contact_email",
              )
              .eq("id", key)
              .eq("created_by", uid)
              .maybeSingle();
            if (r.error) throw r.error;
            return r.data;
          },
          insert: async (row) => {
            const r = await supabase.from("organizations").insert(row);
            if (r.error) throw r.error;
          },
        },
        { id, created_by: uid, ...payload },
      );
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["organizations"] });
      done();
    },
  });
  const locked = !!snapshot;
  return (
    <>
      <Text style={s.small}>
        Ces informations seront visibles dans l’annuaire public.
      </Text>
      {(
        [
          ["name", "Nom de l’organisation"],
          ["description", "Description"],
          ["website", "Site web"],
          ["department", "Code du département"],
          ["address", "Adresse"],
          ["contact_email", "Email de contact"],
        ] as const
      ).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={form[key]}
          editable={!locked}
          multiline={key === "description"}
          onChangeText={(value) => {
            setValidation(null);
            setForm((v) => ({ ...v, [key]: value }));
          }}
        />
      ))}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(organizationTypes).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={form.type === value}
            onPress={() => {
              if (!locked) setForm((v) => ({ ...v, type: value }));
            }}
          />
        ))}
      </View>
      {!!validation && <ErrorState error={validation} />}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <Button
        title={snapshot ? "Réessayer la création" : "Créer l’organisation"}
        busy={mutation.isPending}
        onPress={() => {
          try {
            const payload = snapshot || organizationPayload(form);
            setSnapshot(payload);
            setValidation(null);
            mutation.mutate(payload);
          } catch (error) {
            setValidation(error);
          }
        }}
      />
    </>
  );
}
