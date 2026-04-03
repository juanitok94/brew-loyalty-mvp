import { NextRequest, NextResponse } from "next/server";
import { getCustomer, upsertCustomer, normalizePhone } from "@/lib/stamps";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }
  const normalized = normalizePhone(phone);
  const customer = await upsertCustomer(normalized);
  return NextResponse.json({ phone: normalized, ...customer });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone } = body;
  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }
  const normalized = normalizePhone(phone);
  const customer = await upsertCustomer(normalized);
  return NextResponse.json({ phone: normalized, ...customer });
}
