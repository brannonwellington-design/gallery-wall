import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicAddress, readCapped, safeFetch } from "@/lib/server/safeFetch";

describe("isPublicAddress", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.5.5", "192.168.1.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "0.0.0.0"])(
    "blocks %s",
    (ip) => expect(isPublicAddress(ip)).toBe(false),
  );
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700::1111"])("allows %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );
});

describe("safeFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://0x7f000001/",
    "file:///etc/passwd",
    "http://user:pw@example.com/",
    "http://example.com:8080/",
  ])("refuses %s", async (url) => {
    await expect(safeFetch(url)).rejects.toThrow();
  });

  it("re-checks redirect targets", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (u: URL) => {
      calls.push(String(u));
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } });
    });
    await expect(safeFetch("https://93.184.215.14/")).rejects.toThrow(/isn’t reachable/);
    expect(calls).toEqual(["https://93.184.215.14/"]);
  });

  it("caps response bodies", async () => {
    const res = new Response("x".repeat(5000));
    await expect(readCapped(res, 1000)).rejects.toThrow(/too large/);
  });
});
