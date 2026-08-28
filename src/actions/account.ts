"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordProblem } from "@/lib/password";

const signUpInput = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().max(120).optional(),
  code: z.string().optional(),
});

/**
 * The first account on a fresh instance is free to create. After that, sign-up
 * needs SIGNUP_CODE to be set and matched, so a public URL does not mean a
 * public sign-up form.
 */
export async function signUpAllowed() {
  const count = await prisma.user.count();
  if (count === 0) return { allowed: true, needsCode: false };
  if (process.env.SIGNUP_CODE) return { allowed: true, needsCode: true };
  return { allowed: false, needsCode: false };
}

export async function createAccount(input: z.input<typeof signUpInput>) {
  const data = signUpInput.parse(input);
  const email = data.email.trim().toLowerCase();

  const gate = await signUpAllowed();
  if (!gate.allowed) return { ok: false, message: "Sign-up is closed on this instance." };
  if (gate.needsCode && data.code !== process.env.SIGNUP_CODE) {
    return { ok: false, message: "That invite code is not right." };
  }

  const problem = passwordProblem(data.password);
  if (problem) return { ok: false, message: problem };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (existing?.passwordHash) return { ok: false, message: "That email already has an account." };

  const passwordHash = await hashPassword(data.password);

  try {
    if (existing) {
      // Account created earlier by a magic link: give it a password.
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    } else {
      await prisma.user.create({
        data: { email, passwordHash, name: data.name?.trim() || null, emailVerified: new Date() },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("passwordHash") || message.includes("password_hash")) {
      return { ok: false, message: "The database is missing the password column. Run npm run db:migrate." };
    }
    return { ok: false, message: `Could not create the account: ${message.split("\n")[0]}` };
  }

  return { ok: true, message: "Account ready. Sign in below." };
}
