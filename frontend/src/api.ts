export const API_CACHE_BUSTER = "20260419-fix1";

export function buildApiUrl(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${API_CACHE_BUSTER}`;
}
