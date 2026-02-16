/**
 * Type definitions for runtime expression parsing and type inference
 */

export type ExpressionType =
  | 'step'       // $steps.stepId.outputs.field
  | 'input'      // $inputs.field
  | 'url'        // $url
  | 'method'     // $method
  | 'statusCode' // $statusCode
  | 'request'    // $request.header.name
  | 'response'   // $response.body#/path
  | 'literal';   // Any non-expression value

export interface ParsedExpression {
  type: ExpressionType;
  raw: string;

  // For $steps expressions
  stepId?: string;
  field?: string;        // Usually "outputs"
  outputName?: string;   // e.g., "body", "name"

  // For JSONPath fragments (after #)
  jsonPath?: string;     // e.g., "/data/0/id"

  // For $inputs expressions
  inputName?: string;

  // For literals
  literalValue?: any;
}

/**
 * Inferred type information from runtime expressions
 */
export interface InferredType {
  // JSON Schema type
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

  // JSON Schema format
  format?: string;

  // Description from source schema
  description?: string;

  // For arrays
  items?: InferredType;

  // For objects
  properties?: Record<string, InferredType>;
  required?: string[];

  // For enums
  enum?: any[];

  // Constraints
  minimum?: number;
  maximum?: number;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;

  // Metadata
  source: 'inferred' | 'literal' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
  originalExpression: string;
  resolutionNote?: string;
}

/**
 * Result of inferring types for all workflow outputs
 */
export interface TypeInferenceResult {
  // Schema element for the response (ApiDOM SchemaElement in actual implementation)
  schema: any;

  // Metadata about inference process
  metadata: {
    totalFields: number;
    resolvedCount: number;
    fallbackCount: number;
    literalCount: number;
    unresolvedExpressions: string[];
  };
}
