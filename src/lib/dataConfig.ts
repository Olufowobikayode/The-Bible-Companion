// Configuration for your external JSON databases (Google Drive, Firebase Storage, AWS S3, etc.)
// You will replace these placeholder URLs with the actual direct links to your hosted JSON files.

export const JSON_DB_CONFIG = {
  // Base URL for Canonical Books (e.g., Genesis to Revelation)
  // Expected structure: {baseUrl}/{translation}/{book_name}/{chapter}.json
  biblesBaseUrl: 'https://your-storage-url.com/database/bibles',

  // Base URL for Non-Canonical / Extra Books (e.g., Enoch, Jasher)
  // Expected structure: {baseUrl}/{translation}/{book_name}/{chapter}.json
  apocryphaBaseUrl: 'https://your-storage-url.com/database/apocrypha',

  // Base URL for the full Greek/Hebrew Concordance
  // Expected structure: {baseUrl}/{strongs_number_or_word}.json
  concordanceBaseUrl: 'https://your-storage-url.com/database/concordance',

  // Base URL for Cross References
  // Expected structure: {baseUrl}/{book_name}/{chapter}/{verse}.json
  crossReferencesBaseUrl: 'https://your-storage-url.com/database/crossrefs'
};

/**
 * Helper function to format book names for URLs (e.g., "1 Samuel" -> "1_samuel")
 */
export const formatUrlParam = (text: string) => {
  return text.toLowerCase().replace(/\s+/g, '_');
};
