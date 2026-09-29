export function canFilmMatch(kickoff: string, now = Date.now()) {
  const start = Date.parse(kickoff);
  return (
    Number.isFinite(start) && now >= start - 3600000 && now <= start + 3600000
  );
}
