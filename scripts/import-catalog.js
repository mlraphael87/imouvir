const path = require("path");
const XLSX = require("xlsx");

const SOURCE = "modelo-pedido-uberlandia";
const SHEET = "Planilha1";
const WORKBOOK_PATH = path.resolve(process.cwd(), "..", "..", "work", "crm-templates", "modelo-pedido-uberlandia.xlsx");

const DEVICE_CATEGORIES = new Set(["AASI"]);
const SECTION_ROWS = new Set([
  "RECEPTORES",
  "DOMO",
  "PILHAS",
  "FILTROS",
  "FERRAMENTAS",
  "ACESSÓRIOS FONOAUDIÓLOGOS",
  "GANCHOS",
  "ACESSÓRIOS CONECTIVIDADE",
  "ACESSÓRIOS DE PROGRAMAÇÃO",
  "ACESSÓRIOS PARA USUÁRIOS"
]);

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function moneyToCents(value) {
  const number = Number(value || 0);
  return Math.round(number * 100);
}

function readWorkbook() {
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: true });
  const worksheet = workbook.Sheets[SHEET];
  if (!worksheet) throw new Error(`Aba ${SHEET} não encontrada.`);
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: true });
}

function parseCatalog(rows) {
  let category = "AASI";
  const products = [];
  const paymentTerms = [];
  const seenProducts = new Set();

  rows.forEach((row, index) => {
    const sourceRow = index + 1;
    const description = clean(row[0]);
    const code = clean(row[1]);
    const value = row[2];
    const terms = clean(row[4]);
    const paymentDescription = clean(row[5]);
    const paymentCode = clean(row[6]);

    if (terms && (paymentDescription || paymentCode) && terms !== "Cond. Pagto") {
      paymentTerms.push({
        source_sheet: SHEET,
        source_row: sourceRow,
        terms,
        description: paymentDescription,
        code: paymentCode
      });
    }

    if (!description || description === "AASI") return;
    if (SECTION_ROWS.has(description.toUpperCase())) {
      category = description.toUpperCase();
      return;
    }
    if (!code && value === null) return;
    if (!code && !Number.isFinite(Number(value))) return;

    const dedupeKey = `${description}|${code || ""}`;
    if (seenProducts.has(dedupeKey)) return;
    seenProducts.add(dedupeKey);

    products.push({
      source_sheet: SHEET,
      source_row: sourceRow,
      category,
      item_kind: DEVICE_CATEGORIES.has(category) && !description.toUpperCase().includes("CARREGADOR") ? "device" : "accessory",
      description,
      code,
      unit_value_cents: moneyToCents(value)
    });
  });

  return { products, paymentTerms };
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("Configure DATABASE_URL ou POSTGRES_URL.");

  const { neon } = await import("@neondatabase/serverless");
  const db = neon(connectionString);
  const { products, paymentTerms } = parseCatalog(readWorkbook());

  for (const product of products) {
    await db`
      insert into catalog_products (
        source, source_sheet, source_row, category, item_kind, description, code, unit_value_cents, active
      ) values (
        ${SOURCE}, ${product.source_sheet}, ${product.source_row}, ${product.category},
        ${product.item_kind}, ${product.description}, ${product.code}, ${product.unit_value_cents}, true
      )
      on conflict (source, source_sheet, source_row) do update set
        category = excluded.category,
        item_kind = excluded.item_kind,
        description = excluded.description,
        code = excluded.code,
        unit_value_cents = excluded.unit_value_cents,
        active = true
    `;
  }

  for (const term of paymentTerms) {
    await db`
      insert into payment_terms (
        source, source_sheet, source_row, terms, description, code, active
      ) values (
        ${SOURCE}, ${term.source_sheet}, ${term.source_row}, ${term.terms},
        ${term.description}, ${term.code}, true
      )
      on conflict (source, source_sheet, source_row) do update set
        terms = excluded.terms,
        description = excluded.description,
        code = excluded.code,
        active = true
    `;
  }

  console.log(`Produtos importados: ${products.length}`);
  console.log(`Condições importadas: ${paymentTerms.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
