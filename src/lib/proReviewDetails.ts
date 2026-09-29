export function withProReview<T extends Record<string, any>>(page: T) {
  const privateRow = Array.isArray(page.review) ? page.review[0] : page.review;
  return {
    ...page,
    request_message: privateRow?.request_message ?? null,
    verification_notes: privateRow?.verification_notes ?? null,
  };
}
