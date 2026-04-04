import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Find the workspace root reliably in a monorepo
function findRoot() {
  let curr = process.cwd();
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, "pnpm-workspace.yaml"))) {
       return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

const dbUrl = process.env.DATABASE_URL;

function createDb() {
  if (dbUrl) {
    // Production / Neon.tech
    console.log(`[Database] Connecting to PostgreSQL (Neon)...`);
    const pool = new pg.Pool({ connectionString: dbUrl });
    return drizzlePg(pool, { schema });
  } else {
    // Local / PGlite
    const root = findRoot();
    const dataPath = path.resolve(root, ".data/postgres");
    console.log(`[Database] Using PGlite info: ${dataPath}`);
    const client = new PGlite(dataPath);
    return drizzlePglite(client, { schema });
  }
}

export const db = createDb();
export * from "./schema";
