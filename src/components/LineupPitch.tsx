import { Pressable, Text, View } from "react-native";

type Props = { formation: string; names: (string | null)[]; onSelect?: (index: number) => void };
export function LineupPitch({ formation, names, onSelect }: Props) {
  const counts = formation.split("-").map(Number);
  const lines: number[][] = [[0]];
  let offset = 1;
  for (const count of counts) {
    lines.push(Array.from({ length: count }, (_, i) => offset + i));
    offset += count;
  }
  return <View accessibilityLabel={`Terrain de football, formation ${formation}`} style={{ backgroundColor: "#166b42", borderColor: "#dbf2df", borderWidth: 2, borderRadius: 12, padding: 8, minHeight: 280, justifyContent: "space-around" }}>
    {lines.reverse().map((line, lineIndex) => <View key={lineIndex} style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 9 }}>
      {line.map((index) => <Pressable key={index} accessibilityRole={onSelect ? "button" : undefined} accessibilityLabel={`Poste ${index + 1} : ${names[index] || "non attribué"}`} onPress={onSelect ? () => onSelect(index) : undefined} style={{ alignItems: "center", flex: 1 }}>
        <View style={{ backgroundColor: "#f7faf8", width: 27, height: 27, borderRadius: 14, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#174a32", fontWeight: "700" }}>{index + 1}</Text></View>
        <Text numberOfLines={2} style={{ color: "white", textAlign: "center", fontSize: 11, marginTop: 3 }}>{names[index] || (onSelect ? "Choisir" : "—")}</Text>
      </Pressable>)}
    </View>)}
  </View>;
}
