import { promises as fs } from 'fs';
import * as path from 'path';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import { WorkflowAnalyzer } from '../../src/core/workflow-analyzer';
import { OpenAPIGenerator } from '../../src/core/openapi-generator';

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('CLI Integration', () => {
  const fixturesDir = path.join(__dirname, '../fixtures/arazzo');
  const outputDir = path.join(__dirname, '../output');

  beforeEach(async () => {
    // Create output directory
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    // Clean up output directory
    try {
      const files = await fs.readdir(outputDir);
      for (const file of files) {
        await fs.unlink(path.join(outputDir, file));
      }
      await fs.rmdir(outputDir);
    } catch {
      // Directory might not exist
    }
  });

  describe('end-to-end conversion', () => {
    it('should convert simple workflow to JSON', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.yaml');
      const outputPath = path.join(outputDir, 'simple-workflow.openapi.json');

      // Parse Arazzo
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      // Analyze workflows
      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Generate OpenAPI
      const generator = new OpenAPIGenerator();
      const openapi = await generator.generateOpenAPI(document, workflows, inputPath, {
        arazzoPath: inputPath,
        outputPath,
        openapiVersion: '3.1.0',
        outputFormat: 'json',
      });

      // Convert to plain object and serialize
      const { toValue } = await import('@speclynx/apidom-core');
      const openapiObj = toValue(openapi);
      const content = JSON.stringify(openapiObj, null, 2);

      // Write output
      await fs.writeFile(outputPath, content, 'utf-8');

      // Verify output file exists
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);

      // Verify content
      const writtenContent = await fs.readFile(outputPath, 'utf-8');
      const parsedContent = JSON.parse(writtenContent);

      expect(parsedContent.openapi).toBe('3.1.0');
      expect(parsedContent.info).toBeDefined();
      expect(parsedContent.info.title).toBe('Simple E-Commerce Workflow');
      expect(parsedContent.paths).toBeDefined();
      expect(parsedContent.paths['/workflows/getProduct']).toBeDefined();
      expect(parsedContent['x-arazzo-document']).toBe(inputPath);
    });

    it('should convert simple workflow to YAML', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.yaml');
      const outputPath = path.join(outputDir, 'simple-workflow.openapi.yaml');

      // Parse Arazzo
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      // Analyze workflows
      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Generate OpenAPI
      const generator = new OpenAPIGenerator();
      const openapi = await generator.generateOpenAPI(document, workflows, inputPath, {
        arazzoPath: inputPath,
        outputPath,
        openapiVersion: '3.1.0',
        outputFormat: 'yaml',
      });

      // Convert to plain object and serialize
      const { toValue } = await import('@speclynx/apidom-core');
      const yaml = await import('yaml');
      const openapiObj = toValue(openapi);
      const content = yaml.stringify(openapiObj, {
        indent: 2,
        lineWidth: 0,
        minContentWidth: 0,
      });

      // Write output
      await fs.writeFile(outputPath, content, 'utf-8');

      // Verify output file exists
      const stats = await fs.stat(outputPath);
      expect(stats.isFile()).toBe(true);

      // Verify content
      const writtenContent = await fs.readFile(outputPath, 'utf-8');
      const parsedContent = yaml.parse(writtenContent);

      expect(parsedContent.openapi).toBe('3.1.0');
      expect(parsedContent.info).toBeDefined();
      expect(parsedContent.info.title).toBe('Simple E-Commerce Workflow');
      expect(parsedContent.paths).toBeDefined();
      expect(parsedContent.paths['/workflows/getProduct']).toBeDefined();
      expect(parsedContent['x-arazzo-document']).toBe(inputPath);
    });

    it('should convert multiple workflows', async () => {
      const inputPath = path.join(fixturesDir, 'multi-workflow.yaml');
      const outputPath = path.join(outputDir, 'multi-workflow.openapi.json');

      // Parse Arazzo
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      // Analyze workflows
      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Generate OpenAPI
      const generator = new OpenAPIGenerator();
      const openapi = await generator.generateOpenAPI(document, workflows, inputPath, {
        arazzoPath: inputPath,
        outputPath,
        openapiVersion: '3.1.0',
        outputFormat: 'json',
      });

      // Convert to plain object and serialize
      const { toValue } = await import('@speclynx/apidom-core');
      const openapiObj = toValue(openapi);
      const content = JSON.stringify(openapiObj, null, 2);

      // Write output
      await fs.writeFile(outputPath, content, 'utf-8');

      // Verify content
      const writtenContent = await fs.readFile(outputPath, 'utf-8');
      const parsedContent = JSON.parse(writtenContent);

      expect(parsedContent.paths['/workflows/placeOrder']).toBeDefined();
      expect(parsedContent.paths['/workflows/cancelOrder']).toBeDefined();
      expect(parsedContent.paths['/workflows/updateOrder']).toBeDefined();
    });

    it('should handle complex workflow with nested schemas', async () => {
      const inputPath = path.join(fixturesDir, 'complex-workflow.yaml');
      const outputPath = path.join(outputDir, 'complex-workflow.openapi.json');

      // Parse Arazzo
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      // Analyze workflows
      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Generate OpenAPI
      const generator = new OpenAPIGenerator();
      const openapi = await generator.generateOpenAPI(document, workflows, inputPath, {
        arazzoPath: inputPath,
        outputPath,
        openapiVersion: '3.1.0',
        outputFormat: 'json',
      });

      // Convert to plain object and serialize
      const { toValue } = await import('@speclynx/apidom-core');
      const openapiObj = toValue(openapi);
      const content = JSON.stringify(openapiObj, null, 2);

      // Write output
      await fs.writeFile(outputPath, content, 'utf-8');

      // Verify content
      const writtenContent = await fs.readFile(outputPath, 'utf-8');
      const parsedContent = JSON.parse(writtenContent);

      // Check request body schema
      const requestBody = parsedContent.paths['/workflows/placeOrder'].post.requestBody;
      const schema = requestBody.content['application/json'].schema;

      expect(schema.properties.customerId).toBeDefined();
      expect(schema.properties.customerId.format).toBe('uuid');
      expect(schema.properties.items).toBeDefined();
      expect(schema.properties.items.type).toBe('array');
      expect(schema.properties.paymentMethod.enum).toContain('credit_card');
    });

    it('should apply CLI overrides for metadata', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.yaml');
      const outputPath = path.join(outputDir, 'overridden.openapi.json');

      // Parse Arazzo
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      // Analyze workflows
      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Generate OpenAPI with overrides
      const generator = new OpenAPIGenerator();
      const openapi = await generator.generateOpenAPI(document, workflows, inputPath, {
        arazzoPath: inputPath,
        outputPath,
        openapiVersion: '3.1.0',
        outputFormat: 'json',
        title: 'Custom API Title',
        version: '2.0.0',
        description: 'Custom description',
        servers: [
          { url: 'https://custom.example.com', description: 'Custom server' },
        ],
      });

      // Convert to plain object and serialize
      const { toValue } = await import('@speclynx/apidom-core');
      const openapiObj = toValue(openapi);
      const content = JSON.stringify(openapiObj, null, 2);

      // Write output
      await fs.writeFile(outputPath, content, 'utf-8');

      // Verify content
      const writtenContent = await fs.readFile(outputPath, 'utf-8');
      const parsedContent = JSON.parse(writtenContent);

      expect(parsedContent.info.title).toBe('Custom API Title');
      expect(parsedContent.info.version).toBe('2.0.0');
      expect(parsedContent.info.description).toBe('Custom description');
      expect(parsedContent.servers).toHaveLength(1);
      expect(parsedContent.servers[0].url).toBe('https://custom.example.com');
    });

    it('should use custom response code when specified', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.yaml');
      const outputPath = path.join(outputDir, 'custom-response.openapi.json');

      // Parse Arazzo
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      // Analyze workflows
      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      // Generate OpenAPI with custom response code
      const generator = new OpenAPIGenerator();
      const openapi = await generator.generateOpenAPI(document, workflows, inputPath, {
        arazzoPath: inputPath,
        outputPath,
        openapiVersion: '3.1.0',
        outputFormat: 'json',
        responseCode: 202,
      });

      // Convert to plain object and serialize
      const { toValue } = await import('@speclynx/apidom-core');
      const openapiObj = toValue(openapi);
      const content = JSON.stringify(openapiObj, null, 2);

      // Write output
      await fs.writeFile(outputPath, content, 'utf-8');

      // Verify content
      const writtenContent = await fs.readFile(outputPath, 'utf-8');
      const parsedContent = JSON.parse(writtenContent);

      const responses = parsedContent.paths['/workflows/getProduct'].post.responses;
      expect(responses['202']).toBeDefined();
      expect(responses['200']).toBeUndefined();
    });
  });

  describe('format detection and conversion', () => {
    it('should detect JSON input format', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.json');
      const parser = new ArazzoParser();
      const { detectedFormat } = await parser.loadDocument(inputPath);

      expect(detectedFormat).toBe('json');
    });

    it('should detect YAML input format', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.yaml');
      const parser = new ArazzoParser();
      const { detectedFormat } = await parser.loadDocument(inputPath);

      expect(detectedFormat).toBe('yaml');
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent file', async () => {
      const inputPath = path.join(fixturesDir, 'non-existent.yaml');
      const parser = new ArazzoParser();

      await expect(parser.loadDocument(inputPath)).rejects.toThrow();
    });

    it('should throw error for malformed Arazzo document', async () => {
      const inputPath = path.join(fixturesDir, 'malformed.json');
      const parser = new ArazzoParser();

      await expect(parser.loadDocument(inputPath)).rejects.toThrow();
    });
  });

  describe('workflow validation', () => {
    it('should validate workflow has required fields', async () => {
      const inputPath = path.join(fixturesDir, 'simple-workflow.yaml');
      const parser = new ArazzoParser();
      const { document } = await parser.loadDocument(inputPath);

      const analyzer = new WorkflowAnalyzer();
      const workflows = analyzer.analyzeAllWorkflows(document);

      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows[0].workflowId).toBeDefined();
      expect(workflows[0].steps).toBeDefined();
    });
  });
});
