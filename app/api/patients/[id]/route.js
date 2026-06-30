import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { normalizePatient } from "@/lib/patient-fields";

export async function PATCH(request, context) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const sql = getSql();
  const data = normalizePatient(await request.json());

  const [row] = await sql`
    update patients set
      status = ${data.status},
      patient_name = ${data.patient_name},
      cpf = ${data.cpf},
      sus_card = ${data.sus_card},
      birth_date = ${data.birth_date},
      phone = ${data.phone},
      email = ${data.email},
      city = ${data.city},
      state = ${data.state},
      medical_request_date = ${data.medical_request_date},
      audiometry_date = ${data.audiometry_date},
      hearing_loss = ${data.hearing_loss},
      documentation_notes = ${data.documentation_notes},
      test_date = ${data.test_date},
      audiologist_name = ${data.audiologist_name},
      test_result = ${data.test_result},
      patient_approved = ${data.patient_approved},
      order_date = ${data.order_date},
      factory_order_number = ${data.factory_order_number},
      selected_payment_term_id = ${data.selected_payment_term_id},
      payment_terms = ${data.payment_terms},
      payment_description = ${data.payment_description},
      payment_code = ${data.payment_code},
      selected_device_product_id = ${data.selected_device_product_id},
      selected_accessory_product_ids = ${data.selected_accessory_product_ids}::bigint[],
      device_side = ${data.device_side},
      device_brand = ${data.device_brand},
      device_model = ${data.device_model},
      right_device_code = ${data.right_device_code},
      left_device_code = ${data.left_device_code},
      accessory_codes = ${data.accessory_codes},
      factory_value_cents = ${data.factory_value_cents},
      patient_value_cents = ${data.patient_value_cents},
      arrival_date = ${data.arrival_date},
      adaptation_date = ${data.adaptation_date},
      notes = ${data.notes}
    where id = ${id}
    returning *
  `;

  if (!row) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  return NextResponse.json({ row });
}
