import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureDefaultPlan } from "@/lib/seed";
import { DesktopNav, MobileNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  await ensureDefaultPlan(session.user.id);

  return (
    <div className="flex min-h-dvh">
      <DesktopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12">{children}</main>
      <MobileNav />
    </div>
  );
}
