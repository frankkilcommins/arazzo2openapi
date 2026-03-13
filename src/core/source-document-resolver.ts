/**
 * Resolves and caches OpenAPI source documents referenced in Arazzo documents
 */

import { ArazzoSpecification1Element } from '@speclynx/apidom-ns-arazzo-1';
import { parse as parseOpenApiJson30 } from '@speclynx/apidom-parser-adapter-openapi-json-3-0';
import { parse as parseOpenApiYaml30 } from '@speclynx/apidom-parser-adapter-openapi-yaml-3-0';
import { parse as parseOpenApiJson31 } from '@speclynx/apidom-parser-adapter-openapi-json-3-1';
import { parse as parseOpenApiYaml31 } from '@speclynx/apidom-parser-adapter-openapi-yaml-3-1';
import { OpenApi3_0Element } from '@speclynx/apidom-ns-openapi-3-0';
import { OpenApi3_1Element } from '@speclynx/apidom-ns-openapi-3-1';
import { isObjectElement, isArrayElement } from '@speclynx/apidom-datamodel';
import * as fs from 'fs/promises';
import * as path from 'path';

type OpenApiElement = OpenApi3_0Element | OpenApi3_1Element;

export class SourceDocumentResolver {
  private documentCache = new Map<string, OpenApiElement>();

  /**
   * Resolve an OpenAPI source document by name
   */
  async resolveSourceDocument(
    sourceName: string,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<OpenApiElement> {
    // Check cache
    if (this.documentCache.has(sourceName)) {
      return this.documentCache.get(sourceName)!;
    }

    // Find source description
    const sourceDesc = this.findSourceDescription(arazzoDoc, sourceName);
    if (!sourceDesc) {
      throw new Error(`Source description "${sourceName}" not found in Arazzo document`);
    }

    const url = sourceDesc.get('url')?.toValue();
    const type = sourceDesc.get('type')?.toValue();

    if (!url) {
      throw new Error(`Source description "${sourceName}" missing url`);
    }

    if (type && type !== 'openapi') {
      throw new Error(`Source type "${type}" not supported (only "openapi" is supported)`);
    }

    let content: string;
    let resourcePath: string;

    // Check if URL is remote or local
    if (this.isRemoteUrl(url)) {
      // Absolute remote URL - fetch directly
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        content = await response.text();
        resourcePath = url;
      } catch (error) {
        throw new Error(
          `Failed to fetch remote source document from ${url}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } else {
      // Relative URL - resolve relative to Arazzo document location
      if (this.isRemoteUrl(arazzoDocPath)) {
        // Arazzo is remote, resolve relative URL
        try {
          const resolvedUrl = new URL(url, arazzoDocPath).href;
          const response = await fetch(resolvedUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          content = await response.text();
          resourcePath = resolvedUrl;
        } catch (error) {
          throw new Error(
            `Failed to fetch relative source document ${url} from ${arazzoDocPath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else {
        // Arazzo is local file, resolve relative file path
        resourcePath = path.resolve(path.dirname(arazzoDocPath), url);

        try {
          content = await fs.readFile(resourcePath, 'utf-8');
        } catch (error) {
          throw new Error(
            `Failed to read source document at ${resourcePath}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    // Parse document
    const document = await this.parseOpenApiDocument(content, resourcePath);

    // Cache and return
    this.documentCache.set(sourceName, document);
    return document;
  }

  /**
   * Find an operation by operationId in an OpenAPI document
   */
  findOperationByOperationId(
    openapiDoc: OpenApiElement,
    operationId: string
  ): any | null {
    const paths = openapiDoc.get('paths');
    if (!paths || !isObjectElement(paths)) return null;

    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

    for (const pathKey of paths.keys()) {
      const pathItem = paths.get(pathKey as string);
      if (!pathItem || !isObjectElement(pathItem)) continue;

      for (const method of httpMethods) {
        const operation = pathItem.get(method);
        if (!operation || !isObjectElement(operation)) continue;

        const opId = operation.get('operationId')?.toValue();
        if (opId === operationId) {
          return operation;
        }
      }
    }

    return null;
  }

  /**
   * Clear the document cache
   */
  clearCache(): void {
    this.documentCache.clear();
  }

  /**
   * Check if a URL is remote (http:// or https://)
   */
  private isRemoteUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Find a source description by name in the Arazzo document
   */
  private findSourceDescription(
    arazzoDoc: ArazzoSpecification1Element,
    sourceName: string
  ): any | null {
    const sourceDescriptions = arazzoDoc.get('sourceDescriptions');
    if (!sourceDescriptions || !isArrayElement(sourceDescriptions)) return null;

    for (let i = 0; i < sourceDescriptions.length; i++) {
      const sourceDesc = sourceDescriptions.get(i);
      if (!isObjectElement(sourceDesc)) continue;

      const name = sourceDesc.get('name')?.toValue();
      if (name === sourceName) {
        return sourceDesc;
      }
    }

    return null;
  }

  /**
   * Parse an OpenAPI document (auto-detects version and format)
   */
  private async parseOpenApiDocument(
    content: string,
    filePath: string
  ): Promise<OpenApiElement> {
    const isJson = filePath.endsWith('.json');
    const version = this.detectOpenApiVersion(content);

    let parseResult: any;

    try {
      if (version.startsWith('3.1')) {
        parseResult = isJson
          ? await parseOpenApiJson31(content)
          : await parseOpenApiYaml31(content);
      } else if (version.startsWith('3.0')) {
        parseResult = isJson
          ? await parseOpenApiJson30(content)
          : await parseOpenApiYaml30(content);
      } else {
        throw new Error(`Unsupported OpenAPI version: ${version}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to parse OpenAPI document at ${filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (parseResult.errors && parseResult.errors.length > 0) {
      throw new Error(
        `OpenAPI document at ${filePath} has validation errors: ${parseResult.errors[0].message}`
      );
    }

    return parseResult.result as unknown as OpenApiElement;
  }

  /**
   * Detect OpenAPI version from document content
   */
  private detectOpenApiVersion(content: string): string {
    // Match: "openapi": "3.1.0" or openapi: 3.1.0
    const match = content.match(/"openapi"\s*:\s*"([^"]+)"|openapi:\s*['"]?([^\s'"]+)/);
    if (match) {
      return match[1] || match[2];
    }

    // Default to 3.1.0 if not found
    return '3.1.0';
  }
}
