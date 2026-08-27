import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { seedDefaultPlan } from "@/actions/schedule";
import { DesktopNav, MobileNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  await seedDefaultPlan();

  return (
    <div className="flex min-h-dvh">
      <DesktopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12">{children}</main>
      <MobileNav />
    </div>
  );
}
