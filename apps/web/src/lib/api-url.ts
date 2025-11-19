/**
 * Gets the base API URL, handling nginx proxy for same-origin testing.
 * 
 * When accessed through nginx on port 3100, uses relative URLs for same-origin requests.
 * Otherwise, falls back to NEXT_PUBLIC_BASE_API_URL environment variable.
 */
export function getBaseApiUrl(): string {
  // If running in browser, check if we're on the nginx proxy port (3100)
  // This allows same-origin testing with nginx
  if (typeof window !== "undefined") {
    const currentOrigin = window.location.origin;
    // If accessing through nginx proxy (port 3100), use current origin for same-origin
    if (currentOrigin.includes(":3100")) {
      return currentOrigin;
    }
  }

  // Fall back to environment variable (for direct access or production)
  const envUrl = process.env.NEXT_PUBLIC_BASE_API_URL;
  if (!envUrl) {
    throw new Error(
      "NEXT_PUBLIC_BASE_API_URL is not defined. Please set it in your environment variables."
    );
  }

  return envUrl;
}

