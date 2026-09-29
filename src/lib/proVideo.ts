import type { ImagePickerAsset } from "expo-image-picker";
export const MAX_PRO_VIDEO_BYTES = 50 * 1024 * 1024;
const videoExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
export function validateProVideo(
  asset: Pick<ImagePickerAsset, "mimeType" | "fileSize" | "type">,
  measuredSize?: number,
) {
  const mime = asset.mimeType || "";
  const extension = videoExtensions[mime];
  const size = measuredSize ?? asset.fileSize;
  if (!extension || asset.type !== "video")
    throw new Error("Choisissez une vidéo MP4, MOV ou WebM.");
  if (
    typeof size === "number" &&
    (!Number.isInteger(size) || size <= 0 || size > MAX_PRO_VIDEO_BYTES)
  )
    throw new Error("Choisissez une vidéo de 50 Mo maximum.");
  return { mime, extension };
}
