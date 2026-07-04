"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  maxFontSize?: number;
  minFontSize?: number;
  className?: string;
}

export default function AutoFitText({
  text,
  maxFontSize = 30,
  minFontSize = 14,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef      = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const container = containerRef.current;
    const textEl    = textRef.current;
    if (!container || !textEl) return;

    const fit = () => {
      let size = maxFontSize;
      textEl.style.fontSize = `${size}px`;
      while (textEl.scrollWidth > container.clientWidth && size > minFontSize) {
        size -= 1;
        textEl.style.fontSize = `${size}px`;
      }
      setFontSize(size);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [text, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap font-bold ${className}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {text}
      </span>
    </div>
  );
}
