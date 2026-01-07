import { relations } from "drizzle-orm";
import { 
  foreignKey, 
  pgTable, 
  primaryKey, 
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
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    clerkId: text("clerk_id").notNull().unique(),
    imageUrl: text("image_url").notNull().default("https://ui-avatars.com/api/?name=John+Doe"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(table)=>({
    clerkIdIdx: uniqueIndex("clerk_id_idx").on(table.clerkId),
}));


export const documents = pgTable("documents",{
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    userId: uuid("user_id").references(()=>users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
},(table)=>([
    primaryKey({ columns: [table.userId, table.id] }),
    foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: "fk_documents_user_id",
    }),
]));
export const usersRelations = relations(users,({many})=>({
    documents: many(documents),
}));
export const documentsRelations = relations(documents,({one})=>({
    user: one(users, { fields: [documents.userId], references: [users.id] }),
}));

export const insertDocumentSchema = createInsertSchema(documents)
export const selectDocumentSchema = createSelectSchema(documents)
export const updateDocumentSchema = createUpdateSchema(documents)