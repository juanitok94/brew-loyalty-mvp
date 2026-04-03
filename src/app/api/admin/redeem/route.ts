import { NextRequest, NextResponse } from "next/server";
import { redeemReward, normalizePhone } from "@/lib/stamps";
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
  const customer = await redeemReward(normalized);
  if (!customer) {
    return NextResponse.json({ error: "Not enough stamps to redeem" }, { status: 400 });
  }
  return NextResponse.json({ phone: normalized, ...customer });
}
