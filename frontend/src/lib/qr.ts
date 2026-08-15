/**
 * Produces the only value encoded in a Digi-Doc QR code: a public retrieval
 * route containing an existing access code. No PIN, file URL, or package data
 * is included.
 */
export const getPackageRetrievalUrl = (accessCode: string): string => {
  const configuredFrontendUrl = import.meta.env.VITE_FRONTEND_URL?.trim();
  const frontendUrl = configuredFrontendUrl || window.location.origin;
  const baseUrl = frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`;

  const retrievalUrl = new URL('verify', baseUrl);
  retrievalUrl.searchParams.set('code', accessCode.trim().toUpperCase());
  return retrievalUrl.toString();
};
