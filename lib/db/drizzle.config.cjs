const { defineConfig } = require("drizzle-kit");

const { defineConfig } = require("drizzle-kit");

const dbUrl = process.env.DATABASE_URL;

module.exports = defineConfig({
  dialect: 'postgresql',
  // drizzle-kit will use 'pglite' if the url points to a local path
  dbCredentials: {
    url: dbUrl || '../../.data/postgres'
  },
  schema: './src/schema/index.ts'
});
