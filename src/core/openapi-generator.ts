import {
  OpenApi3_1Element,
  InfoElement,
  PathsElement,
  PathItemElement,
  OperationElement,
  RequestBodyElement,
  MediaTypeElement,
  ResponsesElement,
  ResponseElement,
  SchemaElement,
  ServerElement,
  ServersElement,
} from '@speclynx/apidom-ns-openapi-3-1';
import { ObjectElement, StringElement, ArrayElement } from '@speclynx/apidom-datamodel';
import { ArazzoSpecification1Element } from '@speclynx/apidom-ns-arazzo-1';
import { GenerationConfig, ServerConfig } from '../types/config';
import { AnalyzedWorkflow, WorkflowInputs } from '../core/workflow-analyzer';
import { MetadataDeriver } from './metadata-deriver';
import { TypeInferenceEngine } from './type-inference-engine';

/**
 * Generates OpenAPI 3.1 documents from analyzed Arazzo workflows
 */
export class OpenAPIGenerator {
  private metadataDeriver: MetadataDeriver;
  private typeInferenceEngine: TypeInferenceEngine;

  constructor() {
    this.metadataDeriver = new MetadataDeriver();
    this.typeInferenceEngine = new TypeInferenceEngine();
  }

  /**
   * Generate a complete OpenAPI document from Arazzo workflows
   * @param arazzoDoc - The Arazzo document
   * @param workflows - Analyzed workflows to convert
   * @param arazzoDocPath - Path to the Arazzo document (for server derivation)
   * @param config - Generation configuration
   * @returns OpenAPI 3.1 document as ApiDOM element
   */
  async generateOpenAPI(
    arazzoDoc: ArazzoSpecification1Element,
    workflows: AnalyzedWorkflow[],
    arazzoDocPath: string,
    config: GenerationConfig
  ): Promise<OpenApi3_1Element> {
    // Create base OpenAPI document
    const openapi = new OpenApi3_1Element();
    openapi.set('openapi', new StringElement('3.1.0'));

    // Derive and set info
    const info = this.metadataDeriver.deriveInfo(arazzoDoc, workflows, config);
    openapi.set('info', this.createInfoElement(info, arazzoDocPath));

    // Derive and set servers
    const servers = await this.metadataDeriver.deriveServers(arazzoDoc, arazzoDocPath, config);
    if (servers.length > 0) {
      openapi.set('servers', this.createServersElement(servers));
    }

    // Generate paths from workflows
    const paths = await this.generatePaths(workflows, config, arazzoDoc, arazzoDocPath);
    openapi.set('paths', paths);

    return openapi;
  }

  /**
   * Create InfoElement from derived metadata
   */
  private createInfoElement(
    info: { title: string; version: string; description?: string },
    arazzoDocPath: string
  ): InfoElement {
    const infoElement = new InfoElement();
    infoElement.set('title', new StringElement(info.title));
    infoElement.set('version', new StringElement(info.version));
    if (info.description) {
      infoElement.set('description', new StringElement(info.description));
    }
    // Add x-arazzo-document extension to info object
    infoElement.set('x-arazzo-document', new StringElement(arazzoDocPath));
    return infoElement;
  }

  /**
   * Create ServersElement from server configs
   */
  private createServersElement(servers: ServerConfig[]): ServersElement {
    const serversElement = new ServersElement();
    for (const server of servers) {
      const serverElement = new ServerElement();
      serverElement.set('url', new StringElement(server.url));
      if (server.description) {
        serverElement.set('description', new StringElement(server.description));
      }
      serversElement.push(serverElement);
    }
    return serversElement;
  }

  /**
   * Generate PathsElement with POST operations for each workflow
   */
  private async generatePaths(
    workflows: AnalyzedWorkflow[],
    config: GenerationConfig,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<PathsElement> {
    const paths = new PathsElement();

    for (const workflow of workflows) {
      const path = `/workflows/${workflow.workflowId}`;
      const pathItem = await this.createPathItem(workflow, config, arazzoDoc, arazzoDocPath);
      paths.set(path, pathItem);
    }

    return paths;
  }

  /**
   * Create a PathItemElement with POST operation for a workflow
   */
  private async createPathItem(
    workflow: AnalyzedWorkflow,
    config: GenerationConfig,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<PathItemElement> {
    const pathItem = new PathItemElement();
    const operation = await this.createOperation(workflow, config, arazzoDoc, arazzoDocPath);
    pathItem.set('post', operation);
    return pathItem;
  }

  /**
   * Create an OperationElement for a workflow
   */
  private async createOperation(
    workflow: AnalyzedWorkflow,
    config: GenerationConfig,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<OperationElement> {
    const operation = new OperationElement();

    // Set operation ID
    operation.set('operationId', new StringElement(`execute_${workflow.workflowId}`));

    // Add x-arazzo-workflow-id extension right after operationId
    operation.set('x-arazzo-workflow-id', new StringElement(workflow.workflowId));

    // Set summary and description
    if (workflow.summary) {
      operation.set('summary', new StringElement(workflow.summary));
    }
    if (workflow.description) {
      operation.set('description', new StringElement(workflow.description));
    }

    // Set request body if workflow has inputs
    if (workflow.inputs) {
      const requestBody = this.createRequestBody(workflow.inputs);
      operation.set('requestBody', requestBody);
    }

    // Set responses
    const responses = await this.createResponses(workflow, config, arazzoDoc, arazzoDocPath);
    operation.set('responses', responses);

    return operation;
  }

  /**
   * Create RequestBodyElement from workflow inputs
   */
  private createRequestBody(inputs: WorkflowInputs): RequestBodyElement {
    const requestBody = new RequestBodyElement();
    requestBody.set('required', true);

    // Create content with application/json media type
    const content = new ObjectElement();
    const mediaType = new MediaTypeElement();

    // Convert inputs JSON Schema to SchemaElement
    const schema = this.convertJsonSchemaToSchemaElement(inputs.schema);
    mediaType.set('schema', schema);

    content.set('application/json', mediaType);
    requestBody.set('content', content);

    return requestBody;
  }

  /**
   * Convert JSON Schema object to SchemaElement
   */
  private convertJsonSchemaToSchemaElement(jsonSchema: Record<string, any>): SchemaElement {
    const schema = new SchemaElement();

    // Handle type
    if (jsonSchema.type) {
      schema.set('type', new StringElement(jsonSchema.type));
    }

    // Handle properties
    if (jsonSchema.properties) {
      const properties = new ObjectElement();
      for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
        const propSchemaElement = this.convertJsonSchemaToSchemaElement(propSchema as Record<string, any>);
        properties.set(propName, propSchemaElement);
      }
      schema.set('properties', properties);
    }

    // Handle required
    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      const required = new ArrayElement();
      for (const req of jsonSchema.required) {
        required.push(new StringElement(req));
      }
      schema.set('required', required);
    }

    // Handle description
    if (jsonSchema.description) {
      schema.set('description', new StringElement(jsonSchema.description));
    }

    // Handle format
    if (jsonSchema.format) {
      schema.set('format', new StringElement(jsonSchema.format));
    }

    // Handle enum
    if (jsonSchema.enum && Array.isArray(jsonSchema.enum)) {
      const enumArray = new ArrayElement();
      for (const enumValue of jsonSchema.enum) {
        enumArray.push(new StringElement(enumValue));
      }
      schema.set('enum', enumArray);
    }

    // Handle items (for arrays)
    if (jsonSchema.items) {
      const items = this.convertJsonSchemaToSchemaElement(jsonSchema.items as Record<string, any>);
      schema.set('items', items);
    }

    // Handle minimum
    if (jsonSchema.minimum !== undefined) {
      schema.set('minimum', jsonSchema.minimum);
    }

    // Handle maximum
    if (jsonSchema.maximum !== undefined) {
      schema.set('maximum', jsonSchema.maximum);
    }

    return schema;
  }

  /**
   * Create ResponsesElement with inferred type schemas
   */
  private async createResponses(
    workflow: AnalyzedWorkflow,
    config: GenerationConfig,
    arazzoDoc: ArazzoSpecification1Element,
    arazzoDocPath: string
  ): Promise<ResponsesElement> {
    const responses = new ResponsesElement();

    // Use configured response code or default to 200
    const responseCode = config.responseCode?.toString() || '200';

    const response = new ResponseElement();
    response.set(
      'description',
      new StringElement(`Workflow ${workflow.workflowId} executed successfully`)
    );

    // If workflow has outputs, infer types and create schema
    if (workflow.outputs && Object.keys(workflow.outputs.fields).length > 0) {
      const content = new ObjectElement();
      const mediaType = new MediaTypeElement();

      // Use TypeInferenceEngine to infer types from runtime expressions
      const inferenceResult = await this.typeInferenceEngine.inferOutputSchema(
        workflow,
        arazzoDoc,
        arazzoDocPath
      );

      mediaType.set('schema', inferenceResult.schema);

      content.set('application/json', mediaType);
      response.set('content', content);
    }

    responses.set(responseCode, response);

    return responses;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.metadataDeriver.clearCache();
    this.typeInferenceEngine.clearCache();
  }
}
