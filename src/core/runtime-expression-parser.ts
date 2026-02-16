/**
 * Parses Arazzo runtime expressions using @swaggerexpert/arazzo-runtime-expression
 * and transforms them into our domain model for type inference.
 */

import { parse, test } from '@swaggerexpert/arazzo-runtime-expression';
import { ParsedExpression } from '../types/runtime-expression';

export class RuntimeExpressionParser {
  /**
   * Parse a runtime expression or literal value
   */
  parse(expression: string): ParsedExpression {
    // Detect literals (values that don't start with $)
    if (!expression.startsWith('$')) {
      return this.parseLiteral(expression);
    }

    // Validate expression
    if (!test(expression)) {
      throw new Error(`Invalid runtime expression: ${expression}`);
    }

    // Parse and transform
    const result = parse(expression);
    return this.transformParseTree(result.tree, expression);
  }

  /**
   * Parse a literal value (non-expression)
   */
  private parseLiteral(value: string): ParsedExpression {
    // Try to parse as JSON primitive (number, boolean, null)
    try {
      const parsed = JSON.parse(value);
      return {
        type: 'literal',
        raw: value,
        literalValue: parsed,
      };
    } catch {
      // String literal
      return {
        type: 'literal',
        raw: value,
        literalValue: value,
      };
    }
  }

  /**
   * Transform the parse tree from @swaggerexpert package into our domain model
   */
  private transformParseTree(tree: any, raw: string): ParsedExpression {
    const type = tree.type;

    // $steps.stepId.outputs.name or $steps.stepId.outputs.body#/path
    if (type === 'StepsExpression') {
      return {
        type: 'step',
        raw,
        stepId: tree.stepId,
        field: tree.field || 'outputs',
        outputName: tree.outputName,
        jsonPath: tree.jsonPointer?.value,
      };
    }

    // $inputs.name
    if (type === 'InputsExpression') {
      return {
        type: 'input',
        raw,
        inputName: tree.name,
      };
    }

    // $url
    if (type === 'UrlExpression') {
      return { type: 'url', raw };
    }

    // $method
    if (type === 'MethodExpression') {
      return { type: 'method', raw };
    }

    // $statusCode
    if (type === 'StatusCodeExpression') {
      return { type: 'statusCode', raw };
    }

    // $request.* or $response.*
    if (type === 'RequestExpression' || type === 'ResponseExpression') {
      return {
        type: type === 'RequestExpression' ? 'request' : 'response',
        raw,
        jsonPath: tree.source?.reference?.jsonPointer?.value,
      };
    }

    // Unknown type - should not happen with valid expressions
    throw new Error(`Unknown expression type: ${type}`);
  }
}
