import { useEffect, useState } from "react";
import {
  createWebSoundtrackPlayer,
  initialSoundtrackStatus,
  type SoundtrackPlayer,
} from "./soundtrackPlayer";

export function useSoundtrackPlayer(uri: string) {
  const [player, setPlayer] = useState<SoundtrackPlayer | null>(null);
  const [status, setStatus] = useState(initialSoundtrackStatus);
  useEffect(() => {
    const audio = document.createElement("audio");
    audio.hidden = true;
    audio.dataset.footnationSoundtrack = "true";
    audio.preload = "metadata";
    const track = createWebSoundtrackPlayer(audio, setStatus);
    audio.src = uri;
    document.body.appendChild(audio);
    setStatus(initialSoundtrackStatus);
    setPlayer(track.player);
    return () => {
      track.dispose();
    };
  }, [uri]);
  return { player, status };
}
