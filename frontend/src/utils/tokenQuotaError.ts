export const TOKEN_QUOTA_EXCEEDED_CODE = "TOKEN_QUOTA_EXCEEDED";

export const TOKEN_QUOTA_CONTACT_ADMIN_MESSAGE =
  "Contact platform admin";

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
} | null | undefined;

export function isTokenQuotaExceeded(payload: ApiErrorPayload): boolean {
  return payload?.code === TOKEN_QUOTA_EXCEEDED_CODE;
}

export function isTokenQuotaExceededMessage(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return /token quota is exhausted|no tokens have been allocated|contact platform admin/i.test(
    message,
  );
}

/** User-facing copy when an LLM call is blocked because tokens were consumed. */
export function apiErrorMessage(
  payload: ApiErrorPayload,
  fallback: string,
): string {
  const message =
    typeof payload?.message === "string" ? payload.message.trim() : "";
  if (isTokenQuotaExceeded(payload) || isTokenQuotaExceededMessage(message)) {
    return TOKEN_QUOTA_CONTACT_ADMIN_MESSAGE;
  }
  return message || fallback;
}

export function errorToUserMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (isTokenQuotaExceededMessage(message)) {
    return TOKEN_QUOTA_CONTACT_ADMIN_MESSAGE;
  }
  return message.trim() || fallback;
}
