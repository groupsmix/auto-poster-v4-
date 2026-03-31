// ============================================================
// AI Chatbot Routes
//
// POST /api/chatbot/chat     — Send message, get AI response
// POST /api/chatbot/execute  — Execute proposed actions
// GET  /api/chatbot/history  — List conversations
// GET  /api/chatbot/history/:id — Get conversation messages
// DELETE /api/chatbot/history/:id — Delete a conversation
// ============================================================

import { Hono } from "hono";
import type { ApiResponse, ChatAction, ChatActionResult } from "@nexus/shared";
import { generateId, slugify, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery, errorResponse, sanitizeInput, forwardToService } from "../helpers";

const chatbot = new Hono<{ Bindings: RouterEnv }>();

// POST /api/chatbot/chat — Send a message and get AI response
chatbot.post("/chat", async (c) => {
  try {
    const body = await c.req.json<{
      message?: string;
      conversation_id?: string;
    }>();

    if (!body.message || body.message.trim().length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "message is required" },
        400
      );
    }

    const userMessage = sanitizeInput(body.message);
    let conversationId = body.conversation_id;

    // Create or get conversation
    if (!conversationId) {
      conversationId = generateId();
      const title = userMessage.slice(0, 100);
      const ts = now();
      await storageQuery(
        c.env,
        "INSERT INTO chat_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [conversationId, title, ts, ts]
      );
    } else {
      // Update conversation timestamp
      await storageQuery(
        c.env,
        "UPDATE chat_conversations SET updated_at = ? WHERE id = ?",
        [now(), conversationId]
      );
    }

    // Store user message
    const userMsgId = generateId();
    await storageQuery(
      c.env,
      "INSERT INTO chat_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
      [userMsgId, conversationId, userMessage, now()]
    );

    // Fetch conversation history for context
    const historyRows = await storageQuery(
      c.env,
      "SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 40",
      [conversationId]
    ) as Array<{ role: string; content: string }>;

    const history = (historyRows ?? []).slice(0, -1).map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));

    // Forward to nexus-ai chatbot endpoint
    const aiResp = await c.env.NEXUS_AI.fetch("http://nexus-ai/ai/chatbot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history }),
    });

    const aiResult = (await aiResp.json()) as ApiResponse<{
      content: string;
      actions: ChatAction[];
    }>;

    if (!aiResult.success || !aiResult.data) {
      return c.json<ApiResponse>(
        { success: false, error: aiResult.error ?? "Chatbot failed to respond" },
        500
      );
    }

    const { content, actions } = aiResult.data;

    // Store assistant message
    const assistantMsgId = generateId();
    await storageQuery(
      c.env,
      "INSERT INTO chat_messages (id, conversation_id, role, content, proposed_actions, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)",
      [
        assistantMsgId,
        conversationId,
        content,
        actions.length > 0 ? JSON.stringify(actions) : null,
        now(),
      ]
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        conversation_id: conversationId,
        message: {
          id: assistantMsgId,
          conversation_id: conversationId,
          role: "assistant",
          content,
          proposed_actions: actions.length > 0 ? actions : undefined,
          created_at: now(),
        },
        pending_actions: actions.length > 0 ? actions : undefined,
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/chatbot/execute — Execute proposed actions
chatbot.post("/execute", async (c) => {
  try {
    const body = await c.req.json<{
      conversation_id?: string;
      message_id?: string;
      action_ids?: string[];
    }>();

    if (!body.conversation_id || !body.message_id || !body.action_ids) {
      return c.json<ApiResponse>(
        { success: false, error: "conversation_id, message_id, and action_ids are required" },
        400
      );
    }

    // Fetch the message with proposed actions
    const msgRows = await storageQuery(
      c.env,
      "SELECT proposed_actions FROM chat_messages WHERE id = ? AND conversation_id = ?",
      [body.message_id, body.conversation_id]
    ) as Array<{ proposed_actions: string | null }>;

    if (!msgRows || msgRows.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Message not found" },
        404
      );
    }

    const rawActions = msgRows[0].proposed_actions;
    if (!rawActions) {
      return c.json<ApiResponse>(
        { success: false, error: "No actions proposed in this message" },
        400
      );
    }

    let proposedActions: ChatAction[];
    try {
      proposedActions = JSON.parse(rawActions) as ChatAction[];
    } catch {
      return c.json<ApiResponse>(
        { success: false, error: "Invalid actions data" },
        500
      );
    }

    // Filter to only the requested action IDs
    const actionsToExecute = proposedActions.filter(
      (a) => body.action_ids!.includes(a.id)
    );

    if (actionsToExecute.length === 0) {
      return c.json<ApiResponse>(
        { success: false, error: "No matching actions found" },
        400
      );
    }

    // Execute each action
    const results: ChatActionResult[] = [];
    for (const action of actionsToExecute) {
      const result = await executeAction(action, c.env);
      results.push(result);
    }

    // Store results on the message
    await storageQuery(
      c.env,
      "UPDATE chat_messages SET action_results = ? WHERE id = ?",
      [JSON.stringify(results), body.message_id]
    );

    // Add a summary message from the assistant
    const summaryParts = results.map((r) =>
      r.success ? `Done: ${r.message}` : `Failed: ${r.message}`
    );
    const summaryContent = summaryParts.join("\n");
    const summaryMsgId = generateId();
    await storageQuery(
      c.env,
      "INSERT INTO chat_messages (id, conversation_id, role, content, action_results, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)",
      [summaryMsgId, body.conversation_id, summaryContent, JSON.stringify(results), now()]
    );

    // Update conversation timestamp
    await storageQuery(
      c.env,
      "UPDATE chat_conversations SET updated_at = ? WHERE id = ?",
      [now(), body.conversation_id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        results,
        summary_message: {
          id: summaryMsgId,
          conversation_id: body.conversation_id,
          role: "assistant",
          content: summaryContent,
          action_results: results,
          created_at: now(),
        },
      },
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/chatbot/history — List conversations
chatbot.get("/history", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const rows = await storageQuery(
      c.env,
      "SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );

    return c.json<ApiResponse>({ success: true, data: rows });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/chatbot/history/:id — Get conversation messages
chatbot.get("/history/:id", async (c) => {
  try {
    const conversationId = c.req.param("id");

    const messages = await storageQuery(
      c.env,
      "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [conversationId]
    ) as Array<Record<string, unknown>>;

    // Parse JSON fields
    if (messages) {
      for (const msg of messages) {
        if (typeof msg.proposed_actions === "string") {
          try { msg.proposed_actions = JSON.parse(msg.proposed_actions as string); } catch { /* keep as string */ }
        }
        if (typeof msg.action_results === "string") {
          try { msg.action_results = JSON.parse(msg.action_results as string); } catch { /* keep as string */ }
        }
      }
    }

    return c.json<ApiResponse>({ success: true, data: messages });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/chatbot/history/:id — Delete a conversation
chatbot.delete("/history/:id", async (c) => {
  try {
    const conversationId = c.req.param("id");

    await storageQuery(
      c.env,
      "DELETE FROM chat_messages WHERE conversation_id = ?",
      [conversationId]
    );
    await storageQuery(
      c.env,
      "DELETE FROM chat_conversations WHERE id = ?",
      [conversationId]
    );

    return c.json<ApiResponse>({ success: true, data: { deleted: conversationId } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// ============================================================
// ACTION EXECUTOR — Runs actions against the dashboard APIs
// ============================================================

async function executeAction(
  action: ChatAction,
  env: RouterEnv
): Promise<ChatActionResult> {
  const ts = now();

  try {
    switch (action.type) {
      case "create_domain": {
        const { name, description, icon } = action.params as {
          name: string;
          description?: string;
          icon?: string;
        };
        const id = generateId();
        const slug = slugify(name);
        await storageQuery(
          env,
          `INSERT INTO domains (id, name, slug, description, icon, sort_order, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM domains), 1, ?)`,
          [id, name, slug, description ?? null, icon ?? null, ts]
        );
        return { action_id: action.id, success: true, message: `Created domain "${name}"`, data: { id, slug } };
      }

      case "create_category": {
        const { domain_id, name, description, auto_setup, niche_hint } = action.params as {
          domain_id: string;
          name: string;
          description?: string;
          auto_setup?: boolean;
          niche_hint?: string;
        };
        const id = generateId();
        const slug = slugify(name);
        await storageQuery(
          env,
          `INSERT INTO categories (id, domain_id, name, slug, description, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE domain_id = ?), 1)`,
          [id, domain_id, name, slug, description ?? null, domain_id]
        );

        // Optionally trigger CEO setup
        if (auto_setup) {
          try {
            const domainRows = await storageQuery(
              env,
              "SELECT name, slug FROM domains WHERE id = ? LIMIT 1",
              [domain_id]
            ) as Array<{ name: string; slug: string }>;

            if (domainRows && domainRows.length > 0) {
              await env.NEXUS_AI.fetch("http://nexus-ai/ai/ceo/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  domain_name: domainRows[0].name,
                  domain_slug: domainRows[0].slug,
                  category_name: name,
                  category_slug: slug,
                  niche_hint: niche_hint ?? null,
                  language: "en",
                }),
              });
            }
          } catch {
            // CEO setup is best-effort
          }
        }

        return {
          action_id: action.id,
          success: true,
          message: `Created category "${name}"${auto_setup ? " with AI CEO setup" : ""}`,
          data: { id, slug },
        };
      }

      case "start_workflow": {
        const params = action.params as {
          domain_id: string;
          category_id: string;
          niche: string;
          language?: string;
          batch_count?: number;
        };
        const result = await forwardToService(
          env.NEXUS_WORKFLOW,
          "/workflow/start",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(params),
          }
        );
        return {
          action_id: action.id,
          success: result.success,
          message: result.success ? "Workflow started" : (result.error ?? "Workflow failed to start"),
          data: result.data,
        };
      }

      case "update_setting": {
        const { key, value } = action.params as { key: string; value: string };
        await storageQuery(
          env,
          `INSERT INTO settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, value, ts]
        );
        return { action_id: action.id, success: true, message: `Updated setting "${key}" to "${value}"` };
      }

      case "add_api_key": {
        const { key_name } = action.params as { key_name: string };
        return {
          action_id: action.id,
          success: false,
          message: `API key "${key_name}" must be added manually in Cloudflare Workers settings for security. Go to Workers & Pages > nexus-ai > Settings > Variables and Secrets.`,
        };
      }

      case "ceo_setup": {
        const ceoParams = action.params as {
          domain_id: string;
          category_id: string;
          niche_hint?: string;
        };

        const domainRows = await storageQuery(
          env,
          "SELECT name, slug FROM domains WHERE id = ? LIMIT 1",
          [ceoParams.domain_id]
        ) as Array<{ name: string; slug: string }>;

        const catRows = await storageQuery(
          env,
          "SELECT name, slug FROM categories WHERE id = ? LIMIT 1",
          [ceoParams.category_id]
        ) as Array<{ name: string; slug: string }>;

        if (!domainRows?.length || !catRows?.length) {
          return { action_id: action.id, success: false, message: "Domain or category not found" };
        }

        const ceoResp = await env.NEXUS_AI.fetch("http://nexus-ai/ai/ceo/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain_name: domainRows[0].name,
            domain_slug: domainRows[0].slug,
            category_name: catRows[0].name,
            category_slug: catRows[0].slug,
            niche_hint: ceoParams.niche_hint ?? null,
            language: "en",
          }),
        });
        const ceoResult = (await ceoResp.json()) as ApiResponse;
        return {
          action_id: action.id,
          success: ceoResult.success,
          message: ceoResult.success ? "AI CEO analysis completed" : (ceoResult.error ?? "CEO setup failed"),
          data: ceoResult.data,
        };
      }

      case "create_platform": {
        const { name: platName, slug: platSlug } = action.params as { name: string; slug: string };
        const platId = generateId();
        await storageQuery(
          env,
          "INSERT INTO platforms (id, name, slug, is_active) VALUES (?, ?, ?, 1)",
          [platId, platName, platSlug]
        );
        return { action_id: action.id, success: true, message: `Created platform "${platName}"`, data: { id: platId } };
      }

      case "create_social_channel": {
        const { name: chanName, slug: chanSlug } = action.params as { name: string; slug: string };
        const chanId = generateId();
        await storageQuery(
          env,
          "INSERT INTO social_channels (id, name, slug, is_active) VALUES (?, ?, ?, 1)",
          [chanId, chanName, chanSlug]
        );
        return { action_id: action.id, success: true, message: `Created social channel "${chanName}"`, data: { id: chanId } };
      }

      case "approve_product": {
        const { product_id } = action.params as { product_id: string };
        await storageQuery(
          env,
          "UPDATE products SET status = 'approved', updated_at = ? WHERE id = ?",
          [ts, product_id]
        );
        return { action_id: action.id, success: true, message: `Product ${product_id} approved` };
      }

      case "reject_product": {
        const { product_id, feedback } = action.params as { product_id: string; feedback: string };
        await storageQuery(
          env,
          "UPDATE products SET status = 'rejected', updated_at = ? WHERE id = ?",
          [ts, product_id]
        );
        return { action_id: action.id, success: true, message: `Product ${product_id} rejected: ${feedback}` };
      }

      case "publish_product": {
        const publishParams = action.params as {
          product_id: string;
          platforms: string[];
          channels: string[];
        };
        // Update product status
        await storageQuery(
          env,
          "UPDATE products SET status = 'published', updated_at = ? WHERE id = ?",
          [ts, publishParams.product_id]
        );
        return { action_id: action.id, success: true, message: `Product ${publishParams.product_id} published` };
      }

      case "update_prompt": {
        const { prompt_id, prompt } = action.params as { prompt_id: string; prompt: string };
        await storageQuery(
          env,
          "UPDATE prompt_templates SET prompt = ?, version = version + 1, updated_at = ? WHERE id = ?",
          [prompt, ts, prompt_id]
        );
        return { action_id: action.id, success: true, message: `Prompt template updated` };
      }

      case "general_query": {
        return { action_id: action.id, success: true, message: "Information provided in the response" };
      }

      default:
        return { action_id: action.id, success: false, message: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { action_id: action.id, success: false, message };
  }
}

export default chatbot;
