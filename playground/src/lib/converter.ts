/**
 * Browser-compatible Arazzo to OpenAPI converter
 * This is a simplified version for the playground
 */

import { parse as parseJsonArazzo } from '@speclynx/apidom-parser-adapter-arazzo-json-1';
import { parse as parseYamlArazzo } from '@speclynx/apidom-parser-adapter-arazzo-yaml-1';
import type { ArazzoSpecification1Element } from '@speclynx/apidom-ns-arazzo-1';
import { stringify as stringifyYaml } from 'yaml';

export async function convertArazzoToOpenAPI(
  content: string
): Promise<string> {
  try {
    // Try to detect if content is JSON or YAML
    const isJson = content.trim().startsWith('{');

    // Parse the Arazzo document
    const parseResult = isJson
      ? await parseJsonArazzo(content)
      : await parseYamlArazzo(content);

    if (parseResult.errors && parseResult.errors.length > 0) {
      throw new Error('Failed to parse Arazzo document');
    }

    const arazzoDoc = parseResult.result as ArazzoSpecification1Element;

    if (!arazzoDoc) {
      throw new Error('Failed to parse Arazzo document: result is empty');
    }

    // Extract basic info
    const info = arazzoDoc.get('info');
    const workflows = arazzoDoc.get('workflows');
    const sourceDescriptions = arazzoDoc.get('sourceDescriptions');

    // Build OpenAPI document
    const openapi: any = {
      openapi: '3.1.0',
      info: {
        title: info?.get('title')?.toValue() || 'Untitled',
        version: info?.get('version')?.toValue() || '1.0.0',
        'x-arazzo-document': 'workflow.yaml',
      },
      servers: [],
      paths: {},
    };

    // Extract server URL from source descriptions
    if (sourceDescriptions && sourceDescriptions.length > 0) {
      const firstSource = sourceDescriptions.get(0);
      const url = firstSource?.get('url')?.toValue();
      if (url) {
        try {
          const urlObj = new URL(url);
          openapi.servers.push({
            url: urlObj.origin + urlObj.pathname.replace(/\/[^/]*$/, ''),
          });
        } catch {
          openapi.servers.push({ url });
        }
      }
    }

    // Convert workflows to OpenAPI paths
    if (workflows) {
      for (let i = 0; i < workflows.length; i++) {
        const workflow = workflows.get(i);
        const workflowId = workflow?.get('workflowId')?.toValue();
        const summary = workflow?.get('summary')?.toValue();
        const inputs = workflow?.get('inputs');
        const outputs = workflow?.get('outputs');

        if (!workflowId) continue;

        const path = `/workflows/${workflowId}`;
        const operation: any = {
          operationId: `execute_${workflowId}`,
          'x-arazzo-workflow-id': workflowId,
        };

        if (summary) {
          operation.summary = summary;
        }

        // Add inputs as requestBody
        if (inputs) {
          const inputsValue = inputs.toValue();
          if (inputsValue && inputsValue.properties) {
            operation.requestBody = {
              required: true,
              content: {
                'application/json': {
                  schema: inputsValue,
                },
              },
            };
          }
        }

        // Add outputs as response
        operation.responses = {
          '200': {
            description: `Workflow ${workflowId} executed successfully`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: outputs?.toValue() || {},
                },
              },
            },
          },
        };

        openapi.paths[path] = {
          post: operation,
        };
      }
    }

    // Convert to YAML string
    return stringifyYaml(openapi);
  } catch (error) {
    throw new Error(
      `Conversion failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
