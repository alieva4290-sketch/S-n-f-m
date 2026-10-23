import { Router, type IRouter } from "express";
import { and, eq, ne } from "drizzle-orm";
import {
  GetMyProfileResponse,
  SearchUsersQueryParams,
  SearchUsersResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { db, profilesTable } from "@workspace/db";
import { authenticatedUserId, ensureProfile } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const profile = await ensureProfile(userId);
  res.json(
    GetMyProfileResponse.parse({
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      city: profile.city,
      occupation: profile.occupation,
      discoverable: profile.discoverable,
    }),
  );
});

router.patch("/me", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Profil bilgilerini kontrol et." });
    return;
  }
  await ensureProfile(userId);
  const [profile] = await db
    .update(profilesTable)
    .set(parsed.data)
    .where(eq(profilesTable.id, userId))
    .returning();
  res.json(
    UpdateMyProfileResponse.parse({
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      city: profile.city,
      occupation: profile.occupation,
      discoverable: profile.discoverable,
    }),
  );
});

function normalizeTurkish(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

router.get("/search/users", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = SearchUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Arama için en az iki harf gir." });
    return;
  }
  const profiles = await db
    .select({
      id: profilesTable.id,
      displayName: profilesTable.displayName,
      bio: profilesTable.bio,
      city: profilesTable.city,
      occupation: profilesTable.occupation,
    })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.discoverable, true),
        ne(profilesTable.id, userId),
      ),
    )
    .limit(200);
  const term = normalizeTurkish(parsed.data.q.trim());
  const results = profiles
    .filter((profile) => normalizeTurkish(profile.displayName).includes(term))
    .slice(0, 50)
    .map((profile) => ({ ...profile, classLabel: null }));
  res.json(SearchUsersResponse.parse(results));
});

export default router;
