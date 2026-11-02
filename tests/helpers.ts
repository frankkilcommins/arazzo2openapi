/**
 * Shared test helpers — provide Node.js-backed instances of injectable classes.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { SourceDocumentResolver } from '../src/core/source-document-resolver';
import { TypeInferenceEngine } from '../src/core/type-inference-engine';
import { OpenAPIGenerator } from '../src/core/openapi-generator';

/** SourceDocumentResolver wired with Node.js fs for test fixtures. */
export function createNodeResolver(): SourceDocumentResolver {
  return new SourceDocumentResolver({
    readLocalFile: async (relativeUrl, docPath) => {
      const resolvedPath = path.resolve(path.dirname(docPath), relativeUrl);
      return fs.readFile(resolvedPath, 'utf-8');
    },
  });
}

/** TypeInferenceEngine wired with the Node.js resolver. */
export function createNodeEngine(): TypeInferenceEngine {
  return new TypeInferenceEngine(createNodeResolver());
}

/** OpenAPIGenerator wired with the Node.js resolver/engine. */
export function createNodeGenerator(): OpenAPIGenerator {
  return new OpenAPIGenerator(createNodeEngine());
}
