import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(["medical_request", "audiometry_exam", "payment_receipt", "other"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export async function GET(_request, context) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const sql = getSql();
  const rows = await sql`
    select id, patient_id, created_at, document_type, file_name, mime_type, file_size
    from patient_files
    where patient_id = ${id}
    order by created_at desc
  `;

  return NextResponse.json({ files: rows });
}

export async function POST(request, context) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const sql = getSql();
  const formData = await request.formData();
  const file = formData.get("file");
  const documentType = String(formData.get("document_type") || "other");

  if (!DOCUMENT_TYPES.has(documentType)) {
    return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Selecione um arquivo para upload." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Envie PDF, JPG, PNG ou WEBP." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo acima do limite de 4 MB." }, { status: 400 });
  }

  const [patient] = await sql`
    select id
    from patients
    where id = ${id}
  `;

  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const [row] = await sql`
    insert into patient_files (
      patient_id,
      document_type,
      file_name,
      mime_type,
      file_size,
      file_data
    ) values (
      ${id},
      ${documentType},
      ${file.name || "arquivo"},
      ${file.type},
      ${file.size},
      decode(${base64}, 'base64')
    )
    returning id, patient_id, created_at, document_type, file_name, mime_type, file_size
  `;

  return NextResponse.json({ file: row }, { status: 201 });
}
