import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }), // For native credential login
  loginMethod: varchar("loginMethod", { length: 64 }),
  // Pro roles: owner/admin/supervisor/agent/viewer
  role: mysqlEnum("role", ["owner", "admin", "supervisor", "agent", "viewer"]).default("agent").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  hasSeenTour: boolean("hasSeenTour").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Global app settings (single-tenant for now, but ready for multi-tenant later).
 * This powers the Settings panel: branding, locale, scheduling rules, permissions matrix.
 */
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("companyName", { length: 120 }).default("Imagine Lab CRM").notNull(),
  logoUrl: varchar("logoUrl", { length: 500 }),
  timezone: varchar("timezone", { length: 60 }).default("America/Asuncion").notNull(),
  language: varchar("language", { length: 10 }).default("es").notNull(),
  currency: varchar("currency", { length: 10 }).default("PYG").notNull(),

  // Permissions matrix by role. Example:
  // { owner: ["*"], admin: ["dashboard.*", "leads.*"], agent: ["leads.view"] }
  permissionsMatrix: json("permissionsMatrix").$type<Record<string, string[]>>(),

  // Scheduling settings
  scheduling: json("scheduling").$type<{
    slotMinutes: number;
    maxPerSlot: number;
    allowCustomTime: boolean;
  }>(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = typeof appSettings.$inferInsert;

/**
 * WhatsApp numbers for campaigns
 */
export const whatsappNumbers = mysqlTable("whatsapp_numbers", {
  id: int("id").autoincrement().primaryKey(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull().unique(),
  displayName: varchar("displayName", { length: 100 }),
  country: varchar("country", { length: 50 }).notNull(),
  countryCode: varchar("countryCode", { length: 5 }).notNull(),
  status: mysqlEnum("status", ["active", "warming_up", "blocked", "disconnected"]).default("warming_up").notNull(),
  warmupDay: int("warmupDay").default(0).notNull(),
  warmupStartDate: timestamp("warmupStartDate"),
  dailyMessageLimit: int("dailyMessageLimit").default(20).notNull(),
  messagesSentToday: int("messagesSentToday").default(0).notNull(),
  totalMessagesSent: int("totalMessagesSent").default(0).notNull(),
  lastConnected: timestamp("lastConnected"),
  isConnected: boolean("isConnected").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhatsappNumber = typeof whatsappNumbers.$inferSelect;
export type InsertWhatsappNumber = typeof whatsappNumbers.$inferInsert;

/**
 * Leads managed in the CRM
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  country: varchar("country", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["new", "contacted", "qualified", "negotiation", "won", "lost"]).default("new").notNull(),
  source: varchar("source", { length: 100 }),
  notes: text("notes"),
  commission: decimal("commission", { precision: 10, scale: 2 }).default("0.00"),
  assignedToId: int("assignedToId"),
  whatsappNumberId: int("whatsappNumberId"),
  lastContactedAt: timestamp("lastContactedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Campaigns for mass messaging
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["draft", "scheduled", "running", "paused", "completed", "cancelled"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  totalRecipients: int("totalRecipients").default(0).notNull(),
  messagesSent: int("messagesSent").default(0).notNull(),
  messagesDelivered: int("messagesDelivered").default(0).notNull(),
  messagesFailed: int("messagesFailed").default(0).notNull(),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

/**
 * Campaign recipients linking campaigns to leads
 */
export const campaignRecipients = mysqlTable("campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  leadId: int("leadId").notNull(),
  whatsappNumberId: int("whatsappNumberId"),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "failed", "read"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = typeof campaignRecipients.$inferInsert;

/**
 * Conversation messages between leads and WhatsApp numbers
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  whatsappNumberId: int("whatsappNumberId").notNull(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * Activity log for tracking actions
 */
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

/**
 * Integrations with external services (n8n, Chatwoot, etc.)
 */
export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["n8n", "chatwoot", "zapier", "webhook"]).notNull(),
  webhookUrl: varchar("webhookUrl", { length: 500 }).notNull(),
  whatsappNumberId: int("whatsappNumberId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  events: json("events").$type<string[]>(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = typeof integrations.$inferInsert;


/**
 * Appointment reasons (editable dropdown options)
 */
export const appointmentReasons = mysqlTable("appointment_reasons", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppointmentReason = typeof appointmentReasons.$inferSelect;
export type InsertAppointmentReason = typeof appointmentReasons.$inferInsert;

/**
 * Appointments/Scheduling
 */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 320 }),
  reasonId: int("reasonId"),
  appointmentDate: timestamp("appointmentDate").notNull(),
  appointmentTime: varchar("appointmentTime", { length: 10 }).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"]).default("scheduled").notNull(),
  leadId: int("leadId"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

/**
 * Chat conversations
 */
export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  channel: mysqlEnum("channel", ["whatsapp", "facebook"]).default("whatsapp").notNull(),
  whatsappNumberId: int("whatsappNumberId"), // Nullable for FB
  facebookPageId: int("facebookPageId"), // Nullable for WA
  contactPhone: varchar("contactPhone", { length: 50 }).notNull(), // Now generic (phone or PSID)
  contactName: varchar("contactName", { length: 200 }),
  leadId: int("leadId"),
  assignedToId: int("assignedToId"),
  lastMessageAt: timestamp("lastMessageAt"),
  unreadCount: int("unreadCount").default(0).notNull(),
  status: mysqlEnum("status", ["active", "archived", "blocked"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Chat messages with full media support
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  whatsappNumberId: int("whatsappNumberId"),
  facebookPageId: int("facebookPageId"),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "video", "audio", "document", "location", "sticker", "contact", "template"]).default("text").notNull(),
  content: text("content"),
  mediaUrl: varchar("mediaUrl", { length: 500 }),
  mediaName: varchar("mediaName", { length: 200 }),
  mediaMimeType: varchar("mediaMimeType", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  locationName: varchar("locationName", { length: 200 }),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  failedAt: timestamp("failedAt"),
  whatsappMessageId: varchar("whatsappMessageId", { length: 100 }),
  facebookMessageId: varchar("facebookMessageId", { length: 100 }),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * WhatsApp connection settings (API or QR)
 */
export const whatsappConnections = mysqlTable("whatsapp_connections", {
  id: int("id").autoincrement().primaryKey(),
  whatsappNumberId: int("whatsappNumberId").notNull().unique(),
  connectionType: mysqlEnum("connectionType", ["api", "qr"]).notNull(),
  accessToken: text("accessToken"),
  phoneNumberId: varchar("phoneNumberId", { length: 50 }),
  businessAccountId: varchar("businessAccountId", { length: 50 }),
  qrCode: text("qrCode"),
  qrExpiresAt: timestamp("qrExpiresAt"),
  sessionData: text("sessionData"),
  isConnected: boolean("isConnected").default(false).notNull(),
  lastPingAt: timestamp("lastPingAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WhatsappConnection = typeof whatsappConnections.$inferSelect;
export type InsertWhatsappConnection = typeof whatsappConnections.$inferInsert;


/**
 * Facebook Pages
 */
export const facebookPages = mysqlTable("facebook_pages", {
  id: int("id").autoincrement().primaryKey(),
  pageId: varchar("pageId", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  accessToken: text("accessToken"), // Long-lived token
  isConnected: boolean("isConnected").default(true).notNull(),
  pictureUrl: varchar("pictureUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FacebookPage = typeof facebookPages.$inferSelect;
export type InsertFacebookPage = typeof facebookPages.$inferInsert;

/**
 * Automations / Workflows
 */
export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  triggerType: mysqlEnum("triggerType", ["lead_created", "status_changed", "message_received"]).notNull(),
  // Conditions stored as JSON, e.g., { "country": "Panama", "status": "new" }
  conditions: json("conditions").$type<Record<string, any>>(),
  // Actions stored as JSON array, e.g., [{ "type": "send_message", "payload": "Hello" }, { "type": "assign_agent", "agentId": 1 }]
  actions: json("actions").$type<any[]>(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = typeof workflows.$inferInsert;

