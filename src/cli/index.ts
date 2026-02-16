#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ArazzoParser } from '../core/arazzo-parser';
import { WorkflowAnalyzer } from '../core/workflow-analyzer';
import { OpenAPIGenerator } from '../core/openapi-generator';
import { GenerationConfig, ServerConfig } from '../types/config';
import { toValue } from '@speclynx/apidom-core';

const program = new Command();

program
  .name('arazzo2openapi')
  .description('Convert Arazzo workflow descriptions to OpenAPI documents')
  .version('0.1.0')
  .argument('<arazzo-file>', 'Path or URL to the Arazzo document (JSON or YAML)')
  .option('-o, --output <file>', 'Output file path (default: derived from input)')
  .option('-f, --format <format>', 'Output format: json or yaml (default: match input format)', /^(json|yaml)$/i)
  .option('--openapi-version <version>', 'OpenAPI version: 3.0.0, 3.1.0, or 3.2.0 (default: 3.1.0)', '3.1.0')
  .option('--title <title>', 'Override the OpenAPI title')
  .option('--version-override <version>', 'Override the OpenAPI version metadata')
  .option('--description <description>', 'Override the OpenAPI description')
  .option('--server <url>', 'Add a server URL (can be used multiple times)', collectServers, [])
  .option('--response-code <code>', 'HTTP response code for successful workflow execution (default: 200)', parseInt)
  .action(async (arazzoFile: string, options: any) => {
    try {
      await convertArazzoToOpenAPI(arazzoFile, options);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Collect server URLs from multiple --server options
 */
function collectServers(url: string, previous: string[]): string[] {
  return [...previous, url];
}

/**
 * Check if a string is a remote URL
 */
function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Main conversion function
 */
async function convertArazzoToOpenAPI(arazzoFile: string, options: any): Promise<void> {
  let arazzoPath: string;

  // Check if input is a remote URL or local file
  if (isRemoteUrl(arazzoFile)) {
    // Use URL as-is
    arazzoPath = arazzoFile;
  } else {
    // Validate local file exists
    arazzoPath = path.resolve(arazzoFile);
    try {
      await fs.access(arazzoPath);
    } catch {
      throw new Error(`Arazzo file not found: ${arazzoPath}`);
    }
  }

  // Parse Arazzo document
  console.log(`Loading Arazzo document: ${arazzoPath}`);
  const parser = new ArazzoParser();
  const { document, detectedFormat } = await parser.loadDocument(arazzoPath);
  console.log(`✓ Parsed Arazzo document (format: ${detectedFormat})`);

  // Analyze workflows
  console.log('Analyzing workflows...');
  const analyzer = new WorkflowAnalyzer();
  const workflows = analyzer.analyzeAllWorkflows(document);
  console.log(`✓ Analyzed ${workflows.length} workflow(s)`);

  // Determine output path
  const outputPath = options.output || deriveOutputPath(arazzoPath, options.format || detectedFormat);
  const outputFormat = options.format || detectedFormat;

  // Convert servers from CLI
  const servers: ServerConfig[] = options.server.map((url: string) => ({
    url,
    description: undefined,
  }));

  // Build generation config
  const config: GenerationConfig = {
    arazzoPath,
    outputPath,
    openapiVersion: options.openapiVersion || '3.1.0',
    outputFormat,
    responseCode: options.responseCode,
    title: options.title,
    version: options.versionOverride,
    description: options.description,
    servers: servers.length > 0 ? servers : undefined,
  };

  // Generate OpenAPI document
  console.log('Generating OpenAPI document...');
  const generator = new OpenAPIGenerator();
  const openapi = await generator.generateOpenAPI(document, workflows, arazzoPath, config);
  console.log('✓ Generated OpenAPI document');

  // Serialize and write output
  console.log(`Writing output to: ${outputPath}`);
  await writeOpenAPIDocument(openapi, outputPath, outputFormat);
  console.log('✓ Conversion complete!');
}

/**
 * Derive output path from input path if not specified
 */
function deriveOutputPath(inputPath: string, format: 'json' | 'yaml'): string {
  const extension = format === 'json' ? '.json' : '.yaml';

  // Handle remote URLs
  if (isRemoteUrl(inputPath)) {
    try {
      const url = new URL(inputPath);
      const urlPath = url.pathname;
      const filename = urlPath.split('/').pop() || 'arazzo';
      const basename = filename.replace(/\.(json|yaml|yml)$/i, '');
      return `${basename}.openapi${extension}`;
    } catch {
      // If URL parsing fails, use a default name
      return `arazzo.openapi${extension}`;
    }
  }

  // Handle local file paths
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.openapi${extension}`);
}

/**
 * Write OpenAPI document to file in specified format
 */
async function writeOpenAPIDocument(
  openapi: any,
  outputPath: string,
  format: 'json' | 'yaml'
): Promise<void> {
  // Convert ApiDOM element to plain JavaScript object
  const openapiObj = toValue(openapi);

  let content: string;
  if (format === 'json') {
    content = JSON.stringify(openapiObj, null, 2);
  } else {
    // For YAML, use a simple serialization approach
    // In Phase 4, we can enhance this with proper YAML library
    const yaml = require('yaml');
    content = yaml.stringify(openapiObj, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0,
    });
  }

  await fs.writeFile(outputPath, content, 'utf-8');
}

// Parse command-line arguments
program.parse(process.argv);

// Show help if no arguments provided
if (process.argv.length <= 2) {
  program.help();
}
