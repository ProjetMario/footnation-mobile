export async function readAsset(uri: string, maxBytes: number) {
  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size > maxBytes)
    throw new Error(`La pièce jointe dépasse ${maxBytes / 1024 / 1024} Mo.`);
  return blob.arrayBuffer();
}
