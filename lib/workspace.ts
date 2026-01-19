import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const DEFAULT_PERSONAL_WORKSPACE_NAME = "我的工作区";
export const DEFAULT_WORKSPACE_PERMISSIONS = { public: false, team: true };

export async function ensurePersonalWorkspace(userId: string) {
  let [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.ownerId, userId), eq(workspaces.isPersonal, true)),
    )
    .limit(1);

  if (!workspace) {
    [workspace] = await db
      .insert(workspaces)
      .values({
        name: DEFAULT_PERSONAL_WORKSPACE_NAME,
        ownerId: userId,
        isPersonal: true,
        permissions: DEFAULT_WORKSPACE_PERMISSIONS,
        metadata: {},
      })
      .returning();
  }

  return workspace;
}
