import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Directory, File, Paths } from "expo-file-system";
import { cvFileName, cvHtml, cvWordHtml, type CVProfile } from "./cv";
export type CVAction = "pdf" | "word" | "print";
export async function exportCV(
  profile: CVProfile,
  action: CVAction,
  assertCurrent = () => {},
) {
  assertCurrent();
  if (action === "print") {
    await Print.printAsync({ html: cvHtml(profile) });
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      "Le partage de fichiers n’est pas disponible sur cet appareil. Vous pouvez utiliser Imprimer.",
    );
  const folder = new Directory(Paths.cache, `footnation-cv-${Date.now()}`);
  folder.create({ intermediates: true });
  const file = new File(
    folder,
    cvFileName(profile, action === "pdf" ? "pdf" : "doc"),
  );
  if (action === "pdf") {
    const result = await Print.printToFileAsync({
      html: cvHtml(profile),
      width: 595,
      height: 842,
    });
    await new File(result.uri).move(file);
  } else {
    file.create();
    file.write("\ufeff" + cvWordHtml(profile));
  }
  assertCurrent();
  await Sharing.shareAsync(file.uri, {
    mimeType: action === "pdf" ? "application/pdf" : "application/msword",
    UTI: action === "pdf" ? "com.adobe.pdf" : "com.microsoft.word.doc",
    dialogTitle: "Enregistrer ou partager mon CV FootNation",
  });
}
