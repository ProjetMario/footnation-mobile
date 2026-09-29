import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import {
  createStoryPublicationJournal,
  type StoryDraftStore,
} from "./storyPublicationJournal";

function target(key: string) {
  if (!/^story-publication\.[0-9a-f-]{36}$/i.test(key))
    throw new Error("Compte invalide.");
  return new File(new Directory(Paths.document, "story-drafts"), `${key}.json`);
}
const store: StoryDraftStore = {
  read: async (key) => {
    const file = target(key),
      directory = file.parentDirectory;
    // Only this journal's unfinished temporary files, left by an interrupted
    // app process. Per-account serialization prevents deleting an active move.
    if (directory.exists)
      for (const candidate of directory.list()) {
        if (
          candidate instanceof File &&
          candidate.name.startsWith(`${key}.`) &&
          candidate.name.endsWith(".tmp")
        )
          candidate.delete();
      }
    return file.exists ? file.textSync() : null;
  },
  create: async (key, value) => {
    const file = target(key),
      directory = file.parentDirectory;
    directory.create({ intermediates: true, idempotent: true });
    if (file.exists) throw new Error("Une tentative existe déjà.");
    const temporary = new File(directory, `${key}.${randomUUID()}.tmp`);
    try {
      temporary.write(value);
      await temporary.move(file);
    } finally {
      if (temporary.exists && temporary.uri !== file.uri) temporary.delete();
    }
  },
  remove: async (key, expected) => {
    const file = target(key);
    // File operations are synchronous: comparison and removal cannot interleave
    // with another JS save. Only this account's exact local journal is removed.
    if (file.exists) {
      if (file.textSync() !== expected)
        throw new Error("La tentative locale a changé.");
      file.delete();
    }
  },
};
export const storyPublicationJournal = createStoryPublicationJournal(store);
