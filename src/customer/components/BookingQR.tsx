import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function BookingQR({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, { errorCorrectionLevel: "M", margin: 2, width: 640, color: { dark: "#2a1f16", light: "#fdfaf3" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [value]);
  return (
    <div className="mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-2xl bg-[#fdfaf3] p-4 shadow-sm ring-1 ring-border">
      {dataUrl ? (
        <img src={dataUrl} alt="Booking QR code" className="h-full w-full" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
      )}
    </div>
  );
}