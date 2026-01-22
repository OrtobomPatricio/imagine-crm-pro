import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { getDb } from "../db";
import { conversations, chatMessages, whatsappConnections, users } from "../../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { ENV } from "../_core/env";
import { dispatchIntegrationEvent } from "../_core/integrationDispatch";

function verifySignature(req: Request): boolean {
  const secret = ENV.whatsappAppSecret;
  if (!secret) return true; // optional

  const header = (req.headers["x-hub-signature-256"] as string | undefined) ?? "";
  if (!header.startsWith("sha256=")) return false;
  const signature = header.slice("sha256=".length);
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!raw || raw.length === 0) return false;

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

async function getWhatsappNumberIdByPhoneNumberId(phoneNumberId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ whatsappNumberId: whatsappConnections.whatsappNumberId })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.phoneNumberId, phoneNumberId))
    .limit(1);
  return rows[0]?.whatsappNumberId ?? null;
}

export function registerWhatsAppWebhookRoutes(app: Express) {
  // Verification endpoint (Meta)
  app.get("/api/whatsapp/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === ENV.whatsappWebhookVerifyToken) {
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.status(403).send("Forbidden");
  });

  // Incoming notifications
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      if (!verifySignature(req)) {
        return res.status(401).json({ ok: false });
      }

      const payload: any = req.body ?? {};
      const entries: any[] = Array.isArray(payload.entry) ? payload.entry : [];

      for (const entry of entries) {
        const changes: any[] = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const value = change.value ?? {};
          const phoneNumberId = value?.metadata?.phone_number_id;
          if (!phoneNumberId) continue;

          const whatsappNumberId = await getWhatsappNumberIdByPhoneNumberId(String(phoneNumberId));
          if (!whatsappNumberId) continue;

          // 1) Status updates for outbound messages
          const statuses: any[] = Array.isArray(value.statuses) ? value.statuses : [];
          if (statuses.length > 0) {
            const db = await getDb();
            if (db) {
              for (const st of statuses) {
                const msgId = String(st.id ?? "");
                const status = String(st.status ?? "");
                if (!msgId) continue;

                const now = new Date();
                const patch: any = {};
                if (status === "sent") {
                  patch.status = "sent";
                  patch.sentAt = now;
                } else if (status === "delivered") {
                  patch.status = "delivered";
                  patch.deliveredAt = now;
                } else if (status === "read") {
                  patch.status = "read";
                  patch.readAt = now;
                } else if (status === "failed") {
                  patch.status = "failed";
                }

                if (Object.keys(patch).length > 0) {
                  await db
                    .update(chatMessages)
                    .set(patch)
                    .where(eq(chatMessages.whatsappMessageId, msgId));
                }
              }
            }
          }

          // 2) Incoming messages
          const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
          if (messages.length === 0) continue;

          const contact = Array.isArray(value.contacts) ? value.contacts[0] : undefined;
          const contactPhone = String(contact?.wa_id ?? messages[0]?.from ?? "");
          const contactName = contact?.profile?.name ? String(contact.profile.name) : null;
          if (!contactPhone) continue;

          const db = await getDb();
          if (!db) continue;

          // Find or create conversation
          let convo = await db
            .select()
            .from(conversations)
            .where(and(eq(conversations.whatsappNumberId, whatsappNumberId), eq(conversations.contactPhone, contactPhone)))
            .limit(1);

          let conversationId = convo[0]?.id as number | undefined;
          if (!conversationId) {
            const inserted = await db.insert(conversations).values({
              whatsappNumberId,
              contactPhone,
              contactName,
              lastMessageAt: new Date(),
              unreadCount: 1,
              status: "active",
            });
            conversationId = inserted[0].insertId as number;
          } else {
            await db
              .update(conversations)
              .set({
                ...(contactName ? { contactName } : {}),
                lastMessageAt: new Date(),
                unreadCount: sql`${conversations.unreadCount} + 1`,
              })
              .where(eq(conversations.id, conversationId));
          }

          for (const m of messages) {
            const msgType = String(m.type ?? "text");
            const waMsgId = m.id ? String(m.id) : undefined;

            let messageType: any = "text";
            let content: string | null = null;
            let mediaUrl: string | null = null;
            let mediaMimeType: string | null = null;
            let latitude: any = null;
            let longitude: any = null;
            let locationName: string | null = null;

            if (msgType === "text") {
              messageType = "text";
              content = m.text?.body ? String(m.text.body) : null;
            } else if (msgType === "image" || msgType === "video" || msgType === "audio" || msgType === "document" || msgType === "sticker") {
              messageType = msgType;
              content = m[msgType]?.caption ? String(m[msgType].caption) : null;
              // We store media id for later fetching; mediaUrl can be filled by a future downloader
              mediaUrl = m[msgType]?.id ? String(m[msgType].id) : null;
              mediaMimeType = m[msgType]?.mime_type ? String(m[msgType].mime_type) : null;
            } else if (msgType === "location") {
              messageType = "location";
              const loc = m.location ?? {};
              latitude = loc.latitude ?? null;
              longitude = loc.longitude ?? null;
              locationName = loc.name ? String(loc.name) : null;
              content = loc.address ? String(loc.address) : null;
            } else if (msgType === "contacts") {
              messageType = "contact";
              content = JSON.stringify(m.contacts ?? []);
            } else {
              messageType = "text";
              content = JSON.stringify(m);
            }

            await db.insert(chatMessages).values({
              conversationId,
              whatsappNumberId,
              direction: "inbound",
              messageType,
              content,
              mediaUrl,
              mediaMimeType,
              latitude: latitude ?? undefined,
              longitude: longitude ?? undefined,
              locationName,
              status: "delivered",
              whatsappMessageId: waMsgId,
              deliveredAt: new Date(),
            });

            void dispatchIntegrationEvent({
              whatsappNumberId,
              event: "message_received",
              data: {
                conversationId,
                from: contactPhone,
                contactName,
                messageType,
                content,
                mediaUrl,
                mediaMimeType,
                latitude: latitude ?? null,
                longitude: longitude ?? null,
                locationName,
                whatsappMessageId: waMsgId ?? null,
              },
            });

            // --- AI BOT LOGIC ---
            // If bot is enabled for this conversation, trigger a response
            if (convo[0]?.botEnabled || (convo.length === 0 && false)) { // Default false for new convos unless config says otherwise
              // We use a small timeout to not block the webhook response (Cloud API requirement) but node is async so it's fine.
              // However, ideally offload to a worker. For now, we just fire and forget (void).
              void handleBotResponse(db, whatsappNumberId, conversationId, contactPhone, content);
            }
          }
        }
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("[Webhook] Error processing incoming:", e);
      return res.status(200).json({ ok: true });
    }
  });
}

import { invokeLLM, Message } from "../_core/llm";
import { sendCloudMessage } from "./cloud";

async function handleBotResponse(db: any, whatsappNumberId: number, conversationId: number, to: string, lastUserMessage: string | null) {
  if (!lastUserMessage) return;

  try {
    // 1. Fetch context (last 10 messages)
    const history = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(sql`${chatMessages.createdAt} DESC`)
      .limit(10);

    // 2. Format for LLM
    const messages: Message[] = [
      {
        role: "system",
        content: "Eres un asistente útil y amable de Imagine CRM. Tu objetivo es ayudar al usuario con sus consultas. Sé conciso y profesional. Responde en el mismo idioma que el usuario."
      },
      ...history.reverse().map((m: any) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || "[Media]"
      } as Message))
    ];

    // 3. Invoke LLM
    // Using gemini-2.5-flash as default in invokeLLM
    console.log(`[Bot] Invoking AI for conversation ${conversationId}...`);
    const result = await invokeLLM({
      messages,
      max_tokens: 300
    });

    const replyText = result.choices[0]?.message?.content;

    if (typeof replyText === 'string' && replyText.trim().length > 0) {
      // 4. Send response via WhatsApp Cloud API
      // We need credentials for this whatsappNumberId
      const connection = await db.select().from(whatsappConnections).where(eq(whatsappConnections.whatsappNumberId, whatsappNumberId)).limit(1);

      if (connection[0]?.accessToken && connection[0]?.phoneNumberId) {
        await sendCloudMessage({
          accessToken: connection[0].accessToken,
          phoneNumberId: connection[0].phoneNumberId,
          to,
          type: "text",
          text: { body: replyText }
        });

        // 5. Store bot message in DB
        await db.insert(chatMessages).values({
          conversationId,
          whatsappNumberId,
          direction: "outbound",
          messageType: "text",
          content: replyText,
          status: "sent",
          sentAt: new Date(),
        });
        console.log(`[Bot] Replied to ${to}`);
      } else {
        console.warn(`[Bot] No credentials found for sending reply to ${to}`);
      }
    }

  } catch (error) {
    console.error(`[Bot] Failed to generate/send response`, error);
  }
}
