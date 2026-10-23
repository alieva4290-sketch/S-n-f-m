import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, profilesTable, classMembershipsTable } from "@workspace/db";

export function authenticatedUserId(
  req: Request,
  res: Response,
): string | null {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Giriş yapman gerekiyor." });
    return null;
  }
  return userId;
}

export async function ensureProfile(userId: string) {
  const existing = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  await db
    .insert(profilesTable)
    .values({ id: userId })
    .onConflictDoNothing();

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, userId))
    .limit(1);
  if (!profile) throw new Error("Kullanıcı profili oluşturulamadı.");
  return profile;
}

export async function isActiveMember(classId: number, userId: string) {
  const [membership] = await db
    .select({ id: classMembershipsTable.id })
    .from(classMembershipsTable)
    .where(
      and(
        eq(classMembershipsTable.classId, classId),
        eq(classMembershipsTable.userId, userId),
        eq(classMembershipsTable.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(membership);
}
