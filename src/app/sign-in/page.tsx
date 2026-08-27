import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/tonight");
  const { sent } = await searchParams;

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
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {sent
              ? "Check your inbox. The link signs you in and expires in 24 hours."
              : "You get a one-time link by email. No password to remember at 3 am."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            action={async (formData: FormData) => {
              "use server";
              await signIn("nodemailer", {
                email: String(formData.get("email") ?? ""),
                redirectTo: "/tonight",
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
            </div>
            <Button type="submit">Send me a link</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
