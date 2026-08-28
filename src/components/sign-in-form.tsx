"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { createAccount } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignInForm({
  emailLinkEnabled,
  signUpOpen,
  needsCode,
}: {
  emailLinkEnabled: boolean;
  signUpOpen: boolean;
  needsCode: boolean;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      if (mode === "sign-up") {
        const res = await createAccount({ email, password, code });
        setMessage(res.message);
        if (res.ok) setMode("sign-in");
        return;
      }

      const res = await signIn("password", { email, password, redirect: false });
      if (res?.error) {
        setMessage("That email and password do not match an account.");
        return;
      }
      window.location.href = "/tonight";
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={mode === "sign-up" ? "at least 10 characters" : ""}
        />
      </div>

      {mode === "sign-up" && needsCode ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Invite code</Label>
          <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      ) : null}

      <Button onClick={submit} disabled={pending}>
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </Button>

      {message ? <p className="text-sm text-[var(--muted-foreground)]">{message}</p> : null}

      {signUpOpen ? (
        <button
          type="button"
          className="text-sm text-[var(--muted-foreground)] underline-offset-4 hover:underline"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setMessage(null);
          }}
        >
          {mode === "sign-in" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      ) : null}

      {emailLinkEnabled ? (
        <div className="border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-sm text-[var(--muted-foreground)]">
            Or get a one-time link by email instead.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending || !email}
            onClick={() =>
              startTransition(async () => {
                setMessage(null);
                await signIn("nodemailer", { email, callbackUrl: "/tonight" });
              })
            }
          >
            Email me a link
          </Button>
        </div>
      ) : null}
    </div>
  );
}
