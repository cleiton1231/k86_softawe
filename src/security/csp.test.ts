import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "./csp";

const EXPECTED_POLICY =
  "default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'";

describe("production CSP", () => {
  it("matches the exact reviewed policy string", () => {
    expect(CONTENT_SECURITY_POLICY).toBe(EXPECTED_POLICY);
  });

  it("blocks every network connection", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
  });
});
