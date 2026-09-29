export const levels = [
  "Ligue 1",
  "Ligue 2",
  "National",
  "National 2",
  "National 3",
  "Régional 1",
  "Régional 2",
  "Régional 3",
  "Départemental 1",
  "Départemental 2",
  "Départemental 3",
  "Départemental 4",
  "Départemental 5",
];
export const positions = [
  "Gardien de but",
  "Défenseur central",
  "Arrière latéral",
  "Milieu défensif",
  "Milieu central",
  "Milieu offensif",
  "Ailier",
  "Attaquant",
];
export const ages = [
  "U6-U7",
  "U8-U9",
  "U10-U11",
  "U12-U13",
  "U14-U15",
  "U16-U17",
  "U18-U19",
  "Séniors",
  "Vétérans",
];
export const benefits: Record<string, string> = {
  housing: "Logement",
  job: "Emploi",
  transport: "Transport",
  education: "Formation",
};
export const choices = (values: string[]) =>
  values.map((value) => ({ label: value, value }));
