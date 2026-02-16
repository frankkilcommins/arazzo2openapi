import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseJson } from '@speclynx/apidom-parser-adapter-arazzo-json-1';
import { parse as parseYaml } from '@speclynx/apidom-parser-adapter-arazzo-yaml-1';
import {
  ArazzoSpecification1Element,
  WorkflowElement,
  WorkflowsElement,
} from '@speclynx/apidom-ns-arazzo-1';
import { ArazzoParseError } from '../types/errors';

/**
 * Parser for Arazzo documents using ApiDOM
 */
export class ArazzoParser {
  /**
   * Load and parse an Arazzo document from a file or URL
   */
  async loadDocument(filePathOrUrl: string): Promise<{
    document: ArazzoSpecification1Element;
    detectedFormat: 'json' | 'yaml';
  }> {
    try {
      let content: string;

      // Check if it's a remote URL
      if (this.isRemoteUrl(filePathOrUrl)) {
        // Fetch remote URL
        const response = await fetch(filePathOrUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        content = await response.text();
      } else {
        // Read local file
        content = await fs.readFile(filePathOrUrl, 'utf-8');
      }

      // Detect format from file extension or URL
      const detectedFormat = this.detectFormat(filePathOrUrl);

      // Parse based on format
      const document = await this.parseContent(content, detectedFormat);

      return {
        document,
        detectedFormat,
      };
    } catch (error) {
      if (error instanceof ArazzoParseError) {
        throw error;
      }
      throw new ArazzoParseError(
        `Failed to load Arazzo document from ${filePathOrUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Check if a URL is remote (http:// or https://)
   */
  private isRemoteUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Detect format from file extension
   */
  private detectFormat(filePath: string): 'json' | 'yaml' {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.yaml' || ext === '.yml' ? 'yaml' : 'json';
  }

  /**
   * Parse Arazzo content based on format using ApiDOM
   */
  async parseContent(
    content: string,
    format: 'json' | 'yaml'
  ): Promise<ArazzoSpecification1Element> {
    try {
      let parseResult;

      if (format === 'json') {
        parseResult = await parseJson(content);
      } else {
        parseResult = await parseYaml(content);
      }

      // Check for parsing errors
      if (parseResult.errors && parseResult.errors.length > 0) {
        // Convert errors to array for error reporting
        const errorArray = Array.from(parseResult.errors);
        throw new ArazzoParseError('Failed to parse Arazzo document', errorArray);
      }

      return parseResult.result as ArazzoSpecification1Element;
    } catch (error) {
      if (error instanceof ArazzoParseError) {
        throw error;
      }
      throw new ArazzoParseError(
        `Failed to parse Arazzo content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get workflows from parsed document
   */
  getWorkflows(document: ArazzoSpecification1Element): WorkflowsElement | undefined {
    return document.workflows;
  }

  /**
   * Get workflow by ID
   */
  getWorkflowById(
    document: ArazzoSpecification1Element,
    workflowId: string
  ): WorkflowElement | undefined {
    const workflows = this.getWorkflows(document);
    if (!workflows) {
      return undefined;
    }

    // Iterate through workflows ArrayElement
    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows.get(i);
      if (workflow instanceof WorkflowElement) {
        const wfId = workflow.get('workflowId');
        if (wfId && wfId.toValue() === workflowId) {
          return workflow;
        }
      }
    }

    return undefined;
  }
}
