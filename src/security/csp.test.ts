import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "./csp";

const EXPECTED_POLICY =
  "default-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; media-src 'none'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; font-src 'self'";

describe("production CSP", () => {
  it("matches the exact reviewed policy string", () => {
    expect(CONTENT_SECURITY_POLICY).toBe(EXPECTED_POLICY);
  });

  it("blocks every network connection", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
  });

  it("blocks form, base, object, frame, worker and media sinks", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("worker-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("media-src 'none'");
  });

  it("does not allow inline styles", () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-inline");
  });
});
