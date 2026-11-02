/**
 * Tests for TypeResolver JSON Pointer step output resolution.
 *
 * Covers the $response.body#/pointer notation used when step outputs reference
 * specific fields within the response body via RFC 6901 JSON Pointers — e.g.:
 *   outputs:
 *     token: $response.body#/token
 *     connectId: $response.body#/companies/0/id
 *
 * Regression: previously the resolver split on '.' which produced a literal
 * property lookup for the whole string '#/token', always falling back to
 * type:string with a failure note.
 */

import { TypeResolver } from '../../src/core/type-resolver';
import { SourceDocumentResolver } from '../../src/core/source-document-resolver';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import { AnalyzedWorkflow } from '../../src/core/workflow-analyzer';
import { createNodeResolver, createNodeEngine } from '../helpers';
import * as path from 'path';

const fixturesPath = path.join(__dirname, '..', 'fixtures');
const arazzoPath = path.join(fixturesPath, 'arazzo', 'json-pointer-workflow.yaml');

describe('TypeResolver — JSON Pointer step output resolution', () => {
  let resolver: TypeResolver;
  let sourceResolver: SourceDocumentResolver;
  let parser: ArazzoParser;
  let arazzoDoc: any;

  beforeAll(async () => {
    parser = new ArazzoParser();
    const parsed = await parser.loadDocument(arazzoPath);
    arazzoDoc = parsed.document;
  });

  beforeEach(() => {
    resolver = new TypeResolver();
    sourceResolver = createNodeResolver();
  });

  afterEach(() => {
    sourceResolver.clearCache();
  });

  // ---------------------------------------------------------------------------
  // $response.body#/<scalar-field>
  // ---------------------------------------------------------------------------

  describe('$response.body#/<top-level scalar>', () => {
    it('resolves $response.body#/token to string', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'authenticate',
          operationId: 'authSearchAPI.authenticate',
          outputs: { token: '$response.body#/token' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'authenticate',
        'outputs.token',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('string');
      expect(result.description).toBe('JWT bearer token');
    });

    it('resolves $response.body#/expiresIn to integer', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'authenticate',
          operationId: 'authSearchAPI.authenticate',
          outputs: { expiresIn: '$response.body#/expiresIn' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'authenticate',
        'outputs.expiresIn',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('integer');
      expect(result.description).toBe('Token lifetime in seconds');
    });

    it('resolves $response.body#/totalSize to integer', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { totalSize: '$response.body#/totalSize' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.totalSize',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('integer');
      expect(result.description).toBe('Total number of matching companies');
    });
  });

  // ---------------------------------------------------------------------------
  // $response.body#/<array-field>
  // ---------------------------------------------------------------------------

  describe('$response.body#/<array field>', () => {
    it('resolves $response.body#/companies to array', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { companies: '$response.body#/companies' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.companies',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('array');
      expect(result.items).toBeDefined();
      expect(result.items?.type).toBe('object');
    });
  });

  // ---------------------------------------------------------------------------
  // $response.body#/<array>/<index>/<property> (nested JSON Pointer)
  // ---------------------------------------------------------------------------

  describe('$response.body#/<array>/<index>/<property>', () => {
    it('resolves $response.body#/companies/0/id to integer', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { connectId: '$response.body#/companies/0/id' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.connectId',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('integer');
      expect(result.format).toBe('int64');
      expect(result.description).toBe('Unique company identifier');
    });

    it('resolves $response.body#/companies/0/name to string', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { companyName: '$response.body#/companies/0/name' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.companyName',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('string');
      expect(result.description).toBe('Company name');
    });
  });

  // ---------------------------------------------------------------------------
  // $response.body (no pointer — entire body)
  // ---------------------------------------------------------------------------

  describe('$response.body (whole body)', () => {
    it('resolves $response.body to the full response object schema', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { fullBody: '$response.body' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.fullBody',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('inferred');
      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
      expect(result.properties?.companies).toBeDefined();
      expect(result.properties?.totalSize).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback cases
  // ---------------------------------------------------------------------------

  describe('fallback cases', () => {
    it('falls back gracefully for a non-existent JSON Pointer path', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { missing: '$response.body#/nonExistentField' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.missing',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('fallback');
      expect(result.type).toBe('string');
      expect(result.resolutionNote).toContain('could not be resolved');
    });

    it('falls back gracefully for a bad nested JSON Pointer path', async () => {
      const workflow = makeWorkflow([
        {
          stepId: 'searchCompanies',
          operationId: 'authSearchAPI.searchCompanies',
          outputs: { missing: '$response.body#/companies/0/nonExistent' },
        },
      ]);

      const result = await resolver.resolveStepOutputType(
        'searchCompanies',
        'outputs.missing',
        workflow,
        sourceResolver,
        arazzoDoc,
        arazzoPath
      );

      expect(result.source).toBe('fallback');
      expect(result.type).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // End-to-end: full workflow output inference
  // ---------------------------------------------------------------------------

  describe('end-to-end workflow output schema', () => {
    it('infers all output types correctly via TypeInferenceEngine', async () => {
      // Import here to avoid circular test init
      const { WorkflowAnalyzer } = await import('../../src/core/workflow-analyzer');

      const analyzer = new WorkflowAnalyzer();
      const engine = createNodeEngine();

      const { document } = await parser.loadDocument(arazzoPath);
      const workflows = analyzer.analyzeAllWorkflows(document);
      expect(workflows).toHaveLength(1);

      const result = await engine.inferOutputSchema(workflows[0], document, arazzoPath);

      expect(result.metadata.fallbackCount).toBe(0);
      expect(result.metadata.resolvedCount).toBe(8);

      // Scalar fields from authenticate
      expect(result.schema.get?.('properties')?.get?.('authToken')?.get?.('type')?.toValue()).toBe('string');
      expect(result.schema.get?.('properties')?.get?.('expiresIn')?.get?.('type')?.toValue()).toBe('integer');

      // Scalar fields from searchCompanies
      expect(result.schema.get?.('properties')?.get?.('connectId')?.get?.('type')?.toValue()).toBe('integer');
      expect(result.schema.get?.('properties')?.get?.('companyName')?.get?.('type')?.toValue()).toBe('string');
      expect(result.schema.get?.('properties')?.get?.('totalSize')?.get?.('type')?.toValue()).toBe('integer');

      // Array and object fields
      expect(result.schema.get?.('properties')?.get?.('companies')?.get?.('type')?.toValue()).toBe('array');
      expect(result.schema.get?.('properties')?.get?.('fullSearchBody')?.get?.('type')?.toValue()).toBe('object');
      expect(result.schema.get?.('properties')?.get?.('fullAuthBody')?.get?.('type')?.toValue()).toBe('object');
    });
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeWorkflow(
  steps: Array<{
    stepId: string;
    operationId?: string;
    outputs?: Record<string, string>;
  }>
): AnalyzedWorkflow {
  return {
    workflowId: 'test',
    inputs: undefined,
    outputs: { fields: {} },
    steps,
    sourceDescriptions: [],
  };
}
