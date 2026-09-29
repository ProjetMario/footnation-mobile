import { Asset } from "expo-asset";
import { cvFileName, cvHtml, cvWordHtml, type CVProfile } from "./cv";
export type CVAction = "pdf" | "word" | "print";
const base64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
};
let fonts: Promise<{ regular: string; bold: string }> | undefined;
async function loadFonts() {
  if (!fonts)
    fonts = Promise.all(
      [
        require("../../assets/fonts/Inter-Regular.ttf"),
        require("../../assets/fonts/Inter-Bold.ttf"),
      ].map(async (module) => {
        const response = await fetch(Asset.fromModule(module).uri);
        if (!response.ok)
          throw new Error("Impossible de charger la police du CV. Réessayez.");
        return base64(await response.arrayBuffer());
      }),
    )
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((error) => {
        fonts = undefined;
        throw error;
      });
  return fonts;
}
async function photo(uri?: string) {
  if (!uri || !/^https:\/\//.test(uri)) return undefined;
  // Optional image, bounded wait. A missing avatar must not block a PDF export.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(uri, { signal: controller.signal });
    if (!response.ok) return undefined;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return undefined;
    }
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      192,
      192,
    );
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function exportCV(
  profile: CVProfile,
  action: CVAction,
  assertCurrent = () => {},
) {
  assertCurrent();
  if (action === "print") {
    const preview = window.open("", "_blank");
    if (!preview)
      throw new Error(
        "Autorisez l’ouverture de la fenêtre d’impression, puis réessayez.",
      );
    preview.opener = null;
    preview.document.open();
    preview.document.write(cvHtml(profile));
    preview.document.close();
    // Print only the CV document, without application navigation or action buttons.
    await Promise.race([
      Promise.all(
        Array.from(preview.document.images).map((img) =>
          img.decode().catch(() => {}),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
    try {
      assertCurrent();
    } catch (error) {
      preview.close();
      throw error;
    }
    preview.focus();
    preview.print();
    return;
  }
  if (action === "word") {
    download(
      new Blob(["\ufeff", cvWordHtml(profile)], {
        type: "application/msword;charset=utf-8",
      }),
      cvFileName(profile, "doc"),
    );
    return;
  }
  const [{ renderCVPdf }, fontData, avatar] = await Promise.all([
    import("./cvPdf"),
    loadFonts(),
    photo(profile.avatar_url),
  ]);
  assertCurrent();
  const pdf = renderCVPdf(profile, { ...fontData, avatar });
  download(pdf.output("blob"), cvFileName(profile, "pdf"));
}
