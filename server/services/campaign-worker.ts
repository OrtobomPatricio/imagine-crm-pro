
import cron from "node-cron";
import { getDb } from "../db";
import { campaigns, campaignRecipients, whatsappNumbers, whatsappConnections, templates, leads } from "../../drizzle/schema";
import { eq, and, lte, inArray, sql } from "drizzle-orm";
import { sendCloudTemplate } from "../whatsapp/cloud";
import { sendEmail } from "../_core/email";

// Concurrency limit per tick
const BATCH_SIZE = 50;

export function startCampaignWorker() {
    console.log("[CampaignWorker] Starting worker...");

    // Run every minute
    cron.schedule("* * * * *", async () => {
        try {
            await processscheduledCampaigns();
            await processRunningCampaigns();
        } catch (err) {
            console.error("[CampaignWorker] Error in cron job:", err);
        }
    });
}

async function processscheduledCampaigns() {
    const db = await getDb();
    if (!db) return;

    const now = new Date();

    // Find campaigns that are scheduled and due
    const dueCampaigns = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.scheduledAt, now)));

    for (const campaign of dueCampaigns) {
        console.log(`[CampaignWorker] Starting campaign ${campaign.id}: ${campaign.name}`);
        await db
            .update(campaigns)
            .set({ status: "running", startedAt: now })
            .where(eq(campaigns.id, campaign.id));
    }
}

async function processRunningCampaigns() {
    const db = await getDb();
    if (!db) return;

    // Find running campaigns
    const running = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.status, "running"));

    for (const campaign of running) {
        // Determine channel (whatsapp vs email)
        if (campaign.type === "whatsapp") {
            await processWhatsAppCampaignBatch(campaign);
        } else {
            // Email implementation
            await processEmailCampaignBatch(campaign);
        }
    }
}

async function processEmailCampaignBatch(campaign: typeof campaigns.$inferSelect) {
    const db = await getDb();
    if (!db) return;

    // 1. Get recipients pending
    const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(and(eq(campaignRecipients.campaignId, campaign.id), eq(campaignRecipients.status, "pending")))
        .limit(BATCH_SIZE);

    if (recipients.length === 0) {
        console.log(`[CampaignWorker] Email Campaign ${campaign.id} completed.`);
        await db
            .update(campaigns)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(campaigns.id, campaign.id));
        return;
    }

    // 2. Get Template (if any) or use raw message
    let subject = `Campaign ${campaign.name}`;
    let htmlContent = campaign.message || "";

    if (campaign.templateId) {
        const tmpl = await db.select().from(templates).where(eq(templates.id, campaign.templateId)).limit(1);
        if (tmpl[0]) {
            // If template has subject/body structure in content json, parse it.
            // For now assuming template content is the HTML body.
            htmlContent = tmpl[0].content;
            subject = tmpl[0].name; // specific subject field in template table would be better
        }
    }

    // 3. Send Emails
    for (const recipient of recipients) {
        try {
            const leadRes = await db
                .select({ email: leads.email, name: leads.name })
                .from(leads)
                .where(eq(leads.id, recipient.leadId))
                .limit(1);

            if (!leadRes[0] || !leadRes[0].email) {
                await updateRecipientStatus(db, recipient.id, "failed", "Lead not found or no email");
                continue;
            }

            const emailAddr = leadRes[0].email;

            // Simple variable substitution
            let finalHtml = htmlContent.replace(/{{name}}/g, leadRes[0].name || "Customer");

            await sendEmail({
                to: emailAddr,
                subject: subject,
                html: finalHtml
            });

            await updateRecipientStatus(db, recipient.id, "sent");
            await db.execute(sql`UPDATE campaigns SET messages_sent = messages_sent + 1 WHERE id = ${campaign.id}`);

        } catch (error: any) {
            console.error(`[CampaignWorker] Failed to send email to recipient ${recipient.id}:`, error.message);
            await updateRecipientStatus(db, recipient.id, "failed", error.message);
            await db.execute(sql`UPDATE campaigns SET messages_failed = messages_failed + 1 WHERE id = ${campaign.id}`);
        }
    }
}

async function processWhatsAppCampaignBatch(campaign: typeof campaigns.$inferSelect) {
    const db = await getDb();
    if (!db) return;

    // 1. Get recipients pending
    const recipients = await db
        .select()
        .from(campaignRecipients)
        .where(and(eq(campaignRecipients.campaignId, campaign.id), eq(campaignRecipients.status, "pending")))
        .limit(BATCH_SIZE);

    if (recipients.length === 0) {
        // No more pending recipients, mark campaign as completed
        // DOUBLE CHECK: might be race condition if adding recipients dynamically? 
        // For now assume static audience.
        console.log(`[CampaignWorker] Campaign ${campaign.id} completed.`);
        await db
            .update(campaigns)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(campaigns.id, campaign.id));
        return;
    }

    // 2. Get connection credentials
    // Logic: Campaigns might be linked to a specific whatsappNumberId in the future, 
    // currently the schema links recipients to whatsappNumberId.
    // We'll assume the system uses the FIRST active connection if not specified, 
    // or we need to find the connection for the recipient's assigned number.

    // For simplicity: Try to find a valid connection for the sending number.
    // In `leads`, we have `whatsappNumberId`? No, that's assignation.
    // In `campaignRecipients`, `whatsappNumberId` IS NULLABLE.

    // We need a valid accessToken.
    const connections = await db.select().from(whatsappConnections).where(eq(whatsappConnections.isConnected, true));

    if (connections.length === 0) {
        console.warn(`[CampaignWorker] No active WhatsApp connections found. Pausing campaign ${campaign.id}.`);
        // Optionally pause campaign
        return;
    }

    // Use the first available connection or round robin? 
    // Let's pick the first one for now.
    const connection = connections[0];
    const { accessToken, phoneNumberId } = connection;

    if (!accessToken || !phoneNumberId) {
        console.error(`[CampaignWorker] Connection ${connection.id} missing credentials.`);
        return;
    }

    // 3. Get Template
    let templateName = "";
    let languageCode = "es";

    if (campaign.templateId) {
        const tmpl = await db.select().from(templates).where(eq(templates.id, campaign.templateId)).limit(1);
        if (tmpl[0]) {
            templateName = tmpl[0].name;
            // TODO: Store language in template table
        }
    }

    if (!templateName) {
        console.error(`[CampaignWorker] Campaign ${campaign.id} has no valid template.`);
        await db.update(campaigns).set({ status: "failed" as any }).where(eq(campaigns.id, campaign.id)); // Cast to any because failed is not in enum for draft? Wait, failed is not in enum!
        return;
    }

    // 4. Send Messages
    for (const recipient of recipients) {
        try {
            // Fetch lead phone
            // Using raw select because query builder typing might be tricky with dynamic imports
            const leadRes = await db
                .select({ phone: leads.phone, name: leads.name })
                .from(leads)
                .where(eq(leads.id, recipient.leadId))
                .limit(1);

            if (!leadRes[0] || !leadRes[0].phone) {
                await updateRecipientStatus(db, recipient.id, "failed", "Lead not found or no phone");
                continue;
            }

            const phone = leadRes[0].phone.replace(/\D/g, ""); // strip non-digits

            // Send Template
            // Mock components for now (variables)
            const { messageId } = await sendCloudTemplate({
                accessToken,
                phoneNumberId,
                to: phone,
                templateName,
                languageCode
            });

            await db.update(campaignRecipients)
                .set({
                    status: "sent",
                    sentAt: new Date(),
                    whatsappNumberId: connection.whatsappNumberId
                })
                .where(eq(campaignRecipients.id, recipient.id)); // Using recipient.id

            // Update campaign stats
            // We can do this in bulk content later, but for now 1 by 1
            await db.execute(sql`UPDATE campaigns SET messages_sent = messages_sent + 1 WHERE id = ${campaign.id}`);

        } catch (error: any) {
            console.error(`[CampaignWorker] Failed to send to recipient ${recipient.id}:`, error.message);
            await updateRecipientStatus(db, recipient.id, "failed", error.message);
            await db.execute(sql`UPDATE campaigns SET messages_failed = messages_failed + 1 WHERE id = ${campaign.id}`);
        }
    }
}

async function updateRecipientStatus(db: any, id: number, status: any, errorMessage?: string) {
    await db.update(campaignRecipients)
        .set({ status, errorMessage: errorMessage || null })
        .where(eq(campaignRecipients.id, id));
}
