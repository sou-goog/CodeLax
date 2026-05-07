import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { indexRepo } from "../../../inngest/functions";
import { generateReviewMultiAgent } from "../../../inngest/functions/multi-agent-review";
import { generatePRDescription } from "../../../inngest/functions/generate-pr-description";

export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    indexRepo,
    generateReviewMultiAgent,
    generatePRDescription,
  ],
});
