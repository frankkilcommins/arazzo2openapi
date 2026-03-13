const { OpenAPIGenerator } = require('./dist/core/openapi-generator');
const { ArazzoParser } = require('./dist/core/arazzo-parser');
const { WorkflowAnalyzer } = require('./dist/core/workflow-analyzer');
const { toValue } = require('@speclynx/apidom-core');
const yaml = require('yaml');
const path = require('path');

async function testMissingSourceDoc() {
  console.log('Testing workflow with MISSING source document...\n');
  
  const parser = new ArazzoParser();
  const analyzer = new WorkflowAnalyzer();
  const generator = new OpenAPIGenerator();
  
  // Use a workflow that references a non-existent source
  const filePath = path.join(__dirname, 'tests/fixtures/arazzo/external-refs.yaml');
  const { document } = await parser.loadDocument(filePath);
  const workflows = analyzer.analyzeAllWorkflows(document);
  
  const config = {
    arazzoPath: filePath,
    outputPath: 'output.yaml',
    openapiVersion: '3.1.0',
  };
  
  const openapi = await generator.generateOpenAPI(document, workflows, filePath, config);
  const openapiObj = toValue(openapi);
  
  // Check the first workflow's response schema
  const firstPath = Object.keys(openapiObj.paths)[0];
  if (firstPath) {
    const schema = openapiObj.paths[firstPath].post.responses['200']?.content?.['application/json']?.schema;
    if (schema) {
      console.log('Response schema:');
      console.log(yaml.stringify({ schema }));
      
      // Check if properties contain expressions
      if (schema.properties) {
        for (const [key, value] of Object.entries(schema.properties)) {
          if (typeof value === 'string' && value.startsWith('$')) {
            console.log(`\n❌ FOUND RAW EXPRESSION: ${key} = ${value}`);
          }
        }
      }
    }
  }
}

testMissingSourceDoc().catch(err => {
  console.log('Error (expected for missing source):', err.message);
});
