import { useEffect, useState } from "react";

type Props = {
  urls: string[];
  alt?: string;
  className?: string;
  /** Auto-advance interval in ms. Set 0 to disable. */
  intervalMs?: number;
  showDots?: boolean;
  productLabel?: string | null;
};

export function ProductImageSlider({
  urls,
  alt = "",
  className = "",
  intervalMs = 3200,
  showDots = true,
  productLabel,
}: Props) {
  const images = urls.filter(Boolean);
  const [index, setIndex] = useState(0);
  const label = productLabel?.trim() || "";

  useEffect(() => {
    setIndex(0);
  }, [images.join("|")]);

  useEffect(() => {
    if (images.length <= 1 || !intervalMs) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [images.length, intervalMs]);

  if (images.length === 0) {
    return (
      <div className={`relative bg-muted ${className}`}>
        {label ? (
          <span className="absolute left-2 top-2 z-20 max-w-[70%] truncate rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {images.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={i === index ? alt : ""}
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {label ? (
        <span className="pointer-events-none absolute left-2 top-2 z-20 max-w-[70%] truncate rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md">
          {label}
        </span>
      ) : null}

      {showDots && images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Image ${i + 1}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-white" : "w-1.5 bg-white/55"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
