// Anonymous per-device owner id. Persisted in localStorage so that
// lab reports and prediction history rows are grouped per browser.
// This is NOT a security boundary — server functions read owner_id
// from the payload; without real auth, anyone with the id sees the rows.

const KEY = "cycloscope.owner_id.v1";

function randomUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (older browsers): RFC4122 v4 shim.
  const buf = new Uint8Array(16);
  (crypto as Crypto).getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const h = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getOwnerId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
