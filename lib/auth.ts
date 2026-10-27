import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { headers } from "next/headers";
import { prisma } from "./prisma";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Brak wymaganej zmiennej środowiskowej: ${name}`);
  }
  return value;
}

const secret = requireEnv("BETTER_AUTH_SECRET");
if (secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET musi mieć co najmniej 32 znaki.");
}

const baseURL = requireEnv("BETTER_AUTH_URL");
const githubClientId = requireEnv("GITHUB_CLIENT_ID");
const githubClientSecret = requireEnv("GITHUB_CLIENT_SECRET");

export const auth = betterAuth({
  secret,
  baseURL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    github: {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
      scope: ["read:user", "user:email"],
    },
  },
  session: {
    cookieCache: {
      enabled: false,
    },
  },
});

/**
 * Odczytuje i weryfikuje sesję w bazie danych na podstawie nagłówków bieżącego żądania.
 * Zwrócone session.user.id jest jedynym źródłem tożsamości właściciela na serwerze.
 */
export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}