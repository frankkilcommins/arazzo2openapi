/**
 * Simplified tests for TypeResolver focusing on core logic
 */

import { TypeResolver } from '../../src/core/type-resolver';
import { SourceDocumentResolver } from '../../src/core/source-document-resolver';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import { AnalyzedWorkflow } from '../../src/core/workflow-analyzer';
import * as path from 'path';

describe('TypeResolver (Simplified)', () => {
  let resolver: TypeResolver;
  let sourceResolver: SourceDocumentResolver;
  let parser: ArazzoParser;

  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const arazzoPath = path.join(fixturesPath, 'arazzo-with-sources.json');

  beforeEach(() => {
    resolver = new TypeResolver();
    sourceResolver = new SourceDocumentResolver();
    parser = new ArazzoParser();
  });

  afterEach(() => {
    sourceResolver.clearCache();
  });

  describe('resolveLiteralType', () => {
    it('should resolve string literal', () => {
      const type = resolver.resolveLiteralType('confirmed');

      expect(type.type).toBe('string');
      expect(type.source).toBe('literal');
      expect(type.confidence).toBe('high');
    });

    it('should resolve integer literal', () => {
      const type = resolver.resolveLiteralType(123);

      expect(type.type).toBe('integer');
      expect(type.source).toBe('literal');
    });

    it('should resolve float literal', () => {
      const type = resolver.resolveLiteralType(45.67);

      expect(type.type).toBe('number');
      expect(type.source).toBe('literal');
    });

    it('should resolve boolean literal', () => {
      const type = resolver.resolveLiteralType(true);

      expect(type.type).toBe('boolean');
      expect(type.source).toBe('literal');
    });

    it('should resolve null literal', () => {
      const type = resolver.resolveLiteralType(null);

      expect(type.type).toBe('null');
      expect(type.source).toBe('literal');
    });
  });

  describe('resolveInputType', () => {
    it('should resolve input type from workflow', () => {
      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: {
          schema: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
                format: 'uuid',
                description: 'Product ID',
              },
            },
          },
          required: [],
        },
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const type = resolver.resolveInputType('productId', workflow);

      expect(type.type).toBe('string');
      expect(type.format).toBe('uuid');
      expect(type.description).toBe('Product ID');
      expect(type.source).toBe('inferred');
      expect(type.confidence).toBe('high');
    });

    it('should fallback for non-existent input', () => {
      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: {
          schema: {
            type: 'object',
            properties: {
              productId: {
                type: 'string',
              },
            },
          },
          required: [],
        },
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const type = resolver.resolveInputType('nonExistent', workflow);

      expect(type.source).toBe('fallback');
      expect(type.type).toBe('string');
      expect(type.confidence).toBe('low');
    });

    it('should fallback if workflow has no inputs', () => {
      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        outputs: { fields: {} },
        steps: [],
        sourceDescriptions: [],
      };

      const type = resolver.resolveInputType('field', workflow);

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('low');
    });
  });

  describe('resolveStepOutputType - Basic Tests', () => {
    it('should resolve string type from OpenAPI schema', async () => {
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

      const type = await resolver.resolveStepOutputType(
        'fetchProduct',
        'outputs.name',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.type).toBe('string');
      expect(type.description).toBe('Product name');
      expect(type.source).toBe('inferred');
      expect(type.confidence).toBe('high');
    });

    it('should resolve number type with format', async () => {
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

      const type = await resolver.resolveStepOutputType(
        'fetchProduct',
        'outputs.price',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.type).toBe('number');
      expect(type.format).toBe('float');
      expect(type.description).toBe('Product price in USD');
      expect(type.source).toBe('inferred');
    });

    it('should resolve boolean type', async () => {
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

      const type = await resolver.resolveStepOutputType(
        'fetchProduct',
        'outputs.inStock',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.type).toBe('boolean');
      expect(type.source).toBe('inferred');
    });
  });

  describe('Fallback Scenarios', () => {
    it('should fallback for non-existent step', async () => {
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

      const type = await resolver.resolveStepOutputType(
        'nonExistentStep',
        'outputs.field',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('low');
      expect(type.resolutionNote).toContain('not found');
    });

    it('should fallback for non-existent operation', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'badStep',
            operationId: 'shopAPI.nonExistentOperation',
          },
        ],
        sourceDescriptions: [],
      };

      const type = await resolver.resolveStepOutputType(
        'badStep',
        'outputs.field',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('medium');
      expect(type.resolutionNote).toContain('not found');
    });

    it('should fallback for non-existent property', async () => {
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

      const type = await resolver.resolveStepOutputType(
        'fetchProduct',
        'outputs.nonExistentField',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('low');
    });
  });

  describe('getFallbackType', () => {
    it('should create fallback type with low confidence', () => {
      const type = resolver.getFallbackType('Test reason', 'low');

      expect(type.type).toBe('string');
      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('low');
      expect(type.resolutionNote).toBe('Test reason');
      expect(type.description).toContain('fallback');
    });

    it('should create fallback type with medium confidence', () => {
      const type = resolver.getFallbackType('Test reason', 'medium');

      expect(type.confidence).toBe('medium');
    });
  });

  describe('Additional Edge Cases', () => {
    it('should fallback for step without operationId', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'badStep',
            // No operationId
          },
        ],
        sourceDescriptions: [],
      };

      const type = await resolver.resolveStepOutputType(
        'badStep',
        'outputs.field',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.source).toBe('fallback');
      expect(type.resolutionNote).toContain('no operationId');
    });

    it('should handle body reference correctly', async () => {
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

      const type = await resolver.resolveStepOutputType(
        'fetchProduct',
        'outputs.body',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.type).toBe('object');
      expect(type.source).toBe('inferred');
      expect(type.properties).toBeDefined();
    });

    it('should fallback when source document cannot be resolved', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'badStep',
            operationId: 'nonExistentSource.operation',
          },
        ],
        sourceDescriptions: [],
      };

      const type = await resolver.resolveStepOutputType(
        'badStep',
        'outputs.field',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('low');
      expect(type.resolutionNote).toContain('Could not resolve source document');
    });

    it('should fallback when operation not found', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const workflow: AnalyzedWorkflow = {
        workflowId: 'test',
        inputs: undefined,
        outputs: { fields: {} },
        steps: [
          {
            stepId: 'badStep',
            operationId: 'shopAPI.nonExistentOperation',
          },
        ],
        sourceDescriptions: [],
      };

      const type = await resolver.resolveStepOutputType(
        'badStep',
        'outputs.field',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(type.source).toBe('fallback');
      expect(type.confidence).toBe('medium');
      expect(type.resolutionNote).toContain('not found');
    });
  });
});
