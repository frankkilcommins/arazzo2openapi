/**
 * Simple server configuration (mirrors OpenAPI Server Object)
 */
export interface ServerConfig {
  url: string;
  description?: string;
}

/**
 * Configuration for OpenAPI generation
 */
export interface GenerationConfig {
  /** Path to the Arazzo document */
  arazzoPath: string;

  /** Path to the output OpenAPI document */
  outputPath: string;

  /** OpenAPI version to generate (3.0, 3.1, 3.2) */
  openapiVersion: string;

  /** Output format (json or yaml) */
  outputFormat?: 'json' | 'yaml';

  /** Success response code (200 or 202) */
  responseCode?: number;

  /** Override for OpenAPI info.title */
  title?: string;

  /** Override for OpenAPI info.version */
  version?: string;

  /** Override for OpenAPI info.description */
  description?: string;

  /** Override for servers array */
  servers?: ServerConfig[];

  /** Tag for generated operations */
  tag?: string;

  /** Whether to validate the generated OpenAPI document */
  validate?: boolean;

  /** Whether to embed the full Arazzo document in x-arazzo-document */
  embedArazzo?: boolean;
}

/**
 * Workflow selection for conversion
 */
export interface WorkflowSelection {
  /** List of workflow IDs to include */
  workflowIds?: string[];

  /** Whether to use interactive selection */
  interactive?: boolean;
}
