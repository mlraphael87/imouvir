import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { statusLabel } from "@/lib/status";

const currency = (cents) => Number(cents || 0) / 100;

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

  const data = rows.map((row) => ({
    "Status": statusLabel(row.status),
    "Paciente": row.patient_name,
    "CPF": row.cpf,
    "Cartão SUS": row.sus_card,
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
