/**
 * Tests for SourceDocumentResolver
 * Focus: Testing OUR logic for resolution, caching, and operation lookup
 */

import { SourceDocumentResolver } from '../../src/core/source-document-resolver';
import { ArazzoParser } from '../../src/core/arazzo-parser';
import * as path from 'path';

describe('SourceDocumentResolver', () => {
  let resolver: SourceDocumentResolver;
  let parser: ArazzoParser;
  const fixturesPath = path.join(__dirname, '..', 'fixtures');
  const arazzoPath = path.join(fixturesPath, 'arazzo-with-sources.json');

  beforeEach(async () => {
    resolver = new SourceDocumentResolver();
    parser = new ArazzoParser();
  });

  afterEach(() => {
    resolver.clearCache();
  });

  describe('resolveSourceDocument', () => {
    it('should resolve OpenAPI 3.1 JSON document', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const document = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      expect(document).toBeDefined();
      expect(document.get('openapi')?.toValue()).toBe('3.1.0');
      expect(document.get('info')?.get('title')?.toValue()).toBe('Shop API');
    });

    it('should resolve OpenAPI 3.0 YAML document', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const document = await resolver.resolveSourceDocument('legacyAPI', arazzoDoc, arazzoPath);

      expect(document).toBeDefined();
      expect(document.get('openapi')?.toValue()).toBe('3.0.3');
      expect(document.get('info')?.get('title')?.toValue()).toBe('Legacy API');
    });

    it('should cache resolved documents', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      const doc1 = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);
      const doc2 = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      // Same instance from cache
      expect(doc1).toBe(doc2);
    });

    it('should throw error for non-existent source', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      await expect(
        resolver.resolveSourceDocument('nonExistent', arazzoDoc, arazzoPath)
      ).rejects.toThrow('Source description "nonExistent" not found');
    });

    it('should throw error for non-existent file', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      // Manually create a source description pointing to non-existent file
      const sourceDescriptions = arazzoDoc.get('sourceDescriptions');
      const badSource = sourceDescriptions.content[0].clone();
      badSource.set('name', 'badAPI');
      badSource.set('url', './non-existent.json');
      sourceDescriptions.content.push(badSource);

      await expect(
        resolver.resolveSourceDocument('badAPI', arazzoDoc, arazzoPath)
      ).rejects.toThrow('Failed to read source document');
    });

    it('should throw error for unsupported source type', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      // Manually create a source description with unsupported type
      const sourceDescriptions = arazzoDoc.get('sourceDescriptions');
      const badSource = sourceDescriptions.content[0].clone();
      badSource.set('name', 'graphqlAPI');
      badSource.set('type', 'graphql');
      sourceDescriptions.content.push(badSource);

      await expect(
        resolver.resolveSourceDocument('graphqlAPI', arazzoDoc, arazzoPath)
      ).rejects.toThrow('Source type "graphql" not supported');
    });
  });

  describe('findOperationByOperationId', () => {
    it('should find operation in OpenAPI 3.1 document', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);
      const document = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      const operation = resolver.findOperationByOperationId(document, 'getProduct');

      expect(operation).toBeDefined();
      expect(operation.get('operationId')?.toValue()).toBe('getProduct');
    });

    it('should find operation in OpenAPI 3.0 document', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);
      const document = await resolver.resolveSourceDocument('legacyAPI', arazzoDoc, arazzoPath);

      const operation = resolver.findOperationByOperationId(document, 'getUser');

      expect(operation).toBeDefined();
      expect(operation.get('operationId')?.toValue()).toBe('getUser');
    });

    it('should return null for non-existent operation', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);
      const document = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      const operation = resolver.findOperationByOperationId(document, 'nonExistent');

      expect(operation).toBeNull();
    });

    it('should find operations with different HTTP methods', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);
      const document = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      // Test GET operation
      const getOp = resolver.findOperationByOperationId(document, 'getProduct');
      expect(getOp).toBeDefined();

      // Test another GET operation
      const listOp = resolver.findOperationByOperationId(document, 'listProducts');
      expect(listOp).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear cached documents', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      // Resolve and cache
      const doc1 = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      // Clear cache
      resolver.clearCache();

      // Resolve again - should be different instance
      const doc2 = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      expect(doc1).not.toBe(doc2);
    });
  });

  describe('Version Detection', () => {
    it('should detect OpenAPI 3.1 version', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);
      const document = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      expect(document.get('openapi')?.toValue()).toMatch(/^3\.1\./);
    });

    it('should detect OpenAPI 3.0 version', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);
      const document = await resolver.resolveSourceDocument('legacyAPI', arazzoDoc, arazzoPath);

      expect(document.get('openapi')?.toValue()).toMatch(/^3\.0\./);
    });
  });

  describe('Path Resolution', () => {
    it('should resolve relative paths correctly', async () => {
      const { document: arazzoDoc } = await parser.loadDocument(arazzoPath);

      // The URL in the fixture is "./openapi-sources/shop-api-3.1.json"
      // Should resolve relative to the Arazzo document location
      const document = await resolver.resolveSourceDocument('shopAPI', arazzoDoc, arazzoPath);

      expect(document).toBeDefined();
      expect(document.get('info')?.get('title')?.toValue()).toBe('Shop API');
    });
  });
});
