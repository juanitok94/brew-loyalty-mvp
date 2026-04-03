import { NextRequest, NextResponse } from "next/server";
import { getCustomer, normalizePhone } from "@/lib/stamps";
import { verifyAdminPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, password } = body;

  if (!verifyAdminPassword(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  const customer = await getCustomer(normalized);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json({ phone: normalized, ...customer });
}
