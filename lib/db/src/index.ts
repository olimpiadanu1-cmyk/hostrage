import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
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
  return process.cwd(); // Fallback to current directory
}

const root = findRoot();
const dataPath = path.resolve(root, ".data/postgres");

// This log will help us confirm the path resolution during start
console.log(`[PGlite] Database root: ${root}`);
console.log(`[PGlite] Data path: ${dataPath}`);

export const client = new PGlite(dataPath);
export const db = drizzle(client, { schema });

export * from "./schema";
