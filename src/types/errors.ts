/**
 * Base error class for arazzo2openapi
 */
export class Arazzo2OpenAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Arazzo2OpenAPIError';
    Object.setPrototypeOf(this, Arazzo2OpenAPIError.prototype);
  }
}

/**
 * Error thrown when Arazzo document parsing fails
 */
export class ArazzoParseError extends Arazzo2OpenAPIError {
  constructor(
    message: string,
    public errors?: unknown[] | ArrayLike<unknown>
  ) {
    super(message);
    this.name = 'ArazzoParseError';
    Object.setPrototypeOf(this, ArazzoParseError.prototype);
  }
}

/**
 * Error thrown when OpenAPI validation fails
 */
export class ValidationError extends Arazzo2OpenAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error thrown when workflow analysis fails
 */
export class WorkflowAnalysisError extends Arazzo2OpenAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowAnalysisError';
    Object.setPrototypeOf(this, WorkflowAnalysisError.prototype);
  }
}

/**
 * Error thrown when schema derivation fails
 */
export class SchemaDerivationError extends Arazzo2OpenAPIError {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaDerivationError';
    Object.setPrototypeOf(this, SchemaDerivationError.prototype);
  }
}
