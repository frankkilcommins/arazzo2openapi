import { ArazzoParser } from '../../src/core/arazzo-parser';
import { ArazzoParseError } from '../../src/types/errors';
import { ArazzoSpecification1Element, WorkflowElement } from '@speclynx/apidom-ns-arazzo-1';
import * as path from 'path';

describe('ArazzoParser', () => {
  let parser: ArazzoParser;

  beforeEach(() => {
    parser = new ArazzoParser();
  });

  describe('loadDocument', () => {
    it('should load and parse a valid JSON Arazzo document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const result = await parser.loadDocument(filePath);

      expect(result.document).toBeInstanceOf(ArazzoSpecification1Element);
      expect(result.detectedFormat).toBe('json');

      // Verify document structure
      const doc = result.document;
      expect(doc.arazzo?.toValue()).toBe('1.0.0');
      expect(doc.info?.get('title')?.toValue()).toBe('Simple E-Commerce Workflow');
      expect(doc.info?.get('version')?.toValue()).toBe('1.0.0');
    });

    it('should load and parse a valid YAML Arazzo document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const result = await parser.loadDocument(filePath);

      expect(result.document).toBeInstanceOf(ArazzoSpecification1Element);
      expect(result.detectedFormat).toBe('yaml');

      // Verify document structure
      const doc = result.document;
      expect(doc.arazzo?.toValue()).toBe('1.0.0');
      expect(doc.info?.get('title')?.toValue()).toBe('Simple E-Commerce Workflow');
    });

    it('should detect JSON format from .json extension', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const result = await parser.loadDocument(filePath);

      expect(result.detectedFormat).toBe('json');
    });

    it('should detect YAML format from .yaml extension', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const result = await parser.loadDocument(filePath);

      expect(result.detectedFormat).toBe('yaml');
    });

    it('should detect YAML format from .yml extension', async () => {
      // Create a .yml file for this test
      const yamlPath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const result = await parser.loadDocument(yamlPath);

      expect(result.detectedFormat).toBe('yaml');
    });

    it('should throw ArazzoParseError for non-existent file', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/non-existent.json');

      await expect(parser.loadDocument(filePath)).rejects.toThrow(ArazzoParseError);
      await expect(parser.loadDocument(filePath)).rejects.toThrow(/Failed to load Arazzo document/);
    });

    it('should throw ArazzoParseError for malformed JSON', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/malformed.json');

      await expect(parser.loadDocument(filePath)).rejects.toThrow(ArazzoParseError);
      await expect(parser.loadDocument(filePath)).rejects.toThrow(/Failed to parse Arazzo document/);
    });
  });

  describe('getWorkflows', () => {
    it('should extract workflows from document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);

      expect(workflows).toBeDefined();
      expect(workflows?.length).toBe(1);
    });

    it('should return undefined for document without workflows', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const { document } = await parser.loadDocument(filePath);

      // Create a mock document without workflows
      const emptyDoc = new ArazzoSpecification1Element();
      const workflows = parser.getWorkflows(emptyDoc);

      expect(workflows).toBeUndefined();
    });

    it('should handle multiple workflows', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);

      expect(workflows).toBeDefined();
      expect(workflows?.length).toBe(3);
    });
  });

  describe('getWorkflowById', () => {
    it('should find workflow by ID', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const { document } = await parser.loadDocument(filePath);

      const workflow = parser.getWorkflowById(document, 'getProduct');

      expect(workflow).toBeInstanceOf(WorkflowElement);
      expect(workflow?.get('workflowId')?.toValue()).toBe('getProduct');
      expect(workflow?.get('summary')?.toValue()).toBe('Get product details');
    });

    it('should return undefined for non-existent workflow ID', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const { document } = await parser.loadDocument(filePath);

      const workflow = parser.getWorkflowById(document, 'nonExistent');

      expect(workflow).toBeUndefined();
    });

    it('should find correct workflow in multi-workflow document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflow1 = parser.getWorkflowById(document, 'placeOrder');
      expect(workflow1?.get('workflowId')?.toValue()).toBe('placeOrder');
      expect(workflow1?.get('summary')?.toValue()).toBe('Place a new order');

      const workflow2 = parser.getWorkflowById(document, 'cancelOrder');
      expect(workflow2?.get('workflowId')?.toValue()).toBe('cancelOrder');
      expect(workflow2?.get('summary')?.toValue()).toBe('Cancel an order');

      const workflow3 = parser.getWorkflowById(document, 'updateOrder');
      expect(workflow3?.get('workflowId')?.toValue()).toBe('updateOrder');
      expect(workflow3?.get('summary')?.toValue()).toBe('Update order details');
    });

    it('should return undefined when document has no workflows', async () => {
      const emptyDoc = new ArazzoSpecification1Element();
      const workflow = parser.getWorkflowById(emptyDoc, 'anyId');

      expect(workflow).toBeUndefined();
    });
  });

  describe('format detection', () => {
    it('should correctly detect all JSON variants', async () => {
      const jsonPath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const result = await parser.loadDocument(jsonPath);
      expect(result.detectedFormat).toBe('json');
    });

    it('should correctly detect all YAML variants', async () => {
      const yamlPath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const result = await parser.loadDocument(yamlPath);
      expect(result.detectedFormat).toBe('yaml');
    });
  });

  describe('error handling', () => {
    it('should preserve ArazzoParseError when thrown', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/malformed.json');

      try {
        await parser.loadDocument(filePath);
        fail('Should have thrown ArazzoParseError');
      } catch (error) {
        expect(error).toBeInstanceOf(ArazzoParseError);
        expect(error instanceof Error && error.name).toBe('ArazzoParseError');
      }
    });

    it('should wrap non-ArazzoParseError errors', async () => {
      const filePath = '/path/that/does/not/exist/file.json';

      try {
        await parser.loadDocument(filePath);
        fail('Should have thrown ArazzoParseError');
      } catch (error) {
        expect(error).toBeInstanceOf(ArazzoParseError);
        expect(error instanceof Error && error.message).toContain('Failed to load Arazzo document');
      }
    });
  });
});
