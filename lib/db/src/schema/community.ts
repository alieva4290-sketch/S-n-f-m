import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull().default("Yeni üye"),
  bio: text("bio"),
  city: text("city"),
  occupation: text("occupation"),
  discoverable: boolean("discoverable").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const institutionsTable = pgTable(
  "institutions",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    type: text("type").notNull(),
    campus: text("campus"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("institutions_name_city_idx").on(table.name, table.city),
    uniqueIndex("institutions_unique_name_city_idx").on(
      table.name,
      table.city,
    ),
  ],
);

export const classGroupsTable = pgTable(
  "class_groups",
  {
    id: serial("id").primaryKey(),
    institutionId: integer("institution_id")
      .notNull()
      .references(() => institutionsTable.id, { onDelete: "cascade" }),
    graduationYear: integer("graduation_year").notNull(),
    className: text("class_name").notNull(),
    description: text("description"),
    createdBy: text("created_by")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("class_groups_institution_year_idx").on(
      table.institutionId,
      table.graduationYear,
    ),
    uniqueIndex("class_groups_unique_cohort_idx").on(
      table.institutionId,
      table.graduationYear,
      table.className,
    ),
  ],
);

export const classMembershipsTable = pgTable(
  "class_memberships",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classGroupsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("class_memberships_class_user_idx").on(
      table.classId,
      table.userId,
    ),
    index("class_memberships_user_status_idx").on(table.userId, table.status),
  ],
);

export const postsTable = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classGroupsTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    kind: text("kind").notNull().default("not"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("posts_class_created_idx").on(table.classId, table.createdAt)],
);

export const commentsTable = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("comments_post_created_idx").on(table.postId, table.createdAt)],
);

export const reactionsTable = pgTable(
  "reactions",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reactions_post_user_idx").on(table.postId, table.userId),
  ],
);

