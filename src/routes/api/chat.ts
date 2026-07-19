import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { createLovableGateway, COPILOT_MODEL } from "@/lib/ai-gateway.server";
import { buildTools } from "@/lib/agent/tools.server";
import { systemPrompt, type AgentContextSnapshot } from "@/lib/agent/context";

type ChatBody = { messages?: UIMessage[]; context?: AgentContextSnapshot; locale?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages) || !body.context) {
          return new Response("messages and context are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableGateway(key);
        const model = gateway(COPILOT_MODEL);
        const tools = buildTools(body.context);

        const langMap: Record<string, string> = {
          zh: "Simplified Chinese (简体中文)",
          fr: "French (Français)",
          it: "Italian (Italiano)",
          de: "German (Deutsch)",
          en: "English",
        };
        const langName = langMap[body.locale ?? "en"] ?? "English";
        const langLine = `IMPORTANT: Reply to the user in ${langName}, regardless of the input language. Keep tool arguments and JSON in English.`;
        const result = streamText({
          model,
          system: systemPrompt(body.context) + "\n\n" + langLine,
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});