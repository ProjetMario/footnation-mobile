import React, { useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  FRENCH_DEPARTMENTS,
  extractDeptCodeFromUrl,
  getDepartmentByCode,
  departmentUrl,
} from "../data/french-departments";
import {
  Button,
  Empty,
  MenuRow,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import Clubs from "./Clubs";
export default function ClubDepartments() {
  const s = useUIStyles();

  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase("fr-FR");
  const rows = FRENCH_DEPARTMENTS.filter((d) =>
    [d.name, d.code, d.region].some((v) =>
      v.toLocaleLowerCase("fr-FR").includes(term),
    ),
  );
  return (
    <Screen title="Clubs par département">
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Département, code ou région"
      />
      {!rows.length && <Empty title="Aucun département trouvé" />}
      {rows.map((d) => (
        <View key={d.code} style={s.card}>
          <MenuRow
            title={`${d.name} (${d.code})`}
            subtitle={d.region}
            onPress={() => router.push(departmentUrl(d))}
          />
        </View>
      ))}
    </Screen>
  );
}
export function DepartmentClubs() {
  const { combined } = useLocalSearchParams<{ combined: string }>();
  const code = extractDeptCodeFromUrl(combined || "");
  const department = code ? getDepartmentByCode(code) : undefined;
  if (!department)
    return (
      <Screen title="Département introuvable">
        <Empty title="Ce département n’est pas reconnu" />
        <Button
          title="Choisir un département"
          onPress={() => router.replace("/clubs-departement")}
        />
      </Screen>
    );
  if (combined !== `${department.slug}-${department.code}`)
    return <Redirect href={departmentUrl(department)} />;
  return <Clubs key={department.code} fixedDepartment={department} />;
}
