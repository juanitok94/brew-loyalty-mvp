"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CustomerScanPanel from "@/components/CustomerScanPanel";
import { STAMPS_REQUIRED } from "@/lib/constants";

type CustomerData = {
  phone: string;
  stamps: number;
  lastVisit: string;
  redeemed: number;
};

const TOTAL = STAMPS_REQUIRED;

export default function AdminCustomerPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const pw = sessionStorage.getItem("adminPw");
    if (!pw) {
      router.replace("/admin");
      return;
    }
    setPassword(pw);
  }, [router]);

  function formatDisplay(digits: string) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneInput(formatDisplay(raw));
    setError("");
    setMessage("");
    setCustomer(null);
  }

  async function loadCustomerByDigits(digits: string) {
    if (digits.length !== 10) {
      setError("Enter a valid 10-digit number.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setCustomer(null);

    try {
      const res = await fetch("/api/admin/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, password }),
      });

      if (res.status === 401) {
        router.replace("/admin");
        return;
      }

      if (res.status === 404) {
        const createRes = await fetch("/api/stamps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: digits }),
        });
        const data = await createRes.json();
        setCustomer(data);
        setMessage("New customer created.");
      } else {
        const data = await res.json();
        setCustomer(data);
      }
    } catch {
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function lookupCustomer(e: React.FormEvent) {
    e.preventDefault();
    await loadCustomerByDigits(phoneInput.replace(/\D/g, ""));
  }

  async function handleScan(scannedValue: string) {
    const digits = scannedValue.replace(/\D/g, "").slice(-10);
    setPhoneInput(formatDisplay(digits));
    setShowScanner(false);
    await loadCustomerByDigits(digits);
  }

  async function addStamp() {
    if (!customer) return;
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer.phone.replace(/\D/g, ""), password }),
      });
      if (res.status === 401) { router.replace("/admin"); return; }
      const data = await res.json();
      setCustomer(data);
      setMessage(data.stamps >= TOTAL ? "Stamp added! Reward unlocked!" : "Stamp added!");
    } catch {
      setError("Failed to add stamp.");
    } finally {
      setActionLoading(false);
    }
  }

  async function redeemReward() {
    if (!customer) return;
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: customer.phone.replace(/\D/g, ""), password }),
      });
      if (res.status === 401) { router.replace("/admin"); return; }
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Redeem failed.");
        return;
      }
      const data = await res.json();
      setCustomer(data);
      setMessage("Reward redeemed! Card reset to 0 stamps.");
    } catch {
      setError("Failed to redeem.");
    } finally {
      setActionLoading(false);
    }
  }

  const isReady = customer && customer.stamps >= TOTAL;
  const displayPhone = customer
    ? customer.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
    : "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { sessionStorage.removeItem("adminPw"); router.push("/admin"); }}
            className="text-sm"
            style={{ color: "var(--brown-light)" }}
          >
            ← Logout
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>
            Odds Cafe Dashboard
          </h1>
        </div>

        {/* Quick links */}
        <div className="flex gap-2">
          <a
            href="/qr"
            target="_blank"
            className="flex-1 py-2 rounded-xl text-center text-sm font-medium border"
            style={{ borderColor: "var(--stamp-empty)", color: "var(--brown)" }}
          >
            View QR Code
          </a>
          <button
            type="button"
            onClick={() => setShowScanner((current) => !current)}
            className="flex-1 py-2 rounded-xl text-center text-sm font-medium border"
            style={{ borderColor: "var(--stamp-empty)", color: "var(--brown)" }}
          >
            {showScanner ? "Hide Scanner" : "Scan Customer"}
          </button>
        </div>

        {showScanner && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "#fff", border: "1.5px solid var(--stamp-empty)" }}
          >
            <CustomerScanPanel onScan={handleScan} />
          </div>
        )}

        {/* Lookup Form */}
        <form onSubmit={lookupCustomer} className="space-y-3">
          <label
            className="block text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            Customer phone number
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="(828) 555-0123"
              value={phoneInput}
              onChange={handlePhoneChange}
              className="flex-1 px-4 py-3 rounded-xl border text-base outline-none"
              style={{
                borderColor: error ? "#dc2626" : "var(--stamp-empty)",
                background: "#fff",
                color: "var(--foreground)",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--brown)" }}
            >
              {loading ? "..." : "Look Up"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && (
            <p className="text-sm font-medium" style={{ color: "#16a34a" }}>
              {message}
            </p>
          )}
        </form>

        {/* Customer Card */}
        {customer && (
          <div
            className="rounded-2xl p-5 space-y-5"
            style={{ background: "#fff", border: "1.5px solid var(--stamp-empty)" }}
          >
            {/* Customer Info */}
            <div className="space-y-1">
              <p className="font-semibold" style={{ color: "var(--brown-dark)" }}>
                {displayPhone}
              </p>
              <p className="text-xs" style={{ color: "var(--brown-light)" }}>
                Last visit: {customer.lastVisit} · {customer.redeemed} free drinks earned
              </p>
            </div>

            {/* Reward Banner */}
            {isReady && (
              <div
                className="rounded-xl p-3 text-center"
                style={{ background: "var(--brown)", color: "#fff" }}
              >
                <p className="font-semibold">🎉 Free drink ready to redeem!</p>
              </div>
            )}

            {/* Stamp Grid */}
            <div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full aspect-square rounded-full flex items-center justify-center text-base"
                    style={{
                      background: i < customer.stamps ? "var(--stamp-filled)" : "var(--stamp-empty)",
                      color: i < customer.stamps ? "#fff" : "var(--brown-light)",
                    }}
                  >
                    {i < customer.stamps ? "☕" : ""}
                  </div>
                ))}
              </div>
              <p className="text-xs text-center mt-2" style={{ color: "var(--brown-light)" }}>
                {customer.stamps} / {TOTAL} stamps
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={addStamp}
                disabled={actionLoading || customer.stamps >= TOTAL}
                className="flex-1 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-40"
                style={{ background: "var(--brown)" }}
              >
                {actionLoading ? "..." : "+ Add Stamp"}
              </button>
              {isReady && (
                <button
                  onClick={redeemReward}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                  style={{ background: "var(--cream)", color: "var(--brown-dark)" }}
                >
                  {actionLoading ? "..." : "Redeem Reward"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
