/**
 * Integration tests for complete type inference pipeline
 * Tests the full flow: Arazzo → Type Inference → OpenAPI with accurate types
 */

import { ArazzoParser } from '../../src/core/arazzo-parser';
import { WorkflowAnalyzer } from '../../src/core/workflow-analyzer';
import { OpenAPIGenerator } from '../../src/core/openapi-generator';
import { GenerationConfig } from '../../src/types/config';
import * as path from 'path';

// Helper to safely navigate nested element properties in tests
function getNestedElement(parent: any, ...keys: string[]): any {
  let current = parent;
  for (const key of keys) {
    if (!current) return undefined;
    current = current.get?.(key);
  }
  return current;
}

describe('Type Inference Integration', () => {
  let parser: ArazzoParser;
  let analyzer: WorkflowAnalyzer;
  let generator: OpenAPIGenerator;

  beforeEach(() => {
    parser = new ArazzoParser();
    analyzer = new WorkflowAnalyzer();
    generator = new OpenAPIGenerator();
  });

  afterEach(() => {
    generator.clearCache();
  });

  describe('Simple Type Inference', () => {
    it('should infer string type from OpenAPI schema', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const productNameSchema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post')
        ?.get('responses')
        ?.get('200')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema')
        ?.get('properties')
        ?.get('productName');

      expect(productNameSchema?.get('type')?.toValue()).toBe('string');
    });

    it('should infer number type with format from OpenAPI schema', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const productPriceSchema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post')
        ?.get('responses')
        ?.get('200')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema')
        ?.get('properties')
        ?.get('productPrice');

      expect(productPriceSchema?.get('type')?.toValue()).toBe('number');
    });
  });

  describe('Multiple Workflows', () => {
    it('should infer types for all workflows independently', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      // Check placeOrder workflow
      const placeOrderSchema = getNestedElement(openapi, 'paths', '/workflows/placeOrder', 'post')
        ?.get('responses')
        ?.get('200')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema');

      expect(placeOrderSchema).toBeDefined();
      expect(placeOrderSchema?.get('properties')?.get('orderId')).toBeDefined();

      // Check cancelOrder workflow
      const cancelOrderSchema = getNestedElement(openapi, 'paths', '/workflows/cancelOrder', 'post')
        ?.get('responses')
        ?.get('200')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema');

      expect(cancelOrderSchema).toBeDefined();
      expect(cancelOrderSchema?.get('properties')?.get('status')).toBeDefined();

      // Check updateOrder workflow
      const updateOrderSchema = getNestedElement(openapi, 'paths', '/workflows/updateOrder', 'post')
        ?.get('responses')
        ?.get('200')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema');

      expect(updateOrderSchema).toBeDefined();
      expect(updateOrderSchema?.get('properties')?.get('updatedOrder')).toBeDefined();
    });
  });

  describe('Source Document Resolution', () => {
    it('should resolve types from multiple source documents', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo-with-sources.json');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.json',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      // Should successfully generate without errors
      expect(openapi).toBeDefined();
      expect(openapi.get('openapi')?.toValue()).toBe('3.1.0');
    });
  });

  describe('Complex Workflows', () => {
    it('should handle workflows with nested schemas', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      // Verify the document was generated
      expect(openapi).toBeDefined();
      expect(openapi.get('paths')).toBeDefined();
    });
  });

  describe('Metadata Preservation', () => {
    it('should preserve x-arazzo-document extension in info', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const xArazzoDoc = getNestedElement(openapi, 'info','x-arazzo-document')?.toValue();
      expect(xArazzoDoc).toBe(filePath);
    });

    it('should preserve x-arazzo-workflow-id extension in operations', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const xArazzoWorkflowId = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post')
        ?.get('x-arazzo-workflow-id')
        ?.toValue();

      expect(xArazzoWorkflowId).toBe('getProduct');
    });
  });

  describe('Request Body Generation', () => {
    it('should generate correct request body schema from workflow inputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const requestBodySchema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post')
        ?.get('requestBody')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema');

      expect(requestBodySchema?.get('type')?.toValue()).toBe('object');
      expect(requestBodySchema?.get('properties')?.get('productId')).toBeDefined();

      const required = requestBodySchema?.get('required');
      if (required) {
        const requiredFields = Array.from(required as any).map((e: any) => e.toValue());
        expect(requiredFields).toContain('productId');
      }
    });
  });

  describe('Response Schema Generation', () => {
    it('should mark all output fields as required', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const responseSchema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post')
        ?.get('responses')
        ?.get('200')
        ?.get('content')
        ?.get('application/json')
        ?.get('schema');

      const required = responseSchema?.get('required');
      expect(required).toBeDefined();

      if (required) {
        const requiredFields = Array.from(required as any).map((e: any) => e.toValue());
        expect(requiredFields).toContain('productName');
        expect(requiredFields).toContain('productPrice');
      }
    });

    it('should use custom response code when configured', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        responseCode: 201,
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const response201 = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post')
        ?.get('responses')
        ?.get('201');

      expect(response201).toBeDefined();
      expect(response201?.get('description')?.toValue()).toContain('executed successfully');
    });
  });

  describe('Info and Server Generation', () => {
    it('should derive info from Arazzo document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const info = openapi.get('info');
      expect(getNestedElement(info,'title')?.toValue()).toBe('Simple E-Commerce Workflow');
      expect(getNestedElement(info,'version')?.toValue()).toBe('1.0.0');
      expect(getNestedElement(info,'description')?.toValue()).toBe('A simple workflow for testing');
    });

    it('should apply CLI overrides for info', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        title: 'Override Title',
        version: '2.0.0',
        description: 'Override Description',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      const info = openapi.get('info');
      expect(getNestedElement(info,'title')?.toValue()).toBe('Override Title');
      expect(getNestedElement(info,'version')?.toValue()).toBe('2.0.0');
      expect(getNestedElement(info,'description')?.toValue()).toBe('Override Description');
    });
  });

  describe('Edge Cases', () => {
    it('should handle workflows without outputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      // Should generate successfully even if some workflows have no outputs
      expect(openapi).toBeDefined();
    });

    it('should handle workflows without inputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      // Should generate successfully
      expect(openapi).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should cache type inference results across workflows', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      // Generate once
      const openapi1 = await generator.generateOpenAPI(document, workflows, filePath, config);
      expect(openapi1).toBeDefined();

      // Clear cache and generate again
      generator.clearCache();
      const openapi2 = await generator.generateOpenAPI(document, workflows, filePath, config);
      expect(openapi2).toBeDefined();

      // Both should succeed
      expect(openapi1.get('openapi')?.toValue()).toBe(openapi2.get('openapi')?.toValue());
    });
  });
});
