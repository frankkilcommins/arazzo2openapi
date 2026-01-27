import { ArazzoParser } from '../../src/core/arazzo-parser';
import { WorkflowAnalyzer } from '../../src/core/workflow-analyzer';
import { WorkflowAnalysisError } from '../../src/types/errors';
import { WorkflowElement } from '@speclynx/apidom-ns-arazzo-1';
import * as path from 'path';

describe('WorkflowAnalyzer', () => {
  let parser: ArazzoParser;
  let analyzer: WorkflowAnalyzer;

  beforeEach(() => {
    parser = new ArazzoParser();
    analyzer = new WorkflowAnalyzer();
  });

  describe('analyzeWorkflow', () => {
    it('should analyze a simple workflow with inputs and outputs', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const analyzed = analyzer.analyzeWorkflow(workflow);

      expect(analyzed.workflowId).toBe('getProduct');
      expect(analyzed.summary).toBe('Get product details');
      expect(analyzed.description).toBe('Retrieve product information by ID');
      expect(analyzed.inputs).toBeDefined();
      expect(analyzed.outputs).toBeDefined();
      expect(analyzed.steps).toHaveLength(1);
      expect(analyzed.sourceDescriptions).toContain('testAPI');
    });

    it('should analyze a complex workflow with multiple steps', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const analyzed = analyzer.analyzeWorkflow(workflow);

      expect(analyzed.workflowId).toBe('placeOrder');
      expect(analyzed.summary).toBe('Place a new order');
      expect(analyzed.steps).toHaveLength(3);
      expect(analyzed.sourceDescriptions).toHaveLength(2);
      expect(analyzed.sourceDescriptions).toContain('shopAPI');
      expect(analyzed.sourceDescriptions).toContain('paymentAPI');
    });

    it('should extract workflow steps with descriptions', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const analyzed = analyzer.analyzeWorkflow(workflow);

      expect(analyzed.steps[0].stepId).toBe('checkInventory');
      expect(analyzed.steps[0].description).toBe('Verify product availability');
      expect(analyzed.steps[0].operationId).toBe('shopAPI.checkStock');

      expect(analyzed.steps[1].stepId).toBe('processPayment');
      expect(analyzed.steps[1].description).toBe('Process customer payment');
      expect(analyzed.steps[1].operationId).toBe('paymentAPI.createPayment');

      expect(analyzed.steps[2].stepId).toBe('createOrder');
      expect(analyzed.steps[2].description).toBe('Create order record');
      expect(analyzed.steps[2].operationId).toBe('shopAPI.createOrder');
    });
  });

  describe('analyzeAllWorkflows', () => {
    it('should analyze all workflows in a document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const analyzed = analyzer.analyzeAllWorkflows(document);

      expect(analyzed).toHaveLength(3);
      expect(analyzed[0].workflowId).toBe('placeOrder');
      expect(analyzed[1].workflowId).toBe('cancelOrder');
      expect(analyzed[2].workflowId).toBe('updateOrder');
    });

    it('should return empty array for document without workflows', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.json');
      const { document } = await parser.loadDocument(filePath);

      // Create empty document by using a fresh ArazzoSpecification1Element
      const { ArazzoSpecification1Element } = await import('@speclynx/apidom-ns-arazzo-1');
      const emptyDoc = new ArazzoSpecification1Element();

      const analyzed = analyzer.analyzeAllWorkflows(emptyDoc);

      expect(analyzed).toEqual([]);
    });
  });

  describe('analyzeInputs', () => {
    it('should extract inputs schema and required fields', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const inputs = analyzer.analyzeInputs(workflow);

      expect(inputs).toBeDefined();
      expect(inputs?.schema.type).toBe('object');
      expect(inputs?.schema.properties).toBeDefined();
      expect(inputs?.required).toContain('productId');
    });

    it('should handle complex inputs with nested objects and arrays', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const inputs = analyzer.analyzeInputs(workflow);

      expect(inputs).toBeDefined();
      expect(inputs?.schema.type).toBe('object');
      expect(inputs?.required).toHaveLength(3);
      expect(inputs?.required).toContain('customerId');
      expect(inputs?.required).toContain('items');
      expect(inputs?.required).toContain('paymentMethod');

      const properties = inputs?.schema.properties as Record<string, unknown>;
      expect(properties.customerId).toBeDefined();
      expect(properties.items).toBeDefined();
      expect(properties.paymentMethod).toBeDefined();
    });

    it('should return undefined for workflow without inputs', async () => {
      // Use a workflow that has no inputs defined
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(1) as WorkflowElement; // cancelOrder has inputs

      // Create a minimal workflow element without inputs for testing
      const { WorkflowElement: WE } = await import('@speclynx/apidom-ns-arazzo-1');
      const minimalWorkflow = new WE({ workflowId: 'test' });

      const inputs = analyzer.analyzeInputs(minimalWorkflow);

      expect(inputs).toBeUndefined();
    });
  });

  describe('analyzeOutputs', () => {
    it('should extract output fields and expressions', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const outputs = analyzer.analyzeOutputs(workflow);

      expect(outputs).toBeDefined();
      expect(outputs?.fields).toBeDefined();
      expect(outputs?.fields.productName).toBeDefined();
      expect(outputs?.fields.productName.name).toBe('productName');
      expect(outputs?.fields.productName.expression).toBe('$steps.fetchProduct.outputs.name');

      expect(outputs?.fields.productPrice).toBeDefined();
      expect(outputs?.fields.productPrice.name).toBe('productPrice');
      expect(outputs?.fields.productPrice.expression).toBe('$steps.fetchProduct.outputs.price');
    });

    it('should handle multiple output fields', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const outputs = analyzer.analyzeOutputs(workflow);

      expect(outputs).toBeDefined();
      expect(Object.keys(outputs?.fields || {})).toHaveLength(4);
      expect(outputs?.fields.orderId).toBeDefined();
      expect(outputs?.fields.orderStatus).toBeDefined();
      expect(outputs?.fields.totalAmount).toBeDefined();
      expect(outputs?.fields.paymentConfirmation).toBeDefined();
    });

    it('should return undefined for workflow without outputs', async () => {
      // Create a minimal workflow element without outputs for testing
      const { WorkflowElement: WE } = await import('@speclynx/apidom-ns-arazzo-1');
      const minimalWorkflow = new WE({ workflowId: 'test' });

      const outputs = analyzer.analyzeOutputs(minimalWorkflow);

      expect(outputs).toBeUndefined();
    });
  });

  describe('getWorkflowMetadata', () => {
    it('should extract lightweight workflow metadata', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const metadata = analyzer.getWorkflowMetadata(workflow);

      expect(metadata.workflowId).toBe('placeOrder');
      expect(metadata.summary).toBe('Place a new order');
      expect(metadata.description).toBeDefined();
      expect(metadata.stepCount).toBe(3);
      expect(metadata.hasInputs).toBe(true);
      expect(metadata.hasOutputs).toBe(true);
    });

    it('should handle workflow without inputs or outputs', async () => {
      // Create a minimal workflow element without inputs/outputs for testing
      const { WorkflowElement: WE } = await import('@speclynx/apidom-ns-arazzo-1');
      const minimalWorkflow = new WE({ workflowId: 'test', summary: 'Test workflow' });

      const metadata = analyzer.getWorkflowMetadata(minimalWorkflow);

      expect(metadata.hasInputs).toBe(false);
      expect(metadata.hasOutputs).toBe(false);
    });
  });

  describe('getAllWorkflowMetadata', () => {
    it('should get metadata for all workflows', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const metadata = analyzer.getAllWorkflowMetadata(document);

      expect(metadata).toHaveLength(3);
      expect(metadata[0].workflowId).toBe('placeOrder');
      expect(metadata[0].stepCount).toBe(1);
      expect(metadata[1].workflowId).toBe('cancelOrder');
      expect(metadata[2].workflowId).toBe('updateOrder');
    });

    it('should return empty array for document without workflows', async () => {
      // Create empty document
      const { ArazzoSpecification1Element } = await import('@speclynx/apidom-ns-arazzo-1');
      const emptyDoc = new ArazzoSpecification1Element();

      const metadata = analyzer.getAllWorkflowMetadata(emptyDoc);

      expect(metadata).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should throw WorkflowAnalysisError for workflow without workflowId', async () => {
      // Create a workflow element without workflowId
      const { WorkflowElement: WE } = await import('@speclynx/apidom-ns-arazzo-1');
      const invalidWorkflow = new WE({}); // No workflowId

      expect(() => analyzer.analyzeWorkflow(invalidWorkflow)).toThrow(WorkflowAnalysisError);
      expect(() => analyzer.analyzeWorkflow(invalidWorkflow)).toThrow(/workflowId/);
    });
  });

  describe('source description extraction', () => {
    it('should extract unique source descriptions from operationIds', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const analyzed = analyzer.analyzeWorkflow(workflow);

      expect(analyzed.sourceDescriptions).toHaveLength(2);
      expect(analyzed.sourceDescriptions).toContain('shopAPI');
      expect(analyzed.sourceDescriptions).toContain('paymentAPI');
    });

    it('should handle workflow with single source description', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const workflows = parser.getWorkflows(document);
      const workflow = workflows?.get(0) as WorkflowElement;

      const analyzed = analyzer.analyzeWorkflow(workflow);

      expect(analyzed.sourceDescriptions).toHaveLength(1);
      expect(analyzed.sourceDescriptions).toContain('testAPI');
    });

    it('should handle workflow without operationIds', async () => {
      // Create a minimal workflow with steps but no operationIds
      const { WorkflowElement: WE, StepElement } = await import('@speclynx/apidom-ns-arazzo-1');
      const { ArrayElement } = await import('@speclynx/apidom-core');

      const step1 = new StepElement({ stepId: 'step1', operationPath: '/some/path' });
      const steps = new ArrayElement([step1]);

      const workflowWithoutOpIds = new WE({
        workflowId: 'test',
        steps: steps.toValue()
      });

      const analyzed = analyzer.analyzeWorkflow(workflowWithoutOpIds);

      expect(analyzed.sourceDescriptions).toHaveLength(0);
    });
  });
});
