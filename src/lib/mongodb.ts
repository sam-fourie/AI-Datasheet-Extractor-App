import { MongoClient } from "mongodb";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

export class MongoConfigError extends Error {
  constructor() {
    super("MONGODB_URI is not configured on the server.");
    this.name = "MongoConfigError";
  }
}

export async function getMongoClient() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new MongoConfigError();
  }

  if (!globalThis.__mongoClientPromise) {
    // ignoreUndefined: omit undefined fields instead of storing them as null,
    // so optional review fields round-trip through the PATCH schema.
    globalThis.__mongoClientPromise = new MongoClient(mongoUri, {
      ignoreUndefined: true,
    }).connect();
  }

  return globalThis.__mongoClientPromise;
}

export async function getMongoDatabase() {
  const client = await getMongoClient();

  return client.db();
}
