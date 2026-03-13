// Quick test to reproduce the bug
const { ArazzoParser } = require('./dist/core/arazzo-parser');
const { WorkflowAnalyzer } = require('./dist/core/workflow-analyzer');
const { OpenAPIGenerator } = require('./dist/core/openapi-generator');
const { toValue } = require('@speclynx/apidom-core');
const path = require('path');

async function test() {
  const parser = new ArazzoParser();
  const analyzer = new WorkflowAnalyzer();
  const generator = new OpenAPIGenerator();
  
  const filePath = path.join(__dirname, 'tests/fixtures/arazzo/simple-workflow.yaml');
  const { document } = await parser.loadDocument(filePath);
  const workflows = analyzer.analyzeAllWorkflows(document);
  
  const config = {
    arazzoPath: filePath,
    outputPath: 'output.yaml',
    openapiVersion: '3.1.0',
  };
  
  const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
  const openapiObj = toValue(openapi);
  
  // Check the response schema
  const schema = openapiObj.paths['/workflows/getProduct'].post.responses['200'].content['application/json'].schema;
  console.log('Response schema properties:');
  console.log(JSON.stringify(schema.properties, null, 2));
}

test().catch(console.error);
