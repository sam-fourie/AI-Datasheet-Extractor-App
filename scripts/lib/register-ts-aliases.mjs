/**
 * Lets Node run a TypeScript script that imports app code directly, without a
 * build step: it resolves the "@/" alias to src/ and extensionless imports to
 * their .ts files, the way tsconfig's "bundler" resolution does.
 *
 *   node --experimental-transform-types --import ./scripts/lib/register-ts-aliases.mjs scripts/<name>.ts
 *
 * --experimental-transform-types is needed because some app modules use
 * TypeScript-only syntax (parameter properties) that type stripping rejects.
 */
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_ROOT = fileURLToPath(new URL("../../src/", import.meta.url));
const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts"];

function resolveFile(basePath) {
  if (existsSync(basePath) && statSync(basePath).isFile()) {
    return basePath;
  }

  for (const suffix of CANDIDATE_SUFFIXES) {
    if (existsSync(basePath + suffix)) {
      return basePath + suffix;
    }
  }

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const file = resolveFile(path.join(SOURCE_ROOT, specifier.slice(2)));

      if (file) {
        return { shortCircuit: true, url: pathToFileURL(file).href };
      }
    }

    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      const parentDirectory = path.dirname(fileURLToPath(context.parentURL));
      const file = resolveFile(path.resolve(parentDirectory, specifier));

      if (file) {
        return { shortCircuit: true, url: pathToFileURL(file).href };
      }
    }

    return nextResolve(specifier, context);
  },
});
