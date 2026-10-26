import { useLayoutEffect, useRef, useState } from 'react';

// The width of an element in CSS pixels, measured before the first paint and kept current.
// `fallback` is used until measured (and on the server, where nothing is measured).
export function useWidth(fallback = 0) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
