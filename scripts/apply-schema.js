const fs = require("fs");
const path = require("path");

const FUNCTION_MARKER = "$$ language plpgsql;";
const DO_MARKER = "$$;";

function splitSql(sql) {
  const statements = [];
  let remaining = sql;

  while (remaining.trim()) {
    const functionStart = remaining.search(/create\s+or\s+replace\s+function/i);
    const doStart = remaining.search(/\bdo\s+\$\$/i);
    const specialStart = [functionStart, doStart].filter((index) => index >= 0).sort((a, b) => a - b)[0];

    if (specialStart === undefined) {
      statements.push(...splitBasic(remaining));
      break;
    }

    statements.push(...splitBasic(remaining.slice(0, specialStart)));
    remaining = remaining.slice(specialStart);

    const marker = /^do\s+\$\$/i.test(remaining.trimStart()) ? DO_MARKER : FUNCTION_MARKER;
    const specialEnd = remaining.indexOf(marker);
    if (specialEnd < 0) throw new Error("Bloco SQL com $$ sem fechamento esperado.");

    statements.push(remaining.slice(0, specialEnd + marker.length).trim());
    remaining = remaining.slice(specialEnd + marker.length);
  }

  return statements.filter(Boolean);
}

function splitBasic(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("Configure DATABASE_URL ou POSTGRES_URL.");

  const { neon } = await import("@neondatabase/serverless");
  const db = neon(connectionString);
  const schemaPath = path.join(process.cwd(), "sql", "schema.sql");
  const statements = splitSql(fs.readFileSync(schemaPath, "utf8"));

  for (const statement of statements) {
    await db(statement);
    console.log("ok:", statement.split(/\s+/).slice(0, 6).join(" "));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
