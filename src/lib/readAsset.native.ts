import { File } from "expo-file-system";
export async function readAsset(uri: string, maxBytes: number) {
  const file = new File(uri);
  if (file.size > maxBytes)
    throw new Error(`La pièce jointe dépasse ${maxBytes / 1024 / 1024} Mo.`);
  return file.arrayBuffer();
}
