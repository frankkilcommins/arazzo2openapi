# arazzo2openapi

[![NPM Version](https://img.shields.io/npm/v/arazzo2openapi.svg)](https://www.npmjs.com/package/arazzo2openapi)
[![CI](https://github.com/frankkilcommins/arazzo2openapi/workflows/CI/badge.svg)](https://github.com/frankkilcommins/arazzo2openapi/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/frankkilcommins/arazzo2openapi.svg)](LICENSE)

Convert Arazzo workflow descriptions to OpenAPI documents.

[Try it online](https://frankkilcommins.github.io/arazzo2openapi) • [NPM Package](https://www.npmjs.com/package/arazzo2openapi)

## Features

- ✅ Convert Arazzo 1.0 workflows to OpenAPI 3.0/3.1 documents
- ✅ Intelligent type inference from source OpenAPI documents
- ✅ Support for remote and local source documents
- ✅ $ref resolution in OpenAPI schemas
- ✅ Preserve types, formats, descriptions, and constraints
- ✅ CLI and programmatic API
- ✅ TypeScript support

## Installation

```bash
npm install -g arazzo2openapi
```

## Usage

### CLI

```bash
# Convert local file
arazzo2openapi workflow.yaml -o openapi.yaml

# Convert remote URL
arazzo2openapi https://example.com/workflow.yaml -o openapi.yaml

# Override metadata
arazzo2openapi workflow.yaml \
  --title "My API" \
  --version "2.0.0" \
  --description "Custom description"
```

### CLI Options

```
  <arazzo-file>                    Path or URL to Arazzo document
  -o, --output <file>              Output file path
  -f, --format <format>            Output format: json or yaml
  --openapi-version <version>      OpenAPI version (3.0.0 or 3.1.0)
  --title <title>                  Override API title
  --version-override <version>     Override API version
  --description <description>      Override API description
  --server <url>                   Add server URL (repeatable)
  --response-code <code>           HTTP response code (default: 200)
```

### Programmatic API

```typescript
import { ArazzoParser, WorkflowAnalyzer, OpenAPIGenerator } from 'arazzo2openapi';

// Parse Arazzo document
const parser = new ArazzoParser();
const { document } = await parser.loadDocument('workflow.yaml');

// Analyze workflows
const analyzer = new WorkflowAnalyzer();
const workflows = analyzer.analyzeAllWorkflows(document);

// Generate OpenAPI
const generator = new OpenAPIGenerator();
const config = {
  arazzoPath: 'workflow.yaml',
  outputPath: 'openapi.yaml',
  openapiVersion: '3.1.0',
};

const openapi = await generator.generateOpenAPI(
  document,
  workflows,
  'workflow.yaml',
  config
);
```

## Type Inference

Automatically infers accurate types from source OpenAPI documents:

```yaml
# Input: Arazzo workflow
outputs:
  petId: $steps.getPet.outputs.id
  petName: $steps.getPet.outputs.name

# Output: OpenAPI with inferred types
schema:
  properties:
    petId:
      type: integer      # ✅ Inferred from source
      format: int64
    petName:
      type: string       # ✅ Inferred from source
```

Supports:
- Primitive types (string, number, integer, boolean)
- Formats (uuid, email, date-time, int32, int64, float, etc.)
- Enums and constraints (min/max, pattern, etc.)
- Nested objects and arrays
- $ref resolution

## Examples

See [test fixtures](tests/fixtures/arazzo) for example Arazzo documents.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

## Contributing

Contributions welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.

## License

Apache-2.0 © [Frank Kilcommins](https://github.com/frankkilcommins)

## Related

- [Arazzo Specification](https://github.com/OAI/Arazzo-Specification)
- [OpenAPI Specification](https://github.com/OAI/OpenAPI-Specification)
