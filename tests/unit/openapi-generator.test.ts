import { OpenAPIGenerator } from '../../src/core/openapi-generator';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import { WorkflowAnalyzer } from '../../src/core/workflow-analyzer';
import { GenerationConfig } from '../../src/types/config';
import { isObjectElement } from '@speclynx/apidom-datamodel';
import * as path from 'path';

// Helper to safely navigate nested element properties in tests
function getNestedElement(parent: any, ...keys: (string | number)[]): any {
  let current = parent;
  for (const key of keys) {
    if (!current) return undefined;
    current = current.get?.(key);
    // Continue navigation even if not an ObjectElement (might be other element types)
  }
  return current;
}

describe('OpenAPIGenerator', () => {
  let generator: OpenAPIGenerator;
  let parser: ArazzoParser;
  let analyzer: WorkflowAnalyzer;

  beforeEach(() => {
    generator = new OpenAPIGenerator();
    parser = new ArazzoParser();
    analyzer = new WorkflowAnalyzer();
  });

  afterEach(() => {
    generator.clearCache();
  });

  describe('generateOpenAPI', () => {
    it('should generate a valid OpenAPI 3.1 document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);

      // Verify basic structure
      expect(openapi.get('openapi')?.toValue()).toBe('3.1.0');
      expect(openapi.get('info')).toBeDefined();
      expect(openapi.get('paths')).toBeDefined();
      expect(getNestedElement(openapi, 'info','x-arazzo-document')?.toValue()).toBe(filePath);
    });

    it('should include derived info metadata', async () => {
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

    it('should use CLI overrides for info', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        title: 'Custom API Title',
        version: '2.0.0',
        description: 'Custom description',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const info = openapi.get('info');

      expect(getNestedElement(info,'title')?.toValue()).toBe('Custom API Title');
      expect(getNestedElement(info,'version')?.toValue()).toBe('2.0.0');
      expect(getNestedElement(info,'description')?.toValue()).toBe('Custom description');
    });

    it('should include derived servers', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const servers = openapi.get('servers');

      expect(servers).toBeDefined();
      expect((servers as any)?.length).toBeGreaterThan(0);

      const firstServer = getNestedElement(servers,0);
      expect(firstServer?.get('url')?.toValue()).toBe('https://api.test.com/v1');
    });

    it('should use CLI override servers', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        servers: [
          { url: 'https://custom.example.com', description: 'Custom server' },
        ],
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const servers = openapi.get('servers');

      expect((servers as any)?.length).toBe(1);
      const server = getNestedElement(servers,0);
      expect(server?.get('url')?.toValue()).toBe('https://custom.example.com');
      expect(server?.get('description')?.toValue()).toBe('Custom server');
    });
  });

  describe('path generation', () => {
    it('should generate path for each workflow', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const paths = openapi.get('paths');

      expect(getNestedElement(paths,'/workflows/placeOrder')).toBeDefined();
      expect(getNestedElement(paths,'/workflows/cancelOrder')).toBeDefined();
      expect(getNestedElement(paths,'/workflows/updateOrder')).toBeDefined();
    });

    it('should create POST operation for each workflow', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const paths = openapi.get('paths');
      const pathItem = getNestedElement(paths,'/workflows/getProduct');
      const operation = getNestedElement(pathItem, 'post');

      expect(operation).toBeDefined();
      expect(operation?.get('operationId')?.toValue()).toBe('execute_getProduct');
    });

    it('should include workflow summary and description in operation', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const operation = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post');

      expect(operation?.get('summary')?.toValue()).toBe('Get product details');
      expect(operation?.get('description')?.toValue()).toBe('Retrieve product information by ID');
    });

    it('should include x-arazzo-workflow-id extension', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const operation = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post');

      expect(operation?.get('x-arazzo-workflow-id')?.toValue()).toBe('getProduct');
    });
  });

  describe('request body generation', () => {
    it('should generate request body from workflow inputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const operation = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post');
      const requestBody = operation?.get('requestBody');

      expect(requestBody).toBeDefined();
      expect(requestBody?.get('required')?.toValue()).toBe(true);

      const content = requestBody?.get('content');
      const mediaType = content?.get('application/json');
      expect(mediaType).toBeDefined();

      const schema = mediaType?.get('schema');
      expect(schema?.get('type')?.toValue()).toBe('object');
    });

    it('should convert JSON Schema properties correctly', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const schema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'requestBody', 'content', 'application/json', 'schema');

      const properties = schema?.get('properties');
      const productIdSchema = properties?.get('productId');

      expect(productIdSchema?.get('type')?.toValue()).toBe('string');
      expect(productIdSchema?.get('description')?.toValue()).toBe('Product identifier');
    });

    it('should convert required fields correctly', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const schema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'requestBody', 'content', 'application/json', 'schema');

      const required = schema?.get('required');
      expect(required).toBeDefined();
      expect(Array.from(required as any).map((el: any) => el.toValue())).toContain('productId');
    });

    it('should handle complex nested schemas', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const schema = getNestedElement(openapi, 'paths', '/workflows/placeOrder', 'post', 'requestBody', 'content', 'application/json', 'schema');

      const properties = schema?.get('properties');
      const itemsSchema = properties?.get('items');

      expect(itemsSchema?.get('type')?.toValue()).toBe('array');
      expect(itemsSchema?.get('items')).toBeDefined();
      expect(itemsSchema?.get('description')?.toValue()).toBe('Items to order');
    });

    it('should handle enum values', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const schema = getNestedElement(openapi, 'paths', '/workflows/placeOrder', 'post', 'requestBody', 'content', 'application/json', 'schema');

      const properties = schema?.get('properties');
      const paymentMethodSchema = properties?.get('paymentMethod');
      const enumValues = paymentMethodSchema?.get('enum');

      expect(enumValues).toBeDefined();
      const enumArray = Array.from(enumValues as any).map((el: any) => el.toValue());
      expect(enumArray).toContain('credit_card');
      expect(enumArray).toContain('paypal');
      expect(enumArray).toContain('bank_transfer');
    });

    it('should handle format specifications', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const schema = getNestedElement(openapi, 'paths', '/workflows/placeOrder', 'post', 'requestBody', 'content', 'application/json', 'schema');

      const properties = schema?.get('properties');
      const customerIdSchema = properties?.get('customerId');

      expect(customerIdSchema?.get('format')?.toValue()).toBe('uuid');
    });

    it('should not generate request body for workflows without inputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Remove inputs from workflow for testing
      const workflowWithoutInputs = { ...workflows[0], inputs: undefined };

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, [workflowWithoutInputs], filePath, config);
      const operation = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post');
      const requestBody = operation?.get('requestBody');

      expect(requestBody).toBeUndefined();
    });
  });

  describe('response generation', () => {
    it('should generate 200 response by default', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const responses = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'responses');

      const response200 = responses?.get('200');
      expect(response200).toBeDefined();
      expect(response200?.get('description')?.toValue()).toContain('executed successfully');
    });

    it('should use custom response code when configured', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        responseCode: 202,
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const responses = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'responses');

      const response202 = responses?.get('202');
      expect(response202).toBeDefined();
    });

    it('should generate placeholder schema for workflow outputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const response = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'responses')
        ?.get('200');

      const schema = response
        ?.get('content')
        ?.get('application/json')
        ?.get('schema');

      expect(schema?.get('type')?.toValue()).toBe('object');

      const properties = schema?.get('properties');
      expect(properties?.get('productName')).toBeDefined();
      expect(properties?.get('productPrice')).toBeDefined();
    });

    it('should infer types from runtime expressions', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      const schema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'responses', '200', 'content', 'application/json', 'schema');

      const properties = schema?.get('properties');

      // Check that productName has inferred string type
      const productNameSchema = properties?.get('productName');
      expect(productNameSchema?.get('type')?.toValue()).toBe('string');

      // Check that productPrice has inferred number type
      const productPriceSchema = properties?.get('productPrice');
      expect(productPriceSchema?.get('type')?.toValue()).toBe('number');
    });

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
      const schema = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'responses', '200', 'content', 'application/json', 'schema');

      const required = schema?.get('required');
      const requiredArray = Array.from(required as any).map((el: any) => el.toValue());

      expect(requiredArray).toContain('productName');
      expect(requiredArray).toContain('productPrice');
    });

    it('should not generate response content for workflows without outputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Remove outputs from workflow for testing
      const workflowWithoutOutputs = { ...workflows[0], outputs: undefined };

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, [workflowWithoutOutputs], filePath, config);
      const response = getNestedElement(openapi, 'paths', '/workflows/getProduct', 'post', 'responses')
        ?.get('200');

      const content = response?.get('content');
      expect(content).toBeUndefined();
    });
  });

  describe('cache management', () => {
    it('should clear metadata deriver cache', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      await generator.generateOpenAPI(document, workflows, filePath, config);

      // Should not throw after clearing cache
      expect(() => generator.clearCache()).not.toThrow();

      // Should still work after cache clear
      const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
      expect(openapi).toBeDefined();
    });
  });
});
