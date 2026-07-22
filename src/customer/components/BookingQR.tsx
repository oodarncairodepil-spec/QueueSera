import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  /** Pixel size of the QR bitmap (scannable mini ~96–128). */
  size?: number;
  className?: string;
  alt?: string;
  onClick?: () => void;
};

export function BookingQR({
  value,
  size = 640,
  className,
  alt = "Booking QR code",
  onClick,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#2a1f16", light: "#fdfaf3" },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [value, size]);

  const content = dataUrl ? (
    <img src={dataUrl} alt={alt} className="h-full w-full" />
  ) : (
    <div className="h-full w-full animate-pulse rounded bg-muted" />
  );

  if (className) {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          aria-label={`Enlarge ${alt}`}
          className={`${className} cursor-pointer transition-transform active:scale-[0.98]`}
        >
          {content}
        </button>
      );
    }
    return <div className={className}>{content}</div>;
  }

  const shell = (
    <div className="mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-2xl bg-[#fdfaf3] p-4 shadow-sm ring-1 ring-border">
      {content}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Enlarge ${alt}`}
        className="block w-full cursor-pointer transition-transform active:scale-[0.99]"
      >
        {shell}
      </button>
    );
  }

  return shell;
}

type FullscreenProps = {
  value: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export function FullscreenQR({ value, title, subtitle, onClose }: FullscreenProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "QR code"}
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-2 text-white">
        <div className="min-w-0">
          {title && <div className="truncate text-sm font-semibold">{title}</div>}
          {subtitle && <div className="truncate font-mono text-xs opacity-80">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium"
        >
          Close
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-sm rounded-2xl bg-[#fdfaf3] p-5 shadow-lg">
          <BookingQR value={value} size={720} alt={title ?? "QR code"} />
        </div>
      </div>
      <p className="pb-2 text-center text-xs text-white/70">Tap outside to close</p>
    </div>
  );
}
