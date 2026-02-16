/**
 * Tests for TypeInferenceEngine
 * Focus: Testing orchestration logic and schema generation
 */

import { TypeInferenceEngine } from '../../src/core/type-inference-engine';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import { AnalyzedWorkflow } from '../../src/core/workflow-analyzer';
import * as path from 'path';

describe('TypeInferenceEngine', () => {
  let engine: TypeInferenceEngine;
  let parser: ArazzoParser;

  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const arazzoPath = path.join(fixturesPath, 'arazzo-with-sources.json');

  beforeEach(() => {
    engine = new TypeInferenceEngine();
    parser = new ArazzoParser();
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe('inferType', () => {
    it('should infer type from step expression', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const type = await engine.inferType(
        '$steps.fetchProduct.outputs.name',
        workflow,
        arazzoDoc,
        arazzoPath
      );

      expect(type.type).toBe('string');
      expect(type.source).toBe('inferred');
      expect(type.originalExpression).toBe('$steps.fetchProduct.outputs.name');
    });

    it('should infer type from input expression', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: {
          schema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                format: 'uuid',
              },
            },
          },
          required: [],
        },
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const type = await engine.inferType('$inputs.userId', workflow, arazzoDoc, arazzoPath);

      expect(type.type).toBe('string');
      expect(type.format).toBe('uuid');
      expect(type.source).toBe('inferred');
      expect(type.originalExpression).toBe('$inputs.userId');
    });

    it('should infer type from literal expression', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const type = await engine.inferType('confirmed', workflow, arazzoDoc, arazzoPath);

      expect(type.type).toBe('string');
      expect(type.source).toBe('literal');
      expect(type.originalExpression).toBe('confirmed');
    });

    it('should cache inferred types', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const type1 = await engine.inferType(
        '$steps.fetchProduct.outputs.name',
        workflow,
        arazzoDoc,
        arazzoPath
      );

      const type2 = await engine.inferType(
        '$steps.fetchProduct.outputs.name',
        workflow,
        arazzoDoc,
        arazzoPath
      );

      // Should be same instance from cache
      expect(type1).toBe(type2);
    });

    it('should use fallback for unsupported expression types', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const type = await engine.inferType('$url', workflow, arazzoDoc, arazzoPath);

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('medium');
      expect(type.originalExpression).toBe('$url');
    });
  });

  describe('inferOutputSchema', () => {
    it('should generate schema for workflow outputs', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: {
          fields: {
            productName: {
              name: 'productName',
              expression: '$steps.fetchProduct.outputs.name',
            },
            productPrice: {
              name: 'productPrice',
              expression: '$steps.fetchProduct.outputs.price',
            },
            status: {
              name: 'status',
              expression: 'confirmed',
            },
          },
        },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const result = await engine.inferOutputSchema(workflow, arazzoDoc, arazzoPath);

      expect(result.schema).toBeDefined();
      expect(result.schema.get('type')?.toValue()).toBe('object');

      const properties = result.schema.get('properties');
      expect(properties).toBeDefined();
      expect(Array.from(properties.keys())).toEqual([
        'productName',
        'productPrice',
        'status',
      ]);

      const required = result.schema.get('required');
      expect(required).toBeDefined();
      expect(Array.from(required as any).map((e: any) => e.toValue())).toEqual([
        'productName',
        'productPrice',
        'status',
      ]);
    });

    it('should track metadata correctly', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: {
          fields: {
            productName: {
              name: 'productName',
              expression: '$steps.fetchProduct.outputs.name',
            },
            productPrice: {
              name: 'productPrice',
              expression: '$steps.fetchProduct.outputs.price',
            },
            status: {
              name: 'status',
              expression: 'confirmed',
            },
            unknownField: {
              name: 'unknownField',
              expression: '$steps.nonExistent.outputs.field',
            },
          },
        },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const result = await engine.inferOutputSchema(workflow, arazzoDoc, arazzoPath);

      expect(result.metadata.totalFields).toBe(4);
      expect(result.metadata.resolvedCount).toBe(2); // productName, productPrice
      expect(result.metadata.literalCount).toBe(1); // status
      expect(result.metadata.fallbackCount).toBe(1); // unknownField
      expect(result.metadata.unresolvedExpressions).toEqual([
        '$steps.nonExistent.outputs.field',
      ]);
    });

    it('should handle workflow with no outputs', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const result = await engine.inferOutputSchema(workflow, arazzoDoc, arazzoPath);

      expect(result.schema).toBeDefined();
      expect(result.schema.get('type')?.toValue()).toBe('object');
      expect(result.metadata.totalFields).toBe(0);
    });

    it('should preserve type details in schema', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: {
          fields: {
            productPrice: {
              name: 'productPrice',
              expression: '$steps.fetchProduct.outputs.price',
            },
          },
        },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const result = await engine.inferOutputSchema(workflow, arazzoDoc, arazzoPath);

      const properties = result.schema.get('properties');
      const priceSchema = properties.get('productPrice');

      expect(priceSchema.get('type')?.toValue()).toBe('number');
      expect(priceSchema.get('format')?.toValue()).toBe('float');
      expect(priceSchema.get('description')?.toValue()).toBe('Product price in USD');
    });
  });

  describe('clearCache', () => {
    it('should clear cached types', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const type1 = await engine.inferType(
        '$steps.fetchProduct.outputs.name',
        workflow,
        arazzoDoc,
        arazzoPath
      );

      engine.clearCache();

      const type2 = await engine.inferType(
        '$steps.fetchProduct.outputs.name',
        workflow,
        arazzoDoc,
        arazzoPath
      );

      // Should be different instances after clearing cache
      expect(type1).not.toBe(type2);
    });
  });

  describe('Schema Element Conversion', () => {
    it('should handle different primitive types', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: {
          fields: {
            stringField: { name: 'stringField', expression: '$steps.fetchProduct.outputs.name' },
            numberField: { name: 'numberField', expression: '$steps.fetchProduct.outputs.price' },
            booleanField: { name: 'booleanField', expression: '$steps.fetchProduct.outputs.inStock' },
            literalString: { name: 'literalString', expression: 'confirmed' },
            literalNumber: { name: 'literalNumber', expression: '123' },
            literalBoolean: { name: 'literalBoolean', expression: 'true' },
          },
        },
        steps: [
          {
            stepId: 'fetchProduct',
            operationId: 'shopAPI.getProduct',
          },
        ],
        sourceDescriptions: [],
      };

      const result = await engine.inferOutputSchema(workflow, arazzoDoc, arazzoPath);

      const properties = result.schema.get('properties');

      expect(properties.get('stringField').get('type')?.toValue()).toBe('string');
      expect(properties.get('numberField').get('type')?.toValue()).toBe('number');
      expect(properties.get('booleanField').get('type')?.toValue()).toBe('boolean');
      expect(properties.get('literalString').get('type')?.toValue()).toBe('string');
      expect(properties.get('literalNumber').get('type')?.toValue()).toBe('integer');
      expect(properties.get('literalBoolean').get('type')?.toValue()).toBe('boolean');
    });
  });
});
