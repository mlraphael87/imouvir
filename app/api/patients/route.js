import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isValidBrazilMobilePhone, isValidCpf, isValidEmail, normalizePatient } from "@/lib/patient-fields";
import { STATUSES } from "@/lib/status";

function normalizeAutomaticStatus(data) {
  if (data.status !== "teste_agendado" || !data.test_date) return data.status;
  const testDate = new Date(data.test_date);
  if (Number.isNaN(testDate.getTime())) return data.status;
  return testDate < new Date() ? "teste_realizado" : data.status;
}

export async function GET(request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sql = getSql();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") || 80), 200);

  await sql`
    update patients
    set status = 'teste_realizado',
        updated_at = now()
    where status = 'teste_agendado'
      and test_date is not null
      and test_date < now()
  `;

  const rows = await sql`
    select patients.*,
      coalesce(file_counts.total, 0)::int as document_count
    from patients
    left join (
      select patient_id, count(*)::int as total
      from patient_files
      group by patient_id
    ) file_counts on file_counts.patient_id = patients.id
    where (${q || null}::text is null
      or lower(patient_name) like lower(${"%" + q + "%"})
      or coalesce(phone, '') like ${"%" + q + "%"}
      or coalesce(cpf, '') like ${"%" + q + "%"})
    and (${status || null}::text is null or status = ${status})
    order by updated_at desc
    limit ${limit}
  `;

  const summary = await sql`
    select status, count(*)::int as total
    from patients
    group by status
  `;

  const totals = Object.fromEntries(STATUSES.map((item) => [item.key, 0]));
  for (const item of summary) totals[item.status] = item.total;

  return NextResponse.json({ rows, totals });
}

export async function POST(request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sql = getSql();
  const data = normalizePatient(await request.json());
  if (!isValidBrazilMobilePhone(data.phone)) {
    return NextResponse.json({ error: "Telefone invalido. Informe 11 digitos: 2 de DDD + 9 do telefone." }, { status: 400 });
  }

  if (!isValidCpf(data.cpf)) {
    return NextResponse.json({ error: "CPF invalido. Verifique os 11 digitos informados." }, { status: 400 });
  }

  if (!isValidEmail(data.email)) {
    return NextResponse.json({ error: "E-mail invalido. Informe um e-mail no formato correto." }, { status: 400 });
  }

  if (!data.patient_name) {
    return NextResponse.json({ error: "Nome do paciente é obrigatório." }, { status: 400 });
  }

  const [row] = await sql`
    insert into patients (
      status, patient_name, cpf, sus_card, birth_date, phone, email, city, state,
      medical_request_date, audiometry_date, hearing_loss, documentation_notes,
      test_date, audiologist_name, test_result, patient_approved,
      order_date, factory_order_number, selected_payment_term_id, payment_terms,
      payment_description, payment_code, selected_device_product_id,
      selected_accessory_product_ids, accessory_items, device_side, device_brand, device_model,
      right_device_code, left_device_code, accessory_codes, factory_value_cents,
      patient_value_cents, arrival_date, adaptation_date, notes
    ) values (
      ${normalizeAutomaticStatus(data)}, ${data.patient_name}, ${data.cpf}, ${data.sus_card}, ${data.birth_date},
      ${data.phone}, ${data.email}, ${data.city}, ${data.state}, ${data.medical_request_date},
      ${data.audiometry_date}, ${data.hearing_loss}, ${data.documentation_notes},
      ${data.test_date}, ${data.audiologist_name}, ${data.test_result}, ${data.patient_approved},
      ${data.order_date}, ${data.factory_order_number}, ${data.selected_payment_term_id},
      ${data.payment_terms}, ${data.payment_description}, ${data.payment_code},
      ${data.selected_device_product_id}, ${data.selected_accessory_product_ids}::bigint[],
      ${JSON.stringify(data.accessory_items)}::jsonb,
      ${data.device_side}, ${data.device_brand}, ${data.device_model}, ${data.right_device_code}, ${data.left_device_code},
      ${data.accessory_codes}, ${data.factory_value_cents}, ${data.patient_value_cents},
      ${data.arrival_date}, ${data.adaptation_date}, ${data.notes}
    )
    returning *
  `;

  return NextResponse.json({ row }, { status: 201 });
}
