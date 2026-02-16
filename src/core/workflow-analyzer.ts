import {
  ArazzoSpecification1Element,
  WorkflowElement,
  StepElement,
} from '@speclynx/apidom-ns-arazzo-1';
import { WorkflowAnalysisError } from '../types/errors';

/**
 * Analyzed workflow data ready for OpenAPI generation
 */
export interface AnalyzedWorkflow {
  workflowId: string;
  summary?: string;
  description?: string;
  inputs?: WorkflowInputs;
  outputs?: WorkflowOutputs;
  steps: WorkflowStep[];
  sourceDescriptions: string[]; // Names of source descriptions used
}

/**
 * Workflow inputs structure (JSON Schema)
 */
export interface WorkflowInputs {
  schema: Record<string, unknown>; // JSON Schema object
  required: string[];
}

/**
 * Workflow outputs structure
 */
export interface WorkflowOutputs {
  fields: Record<string, OutputField>;
}

/**
 * Output field with runtime expression
 */
export interface OutputField {
  name: string;
  expression: string;
  description?: string;
}

/**
 * Workflow step information
 */
export interface WorkflowStep {
  stepId: string;
  description?: string;
  operationId?: string;
  operationPath?: string;
  outputs?: Record<string, string>; // Map of output name to runtime expression
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  workflowId: string;
  summary?: string;
  description?: string;
  stepCount: number;
  hasInputs: boolean;
  hasOutputs: boolean;
}

/**
 * Analyzer for extracting workflow information from Arazzo documents
 */
export class WorkflowAnalyzer {
  /**
   * Analyze a workflow element and extract all relevant data
   */
  analyzeWorkflow(workflow: WorkflowElement): AnalyzedWorkflow {
    try {
      const workflowId = this.getWorkflowId(workflow);
      const summary = this.getSummary(workflow);
      const description = this.getDescription(workflow);
      const inputs = this.analyzeInputs(workflow);
      const outputs = this.analyzeOutputs(workflow);
      const steps = this.analyzeSteps(workflow);
      const sourceDescriptions = this.extractSourceDescriptions(workflow, steps);

      return {
        workflowId,
        summary,
        description,
        inputs,
        outputs,
        steps,
        sourceDescriptions,
      };
    } catch (error) {
      throw new WorkflowAnalysisError(
        `Failed to analyze workflow: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Analyze all workflows in a document
   */
  analyzeAllWorkflows(document: ArazzoSpecification1Element): AnalyzedWorkflow[] {
    const workflows = document.workflows;
    if (!workflows) {
      return [];
    }

    const analyzed: AnalyzedWorkflow[] = [];

    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows.get(i);
      if (workflow instanceof WorkflowElement) {
        analyzed.push(this.analyzeWorkflow(workflow));
      }
    }

    return analyzed;
  }

  /**
   * Get workflow metadata (lightweight extraction)
   */
  getWorkflowMetadata(workflow: WorkflowElement): WorkflowMetadata {
    const workflowId = this.getWorkflowId(workflow);
    const summary = this.getSummary(workflow);
    const description = this.getDescription(workflow);

    const steps = workflow.get('steps');
    const stepCount = steps ? steps.length : 0;

    const inputs = workflow.get('inputs');
    const hasInputs = !!inputs;

    const outputs = workflow.get('outputs');
    const hasOutputs = !!outputs;

    return {
      workflowId,
      summary,
      description,
      stepCount,
      hasInputs,
      hasOutputs,
    };
  }

  /**
   * Get all workflow metadata from document
   */
  getAllWorkflowMetadata(document: ArazzoSpecification1Element): WorkflowMetadata[] {
    const workflows = document.workflows;
    if (!workflows) {
      return [];
    }

    const metadata: WorkflowMetadata[] = [];

    for (let i = 0; i < workflows.length; i++) {
      const workflow = workflows.get(i);
      if (workflow instanceof WorkflowElement) {
        metadata.push(this.getWorkflowMetadata(workflow));
      }
    }

    return metadata;
  }

  /**
   * Extract workflow ID
   */
  private getWorkflowId(workflow: WorkflowElement): string {
    const workflowId = workflow.get('workflowId');
    if (!workflowId) {
      throw new WorkflowAnalysisError('Workflow missing required workflowId field');
    }
    return workflowId.toValue() as string;
  }

  /**
   * Extract workflow summary
   */
  private getSummary(workflow: WorkflowElement): string | undefined {
    const summary = workflow.get('summary');
    return summary ? (summary.toValue() as string) : undefined;
  }

  /**
   * Extract workflow description
   */
  private getDescription(workflow: WorkflowElement): string | undefined {
    const description = workflow.get('description');
    return description ? (description.toValue() as string) : undefined;
  }

  /**
   * Analyze workflow inputs
   */
  analyzeInputs(workflow: WorkflowElement): WorkflowInputs | undefined {
    const inputs = workflow.get('inputs');
    if (!inputs) {
      return undefined;
    }

    // Inputs is a JSON Schema object
    const schema = inputs.toValue() as Record<string, unknown>;
    const required = (schema.required as string[]) || [];

    return {
      schema,
      required,
    };
  }

  /**
   * Analyze workflow outputs
   */
  analyzeOutputs(workflow: WorkflowElement): WorkflowOutputs | undefined {
    const outputs = workflow.get('outputs');
    if (!outputs) {
      return undefined;
    }

    // Outputs is a map of field names to runtime expressions
    const outputsValue = outputs.toValue() as Record<string, string>;
    const fields: Record<string, OutputField> = {};

    for (const [fieldName, expression] of Object.entries(outputsValue)) {
      fields[fieldName] = {
        name: fieldName,
        expression: expression,
      };
    }

    return {
      fields,
    };
  }

  /**
   * Analyze workflow steps
   */
  private analyzeSteps(workflow: WorkflowElement): WorkflowStep[] {
    const steps = workflow.get('steps');
    if (!steps) {
      return [];
    }

    const analyzedSteps: WorkflowStep[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps.get(i);
      if (step instanceof StepElement) {
        const stepId = step.get('stepId')?.toValue() as string;
        const description = step.get('description')?.toValue() as string | undefined;
        const operationId = step.get('operationId')?.toValue() as string | undefined;
        const operationPath = step.get('operationPath')?.toValue() as string | undefined;

        // Extract step outputs
        const outputsElement = step.get('outputs');
        let outputs: Record<string, string> | undefined;
        if (outputsElement) {
          outputs = outputsElement.toValue() as Record<string, string>;
        }

        analyzedSteps.push({
          stepId,
          description,
          operationId,
          operationPath,
          outputs,
        });
      }
    }

    return analyzedSteps;
  }

  /**
   * Extract source descriptions used by workflow steps
   */
  private extractSourceDescriptions(
    workflow: WorkflowElement,
    steps: WorkflowStep[]
  ): string[] {
    const sourceDescriptions = new Set<string>();

    for (const step of steps) {
      if (step.operationId) {
        // operationId format: "sourceName.operationId"
        const parts = step.operationId.split('.');
        if (parts.length >= 2) {
          sourceDescriptions.add(parts[0]);
        }
      }
    }

    return Array.from(sourceDescriptions);
  }
}
