import {
  ArazzoSpecification1Element,
  SourceDescriptionElement,
} from '@speclynx/apidom-ns-arazzo-1';
import { parse as parseOpenApiJson } from '@speclynx/apidom-parser-adapter-openapi-json-3-1';
import { parse as parseOpenApiYaml } from '@speclynx/apidom-parser-adapter-openapi-yaml-3-1';
import { OpenApi3_1Element } from '@speclynx/apidom-ns-openapi-3-1';
import { isObjectElement } from '@speclynx/apidom-datamodel';
import { AnalyzedWorkflow } from './workflow-analyzer';
import { GenerationConfig, ServerConfig } from '../types/config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * OpenAPI Info metadata
 */
export interface DerivedInfo {
  title: string;
  version: string;
  description?: string;
}

/**
 * Derives OpenAPI metadata from Arazzo documents
 */
export class MetadataDeriver {
  private sourceDescriptionCache: Map<string, OpenApi3_1Element> = new Map();

  /**
   * Derive OpenAPI info metadata from Arazzo document and workflows
   */
  deriveInfo(
    arazzoDoc: ArazzoSpecification1Element,
    workflows: AnalyzedWorkflow[],
    config: GenerationConfig
  ): DerivedInfo {
    // Priority 1: CLI override
    if (config.title && config.version) {
      return {
        title: config.title,
        version: config.version,
        description: config.description,
      };
    }

    // Priority 2: Arazzo info
    const arazzoInfo = arazzoDoc.info;
    if (!arazzoInfo) {
      throw new Error('Arazzo document missing required info object');
    }

    const title = config.title || this.extractTitle(arazzoInfo, workflows);
    const version = config.version || this.extractVersion(arazzoInfo);
    const description = config.description || this.extractDescription(arazzoInfo, workflows);

    return {
      title,
      version,
      description,
    };
  }

  /**
   * Extract title from Arazzo info or generate from workflows
   */
  private extractTitle(arazzoInfo: unknown, workflows: AnalyzedWorkflow[]): string {
    const titleElement = (arazzoInfo as any).get?.('title');
    if (titleElement) {
      return titleElement.toValue() as string;
    }

    // Generate from workflows if no title
    return this.generateTitleFromWorkflows(workflows);
  }

  /**
   * Extract version from Arazzo info (required field)
   */
  private extractVersion(arazzoInfo: unknown): string {
    const versionElement = (arazzoInfo as any).get?.('version');
    if (!versionElement) {
      throw new Error('Arazzo info missing required version field');
    }
    return versionElement.toValue() as string;
  }

  /**
   * Extract description from Arazzo info or generate from workflows
   */
  private extractDescription(arazzoInfo: unknown, workflows: AnalyzedWorkflow[]): string {
    const descElement = (arazzoInfo as any).get?.('description');
    if (descElement) {
      return descElement.toValue() as string;
    }

    // Generate from workflows if no description
    return this.generateDescriptionFromWorkflows(workflows);
  }

  /**
   * Generate title from workflows
   */
  generateTitleFromWorkflows(workflows: AnalyzedWorkflow[]): string {
    if (workflows.length === 0) {
      return 'Workflow API';
    }

    if (workflows.length === 1) {
      return `${workflows[0].workflowId} Workflow API`;
    }

    return 'Workflow API';
  }

  /**
   * Generate description from workflows
   */
  generateDescriptionFromWorkflows(workflows: AnalyzedWorkflow[]): string {
    let desc = 'Generated from Arazzo workflow descriptions.\n\n';
    desc += `This API exposes ${workflows.length} workflow${workflows.length > 1 ? 's' : ''} as executable endpoints:\n\n`;

    workflows.forEach((wf) => {
      const summary = wf.summary || wf.description || 'No description';
      desc += `- **${wf.workflowId}**: ${summary}\n`;
    });

    return desc;
  }

  /**
   * Derive servers from Arazzo source descriptions
   */
  async deriveServers(
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string,
    config: GenerationConfig
  ): Promise<ServerConfig[]> {
    // Priority 1: Explicit CLI override
    if (config.servers && config.servers.length > 0) {
      return config.servers;
    }

    // Priority 2: Extract from source descriptions
    const serversFromSources = await this.extractServersFromSourceDescriptions(
      arazzoDoc,
      arazzoDocPath
    );

    if (serversFromSources.length > 0) {
      return serversFromSources;
    }

    // Priority 3: Fallback
    return [
      {
        url: 'https://api.example.com',
        description: 'Workflow execution server',
      },
    ];
  }

  /**
   * Extract servers from OpenAPI source descriptions
   */
  private async extractServersFromSourceDescriptions(
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<ServerConfig[]> {
    const sourceDescriptions = arazzoDoc.sourceDescriptions;
    if (!sourceDescriptions) {
      return [];
    }

    const servers: ServerConfig[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < sourceDescriptions.length; i++) {
      const sourceDesc = sourceDescriptions.get(i);
      if (!(sourceDesc instanceof SourceDescriptionElement)) {
        continue;
      }

      const typeElement = sourceDesc.get('type');
      const type = typeElement?.toValue() as string;

      if (type === 'openapi') {
        const urlElement = sourceDesc.get('url');
        const url = urlElement?.toValue() as string;
        const nameElement = sourceDesc.get('name');
        const name = nameElement?.toValue() as string;

        if (!url) {
          continue;
        }

        try {
          const openApiDoc = await this.loadOpenAPIDocument(url, arazzoDocPath);
          const serversElement = openApiDoc.servers;

          if (serversElement) {
            for (let j = 0; j < serversElement.length; j++) {
              const server = serversElement.get(j);
              if (!isObjectElement(server)) continue;

              const serverUrlElement = server.get('url');
              const serverUrl = serverUrlElement?.toValue?.() as string;

              if (serverUrl && !seenUrls.has(serverUrl)) {
                seenUrls.add(serverUrl);

                const descElement = server.get('description');
                const description =
                  (descElement?.toValue?.() as string) || `Server from ${name}`;

                servers.push({
                  url: serverUrl,
                  description,
                });
              }
            }
          }
        } catch (error) {
          // If we can't load a source description, just continue
          console.warn(
            `Warning: Could not load source description ${url}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    return servers;
  }

  /**
   * Load an OpenAPI document from a URL (file path or remote URL)
   */
  private async loadOpenAPIDocument(url: string, arazzoDocPath: string): Promise<OpenApi3_1Element> {
    // Check cache first
    if (this.sourceDescriptionCache.has(url)) {
      return this.sourceDescriptionCache.get(url)!;
    }

    let content: string;
    let resourcePath: string;

    // Check if URL is remote or local
    if (this.isRemoteUrl(url)) {
      // Absolute remote URL - fetch directly
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      content = await response.text();
      resourcePath = url;
    } else {
      // Relative URL - resolve relative to Arazzo document location
      if (this.isRemoteUrl(arazzoDocPath)) {
        // Arazzo is remote, resolve relative URL
        const resolvedUrl = new URL(url, arazzoDocPath).href;
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        content = await response.text();
        resourcePath = resolvedUrl;
      } else {
        // Arazzo is local file, resolve relative file path
        const baseDir = path.dirname(arazzoDocPath);
        resourcePath = path.resolve(baseDir, url);
        content = await fs.readFile(resourcePath, 'utf-8');
      }
    }

    // Detect format and parse
    const format = this.detectOpenAPIFormat(resourcePath);
    let parseResult;

    if (format === 'json') {
      parseResult = await parseOpenApiJson(content);
    } else {
      parseResult = await parseOpenApiYaml(content);
    }

    const document = parseResult.result as unknown as OpenApi3_1Element;

    // Cache the result
    this.sourceDescriptionCache.set(url, document);

    return document;
  }

  /**
   * Check if a URL is remote (http:// or https://)
   */
  private isRemoteUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Detect OpenAPI format from file extension
   */
  private detectOpenAPIFormat(filePath: string): 'json' | 'yaml' {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.json' ? 'json' : 'yaml';
  }

  /**
   * Clear the source description cache (useful for testing)
   */
  clearCache(): void {
    this.sourceDescriptionCache.clear();
  }
}
