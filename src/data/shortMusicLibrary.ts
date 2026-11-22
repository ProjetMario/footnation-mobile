// Catalogue de morceaux dynamiques issus de Pixabay Music.
// Les URLs pointent vers les fichiers audio CDN afin d'éviter tout fichier
// lourd dans l'application. Pixabay publie ces morceaux sous sa Pixabay
// Content License : vérifier les conditions applicables avant une diffusion
// commerciale ou sponsorisée.

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  duration?: string;
  audioUrl: string;
  source?: "Pixabay Music";
  license?: "Pixabay Content License";
  isDefault?: boolean;
}

// Fonction pour obtenir la musique par défaut
export function getDefaultMusic(): MusicTrack {
  return musicLibrary.find((track) => track.isDefault) || musicLibrary[0];
}

/** Pick a stable soundtrack for a publication without an explicit track. */
export function getMusicForPublication(publicationId: string): MusicTrack {
  let hash = 0;
  for (let index = 0; index < publicationId.length; index += 1) {
    hash = (hash * 31 + publicationId.charCodeAt(index)) | 0;
  }
  const trackIndex = (hash >>> 0) % musicLibrary.length;
  return musicLibrary[trackIndex] || getDefaultMusic();
}

// Chaque entrée est une piste distincte : la sélection par publication est
// stable (un même post conserve sa musique) et varie d'un post à l'autre.
const rawMusicLibrary: MusicTrack[] = [
  // ⚡ SPORT & MOTIVATION (en premier pour recommandations)
  {
    id: "1",
    title: "Extreme Sport",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3",
  },
  {
    id: "2",
    title: "Adrenaline Rush",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749d484.mp3",
  },
  {
    id: "3",
    title: "Action Highlights",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2023/07/30/audio_e4a5880c26.mp3",
  },
  {
    id: "4",
    title: "Champion Mode",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2023/05/16/audio_166b9c7242.mp3",
  },
  {
    id: "5",
    title: "Goal Celebration",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2022/04/27/audio_67bcb50a30.mp3",
  },
  {
    id: "6",
    title: "Stadium Anthem",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2022/02/22/audio_d1718ab41b.mp3",
  },
  {
    id: "7",
    title: "Victory Lap",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2022/01/20/audio_0625c1539c.mp3",
  },
  {
    id: "8",
    title: "Training Beast",
    artist: "Pixabay Music",
    genre: "Sport",
    audioUrl: "https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3",
  },

  // 🔥 ÉNERGIE & DYNAMIQUE
  {
    id: "9",
    title: "Energy Boost",
    artist: "Pixabay Music",
    genre: "Énergie",
    audioUrl: "https://cdn.pixabay.com/audio/2022/10/25/audio_946b0939c8.mp3",
  },
  {
    id: "10",
    title: "Fast & Furious",
    artist: "Pixabay Music",
    genre: "Énergie",
    audioUrl: "https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3",
    isDefault: true,
  },
  {
    id: "11",
    title: "Pump It Up",
    artist: "Pixabay Music",
    genre: "Énergie",
    audioUrl: "https://cdn.pixabay.com/audio/2022/05/16/audio_3b8e5d5d1c.mp3",
  },
  {
    id: "12",
    title: "Unstoppable",
    artist: "Pixabay Music",
    genre: "Énergie",
    audioUrl: "https://cdn.pixabay.com/audio/2022/06/07/audio_b9bd4170e4.mp3",
  },
  {
    id: "13",
    title: "Power Move",
    artist: "Pixabay Music",
    genre: "Énergie",
    audioUrl: "https://cdn.pixabay.com/audio/2022/09/06/audio_dc39bbc0f4.mp3",
  },

  // 🎵 HIP-HOP / TRAP DYNAMIQUE
  {
    id: "14",
    title: "Hard Trap",
    artist: "Pixabay Music",
    genre: "Hip-Hop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/11/22/audio_a1e8d02d2f.mp3",
  },
  {
    id: "15",
    title: "Street Heat",
    artist: "Pixabay Music",
    genre: "Hip-Hop",
    audioUrl: "https://cdn.pixabay.com/audio/2023/03/20/audio_0f9c06a2d5.mp3",
  },
  {
    id: "16",
    title: "Bass Drop",
    artist: "Pixabay Music",
    genre: "Hip-Hop",
    audioUrl: "https://cdn.pixabay.com/audio/2022/10/30/audio_6c9c9a9d8a.mp3",
  },

  // 🎧 EDM / ÉLECTRO RAPIDE
  {
    id: "17",
    title: "Drop Zone",
    artist: "Pixabay Music",
    genre: "EDM",
    audioUrl: "https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3",
  },
  {
    id: "18",
    title: "Rave Mode",
    artist: "Pixabay Music",
    genre: "EDM",
    audioUrl: "https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3",
  },
  {
    id: "19",
    title: "Festival Energy",
    artist: "Pixabay Music",
    genre: "EDM",
    audioUrl: "https://cdn.pixabay.com/audio/2022/05/17/audio_407815a5a6.mp3",
  },
  {
    id: "20",
    title: "Club Banger",
    artist: "Pixabay Music",
    genre: "EDM",
    audioUrl: "https://cdn.pixabay.com/audio/2022/08/23/audio_d16737dc28.mp3",
  },
];

export const musicLibrary: MusicTrack[] = rawMusicLibrary.map((track) => ({
  ...track,
  source: "Pixabay Music",
  license: "Pixabay Content License",
}));

export const musicGenres = [
  "Tous",
  "Sport",
  "Énergie",
  "Hip-Hop",
  "EDM",
  "Cinematic",
];

export function searchMusic(query: string, genre?: string): MusicTrack[] {
  const lowerQuery = query.toLowerCase();
  return musicLibrary.filter((track) => {
    const matchesQuery =
      !query ||
      track.title.toLowerCase().includes(lowerQuery) ||
      track.artist.toLowerCase().includes(lowerQuery);
    const matchesGenre = !genre || genre === "Tous" || track.genre === genre;
    return matchesQuery && matchesGenre;
  });
}
