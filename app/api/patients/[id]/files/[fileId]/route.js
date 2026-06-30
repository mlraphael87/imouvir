import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function contentDisposition(fileName) {
  const safeName = String(fileName || "arquivo").replace(/[\r\n"]/g, "");
  return `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function GET(_request, context) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id, fileId } = await context.params;
  const sql = getSql();
  const [file] = await sql`
    select file_name, mime_type, encode(file_data, 'base64') as data_base64
    from patient_files
    where id = ${fileId}
      and patient_id = ${id}
  `;

  if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

  const buffer = Buffer.from(file.data_base64, "base64");
  return new Response(buffer, {
    headers: {
      "content-type": file.mime_type || "application/octet-stream",
      "content-length": String(buffer.length),
      "content-disposition": contentDisposition(file.file_name)
    }
  });
}

export async function DELETE(_request, context) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id, fileId } = await context.params;
  const sql = getSql();
  const [row] = await sql`
    delete from patient_files
    where id = ${fileId}
      and patient_id = ${id}
    returning id
  `;

  if (!row) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
