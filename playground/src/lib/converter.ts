import { convert } from 'arazzo2openapi';

/**
 * Convert an Arazzo document string to an OpenAPI YAML string.
 * Runs entirely in the browser — source descriptions with remote URLs are
 * resolved via fetch; relative-path source descriptions fall back gracefully
 * with a type-inference note (no filesystem access in the browser).
 */
export async function convertArazzoToOpenAPI(content: string): Promise<string> {
  return convert(content, { format: 'yaml' });
}
