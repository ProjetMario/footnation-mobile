export const PRESENTATION_VIDEO_ID = "Fj0XdsAZhXw";
export const PRESENTATION_VIDEO_URL = "https://www.foot-nation.com/videos/footnation-presentation.mp4";
export function presentationVideoUrl(language: string) {
  return language.toLowerCase().split(/[-_]/)[0] === "fr"
    ? PRESENTATION_VIDEO_URL
    : "https://www.foot-nation.com/videos/footnation-presentation-en.mp4";
}

export type PresentationVideoProps = {
  title: string;
  language: string;
  watchLabel: string;
};
