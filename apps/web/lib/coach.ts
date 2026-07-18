export function coachHref(prompt?: string): string {
  if (prompt === undefined || prompt.trim().length === 0) return "/app/coach";
  const params = new URLSearchParams({ prompt: prompt.trim().slice(0, 500) });
  return `/app/coach?${params.toString()}`;
}
