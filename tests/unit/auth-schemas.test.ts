import { describe, expect, it } from "vitest";
import {
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  fieldErrorsOf,
} from "@/features/auth/schemas";

describe("signUpSchema", () => {
  const valid = { email: " Ada@Example.com ", password: "long-enough", displayName: "" };

  it("trims email and treats an empty name as absent", () => {
    const result = signUpSchema.parse(valid);
    expect(result.email).toBe("Ada@Example.com");
    expect(result.displayName).toBeUndefined();
  });

  it("requires at least 8 characters", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrorsOf(result.error).password).toBeDefined();
  });

  it("rejects passwords over bcrypt's 72-byte limit, counting bytes not characters", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
    // 25 three-byte characters = 75 bytes.
    expect(signUpSchema.safeParse({ ...valid, password: "€".repeat(25) }).success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("requires both fields", () => {
    const result = signInSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsOf(result.error);
      expect(errors.email).toBeDefined();
      expect(errors.password).toBeDefined();
    }
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "new-password-1",
      confirmPassword: "new-password-2",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrorsOf(result.error).confirmPassword).toBeDefined();
  });
});
