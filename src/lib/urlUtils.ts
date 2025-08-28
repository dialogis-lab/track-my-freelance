/**
 * URL validation and normalization utilities
 */

// URL validation regex matching the database constraint
const urlRegex = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,24}(:[0-9]{2,5})?(\/\S*)?$/i;

/**
 * Normalizes a website URL by adding https:// if no protocol is present
 * Trims spaces and handles empty strings
 */
export function normalizeWebsite(input?: string | null): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  
  // If no protocol is present, prepend https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  
  return trimmed;
}

/**
 * Validates a website URL according to our rules
 * Returns true if valid or empty/null, false otherwise
 */
export function isValidWebsite(input?: string | null): boolean {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return true; // Empty is allowed
  
  return urlRegex.test(trimmed);
}

/**
 * Gets a user-friendly error message for website validation
 */
export function getWebsiteValidationError(): string {
  return "Bitte eine gültige URL eingeben (z. B. https://firma.de)";
}