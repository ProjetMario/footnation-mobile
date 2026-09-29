import AsyncStorage from "@react-native-async-storage/async-storage";
import { createHiddenPostStore } from "./hiddenPostsState";
export const hiddenPostStore = createHiddenPostStore(AsyncStorage);
export const forgetHiddenPostsForAccount = hiddenPostStore.forget;
