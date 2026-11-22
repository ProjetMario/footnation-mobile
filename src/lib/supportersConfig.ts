/** Build-time rollback: hide entry points and stop all Supporters requests. */
export const SUPPORTERS_ENABLED = process.env.EXPO_PUBLIC_SUPPORTERS_ENABLED !== "false";
