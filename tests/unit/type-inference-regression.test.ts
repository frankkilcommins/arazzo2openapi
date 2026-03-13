/**
 * Regression tests to ensure raw Arazzo expressions never leak into OpenAPI schemas
 */

import { OpenAPIGenerator } from '../../src/core/openapi-generator';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import { WorkflowAnalyzer } from '../../src/core/workflow-analyzer';
import { GenerationConfig } from '../../src/types/config';
import { toValue } from '@speclynx/apidom-core';
import * as path from 'path';

describe('Type Inference Regression Tests', () => {
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

  /**
   * Helper to recursively check if any value in an object is a raw Arazzo expression
   */
  function containsRawExpression(obj: any, path: string = 'root'): string | null {
    if (typeof obj === 'string') {
      // Check if it's a raw Arazzo runtime expression
      if (obj.match(/^\$(steps|inputs|sourceDescriptions|url|method|statusCode|request|response)\./)) {
        return `Found raw expression at ${path}: "${obj}"`;
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = containsRawExpression(obj[i], `${path}[${i}]`);
        if (result) return result;
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const result = containsRawExpression(value, `${path}.${key}`);
        if (result) return result;
      }
    }
    return null;
  }

  it('should NEVER output raw Arazzo expressions in response schemas', async () => {
    const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
    const { document } = await parser.loadDocument(filePath);
    const workflows = analyzer.analyzeAllWorkflows(document);

    const config: GenerationConfig = {
      arazzoPath: filePath,
      outputPath: 'output.yaml',
      openapiVersion: '3.1.0',
    };

    const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
    const openapiObj = toValue(openapi) as any;

    // Check all response schemas for raw expressions
    for (const [pathKey, pathItem] of Object.entries(openapiObj.paths)) {
      const operation = (pathItem as any).post;
      if (operation && operation.responses) {
        for (const [statusCode, response] of Object.entries(operation.responses)) {
          const schema = (response as any).content?.['application/json']?.schema;
          if (schema) {
            const rawExpressionFound = containsRawExpression(schema, `${pathKey}.post.responses.${statusCode}.schema`);
            expect(rawExpressionFound).toBeNull();
            
            // If test fails, show what was found
            if (rawExpressionFound) {
              fail(rawExpressionFound);
            }
          }
        }
      }
    }
  });

  it('should convert $steps expressions to proper typed schemas', async () => {
    const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
    const { document } = await parser.loadDocument(filePath);
    const workflows = analyzer.analyzeAllWorkflows(document);

    const config: GenerationConfig = {
      arazzoPath: filePath,
      outputPath: 'output.yaml',
      openapiVersion: '3.1.0',
    };

    const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
    const openapiObj = toValue(openapi) as any;

    const schema = openapiObj.paths['/workflows/getProduct'].post.responses['200'].content['application/json'].schema;

    // Verify properties are objects with 'type' field, not strings
    expect(schema.properties).toBeDefined();
    expect(typeof schema.properties.productName).toBe('object');
    expect(typeof schema.properties.productPrice).toBe('object');
    
    // Verify they have proper type information
    expect(schema.properties.productName.type).toBe('string');
    expect(schema.properties.productPrice.type).toBe('number');
    
    // Explicitly check they are NOT raw expressions
    expect(schema.properties.productName).not.toEqual('$steps.fetchProduct.outputs.name');
    expect(schema.properties.productPrice).not.toEqual('$steps.fetchProduct.outputs.price');
  });

  it('should use fallback type:string when type inference fails, not raw expressions', async () => {
    // This test ensures that even when we can't resolve types,
    // we output proper schema objects, not raw expressions
    
    // Create a workflow that will fail type inference
    const arazzoContent = `
arazzo: 1.0.0
info:
  title: Test Workflow
  version: 1.0.0
sourceDescriptions:
  - name: fakeAPI
    url: ./non-existent.yaml
    type: openapi
workflows:
  - workflowId: testWorkflow
    outputs:
      result: $steps.fakeStep.outputs.data
    steps:
      - stepId: fakeStep
        operationId: fakeAPI.fakeOperation
`;

    const tempPath = path.join(__dirname, '../fixtures/arazzo/temp-test.yaml');
    const fs = require('fs');
    fs.writeFileSync(tempPath, arazzoContent);

    try {
      const { document } = await parser.loadDocument(tempPath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: tempPath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const openapi = await generator.generateOpenAPI(document, workflows, tempPath, config);
      const openapiObj = toValue(openapi) as any;

      const schema = openapiObj.paths['/workflows/testWorkflow'].post.responses['200'].content['application/json'].schema;

      // Verify it's still a proper schema object, not a raw expression
      expect(schema.properties).toBeDefined();
      expect(schema.properties.result).toBeDefined();
      expect(typeof schema.properties.result).toBe('object');
      
      // Should have fallback type
      expect(schema.properties.result.type).toBe('string');
      
      // Should have description explaining the fallback
      expect(schema.properties.result.description).toContain('Type inference fallback');
      
      // Explicitly verify it's NOT the raw expression
      expect(schema.properties.result).not.toEqual('$steps.fakeStep.outputs.data');
      
      // Check there are no raw expressions anywhere in the schema
      const rawExpressionFound = containsRawExpression(schema);
      expect(rawExpressionFound).toBeNull();
    } finally {
      // Cleanup
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  });
});
