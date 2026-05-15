"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string;
  label: string;
}

export function AnimatedCounter({ value, label }: AnimatedCounterProps) {
  const [displayed, setDisplayed] = useState("0");
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          animateValue(value);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasAnimated, value]);

  function animateValue(target: string) {
    const num = parseInt(target);
    if (isNaN(num)) {
      // Non-numeric values like "Auto" or "RAG" — type them out
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(target.slice(0, i));
        if (i >= target.length) clearInterval(interval);
      }, 80);
      return;
    }

    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += num / steps;
      if (current >= num) {
        setDisplayed(String(num));
        clearInterval(interval);
      } else {
        setDisplayed(String(Math.floor(current)));
      }
    }, stepTime);
  }

  return (
    <div ref={ref} className="flex flex-col items-center py-8 md:py-10">
      <span className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight tabular-nums">
        {displayed}
      </span>
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
        {label}
      </span>
    </div>
  );
}
