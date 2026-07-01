import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { statusLabel } from "@/lib/status";

const currency = (cents) => Number(cents || 0) / 100;
const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "modelo-pedido-uberlandia.xlsx");
const ORDER_SHEET = "Planilha de Pedidos SONIC";
const ORDER_ROWS = Array.from({ length: 16 }, (_item, index) => 13 + index);
const BONUS_ROWS = Array.from({ length: 7 }, (_item, index) => 32 + index);

function sanitizeFilename(value) {
  return String(value || "pedido-imouvir")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "pedido-imouvir";
}

function dateLabel(value = new Date()) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${year}`;
}

function setCell(worksheet, address, value) {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  worksheet[address] = {
    t: isNumber ? "n" : "s",
    v: isNumber ? value : String(value ?? "")
  };
}

function clearItemRows(worksheet, rows) {
  for (const row of rows) {
    setCell(worksheet, `B${row}`, 0);
    setCell(worksheet, `C${row}`, "");
    setCell(worksheet, `D${row}`, "");
    setCell(worksheet, `E${row}`, 0);
    setCell(worksheet, `F${row}`, 0);
  }
}

function cityLabel(row) {
  return [row.city, row.state].filter(Boolean).join(" - ");
}

function patientOrderName(row) {
  return [
    row.factory_order_number || `CRM ${row.id}`,
    `PCT ${row.patient_name || ""}`.trim(),
    cityLabel(row),
    dateLabel(row.order_date || row.test_date || row.created_at)
  ].filter(Boolean).join(" - ");
}

function itemFromProduct(product, quantity) {
  const qty = Math.max(1, Number(quantity || 1));
  const unitValue = currency(product?.unit_value_cents);
  return {
    code: product?.code || "",
    description: product?.description || "",
    quantity: qty,
    unitValue,
    total: unitValue * qty
  };
}

async function productMap(sql, ids) {
  const cleanIds = [...new Set(ids.map(Number).filter(Boolean))];
  if (!cleanIds.length) return new Map();
  const rows = await sql`
    select id, description, code, unit_value_cents
    from catalog_products
    where id = any(${cleanIds}::bigint[])
  `;
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function buildOrderWorkbook(sql, row) {
  const productIds = [
    row.selected_device_product_id,
    ...(row.accessory_items || []).map((item) => item.product_id)
  ];
  const products = await productMap(sql, productIds);
  const workbook = XLSX.read(fs.readFileSync(TEMPLATE_PATH), { type: "buffer", cellStyles: true });
  const worksheet = workbook.Sheets[ORDER_SHEET];
  if (!worksheet) throw new Error(`Aba ${ORDER_SHEET} não encontrada no modelo.`);

  const items = [];
  const selectedDevice = products.get(Number(row.selected_device_product_id));
  if (selectedDevice) {
    const deviceQuantity = row.device_side === "bilateral" ? 2 : 1;
    items.push(itemFromProduct(selectedDevice, deviceQuantity));
  }

  for (const accessory of row.accessory_items || []) {
    const product = products.get(Number(accessory.product_id));
    if (product) items.push(itemFromProduct(product, accessory.quantity));
  }

  clearItemRows(worksheet, ORDER_ROWS);
  clearItemRows(worksheet, BONUS_ROWS);

  setCell(worksheet, "E3", row.factory_order_number || `CRM ${row.id}`);
  setCell(worksheet, "B7", patientOrderName(row));
  setCell(worksheet, "E7", cityLabel(row));
  setCell(worksheet, "B8", row.payment_terms || "");
  setCell(worksheet, "E8", row.payment_description || row.payment_terms || "");
  setCell(worksheet, "B9", row.payment_code || "");

  let total = 0;
  items.slice(0, ORDER_ROWS.length).forEach((item, index) => {
    const excelRow = ORDER_ROWS[index];
    setCell(worksheet, `B${excelRow}`, item.code);
    setCell(worksheet, `C${excelRow}`, item.description);
    setCell(worksheet, `D${excelRow}`, item.quantity);
    setCell(worksheet, `E${excelRow}`, item.unitValue);
    setCell(worksheet, `F${excelRow}`, item.total);
    total += item.total;
  });

  setCell(worksheet, "F29", total);
  setCell(worksheet, "F40", 0);

  return workbook;
}

export async function GET(request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sql = getSql();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const ids = searchParams.get("ids")?.split(",").map((id) => Number(id)).filter(Boolean) || [];

  const rows = await sql`
    select *
    from patients
    where (${status || null}::text is null or status = ${status})
    and (${ids.length ? ids : null}::int[] is null or id = any(${ids.length ? ids : null}::int[]))
    order by updated_at desc
  `;

  if (ids.length === 1) {
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
    const workbook = await buildOrderWorkbook(sql, row);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const filename = sanitizeFilename(patientOrderName(row));

    return new NextResponse(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}.xlsx"`
      }
    });
  }

  const data = rows.map((row) => ({
    "Status": statusLabel(row.status),
    "Paciente": row.patient_name,
    "CPF": row.cpf,
    "Nascimento": row.birth_date,
    "Telefone": row.phone,
    "E-mail": row.email,
    "Cidade": row.city,
    "UF": row.state,
    "Pedido médico": row.medical_request_date,
    "Audiometria": row.audiometry_date,
    "Perda auditiva": row.hearing_loss,
    "Teste": row.test_date,
    "Fonoaudiólogo": row.audiologist_name,
    "Resultado do teste": row.test_result,
    "Paciente aprovou": row.patient_approved ? "Sim" : "Não",
    "Data do pedido": row.order_date,
    "Nº pedido fábrica": row.factory_order_number,
    "Condição de pagamento": row.payment_terms,
    "Descrição pagamento": row.payment_description,
    "Código pagamento": row.payment_code,
    "Lado": row.device_side,
    "Marca": row.device_brand,
    "Modelo": row.device_model,
    "Código direito": row.right_device_code,
    "Código esquerdo": row.left_device_code,
    "Acessórios": row.accessory_codes,
    "Valor fábrica": currency(row.factory_value_cents),
    "Valor paciente": currency(row.patient_value_cents),
    "Chegada": row.arrival_date,
    "Adaptação": row.adaptation_date,
    "Observações": row.notes
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos IMOUVIR");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="pedidos-imouvir.xlsx"`
    }
  });
}
