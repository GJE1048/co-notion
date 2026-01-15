import { relations } from "drizzle-orm";
import { 
  foreignKey, 
  pgTable, 
  text, 
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

export const users = pgTable("users",{
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    clerkId: text("clerk_id").notNull().unique(),
    imageUrl: text("image_url").notNull().default("https://ui-avatars.com/api/?name=John+Doe"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(table)=>({
    clerkIdIdx: uniqueIndex("clerk_id_idx").on(table.clerkId),
    usernameIdx: uniqueIndex("username_idx").on(table.username),
}));


export const documents = pgTable("documents",{
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    userId: uuid("user_id").references(()=>users.id).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(table)=>({
    foreignKey: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: "fk_documents_user_id",
    }),
}));
export const usersRelations = relations(users,({many})=>({
    documents: many(documents),
}));
export const documentsRelations = relations(documents,({one})=>({
    user: one(users, { fields: [documents.userId], references: [users.id] }),
}));

export const insertDocumentSchema = createInsertSchema(documents)
export const selectDocumentSchema = createSelectSchema(documents)
export const updateDocumentSchema = createUpdateSchema(documents)