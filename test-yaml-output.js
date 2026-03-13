const { ArazzoParser } = require('./dist/core/arazzo-parser');
const { WorkflowAnalyzer } = require('./dist/core/workflow-analyzer');
const { OpenAPIGenerator } = require('./dist/core/openapi-generator');
const { toValue } = require('@speclynx/apidom-core');
const yaml = require('yaml');
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
  
  // Convert to YAML like the CLI does
  const yamlOutput = yaml.stringify(openapiObj);
  
  // Check if the YAML contains raw expressions
  if (yamlOutput.includes('$steps.fetchProduct.outputs.name')) {
    console.log('❌ BUG FOUND: Raw expression in YAML output!');
    console.log('\nProblematic section:');
    const lines = yamlOutput.split('\n');
    const idx = lines.findIndex(l => l.includes('$steps'));
    console.log(lines.slice(Math.max(0, idx-5), idx+10).join('\n'));
  } else {
    console.log('✅ No raw expressions found in YAML output');
    console.log('\nResponse schema section:');
    const responseSchema = openapiObj.paths['/workflows/getProduct'].post.responses['200'].content['application/json'].schema;
    console.log(yaml.stringify({ schema: responseSchema }));
  }
}

test().catch(console.error);
