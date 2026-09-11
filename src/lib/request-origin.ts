/**
 * Public origin of the deployment, for links placed in owner emails.
 * Prefers an explicit PUBLIC_BASE_URL, then proxy headers (Render), then the
 * request URL itself.
 */
export function getPublicOrigin(request: Request) {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    return configured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto || "https"}://${host}`;
  }

  return new URL(request.url).origin;
}
