import { redirect } from "next/navigation";
import { auth, emailSignInEnabled } from "@/lib/auth";
import { signUpAllowed } from "@/actions/account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/tonight");

  const gate = await signUpAllowed();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Night study
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          NOTEX
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{gate.allowed && !gate.needsCode ? "Set up your account" : "Sign in"}</CardTitle>
          <CardDescription>
            {gate.allowed && !gate.needsCode
              ? "This instance has no accounts yet, so the first one is yours."
              : "Your schedule, notes and course files."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm
            emailLinkEnabled={emailSignInEnabled}
            signUpOpen={gate.allowed}
            needsCode={gate.needsCode}
          />
        </CardContent>
      </Card>
    </main>
  );
}
