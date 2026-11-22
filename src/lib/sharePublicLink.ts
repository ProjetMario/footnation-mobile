/** A copied link is reported explicitly; cancellation never copies or reports a share. */
export async function sharePublicLink(
  url: string,
  dependencies: {
    platform: string;
    share(message: string): Promise<{ action?: string } | void>;
    copy(message: string): Promise<boolean>;
  },
): Promise<"shared" | "copied" | "dismissed"> {
  try {
    const result = await dependencies.share(url);
    return result?.action === "dismissedAction" ? "dismissed" : "shared";
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    )
      return "dismissed";
    if (dependencies.platform !== "web" || !(await dependencies.copy(url)))
      throw error;
    return "copied";
  }
}
