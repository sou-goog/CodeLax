import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { indexRepo } from "@/inngest/functions";
import { prReviewFunction } from "@/inngest/functions/pr-review";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    indexRepo,
    prReviewFunction,
  ],
});
