/** Lightweight analytics helper: forwards events to GA4 / Meta Pixel when present. */
type Params = Record<string, unknown>;

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };
    w.dataLayer?.push({ event, ...params });
    w.gtag?.("event", event, params);
    w.fbq?.("trackCustom", event, params);
  } catch {}
}

export function pageView(path: string) {
  track("page_view", { page_path: path });
}
