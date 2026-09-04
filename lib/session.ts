import "server-only";

import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db, playerStats, sessions, users, type User } from "@/db";
import { hueFromString } from "@/lib/table-config";

const COOKIE_NAME = "fp_session";
const SESSION_TTL_DAYS = 90;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return slug || "player";
}

export function normaliseDisplayName(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "Guest";
  return value.slice(0, 24);
}

/**
 * Resolves the signed-in player from the session cookie. Safe to call while
 * rendering: it only reads cookies, never writes them.
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0]?.user ?? null;
}

/**
 * Creates a guest player and issues a session cookie.
 *
 * Only callable from a Server Action or Route Handler -- writing a cookie
 * during a render is not allowed.
 */
export async function createGuestSession(displayName: string): Promise<User> {
  const base = slugify(displayName);

  let created: User | undefined;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const suffix = Math.floor(Math.random() * 1_000_000)
      .toString(36)
      .padStart(4, "0");
    const username = `${base}-${suffix}`;

    const inserted = await db
      .insert(users)
      .values({
        username,
        displayName,
        avatarHue: hueFromString(username),
        isGuest: true,
      })
      .onConflictDoNothing({ target: users.username })
      .returning();

    created = inserted[0];
  }

  if (!created) {
    throw new Error("Could not allocate a username; please try again");
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await Promise.all([
    db.insert(sessions).values({ token, userId: created.id, expiresAt }),
    db.insert(playerStats).values({ userId: created.id }).onConflictDoNothing(),
  ]);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return created;
}

/** The current player, creating a guest session if there is not one yet. */
export async function requireUser(displayName = "Guest"): Promise<User> {
  return (await getCurrentUser()) ?? (await createGuestSession(displayName));
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
    store.delete(COOKIE_NAME);
  }
}
