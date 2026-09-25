/**
 * One-off: creates the `datasheet_submissions` indexes defined in
 * src/lib/submissions/indexes.ts. Never run from a request path; a human runs
 * it deliberately against the database in MONGODB_URI (production).
 *
 *   node --env-file=.env.local scripts/ensure-submission-indexes.ts           # dry run
 *   node --env-file=.env.local scripts/ensure-submission-indexes.ts --apply   # create them
 *
 * Runs under Node's native type stripping (Node 22.18+), so it needs no build
 * step. createIndexes is idempotent when the names and options match.
 */
import { MongoClient } from "mongodb";

// A runtime path Node can load directly (it needs the .ts extension); the
// type comes from the extensionless specifier TypeScript resolves.
const indexesModulePath = "../src/lib/submissions/indexes.ts";
const { ensureSubmissionIndexes, SUBMISSION_INDEXES } = (await import(
  indexesModulePath
)) as typeof import("../src/lib/submissions/indexes");

const COLLECTION_NAME = "datasheet_submissions";
const apply = process.argv.includes("--apply");
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local or export it first.");
  process.exit(1);
}

const client = new MongoClient(mongoUri);

try {
  await client.connect();

  const db = client.db();
  const collection = db.collection(COLLECTION_NAME);

  console.log(`Database: ${db.databaseName}, collection: ${COLLECTION_NAME}`);

  for (const index of SUBMISSION_INDEXES) {
    console.log(`  ${index.name}: ${JSON.stringify(index.key)}`);
  }

  if (!apply) {
    console.log("Dry run. Re-run with --apply to create these indexes.");
  } else {
    const created = await ensureSubmissionIndexes(collection);

    console.log(`Done: ${created.join(", ")}`);
  }
} finally {
  await client.close();
}
