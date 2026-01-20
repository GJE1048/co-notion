import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { getUploadPresignedUrl, getFileUrl } from "@/lib/s3";
import { v4 as uuidv4 } from "uuid";

export const storageRouter = createTRPCRouter({
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { filename, contentType } = input;
      const extension = filename.split(".").pop();
      const key = `uploads/${uuidv4()}.${extension}`;
      
      const uploadUrl = await getUploadPresignedUrl(key, contentType);
      const fileUrl = getFileUrl(key);

      return {
        uploadUrl,
        fileUrl,
      };
    }),
});
