/**
 * Tests for RuntimeExpressionParser
 * Focus: Testing OUR transformation logic, not validating the underlying package
 */

import { RuntimeExpressionParser } from '../../src/core/runtime-expression-parser';

describe('RuntimeExpressionParser', () => {
  let parser: RuntimeExpressionParser;

  beforeEach(() => {
    parser = new RuntimeExpressionParser();
  });

  describe('Step Expressions', () => {
    it('should parse simple step output', () => {
      const result = parser.parse('$steps.fetchProduct.outputs.name');

      expect(result.type).toBe('step');
      expect(result.stepId).toBe('fetchProduct');
      expect(result.field).toBe('outputs');
      expect(result.outputName).toBe('name');
      expect(result.jsonPath).toBeUndefined();
    });

    it('should parse step output with JSONPath', () => {
      const result = parser.parse('$steps.getItems.outputs.body#/data/0/id');

      expect(result.type).toBe('step');
      expect(result.stepId).toBe('getItems');
      expect(result.outputName).toBe('body');
      expect(result.jsonPath).toBe('/data/0/id');
    });

    it('should parse complex nested JSONPath', () => {
      const result = parser.parse('$steps.fetchUsers.outputs.body#/users/0/profile/email');

      expect(result.type).toBe('step');
      expect(result.jsonPath).toBe('/users/0/profile/email');
    });
  });

  describe('Input Expressions', () => {
    it('should parse input reference', () => {
      const result = parser.parse('$inputs.customerId');

      expect(result.type).toBe('input');
      expect(result.inputName).toBe('customerId');
    });

    it('should parse nested input reference', () => {
      const result = parser.parse('$inputs.user.email');

      expect(result.type).toBe('input');
      expect(result.inputName).toBeDefined();
    });
  });

  describe('Literal Values', () => {
    it('should identify string literal', () => {
      const result = parser.parse('confirmed');

      expect(result.type).toBe('literal');
      expect(result.literalValue).toBe('confirmed');
    });

    it('should identify numeric literal', () => {
      const result = parser.parse('123');

      expect(result.type).toBe('literal');
      expect(result.literalValue).toBe(123);
    });

    it('should identify float literal', () => {
      const result = parser.parse('45.67');

      expect(result.type).toBe('literal');
      expect(result.literalValue).toBe(45.67);
    });

    it('should identify boolean literal true', () => {
      const result = parser.parse('true');

      expect(result.type).toBe('literal');
      expect(result.literalValue).toBe(true);
    });

    it('should identify boolean literal false', () => {
      const result = parser.parse('false');

      expect(result.type).toBe('literal');
      expect(result.literalValue).toBe(false);
    });

    it('should identify null literal', () => {
      const result = parser.parse('null');

      expect(result.type).toBe('literal');
      expect(result.literalValue).toBe(null);
    });
  });

  describe('Other Expression Types', () => {
    it('should parse $url expression', () => {
      const result = parser.parse('$url');
      expect(result.type).toBe('url');
    });

    it('should parse $method expression', () => {
      const result = parser.parse('$method');
      expect(result.type).toBe('method');
    });

    it('should parse $statusCode expression', () => {
      const result = parser.parse('$statusCode');
      expect(result.type).toBe('statusCode');
    });

    it('should parse $request expression', () => {
      const result = parser.parse('$request.header.accept');
      expect(result.type).toBe('request');
    });

    it('should parse $response expression', () => {
      const result = parser.parse('$response.body#/data');
      expect(result.type).toBe('response');
      expect(result.jsonPath).toBe('/data');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid expression', () => {
      expect(() => parser.parse('$invalid.syntax')).toThrow('Invalid runtime expression');
    });
  });

  describe('Transformation Consistency', () => {
    it('should include raw expression in result', () => {
      const expr = '$steps.fetch.outputs.name';
      const result = parser.parse(expr);

      expect(result.raw).toBe(expr);
    });

    it('should handle all our supported types', () => {
      const expressions = [
        '$steps.s1.outputs.field',
        '$inputs.name',
        '$url',
        '$method',
        '$statusCode',
        'literal',
      ];

      expressions.forEach((expr) => {
        const result = parser.parse(expr);
        expect(result.type).toBeDefined();
        expect(['step', 'input', 'url', 'method', 'statusCode', 'literal']).toContain(result.type);
      });
    });
  });
});
