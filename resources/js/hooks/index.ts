// Shared React hooks extracted from App.tsx. Behavior unchanged.
import { useEffect, useRef, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useTypewriter(text: string, speedMs = 22, enabled = true, ready = true) {
  const [out, setOut] = useState(enabled ? "" : text);
  useEffect(() => {
    if (!enabled) {
      setOut(text);
      return;
    }
    if (!ready) {
      setOut("");
      return;
    }
    setOut("");
    let index = 0;
    const id = window.setInterval(() => {
      index += 1;
      setOut(text.slice(0, index));
      if (index >= text.length) window.clearInterval(id);
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, speedMs, enabled, ready]);
  return out;
}

// "Virtualization" via window slicing: for very large lists we only render the
// rows currently inside the scroll viewport plus a small buffer.
export function useVirtualWindow<T>(
  items: T[],
  rowHeight: number,
  overscan = 8,
): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  visible: { item: T; index: number }[];
  totalHeight: number;
  offsetY: number;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handleScroll = () => setScrollTop(node.scrollTop);
    const handleResize = () => setViewport(node.clientHeight);
    handleResize();
    node.addEventListener("scroll", handleScroll, { passive: true });
    const ro = new ResizeObserver(handleResize);
    ro.observe(node);
    return () => {
      node.removeEventListener("scroll", handleScroll);
      ro.disconnect();
    };
  }, []);

  const total = items.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(total, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  const visible = items.slice(startIndex, endIndex).map((item, i) => ({
    item,
    index: startIndex + i,
  }));

  return {
    containerRef,
    visible,
    totalHeight: total * rowHeight,
    offsetY: startIndex * rowHeight,
  };
}
