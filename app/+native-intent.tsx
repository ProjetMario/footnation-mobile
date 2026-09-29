import { incomingPath } from "../src/lib/incomingPath";
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  return incomingPath(path, __DEV__);
}
