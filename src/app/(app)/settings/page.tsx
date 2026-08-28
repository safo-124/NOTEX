import { currentUserId, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAlertPrefs } from "@/lib/queries";
import { channels } from "@/alerts";
import { PageHead } from "@/components/page-head";
import { SettingsForm } from "@/components/settings-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await currentUserId();
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, email: true },
  });
  const prefs = await getAlertPrefs(userId);

  return (
    <>
      <PageHead eyebrow={me?.email ?? ""} title="Alerts and settings" action={<ThemeToggle />} />

      <SettingsForm
        initial={{
          enabled: prefs?.enabled ?? true,
          leadMinutes: prefs?.leadMinutes ?? 10,
          email: prefs?.channels?.email ?? true,
          telegram: prefs?.channels?.telegram ?? false,
          whatsapp: prefs?.channels?.whatsapp ?? false,
          emailTo: prefs?.emailTo ?? "",
          telegramChatId: prefs?.telegramChatId ?? "",
          whatsappTo: prefs?.whatsappTo ?? "",
          dailySummary: prefs?.dailySummary ?? true,
          summaryHour: prefs?.summaryHour ?? 19,
          timezone: me?.timezone ?? "Europe/Helsinki",
        }}
        configured={{
          email: channels.email.configured(),
          telegram: channels.telegram.configured(),
          whatsapp: channels.whatsapp.configured(),
        }}
      />

      <form
        className="mt-8 border-t border-[var(--border)] pt-5"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <Button variant="ghost" type="submit" className="text-[var(--muted-foreground)]">
          Sign out
        </Button>
      </form>
    </>
  );
}
