/**
 * Resolves types from OpenAPI schemas and workflow inputs
 */

import { AnalyzedWorkflow } from './workflow-analyzer';
import { SourceDocumentResolver } from './source-document-resolver';
import { InferredType } from '../types/runtime-expression';
import { ArazzoSpecification1Element } from '@speclynx/apidom-ns-arazzo-1';

export class TypeResolver {
  /**
   * Resolve type from a step output expression
   */
  async resolveStepOutputType(
    stepId: string,
    outputPath: string,
    workflow: AnalyzedWorkflow,
    sourceResolver: SourceDocumentResolver,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string,
    jsonPath?: string
  ): Promise<InferredType> {
    // Find the step in the workflow
    const step = workflow.steps.find((s) => s.stepId === stepId);
    if (!step) {
      return this.getFallbackType(`Step "${stepId}" not found in workflow`, 'low');
    }

    // Parse operationId (format: "sourceName.operationId" or just "operationId")
    if (!step.operationId) {
      return this.getFallbackType(`Step "${stepId}" has no operationId`, 'low');
    }

    let sourceName: string;
    let opId: string;

    // Check if operationId includes source name prefix
    if (step.operationId.includes('.')) {
      const operationIdParts = step.operationId.split('.');
      sourceName = operationIdParts[0];
      opId = operationIdParts.slice(1).join('.'); // Handle operationIds with dots
    } else {
      // No prefix - use first (or only) source description
      const sourceDescriptions = arazzoDoc.get('sourceDescriptions');
      if (!sourceDescriptions || sourceDescriptions.length === 0) {
        return this.getFallbackType(
          `No source descriptions found in Arazzo document`,
          'low'
        );
      }
      const firstSource = sourceDescriptions.get(0);
      const nameElement = firstSource?.get?.('name');
      sourceName = nameElement?.toValue() as string;
      if (!sourceName) {
        return this.getFallbackType(
          `First source description has no name`,
          'low'
        );
      }
      opId = step.operationId;
    }

    // Resolve source document
    let openapiDoc: any;
    try {
      openapiDoc = await sourceResolver.resolveSourceDocument(
        sourceName,
        arazzoDoc,
        arazzoDocPath
      );
    } catch (error) {
      return this.getFallbackType(
        `Could not resolve source document "${sourceName}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        'low'
      );
    }

    // Find operation
    const operation = sourceResolver.findOperationByOperationId(openapiDoc, opId);
    if (!operation) {
      return this.getFallbackType(
        `Operation "${opId}" not found in source "${sourceName}"`,
        'medium'
      );
    }

    // Get response schema
    const schema = this.getResponseSchema(operation);
    if (!schema) {
      return this.getFallbackType('No response schema found for operation', 'medium');
    }

    // Navigate to the output field
    let targetSchema = schema;

    // Parse outputPath: should be "outputs" or "outputs.outputName" or "outputs.body.field"
    const outputPathParts = outputPath.split('.');

    // If outputPath includes a specific output name (e.g., "outputs.petId"),
    // try to look it up in the step's outputs to get the actual expression
    if (outputPathParts.length > 1 && outputPathParts[0] === 'outputs') {
      const outputName = outputPathParts[1];

      // Check if step has outputs defined and this output exists
      if (step.outputs && outputName in step.outputs) {
        // New behavior: look up the step's output expression
        const outputExpression = step.outputs[outputName];

        // Parse the output expression to extract the path
        // Expected format: $response.body.propertyName or $response.header.headerName
        const expressionMatch = outputExpression.match(/^\$response\.(body|header)\.?(.*)$/);
        if (!expressionMatch) {
          return this.getFallbackType(
            `Unsupported output expression format: ${outputExpression}`,
            'low'
          );
        }

        const [, responseType, responsePath] = expressionMatch;

        if (responseType === 'header') {
          // Headers are always strings
          return {
            type: 'string',
            source: 'inferred',
            confidence: 'high',
            originalExpression: outputExpression,
          };
        }

        // Resolve $ref if present
        targetSchema = this.resolveSchemaRef(targetSchema, openapiDoc);

        // Navigate through the response body path
        if (responsePath) {
          const pathParts = responsePath.split('.');
          for (const part of pathParts) {
            if (!part) continue;

            const properties = targetSchema.get?.('properties');
            if (!properties) {
              return this.getFallbackType(
                `No properties found at path: ${responsePath}`,
                'low'
              );
            }

            targetSchema = properties.get?.(part);
            if (!targetSchema) {
              return this.getFallbackType(
                `Property "${part}" not found in schema`,
                'low'
              );
            }

            // Resolve $ref for nested properties
            targetSchema = this.resolveSchemaRef(targetSchema, openapiDoc);
          }
        }
      } else {
        // Fallback behavior: navigate directly through path (backward compatible)
        // Skip "outputs" and "body" prefixes and navigate from there
        const pathParts = outputPathParts.slice(1).filter((p) => p !== 'body');

        // Resolve $ref if present at the root
        targetSchema = this.resolveSchemaRef(targetSchema, openapiDoc);

        for (const part of pathParts) {
          const properties = targetSchema.get?.('properties');
          if (!properties) {
            return this.getFallbackType(
              `No properties found at path: ${outputPath}`,
              'low'
            );
          }

          targetSchema = properties.get?.(part);
          if (!targetSchema) {
            return this.getFallbackType(
              `Property "${part}" not found in schema`,
              'low'
            );
          }

          // Resolve $ref for nested properties
          targetSchema = this.resolveSchemaRef(targetSchema, openapiDoc);
        }
      }
    } else {
      // outputPath is just "outputs" or "outputs.body" - refers to entire response
      const pathParts = outputPath.split('.').filter((p) => p !== 'outputs' && p !== 'body');

      for (const part of pathParts) {
        const properties = targetSchema.get?.('properties');
        if (!properties) {
          return this.getFallbackType(
            `No properties found at path: ${outputPath}`,
            'low'
          );
        }

        targetSchema = properties.get?.(part);
        if (!targetSchema) {
          return this.getFallbackType(
            `Property "${part}" not found in schema`,
            'low'
          );
        }
      }
    }

    // Apply JSONPath navigation if present
    if (jsonPath) {
      targetSchema = this.navigateJsonPath(targetSchema, jsonPath);
      if (!targetSchema) {
        return this.getFallbackType(
          `JSONPath "${jsonPath}" could not be resolved in schema`,
          'low'
        );
      }
    }

    // Convert schema to InferredType
    return this.schemaToInferredType(targetSchema);
  }

  /**
   * Resolve type from workflow input
   */
  resolveInputType(inputName: string, workflow: AnalyzedWorkflow): InferredType {
    if (!workflow.inputs) {
      return this.getFallbackType('Workflow has no inputs defined', 'low');
    }

    const schema = workflow.inputs.schema;
    const properties = schema.properties as any;

    if (!properties || !properties[inputName]) {
      return this.getFallbackType(`Input "${inputName}" not found in workflow`, 'low');
    }

    const inputSchema = properties[inputName];

    return {
      type: inputSchema.type || 'string',
      format: inputSchema.format,
      description: inputSchema.description,
      enum: inputSchema.enum,
      source: 'inferred',
      confidence: 'high',
      originalExpression: `$inputs.${inputName}`,
    };
  }

  /**
   * Resolve type from literal value
   */
  resolveLiteralType(literal: any): InferredType {
    const jsType = typeof literal;

    let type: InferredType['type'];
    if (jsType === 'number') {
      type = Number.isInteger(literal) ? 'integer' : 'number';
    } else if (jsType === 'boolean') {
      type = 'boolean';
    } else if (literal === null) {
      type = 'null';
    } else {
      type = 'string';
    }

    return {
      type,
      source: 'literal',
      confidence: 'high',
      originalExpression: String(literal),
    };
  }

  /**
   * Get fallback type when resolution fails
   */
  getFallbackType(reason: string, confidence: 'low' | 'medium' = 'low'): InferredType {
    return {
      type: 'string',
      description: `Type inference fallback: ${reason}`,
      source: 'fallback',
      confidence,
      originalExpression: '',
      resolutionNote: reason,
    };
  }

  /**
   * Get response schema from operation (tries 200, 201, default)
   */
  private getResponseSchema(operation: any): any | null {
    const responses = operation.get?.('responses');
    if (!responses) return null;

    // Try common success status codes
    for (const code of ['200', '201', '202', 'default']) {
      const response = responses.get?.(code);
      if (!response) continue;

      const content = response.get?.('content');
      if (!content) continue;

      const mediaType = content.get?.('application/json');
      if (!mediaType) continue;

      const schema = mediaType.get?.('schema');
      if (schema) return schema;
    }

    return null;
  }

  /**
   * Resolve $ref in a schema to get the actual schema definition
   */
  private resolveSchemaRef(schema: any, openapiDoc: any): any {
    if (!schema) return schema;

    const ref = schema.get?.('$ref');
    if (!ref) return schema;

    const refValue = ref.toValue();
    if (!refValue || typeof refValue !== 'string') return schema;

    // Parse $ref format: "#/components/schemas/Pet"
    if (!refValue.startsWith('#/')) return schema;

    const refPath = refValue.substring(2); // Remove "#/"
    const pathParts = refPath.split('/');

    // Navigate to the referenced schema
    let current = openapiDoc;
    for (const part of pathParts) {
      current = current.get?.(part);
      if (!current) {
        // Could not resolve $ref
        return schema;
      }
    }

    return current;
  }

  /**
   * Navigate JSONPath through a schema
   * JSONPath format: /data/0/id → ["data", "0", "id"]
   */
  private navigateJsonPath(schema: any, jsonPath: string): any | null {
    // Parse JSONPath into segments
    const segments = jsonPath.split('/').filter((s) => s.length > 0);

    let current = schema;

    for (const segment of segments) {
      if (!current) return null;

      // Check if segment is numeric (array index)
      if (/^\d+$/.test(segment)) {
        // Navigate to array items
        current = current.get?.('items');
      } else {
        // Navigate to object property
        const properties = current.get?.('properties');
        if (!properties) return null;
        current = properties.get?.(segment);
      }
    }

    return current;
  }

  /**
   * Convert ApiDOM SchemaElement to our InferredType
   */
  private schemaToInferredType(schema: any): InferredType {
    const type = schema.get?.('type')?.toValue?.() || 'string';
    const format = schema.get?.('format')?.toValue?.();
    const description = schema.get?.('description')?.toValue?.();

    const inferredType: InferredType = {
      type,
      source: 'inferred',
      confidence: 'high',
      originalExpression: '',
    };

    if (format) inferredType.format = format;
    if (description) inferredType.description = description;

    // Handle enum
    const enumElement = schema.get?.('enum');
    if (enumElement) {
      inferredType.enum = Array.from(enumElement as any).map((e: any) => e.toValue?.() ?? e);
    }

    // Handle arrays
    if (type === 'array') {
      const items = schema.get?.('items');
      if (items) {
        inferredType.items = this.schemaToInferredType(items);
      }
    }

    // Handle objects
    if (type === 'object') {
      const properties = schema.get?.('properties');
      const required = schema.get?.('required');

      if (properties) {
        inferredType.properties = {};
        for (const key of properties.keys?.() || []) {
          const propSchema = properties.get?.(key);
          if (propSchema) {
            inferredType.properties[key] = this.schemaToInferredType(propSchema);
          }
        }
      }

      if (required) {
        inferredType.required = Array.from(required as any).map((r: any) =>
          r.toValue?.() ?? r
        );
      }
    }

    // Handle constraints
    const minimum = schema.get?.('minimum')?.toValue?.();
    const maximum = schema.get?.('maximum')?.toValue?.();
    const pattern = schema.get?.('pattern')?.toValue?.();
    const minLength = schema.get?.('minLength')?.toValue?.();
    const maxLength = schema.get?.('maxLength')?.toValue?.();
    const minItems = schema.get?.('minItems')?.toValue?.();
    const maxItems = schema.get?.('maxItems')?.toValue?.();

    if (minimum !== undefined) inferredType.minimum = minimum;
    if (maximum !== undefined) inferredType.maximum = maximum;
    if (pattern) inferredType.pattern = pattern;
    if (minLength !== undefined) inferredType.minLength = minLength;
    if (maxLength !== undefined) inferredType.maxLength = maxLength;
    if (minItems !== undefined) inferredType.minItems = minItems;
    if (maxItems !== undefined) inferredType.maxItems = maxItems;

    return inferredType;
  }
}
