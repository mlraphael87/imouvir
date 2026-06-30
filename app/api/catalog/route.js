import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const sql = getSql();
  const products = await sql`
    select id, category, item_kind, description, code, unit_value_cents
    from catalog_products
    where active = true
    order by
      case when item_kind = 'device' then 0 else 1 end,
      category,
      description
  `;

  const paymentTerms = await sql`
    select id, terms, description, code
    from payment_terms
    where active = true
    order by source_row
  `;

  return NextResponse.json({ products, paymentTerms });
}
