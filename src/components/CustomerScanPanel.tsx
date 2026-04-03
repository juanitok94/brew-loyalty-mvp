"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onScan: (phone: string) => void;
};

export default function CustomerScanPanel({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Try BarcodeDetector if available
        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ["qr_code"],
          });

          const scan = async () => {
            if (!videoRef.current) return;

            const video = videoRef.current;

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              const barcodes = await detector.detect(video);

              if (barcodes.length > 0) {
                const value = barcodes[0].rawValue;
                if (value) {
                  onScan(value);
                }
              }
            }

            requestAnimationFrame(scan);
          };

          scan();
        }
      } catch (err) {
        setError("Camera access denied");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onScan]);

  return (
    <div style={{ textAlign: "center" }}>
      <h2>Scan Customer</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "100%", maxWidth: 400 }}
      />

      <p style={{ marginTop: 10 }}>Point camera at customer QR code</p>
    </div>
  );
}