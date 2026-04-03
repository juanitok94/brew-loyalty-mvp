"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { STAMPS_REQUIRED } from "@/lib/constants";

type CustomerData = {
  phone: string;
  stamps: number;
  lastVisit: string;
  redeemed: number;
};

const TOTAL = STAMPS_REQUIRED;

function StampCircle({ filled, index }: { filled: boolean; index: number }) {
  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${
        filled ? "stamp-pop" : ""
      }`}
      style={{
        background: filled ? "var(--stamp-filled)" : "var(--stamp-empty)",
        color: filled ? "#fff" : "var(--brown-light)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      {filled ? "☕" : ""}
    </div>
  );
}

function CardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawPhone = searchParams.get("phone") ?? "";

  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrCodeSrc, setQrCodeSrc] = useState("");

  useEffect(() => {
    if (!rawPhone) {
      router.replace("/");
      return;
    }
    fetch(`/api/stamps?phone=${encodeURIComponent(rawPhone)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load your card. Please try again.");
        setLoading(false);
      });
  }, [rawPhone, router]);

  useEffect(() => {
    if (!data?.phone) {
      setQrCodeSrc("");
      return;
    }

    QRCode.toDataURL(data.phone, {
      margin: 1,
      width: 192,
      color: {
        dark: "#6B4F36",
        light: "#FFFFFF",
      },
    })
      .then(setQrCodeSrc)
      .catch(() => setQrCodeSrc(""));
  }, [data?.phone]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--brown-light)" }}>Loading your card...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-red-600">{error || "No data found."}</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm underline"
          style={{ color: "var(--brown)" }}
        >
          Go back
        </button>
      </div>
    );
  }

  const isReady = data.stamps >= TOTAL;
  const displayPhone = rawPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl mb-3"
            style={{ background: "var(--brown)", color: "#fff" }}
          >
            ☕
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--brown-dark)" }}>
            Odds Cafe
          </h1>
          <p className="text-sm" style={{ color: "var(--brown-light)" }}>
            {displayPhone}
          </p>
        </div>

        {/* Reward Banner */}
        {isReady ? (
          <div
            className="rounded-2xl p-5 text-center space-y-2 celebrate"
            style={{ background: "var(--brown)", color: "#fff" }}
          >
            <div className="text-4xl">🎉</div>
            <p className="text-xl font-bold">Free drink ready!</p>
            <p className="text-sm opacity-90">Show this to your barista to redeem</p>
          </div>
        ) : (
          <div
            className="rounded-2xl p-4 text-center"
            style={{ background: "var(--cream)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--brown-light)" }}>
              {TOTAL - data.stamps} more {TOTAL - data.stamps === 1 ? "coffee" : "coffees"} until
              your free drink
            </p>
          </div>
        )}

        {/* Stamp Grid */}
        <div
          className="rounded-2xl p-6"
          style={{ background: isReady ? "#FFF9F0" : "#fff", border: "1.5px solid var(--stamp-empty)" }}
        >
          <div className="grid grid-cols-4 gap-3 justify-items-center">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <StampCircle key={i} filled={i < data.stamps} index={i} />
            ))}
          </div>
          <p className="text-center text-xs mt-4" style={{ color: "var(--brown-light)" }}>
            {data.stamps} / {TOTAL} stamps
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: "var(--cream)" }}
          >
            <p className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>
              {data.stamps}
            </p>
            <p className="text-xs" style={{ color: "var(--brown-light)" }}>
              current stamps
            </p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: "var(--cream)" }}
          >
            <p className="text-xl font-bold" style={{ color: "var(--brown-dark)" }}>
              {data.redeemed}
            </p>
            <p className="text-xs" style={{ color: "var(--brown-light)" }}>
              free drinks earned
            </p>
          </div>
        </div>

        <p className="text-center text-xs" style={{ color: "var(--stamp-empty)" }}>
          Last visit: {data.lastVisit}
        </p>

        {qrCodeSrc && (
          <div
            className="rounded-2xl p-5 text-center space-y-3"
            style={{ background: "#fff", border: "1.5px solid var(--stamp-empty)" }}
          >
            <img
              src={qrCodeSrc}
              alt={`QR code for ${data.phone}`}
              className="mx-auto rounded-xl"
              width={192}
              height={192}
            />
            <p className="text-sm font-medium" style={{ color: "var(--brown-light)" }}>
              Show this at the counter
            </p>
          </div>
        )}

        <button
          onClick={() => router.push("/")}
          className="w-full text-sm underline"
          style={{ color: "var(--brown-light)" }}
        >
          ← Back
        </button>
      </div>
    </main>
  );
}

export default function CardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: "var(--brown-light)" }}>Loading...</p>
      </div>
    }>
      <CardContent />
    </Suspense>
  );
}
