import { neon } from "@neondatabase/serverless";

let sql;

export function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL ou POSTGRES_URL não configurada.");
  }

  if (!sql) {
    sql = neon(connectionString);
  }

  return sql;
}
