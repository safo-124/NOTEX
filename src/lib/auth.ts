import { redirect } from "next/navigation";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

/** Magic links only exist once there is an SMTP server to send them. */
export const emailSignInEnabled = Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials require JWT sessions; the adapter still stores the users.
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in?sent=1", error: "/sign-in" },
  providers: [
    Credentials({
      id: "password",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          // Spend the same time as a real check so a missing account and a
          // wrong password are not distinguishable by timing.
          await verifyPassword(password, "scrypt$00$00");
          return null;
        }
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    ...(emailSignInEnabled
      ? [
          Nodemailer({
            server: {
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT ?? 587),
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
            },
            from: process.env.MAIL_FROM,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/**
 * Next renders a layout and its page in PARALLEL, so a redirect in the layout
 * does not stop the page from running. Every page therefore checks for itself.
 */
export async function currentUserId() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user.id;
}

/** Throws when there is no session, so server actions can assume a user. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  return { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? "" };
}
