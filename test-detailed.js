const { ArazzoParser } = require('./dist/core/arazzo-parser');
const { WorkflowAnalyzer } = require('./dist/core/workflow-analyzer');
const path = require('path');

async function test() {
  const parser = new ArazzoParser();
  const analyzer = new WorkflowAnalyzer();
  
  const filePath = path.join(__dirname, 'tests/fixtures/arazzo/simple-workflow.yaml');
  const { document } = await parser.loadDocument(filePath);
  const workflows = analyzer.analyzeAllWorkflows(document);
  
  console.log('Workflow outputs:');
  console.log(JSON.stringify(workflows[0].outputs, null, 2));
  console.log('\nWorkflow steps:');
  console.log(JSON.stringify(workflows[0].steps, null, 2));
}

test().catch(console.error);
