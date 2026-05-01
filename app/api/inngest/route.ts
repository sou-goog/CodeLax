import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { indexRepo } from "../../../inngest/functions";
import { generateReview } from "../../../inngest/functions/review";
import { generateReviewMultiAgent } from "../../../inngest/functions/multi-agent-review";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    indexRepo,
    generateReview,
    generateReviewMultiAgent,
  ],
});
