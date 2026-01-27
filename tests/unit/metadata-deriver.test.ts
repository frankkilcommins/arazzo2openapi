import { ArazzoParser } from '../../src/core/arazzo-parser';
import { WorkflowAnalyzer } from '../../src/core/workflow-analyzer';
import { MetadataDeriver } from '../../src/core/metadata-deriver';
import { GenerationConfig } from '../../src/types/config';
import * as path from 'path';

describe('MetadataDeriver', () => {
  let parser: ArazzoParser;
  let analyzer: WorkflowAnalyzer;
  let deriver: MetadataDeriver;

  beforeEach(() => {
    parser = new ArazzoParser();
    analyzer = new WorkflowAnalyzer();
    deriver = new MetadataDeriver();
  });

  afterEach(() => {
    deriver.clearCache();
  });

  describe('deriveInfo', () => {
    it('should derive info from Arazzo document', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const info = deriver.deriveInfo(document, workflows, config);

      expect(info.title).toBe('Simple E-Commerce Workflow');
      expect(info.version).toBe('1.0.0');
      expect(info.description).toBe('A simple workflow for testing');
    });

    it('should use CLI overrides when provided', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        title: 'Custom Title',
        version: '2.0.0',
        description: 'Custom description',
      };

      const info = deriver.deriveInfo(document, workflows, config);

      expect(info.title).toBe('Custom Title');
      expect(info.version).toBe('2.0.0');
      expect(info.description).toBe('Custom description');
    });

    it('should generate description from workflows when Arazzo has no description', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/multi-workflow-no-desc.yaml');
      const { document } = await parser.loadDocument(filePath);
      const workflows = analyzer.analyzeAllWorkflows(document);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const info = deriver.deriveInfo(document, workflows, config);

      expect(info.description).toContain('Generated from Arazzo workflow descriptions');
      expect(info.description).toContain('This API exposes 3 workflows');
      expect(info.description).toContain('placeOrder');
      expect(info.description).toContain('cancelOrder');
      expect(info.description).toContain('updateOrder');
    });

    it('should throw error if Arazzo document missing info', async () => {
      const { ArazzoSpecification1Element } = await import('@speclynx/apidom-ns-arazzo-1');
      const emptyDoc = new ArazzoSpecification1Element();

      const config: GenerationConfig = {
        arazzoPath: 'test.yaml',
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      expect(() => deriver.deriveInfo(emptyDoc, [], config)).toThrow(/missing required info/);
    });
  });

  describe('generateTitleFromWorkflows', () => {
    it('should generate title for single workflow', () => {
      const workflows = [
        {
          workflowId: 'placeOrder',
          summary: 'Place an order',
          steps: [],
          sourceDescriptions: [],
        },
      ];

      const title = deriver.generateTitleFromWorkflows(workflows);

      expect(title).toBe('placeOrder Workflow API');
    });

    it('should generate generic title for multiple workflows', () => {
      const workflows = [
        {
          workflowId: 'placeOrder',
          summary: 'Place an order',
          steps: [],
          sourceDescriptions: [],
        },
        {
          workflowId: 'cancelOrder',
          summary: 'Cancel an order',
          steps: [],
          sourceDescriptions: [],
        },
      ];

      const title = deriver.generateTitleFromWorkflows(workflows);

      expect(title).toBe('Workflow API');
    });

    it('should generate default title for empty workflows', () => {
      const title = deriver.generateTitleFromWorkflows([]);

      expect(title).toBe('Workflow API');
    });
  });

  describe('generateDescriptionFromWorkflows', () => {
    it('should generate description listing all workflows', () => {
      const workflows = [
        {
          workflowId: 'placeOrder',
          summary: 'Place a new order',
          steps: [],
          sourceDescriptions: [],
        },
        {
          workflowId: 'cancelOrder',
          summary: 'Cancel an order',
          steps: [],
          sourceDescriptions: [],
        },
      ];

      const description = deriver.generateDescriptionFromWorkflows(workflows);

      expect(description).toContain('Generated from Arazzo workflow descriptions');
      expect(description).toContain('This API exposes 2 workflows');
      expect(description).toContain('**placeOrder**: Place a new order');
      expect(description).toContain('**cancelOrder**: Cancel an order');
    });

    it('should handle workflows without summaries', () => {
      const workflows = [
        {
          workflowId: 'workflow1',
          steps: [],
          sourceDescriptions: [],
        },
      ];

      const description = deriver.generateDescriptionFromWorkflows(workflows);

      expect(description).toContain('**workflow1**: No description');
    });

    it('should use description when summary is missing', () => {
      const workflows = [
        {
          workflowId: 'workflow1',
          description: 'A workflow description',
          steps: [],
          sourceDescriptions: [],
        },
      ];

      const description = deriver.generateDescriptionFromWorkflows(workflows);

      expect(description).toContain('**workflow1**: A workflow description');
    });

    it('should handle single workflow correctly', () => {
      const workflows = [
        {
          workflowId: 'single',
          summary: 'Single workflow',
          steps: [],
          sourceDescriptions: [],
        },
      ];

      const description = deriver.generateDescriptionFromWorkflows(workflows);

      expect(description).toContain('This API exposes 1 workflow as');
      expect(description).not.toContain('workflows');
    });
  });

  describe('deriveServers', () => {
    it('should extract servers from OpenAPI source descriptions', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const servers = await deriver.deriveServers(document, filePath, config);

      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].url).toBe('https://api.test.com/v1');
      expect(servers[0].description).toBeDefined();
    });

    it('should extract servers from multiple source descriptions', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/complex-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const servers = await deriver.deriveServers(document, filePath, config);

      expect(servers.length).toBeGreaterThan(0);

      // Should have servers from both shopAPI and paymentAPI
      const serverUrls = servers.map((s) => s.url);
      expect(serverUrls).toContain('https://shop.example.com/api');
      expect(serverUrls).toContain('https://payment.example.com/v1');
    });

    it('should deduplicate servers by URL', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const servers = await deriver.deriveServers(document, filePath, config);

      const serverUrls = servers.map((s) => s.url);
      const uniqueUrls = new Set(serverUrls);

      expect(serverUrls.length).toBe(uniqueUrls.size);
    });

    it('should use CLI override servers when provided', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
        servers: [
          { url: 'https://custom.example.com', description: 'Custom server' },
          { url: 'https://custom2.example.com', description: 'Custom server 2' },
        ],
      };

      const servers = await deriver.deriveServers(document, filePath, config);

      expect(servers).toHaveLength(2);
      expect(servers[0].url).toBe('https://custom.example.com');
      expect(servers[1].url).toBe('https://custom2.example.com');
    });

    it('should return fallback server when no source descriptions', async () => {
      const { ArazzoSpecification1Element } = await import('@speclynx/apidom-ns-arazzo-1');
      const emptyDoc = new ArazzoSpecification1Element();

      const config: GenerationConfig = {
        arazzoPath: 'test.yaml',
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const servers = await deriver.deriveServers(emptyDoc, __dirname, config);

      expect(servers).toHaveLength(1);
      expect(servers[0].url).toBe('https://api.example.com');
      expect(servers[0].description).toBe('Workflow execution server');
    });

    it('should handle missing OpenAPI file gracefully', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      // Modify source description URL to non-existent file
      const sourceDesc = document.sourceDescriptions?.get(0);
      if (sourceDesc) {
        const { StringElement } = await import('@speclynx/apidom-core');
        sourceDesc.set('url', new StringElement('../openapi/non-existent.yaml'));
      }

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      const servers = await deriver.deriveServers(document, filePath, config);

      // Should return fallback when all sources fail to load
      expect(servers).toHaveLength(1);
      expect(servers[0].url).toBe('https://api.example.com');
    });
  });

  describe('cache management', () => {
    it('should cache loaded OpenAPI documents', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      // Load servers twice
      const servers1 = await deriver.deriveServers(document, filePath, config);
      const servers2 = await deriver.deriveServers(document, filePath, config);

      // Both should return same results (cache working)
      expect(servers1).toEqual(servers2);
    });

    it('should clear cache when requested', async () => {
      const filePath = path.join(__dirname, '../fixtures/arazzo/simple-workflow.yaml');
      const { document } = await parser.loadDocument(filePath);

      const config: GenerationConfig = {
        arazzoPath: filePath,
        outputPath: 'output.yaml',
        openapiVersion: '3.1.0',
      };

      await deriver.deriveServers(document, filePath, config);

      // Clear cache
      deriver.clearCache();

      // Should still work after cache clear
      const servers = await deriver.deriveServers(document, filePath, config);
      expect(servers.length).toBeGreaterThan(0);
    });
  });
});
