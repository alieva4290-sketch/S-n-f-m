import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  sql,
} from "drizzle-orm";
import {
  ClassDetail,
  CreateClassBody,
  CreateClassPostBody,
  CreateClassPostParams,
  CreateClassPostResponse,
  CreateClassResponse,
  CreateCommentBody,
  CreateCommentParams,
  CreateCommentResponse,
  GetClassMembersParams,
  GetClassMembersResponse,
  GetClassParams,
  GetClassPostsParams,
  GetClassPostsResponse,
  GetClassResponse,
  GetDashboardResponse,
  GetInstitutionClassesParams,
  GetInstitutionClassesResponse,
  GetInstitutionsQueryParams,
  GetInstitutionsResponse,
  JoinClassParams,
  JoinClassResponse,
  SetPostReactionBody,
  SetPostReactionParams,
  SetPostReactionResponse,
} from "@workspace/api-zod";
import {
  classGroupsTable,
  classMembershipsTable,
  commentsTable,
  institutionsTable,
  postsTable,
  profilesTable,
  reactionsTable,
  db,
} from "@workspace/db";
import { authenticatedUserId, ensureProfile, isActiveMember } from "../lib/auth";

const router: IRouter = Router();

async function classRecord(classId: number, userId?: string) {
  const [group] = await db
    .select({
      id: classGroupsTable.id,
      institutionId: classGroupsTable.institutionId,
      institutionName: institutionsTable.name,
      city: institutionsTable.city,
      graduationYear: classGroupsTable.graduationYear,
      className: classGroupsTable.className,
      description: classGroupsTable.description,
      createdAt: classGroupsTable.createdAt,
      memberCount: count(classMembershipsTable.id),
    })
    .from(classGroupsTable)
    .innerJoin(
      institutionsTable,
      eq(classGroupsTable.institutionId, institutionsTable.id),
    )
    .leftJoin(
      classMembershipsTable,
      and(
        eq(classMembershipsTable.classId, classGroupsTable.id),
        eq(classMembershipsTable.status, "active"),
      ),
    )
    .where(eq(classGroupsTable.id, classId))
    .groupBy(classGroupsTable.id, institutionsTable.id)
    .limit(1);

  if (!group) return null;
  const isMember = userId
    ? await isActiveMember(classId, userId)
    : false;

  return {
    ...group,
    memberCount: Number(group.memberCount),
    isMember,
  };
}

router.get("/dashboard", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  await ensureProfile(userId);

  const classes = await db
    .select({
      id: classGroupsTable.id,
      institutionId: classGroupsTable.institutionId,
      institutionName: institutionsTable.name,
      city: institutionsTable.city,
      graduationYear: classGroupsTable.graduationYear,
      className: classGroupsTable.className,
      memberCount: sql<number>`(select count(*)::int from ${classMembershipsTable} where ${classMembershipsTable.classId} = ${classGroupsTable.id} and ${classMembershipsTable.status} = 'active')`,
    })
    .from(classMembershipsTable)
    .innerJoin(
      classGroupsTable,
      eq(classMembershipsTable.classId, classGroupsTable.id),
    )
    .innerJoin(
      institutionsTable,
      eq(classGroupsTable.institutionId, institutionsTable.id),
    )
    .where(
      and(
        eq(classMembershipsTable.userId, userId),
        eq(classMembershipsTable.status, "active"),
      ),
    )
    .orderBy(desc(classGroupsTable.graduationYear));

  const recentRows = classes.length
    ? await db
        .select({
          id: postsTable.id,
          classId: postsTable.classId,
          authorId: postsTable.authorId,
          authorName: profilesTable.displayName,
          content: postsTable.content,
          kind: postsTable.kind,
          createdAt: postsTable.createdAt,
          reactionCount: sql<number>`(select count(*)::int from ${reactionsTable} where ${reactionsTable.postId} = ${postsTable.id})`,
          commentCount: sql<number>`(select count(*)::int from ${commentsTable} where ${commentsTable.postId} = ${postsTable.id})`,
          reactedByMe: sql<boolean>`exists (select 1 from ${reactionsTable} where ${reactionsTable.postId} = ${postsTable.id} and ${reactionsTable.userId} = ${userId})`,
        })
        .from(postsTable)
        .innerJoin(profilesTable, eq(postsTable.authorId, profilesTable.id))
        .where(
          inArray(
            postsTable.classId,
            classes.map((group) => group.id),
          ),
        )
        .orderBy(desc(postsTable.createdAt))
        .limit(6)
    : [];

  const recentPosts = recentRows.map((post) => ({
    ...post,
    reactionCount: Number(post.reactionCount),
    commentCount: Number(post.commentCount),
    comments: [],
  }));
  const suggestedInstitutions = await db
    .select({
      id: institutionsTable.id,
      name: institutionsTable.name,
      city: institutionsTable.city,
      type: institutionsTable.type,
      campus: institutionsTable.campus,
      classCount: sql<number>`(select count(*)::int from ${classGroupsTable} where ${classGroupsTable.institutionId} = ${institutionsTable.id})`,
    })
    .from(institutionsTable)
    .orderBy(institutionsTable.name)
    .limit(4);

  res.json(
    GetDashboardResponse.parse({
      classes: classes.map((group) => ({
        ...group,
        memberCount: Number(group.memberCount),
        isMember: true,
      })),
      recentPosts,
      suggestedInstitutions: suggestedInstitutions.map((institution) => ({
        ...institution,
        classCount: Number(institution.classCount),
      })),
    }),
  );
});

router.get("/institutions", async (req, res): Promise<void> => {
  const parsed = GetInstitutionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Arama bilgileri geçersiz." });
    return;
  }

  const filters = [];
  if (parsed.data.q?.trim()) {
    const term = `%${parsed.data.q.trim().replace(/[%_]/g, "\\$&")}%`;
    filters.push(ilike(institutionsTable.name, term));
  }
  if (parsed.data.city?.trim()) {
    filters.push(ilike(institutionsTable.city, `%${parsed.data.city.trim()}%`));
  }
  if (parsed.data.type) {
    filters.push(eq(institutionsTable.type, parsed.data.type));
  }

  const rows = await db
    .select({
      id: institutionsTable.id,
      name: institutionsTable.name,
      city: institutionsTable.city,
      type: institutionsTable.type,
      campus: institutionsTable.campus,
      classCount: sql<number>`(select count(*)::int from ${classGroupsTable} where ${classGroupsTable.institutionId} = ${institutionsTable.id})`,
    })
    .from(institutionsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(institutionsTable.name)
    .limit(100);

  res.json(
    GetInstitutionsResponse.parse(
      rows.map((row) => ({ ...row, classCount: Number(row.classCount) })),
    ),
  );
});

router.get(
  "/institutions/:institutionId/classes",
  async (req, res): Promise<void> => {
    const parsed = GetInstitutionClassesParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Kurum numarası geçersiz." });
      return;
    }
    const userId = getAuth(req).userId;
    const rows = await db
      .select({
        id: classGroupsTable.id,
        institutionId: classGroupsTable.institutionId,
        institutionName: institutionsTable.name,
        city: institutionsTable.city,
        graduationYear: classGroupsTable.graduationYear,
        className: classGroupsTable.className,
        memberCount: count(classMembershipsTable.id),
        viewerMembershipId: sql<number | null>`max(case when ${classMembershipsTable.userId} = ${userId ?? ""} then ${classMembershipsTable.id} else null end)`,
      })
      .from(classGroupsTable)
      .innerJoin(
        institutionsTable,
        eq(classGroupsTable.institutionId, institutionsTable.id),
      )
      .leftJoin(
        classMembershipsTable,
        and(
          eq(classMembershipsTable.classId, classGroupsTable.id),
          eq(classMembershipsTable.status, "active"),
        ),
      )
      .where(eq(classGroupsTable.institutionId, parsed.data.institutionId))
      .groupBy(classGroupsTable.id, institutionsTable.id)
      .orderBy(desc(classGroupsTable.graduationYear), classGroupsTable.className);

    res.json(
      GetInstitutionClassesResponse.parse(
        rows.map(({ viewerMembershipId, memberCount, ...row }) => ({
          ...row,
          memberCount: Number(memberCount),
          isMember: Boolean(viewerMembershipId),
        })),
      ),
    );
  },
);

router.post("/classes", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Sınıf bilgilerini kontrol et." });
    return;
  }
  await ensureProfile(userId);

  const created = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(classGroupsTable)
      .values({
        ...parsed.data,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning();
    if (!group) return null;

    await tx
      .insert(classMembershipsTable)
      .values({ classId: group.id, userId, status: "active" })
      .onConflictDoNothing();
    return group;
  });

  if (!created) {
    res.status(409).json({ error: "Bu sınıf kaydı zaten oluşturulmuş." });
    return;
  }
  const details = await classRecord(created.id, userId);
  res
    .status(201)
    .json(
      CreateClassResponse.parse({
        ...details,
        description: details?.description ?? null,
        createdAt: created.createdAt,
      }),
    );
});

router.get("/classes/:classId", async (req, res): Promise<void> => {
  const parsed = GetClassParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Sınıf numarası geçersiz." });
    return;
  }
  const userId = getAuth(req).userId ?? undefined;
  const details = await classRecord(parsed.data.classId, userId);
  if (!details) {
    res.status(404).json({ error: "Sınıf bulunamadı." });
    return;
  }
  res.json(
    GetClassResponse.parse({
      ...details,
      description: details.description ?? null,
    }),
  );
});

router.post("/classes/:classId/join", async (req, res): Promise<void> => {
  const userId = authenticatedUserId(req, res);
  if (!userId) return;
  const parsed = JoinClassParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Sınıf numarası geçersiz." });
    return;
  }
  const [group] = await db
    .select({ id: classGroupsTable.id })
    .from(classGroupsTable)
    .where(eq(classGroupsTable.id, parsed.data.classId))
    .limit(1);
  if (!group) {
    res.status(404).json({ error: "Sınıf bulunamadı." });
    return;
  }

  await ensureProfile(userId);
  await db
    .insert(classMembershipsTable)
    .values({ classId: group.id, userId, status: "active" })
    .onConflictDoNothing();
  const [membership] = await db
    .select({ status: classMembershipsTable.status })
    .from(classMembershipsTable)
    .where(
      and(
        eq(classMembershipsTable.classId, group.id),
        eq(classMembershipsTable.userId, userId),
      ),
    )
    .limit(1);

  res.json(
    JoinClassResponse.parse({ status: membership?.status ?? "active" }),
  );
});

router.get(
  "/classes/:classId/members",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const parsed = GetClassMembersParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Sınıf numarası geçersiz." });
      return;
    }
    const [group] = await db
      .select({ id: classGroupsTable.id })
      .from(classGroupsTable)
      .where(eq(classGroupsTable.id, parsed.data.classId))
      .limit(1);
    if (!group) {
      res.status(404).json({ error: "Sınıf bulunamadı." });
      return;
    }
    if (!(await isActiveMember(group.id, userId))) {
      res.status(403).json({ error: "Bu sınıfın üyesi olmalısın." });
      return;
    }

    const members = await db
      .select({
        id: profilesTable.id,
        displayName: profilesTable.displayName,
        bio: profilesTable.bio,
        city: profilesTable.city,
        occupation: profilesTable.occupation,
      })
      .from(classMembershipsTable)
      .innerJoin(
        profilesTable,
        eq(classMembershipsTable.userId, profilesTable.id),
      )
      .where(
        and(
          eq(classMembershipsTable.classId, group.id),
          eq(classMembershipsTable.status, "active"),
        ),
      )
      .orderBy(profilesTable.displayName);
    res.json(GetClassMembersResponse.parse(members));
  },
);

router.get(
  "/classes/:classId/posts",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const parsed = GetClassPostsParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Sınıf numarası geçersiz." });
      return;
    }
    const [group] = await db
      .select({ id: classGroupsTable.id })
      .from(classGroupsTable)
      .where(eq(classGroupsTable.id, parsed.data.classId))
      .limit(1);
    if (!group) {
      res.status(404).json({ error: "Sınıf bulunamadı." });
      return;
    }
    if (!(await isActiveMember(group.id, userId))) {
      res.status(403).json({ error: "Bu sınıfın üyesi olmalısın." });
      return;
    }
    const rows = await db
      .select({
        id: postsTable.id,
        classId: postsTable.classId,
        authorId: postsTable.authorId,
        authorName: profilesTable.displayName,
        content: postsTable.content,
        kind: postsTable.kind,
        createdAt: postsTable.createdAt,
        reactionCount: sql<number>`(select count(*)::int from ${reactionsTable} where ${reactionsTable.postId} = ${postsTable.id})`,
        commentCount: sql<number>`(select count(*)::int from ${commentsTable} where ${commentsTable.postId} = ${postsTable.id})`,
        reactedByMe: sql<boolean>`exists (select 1 from ${reactionsTable} where ${reactionsTable.postId} = ${postsTable.id} and ${reactionsTable.userId} = ${userId})`,
      })
      .from(postsTable)
      .innerJoin(profilesTable, eq(postsTable.authorId, profilesTable.id))
      .where(eq(postsTable.classId, group.id))
      .orderBy(desc(postsTable.createdAt))
      .limit(30);

    const postIds = rows.map((post) => post.id);
    const comments = postIds.length
      ? await db
          .select({
            id: commentsTable.id,
            postId: commentsTable.postId,
            authorId: commentsTable.authorId,
            authorName: profilesTable.displayName,
            content: commentsTable.content,
            createdAt: commentsTable.createdAt,
          })
          .from(commentsTable)
          .innerJoin(profilesTable, eq(commentsTable.authorId, profilesTable.id))
          .where(inArray(commentsTable.postId, postIds))
          .orderBy(desc(commentsTable.createdAt))
          .limit(120)
      : [];
    const commentsByPost = new Map<number, typeof comments>();
    for (const comment of comments) {
      const current = commentsByPost.get(comment.postId) ?? [];
      if (current.length < 4) current.push(comment);
      commentsByPost.set(comment.postId, current);
    }

    res.json(
      GetClassPostsResponse.parse(
        rows.map((post) => ({
          ...post,
          reactionCount: Number(post.reactionCount),
          commentCount: Number(post.commentCount),
          comments: (commentsByPost.get(post.id) ?? []).reverse(),
        })),
      ),
    );
  },
);

router.post(
  "/classes/:classId/posts",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = CreateClassPostParams.safeParse(req.params);
    const body = CreateClassPostBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Paylaşım bilgilerini kontrol et." });
      return;
    }
    if (!(await isActiveMember(params.data.classId, userId))) {
      res.status(403).json({ error: "Bu sınıfın üyesi olmalısın." });
      return;
    }
    const [post] = await db
      .insert(postsTable)
      .values({
        classId: params.data.classId,
        authorId: userId,
        content: body.data.content,
        kind: body.data.kind,
      })
      .returning();
    const [author] = await db
      .select({ displayName: profilesTable.displayName })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    res.status(201).json(
      CreateClassPostResponse.parse({
        ...post,
        authorName: author?.displayName ?? "Sınıf arkadaşı",
        reactionCount: 0,
        commentCount: 0,
        reactedByMe: false,
        comments: [],
      }),
    );
  },
);

router.post(
  "/posts/:postId/comments",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = CreateCommentParams.safeParse(req.params);
    const body = CreateCommentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Yorum bilgilerini kontrol et." });
      return;
    }
    const [post] = await db
      .select({ id: postsTable.id, classId: postsTable.classId })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Gönderi bulunamadı." });
      return;
    }
    if (!(await isActiveMember(post.classId, userId))) {
      res.status(403).json({ error: "Bu sınıfın üyesi olmalısın." });
      return;
    }
    const [comment] = await db
      .insert(commentsTable)
      .values({
        postId: post.id,
        authorId: userId,
        content: body.data.content,
      })
      .returning();
    const [author] = await db
      .select({ displayName: profilesTable.displayName })
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    res.status(201).json(
      CreateCommentResponse.parse({
        ...comment,
        authorName: author?.displayName ?? "Sınıf arkadaşı",
      }),
    );
  },
);

router.put(
  "/posts/:postId/reaction",
  async (req, res): Promise<void> => {
    const userId = authenticatedUserId(req, res);
    if (!userId) return;
    const params = SetPostReactionParams.safeParse(req.params);
    const body = SetPostReactionBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Beğeni bilgisi geçersiz." });
      return;
    }
    const [post] = await db
      .select({ id: postsTable.id, classId: postsTable.classId })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Gönderi bulunamadı." });
      return;
    }
    if (!(await isActiveMember(post.classId, userId))) {
      res.status(403).json({ error: "Bu sınıfın üyesi olmalısın." });
      return;
    }
    if (body.data.liked) {
      await db
        .insert(reactionsTable)
        .values({ postId: post.id, userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(reactionsTable)
        .where(
          and(
            eq(reactionsTable.postId, post.id),
            eq(reactionsTable.userId, userId),
          ),
        );
    }
    const [total] = await db
      .select({ value: count() })
      .from(reactionsTable)
      .where(eq(reactionsTable.postId, post.id));
    res.json(
      SetPostReactionResponse.parse({
        liked: body.data.liked,
        reactionCount: Number(total?.value ?? 0),
      }),
    );
  },
);

export default router;
