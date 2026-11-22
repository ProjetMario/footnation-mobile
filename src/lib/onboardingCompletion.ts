import AsyncStorage from "@react-native-async-storage/async-storage";

const key = (userId: string) => `footnation:onboarding-complete:${userId}`;

export async function markOnboardingComplete(userId: string) {
  await AsyncStorage.setItem(key(userId), new Date().toISOString());
}

export async function hasLocalOnboardingCompletion(userId: string) {
  return Boolean(await AsyncStorage.getItem(key(userId)));
}

export async function clearLocalOnboardingCompletion(userId: string) {
  await AsyncStorage.removeItem(key(userId));
}
