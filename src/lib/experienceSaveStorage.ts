import storage from "./sessionStorage";
import { createExperienceJournal } from "./experienceJournal";
export const experienceJournal = createExperienceJournal(storage);
/** Called only after a confirmed server account deletion. */
export const forgetExperienceSaveForAccount = (uid: string) =>
  experienceJournal.forgetAccount(uid);
