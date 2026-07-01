import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { statusLabel } from "@/lib/status";

const currency = (cents) => Number(cents || 0) / 100;
const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "modelo-pedido-sonic.xlsx");
const ORDER_SHEET = "Planilha de Pedidos SONIC";
const ORDER_SHEET_PATH = "xl/worksheets/sheet1.xml";
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

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateCellXml(sheetXml, address, value) {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  const cellPattern = new RegExp(`<c\\b(?=[^>]*\\br="${address}")[^>]*>[\\s\\S]*?<\\/c>`);
  const match = sheetXml.match(cellPattern);
  if (!match) return sheetXml;

  const openingTag = match[0].match(/^<c\b([^>]*)>/)?.[1] || "";
  const attrs = openingTag.replace(/\s+t="[^"]*"/g, "");
  const body = isNumber ? `<v>${value}</v>` : `<is><t>${escapeXml(value)}</t></is>`;
  const typeAttr = isNumber ? "" : ` t="inlineStr"`;

  return sheetXml.replace(cellPattern, `<c${attrs}${typeAttr}>${body}</c>`);
}

function setTemplateCell(cells, address, value) {
  cells.push([address, value]);
}

function clearTemplateRows(cells, rows) {
  for (const row of rows) {
    setTemplateCell(cells, `B${row}`, 0);
    setTemplateCell(cells, `C${row}`, "");
    setTemplateCell(cells, `D${row}`, "");
    setTemplateCell(cells, `E${row}`, 0);
    setTemplateCell(cells, `F${row}`, 0);
  }
}

async function forceWorkbookRecalculation(zip) {
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) return;

  const workbookXml = await workbookFile.async("string");
  const calcPr = '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>';
  const nextWorkbookXml = workbookXml.includes("<calcPr")
    ? workbookXml.replace(/<calcPr\b[^>]*\/>/, calcPr)
    : workbookXml.replace("</workbook>", `${calcPr}</workbook>`);

  zip.file("xl/workbook.xml", nextWorkbookXml);
  zip.remove("xl/calcChain.xml");
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

function itemFromSavedDevice(row) {
  if (!row.device_model && !row.right_device_code && !row.left_device_code) return null;
  const quantity = row.device_side === "bilateral" ? 2 : 1;
  const code = row.device_side === "esquerdo" ? row.left_device_code : row.right_device_code || row.left_device_code;
  const unitValue = quantity ? currency(row.factory_value_cents) / quantity : 0;
  return {
    code: code || "",
    description: row.device_model || "Aparelho auditivo",
    quantity,
    unitValue,
    total: unitValue * quantity
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

async function buildOrderBuffer(sql, row) {
  const productIds = [
    row.selected_device_product_id,
    ...(row.accessory_items || []).map((item) => item.product_id)
  ];
  const products = await productMap(sql, productIds);
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE_PATH));
  const sheetFile = zip.file(ORDER_SHEET_PATH);
  if (!sheetFile) throw new Error(`Aba ${ORDER_SHEET} não encontrada no modelo.`);

  const items = [];
  const selectedDevice = products.get(Number(row.selected_device_product_id));
  if (selectedDevice) {
    const deviceQuantity = row.device_side === "bilateral" ? 2 : 1;
    items.push(itemFromProduct(selectedDevice, deviceQuantity));
  } else {
    const savedDevice = itemFromSavedDevice(row);
    if (savedDevice) items.push(savedDevice);
  }

  for (const accessory of row.accessory_items || []) {
    const product = products.get(Number(accessory.product_id));
    if (product) items.push(itemFromProduct(product, accessory.quantity));
  }

  const cells = [];
  clearTemplateRows(cells, ORDER_ROWS);
  clearTemplateRows(cells, BONUS_ROWS);

  setTemplateCell(cells, "E3", row.factory_order_number || `CRM ${row.id}`);
  setTemplateCell(cells, "B7", patientOrderName(row));
  setTemplateCell(cells, "E7", cityLabel(row));
  setTemplateCell(cells, "B8", row.payment_terms || "");
  setTemplateCell(cells, "E8", row.payment_description || row.payment_terms || "");
  setTemplateCell(cells, "B9", row.payment_code || "");

  let total = 0;
  items.slice(0, ORDER_ROWS.length).forEach((item, index) => {
    const excelRow = ORDER_ROWS[index];
    setTemplateCell(cells, `B${excelRow}`, item.code);
    setTemplateCell(cells, `C${excelRow}`, item.description);
    setTemplateCell(cells, `D${excelRow}`, item.quantity);
    setTemplateCell(cells, `E${excelRow}`, item.unitValue);
    setTemplateCell(cells, `F${excelRow}`, item.total);
    total += item.total;
  });

  setTemplateCell(cells, "F29", total);
  setTemplateCell(cells, "F40", 0);

  let sheetXml = await sheetFile.async("string");
  for (const [address, value] of cells) {
    sheetXml = updateCellXml(sheetXml, address, value);
  }

  zip.file(ORDER_SHEET_PATH, sheetXml);
  await forceWorkbookRecalculation(zip);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
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
    const buffer = await buildOrderBuffer(sql, row);
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
