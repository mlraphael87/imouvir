import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function monthRange(monthParam) {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearText, monthText] = (monthParam || fallback).split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mês inválido.");
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00Z`;
  return { start, end };
}

export async function GET(request) {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let range;

  try {
    range = monthRange(searchParams.get("month"));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const sql = getSql();
  const events = await sql`
    select *
    from (
      select
        id,
        patient_name,
        phone,
        city,
        state,
        status,
        device_model,
        factory_order_number,
        test_date as starts_at,
        to_char(test_date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') as starts_at_local,
        'test_date' as event_type
      from patients
      where test_date >= ${range.start}::timestamptz
        and test_date < ${range.end}::timestamptz

      union all

      select
        id,
        patient_name,
        phone,
        city,
        state,
        status,
        device_model,
        factory_order_number,
        adaptation_date as starts_at,
        to_char(adaptation_date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI') as starts_at_local,
        'adaptation_date' as event_type
      from patients
      where adaptation_date >= ${range.start}::timestamptz
        and adaptation_date < ${range.end}::timestamptz
    ) appointments
    order by starts_at asc, patient_name asc
  `;

  return NextResponse.json({ events });
}
