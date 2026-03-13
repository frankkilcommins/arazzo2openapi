/**
 * Orchestrates type inference from runtime expressions
 */

import { RuntimeExpressionParser } from './runtime-expression-parser';
import { SourceDocumentResolver } from './source-document-resolver';
import { TypeResolver } from './type-resolver';
import { AnalyzedWorkflow } from './workflow-analyzer';
import { InferredType, TypeInferenceResult } from '../types/runtime-expression';
import { ArazzoSpecification1Element } from '@speclynx/apidom-ns-arazzo-1';
import { SchemaElement } from '@speclynx/apidom-ns-openapi-3-1';
import {
  ObjectElement,
  ArrayElement,
  StringElement,
  NumberElement,
  BooleanElement,
} from '@speclynx/apidom-datamodel';

export class TypeInferenceEngine {
  private expressionParser: RuntimeExpressionParser;
  private sourceResolver: SourceDocumentResolver;
  private typeResolver: TypeResolver;
  private typeCache: Map<string, InferredType>;

  constructor() {
    this.expressionParser = new RuntimeExpressionParser();
    this.sourceResolver = new SourceDocumentResolver();
    this.typeResolver = new TypeResolver();
    this.typeCache = new Map();
  }

  /**
   * Infer type from a single runtime expression
   */
  async inferType(
    expression: string,
    workflow: AnalyzedWorkflow,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<InferredType> {
    // Check cache
    const cacheKey = `${workflow.workflowId}:${expression}`;
    if (this.typeCache.has(cacheKey)) {
      return this.typeCache.get(cacheKey)!;
    }

    // Parse expression
    const parsed = this.expressionParser.parse(expression);

    let inferredType: InferredType;

    // Delegate based on expression type
    switch (parsed.type) {
      case 'step':
        inferredType = await this.typeResolver.resolveStepOutputType(
          parsed.stepId!,
          `${parsed.field}.${parsed.outputName}`,
          workflow,
          this.sourceResolver,
          arazzoDoc,
          arazzoDocPath,
          parsed.jsonPath
        );
        break;

      case 'input':
        inferredType = this.typeResolver.resolveInputType(parsed.inputName!, workflow);
        break;

      case 'literal':
        inferredType = this.typeResolver.resolveLiteralType(parsed.literalValue);
        break;

      // For other expression types, use fallback for now
      case 'url':
      case 'method':
      case 'statusCode':
      case 'request':
      case 'response':
        inferredType = this.typeResolver.getFallbackType(
          `Expression type "${parsed.type}" not yet fully supported`,
          'medium'
        );
        break;

      default:
        inferredType = this.typeResolver.getFallbackType(
          `Unknown expression type`,
          'low'
        );
    }

    // Add original expression
    inferredType.originalExpression = expression;

    // Cache
    this.typeCache.set(cacheKey, inferredType);

    return inferredType;
  }

  /**
   * Infer complete output schema for a workflow
   */
  async inferOutputSchema(
    workflow: AnalyzedWorkflow,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<TypeInferenceResult> {
    const metadata = {
      totalFields: 0,
      resolvedCount: 0,
      fallbackCount: 0,
      literalCount: 0,
      unresolvedExpressions: [] as string[],
    };

    const inferredTypes: Record<string, InferredType> = {};

    // Infer type for each output field
    if (workflow.outputs?.fields) {
      for (const [fieldName, outputField] of Object.entries(workflow.outputs.fields)) {
        metadata.totalFields++;

        const inferredType = await this.inferType(
          outputField.expression,
          workflow,
          arazzoDoc,
          arazzoDocPath
        );

        inferredTypes[fieldName] = inferredType;

        // Update metadata
        if (inferredType.source === 'inferred') {
          metadata.resolvedCount++;
        } else if (inferredType.source === 'fallback') {
          metadata.fallbackCount++;
          metadata.unresolvedExpressions.push(outputField.expression);
        } else if (inferredType.source === 'literal') {
          metadata.literalCount++;
        }
      }
    }

    // Convert to SchemaElement
    const schema = this.buildSchemaElement(inferredTypes);

    return { schema, metadata };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.typeCache.clear();
    this.sourceResolver.clearCache();
  }

  /**
   * Build ApiDOM SchemaElement from inferred types
   */
  private buildSchemaElement(inferredTypes: Record<string, InferredType>): SchemaElement {
    const schema = new SchemaElement();
    schema.set('type', new StringElement('object'));

    const properties = new ObjectElement();
    const required = new ArrayElement();

    for (const [fieldName, inferredType] of Object.entries(inferredTypes)) {
      const fieldSchema = this.inferredTypeToSchemaElement(inferredType);
      properties.set(fieldName, fieldSchema);

      // All output fields are required by default
      required.push(new StringElement(fieldName));
    }

    schema.set('properties', properties);
    if (required.length > 0) {
      schema.set('required', required);
    }

    return schema;
  }

  /**
   * Convert InferredType to ApiDOM SchemaElement
   */
  private inferredTypeToSchemaElement(inferredType: InferredType): SchemaElement {
    const schema = new SchemaElement();
    schema.set('type', new StringElement(inferredType.type));

    if (inferredType.format) {
      schema.set('format', new StringElement(inferredType.format));
    }

    if (inferredType.description) {
      schema.set('description', new StringElement(inferredType.description));
    }

    if (inferredType.enum) {
      const enumArray = new ArrayElement();
      for (const value of inferredType.enum) {
        if (typeof value === 'string') {
          enumArray.push(new StringElement(value));
        } else if (typeof value === 'number') {
          enumArray.push(new NumberElement(value));
        } else if (typeof value === 'boolean') {
          enumArray.push(new BooleanElement(value));
        }
      }
      schema.set('enum', enumArray);
    }

    // Handle arrays
    if (inferredType.type === 'array' && inferredType.items) {
      const items = this.inferredTypeToSchemaElement(inferredType.items);
      schema.set('items', items);
    }

    // Handle objects
    if (inferredType.type === 'object' && inferredType.properties) {
      const properties = new ObjectElement();
      for (const [propName, propType] of Object.entries(inferredType.properties)) {
        properties.set(propName, this.inferredTypeToSchemaElement(propType));
      }
      schema.set('properties', properties);

      if (inferredType.required && inferredType.required.length > 0) {
        const requiredArray = new ArrayElement();
        for (const req of inferredType.required) {
          requiredArray.push(new StringElement(req));
        }
        schema.set('required', requiredArray);
      }
    }

    // Add constraints
    if (inferredType.minimum !== undefined) {
      schema.set('minimum', new NumberElement(inferredType.minimum));
    }
    if (inferredType.maximum !== undefined) {
      schema.set('maximum', new NumberElement(inferredType.maximum));
    }
    if (inferredType.pattern) {
      schema.set('pattern', new StringElement(inferredType.pattern));
    }
    if (inferredType.minLength !== undefined) {
      schema.set('minLength', new NumberElement(inferredType.minLength));
    }
    if (inferredType.maxLength !== undefined) {
      schema.set('maxLength', new NumberElement(inferredType.maxLength));
    }
    if (inferredType.minItems !== undefined) {
      schema.set('minItems', new NumberElement(inferredType.minItems));
    }
    if (inferredType.maxItems !== undefined) {
      schema.set('maxItems', new NumberElement(inferredType.maxItems));
    }

    return schema;
  }
}
