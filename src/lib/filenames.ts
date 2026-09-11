/**
 * Human-readable, Hebrew-safe file names for the signed agreement.
 */

const MAX_NAME_LENGTH = 60;

/** Cleans a free-text client name for display and for file names. */
export function sanitizeClientName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
}

/** e.g. "הסכם-חתום-אסתי-צמרת.pdf" or "הסכם-חתום.pdf" */
export function signedFileName(clientName?: string) {
  const name = sanitizeClientName(clientName);
  const suffix = name ? `-${name.replace(/\s+/g, "-")}` : "";
  return `הסכם-חתום${suffix}.pdf`;
}

/** ASCII-only fallback for clients that ignore RFC 5987 `filename*`. */
export function asciiFallbackFileName(clientName?: string) {
  const name = sanitizeClientName(clientName)
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  return name ? `signed-agreement-${name}.pdf` : "signed-agreement.pdf";
}

/** Builds a Content-Disposition value carrying both an ASCII and a UTF-8 name. */
export function contentDisposition(
  type: "attachment" | "inline",
  fileName: string,
  fallback: string,
) {
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
