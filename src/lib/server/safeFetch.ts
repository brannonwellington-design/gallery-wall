import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Outbound fetch for user-supplied URLs (product pages, product images).
// Guards against server-side request forgery: only http(s) on default
// ports, every hop's hostname must resolve to public addresses, redirects
// are followed manually so each hop is re-checked, and bodies are capped.
//
// Known gap: the hostname is resolved here and again by fetch(), so a
// DNS-rebinding attacker could still race the two lookups. Closing that
// fully needs a pinned-IP agent; the public-address check stops the
// straightforward cases (localhost, 169.254.169.254, private ranges).

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6) {
    const lower = address.toLowerCase();
    // IPv4-mapped (::ffff:a.b.c.d) — judge by the embedded IPv4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return !blocked.check(mapped[1], "ipv4");
    if (lower.startsWith("::ffff:")) return false;
    return !blocked.check(lower, "ipv6");
  }
  return false;
}

export class UnsafeUrlError extends Error {}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That doesn’t look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("URL must start with http:// or https://");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials aren’t allowed.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Only standard web ports are allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("That address isn’t reachable from here.");
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true }).catch(() => {
        throw new UnsafeUrlError(`Couldn’t find ${host}.`);
      });
  if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
    throw new UnsafeUrlError("That address isn’t reachable from here.");
  }
  return url;
}

type SafeFetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
};

/**
 * fetch() for untrusted URLs. Returns the final response; read its body with
 * readCapped() rather than res.text()/arrayBuffer() so size limits hold.
 */
export async function safeFetch(
  rawUrl: string,
  { headers, timeoutMs = 15000, maxRedirects = 5 }: SafeFetchOptions = {},
): Promise<{ res: Response; url: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertSafeUrl(current);
    const res = await fetch(url, { headers, redirect: "manual", signal });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!location) return { res, url: url.toString() };
      current = new URL(location, url).toString();
      continue;
    }
    return { res, url: url.toString() };
  }
  throw new UnsafeUrlError("Too many redirects.");
}

export class BodyTooLargeError extends Error {}

/** Read a response body, aborting once it exceeds maxBytes. */
export async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => {});
    throw new BodyTooLargeError("Response is too large.");
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError("Response is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
