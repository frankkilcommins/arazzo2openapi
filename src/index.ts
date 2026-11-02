// Core modules
export { ArazzoParser } from './core/arazzo-parser';
export { WorkflowAnalyzer } from './core/workflow-analyzer';
export { MetadataDeriver } from './core/metadata-deriver';
export { OpenAPIGenerator } from './core/openapi-generator';
export { RuntimeExpressionParser } from './core/runtime-expression-parser';
export { SourceDocumentResolver } from './core/source-document-resolver';
export type { SourceDocumentResolverOptions } from './core/source-document-resolver';
export { TypeResolver } from './core/type-resolver';
export { TypeInferenceEngine } from './core/type-inference-engine';

// Types
export type { GenerationConfig, ServerConfig } from './types/config';

export { ArazzoParseError, ValidationError, WorkflowAnalysisError, SchemaDerivationError } from './types/errors';

export type {
  AnalyzedWorkflow,
  WorkflowInputs,
  WorkflowOutputs,
  OutputField,
  WorkflowStep,
} from './core/workflow-analyzer';

export type {
  ExpressionType,
  ParsedExpression,
  InferredType,
  TypeInferenceResult,
} from './types/runtime-expression';

// High-level convert API
import { ArazzoParser } from './core/arazzo-parser';
import { WorkflowAnalyzer } from './core/workflow-analyzer';
import { OpenAPIGenerator } from './core/openapi-generator';
import { TypeInferenceEngine } from './core/type-inference-engine';
import { SourceDocumentResolver, SourceDocumentResolverOptions } from './core/source-document-resolver';
import type { GenerationConfig, ServerConfig } from './types/config';
import { toValue } from '@speclynx/apidom-core';
import { stringify as yamlStringify } from 'yaml';

export interface ConvertOptions {
  /** Virtual path for the Arazzo document — used to resolve relative source description URLs. */
  arazzoDocPath?: string;
  /** Output format. Defaults to the detected input format. */
  format?: 'json' | 'yaml';
  /** Target OpenAPI version. Defaults to '3.1.0'. */
  openapiVersion?: string;
  /** Override the generated OpenAPI title. */
  title?: string;
  /** Override the generated OpenAPI version field. */
  version?: string;
  /** Override the generated OpenAPI description. */
  description?: string;
  /** Additional servers to include. */
  servers?: ServerConfig[];
  /** HTTP response code for the generated workflow endpoint. Defaults to 200. */
  responseCode?: number;
  /**
   * Called when a source description URL is a relative path and the Arazzo
   * document is a local file. Provide this in Node.js environments; omit it
   * in the browser (relative-path source documents will fall back gracefully).
   */
  readLocalFile?: SourceDocumentResolverOptions['readLocalFile'];
}

/**
 * Convert an Arazzo document (provided as a string) to an OpenAPI document.
 * Returns the serialised OpenAPI as a YAML or JSON string.
 */
export async function convert(content: string, options?: ConvertOptions): Promise<string> {
  const arazzoDocPath = options?.arazzoDocPath ?? '';

  const parser = new ArazzoParser();
  const isJson = content.trim().startsWith('{');
  const document = await parser.parseContent(content, isJson ? 'json' : 'yaml');

  const analyzer = new WorkflowAnalyzer();
  const workflows = analyzer.analyzeAllWorkflows(document);

  const sourceResolver = new SourceDocumentResolver({ readLocalFile: options?.readLocalFile });
  const generator = new OpenAPIGenerator(new TypeInferenceEngine(sourceResolver));

  const config: GenerationConfig = {
    arazzoPath: arazzoDocPath,
    outputPath: '',
    openapiVersion: options?.openapiVersion ?? '3.1.0',
    outputFormat: options?.format ?? (isJson ? 'json' : 'yaml'),
    responseCode: options?.responseCode,
    title: options?.title,
    version: options?.version,
    description: options?.description,
    servers: options?.servers,
  };

  const openapi = await generator.generateOpenAPI(document, workflows, arazzoDocPath, config);
  const openapiObj = toValue(openapi);

  if ((options?.format ?? (isJson ? 'json' : 'yaml')) === 'json') {
    return JSON.stringify(openapiObj, null, 2);
  }

  return yamlStringify(openapiObj, { indent: 2, lineWidth: 0, minContentWidth: 0 });
}
