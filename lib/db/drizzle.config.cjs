const { defineConfig } = require("drizzle-kit");

// PGlite configuration for zero-config PostgreSQL on Windows
module.exports = defineConfig({
  dialect: 'postgresql',
  driver: 'pglite',
  dbCredentials: {
    url: '../../.data/postgres' // Relative to lib/db
  },
  schema: './src/schema/index.ts'
});
