import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router, adminProcedure, permissionProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { leads, whatsappNumbers, campaigns, campaignRecipients, messages, activityLogs, users, integrations, appointments, appointmentReasons, conversations, chatMessages, whatsappConnections, appSettings, workflows, reminderTemplates } from "../drizzle/schema";
import { assertSafeOutboundUrl } from "./_core/urlSafety";
import { encryptSecret, decryptSecret, maskSecret } from "./_core/crypto";
import { sendCloudMessage } from "./whatsapp/cloud";
import { dispatchIntegrationEvent } from "./_core/integrationDispatch";
import { eq, desc, sql, and, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    markTourSeen: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return { success: false };

      await db.update(users)
        .set({ hasSeenTour: true })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
      return { success: true };
    }),

    loginWithCredentials: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) return { success: false, error: "Database not available" };

        const user = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (!user[0] || !user[0].password) {
          return { success: false, error: "Invalid credentials" };
        }

        const valid = await bcrypt.compare(input.password, user[0].password);
        if (!valid) {
          return { success: false, error: "Invalid credentials" };
        }

        const sessionToken = await sdk.createSessionToken(user[0].openId, {
          name: user[0].name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user[0].id));

        return { success: true };
      }),
  }),

  // --- Pro Settings / Team / RBAC ---
  settings: router({
    /**
     * Settings panel (only admin/owner)
     */
    get: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;

      const rows = await db.select().from(appSettings).limit(1);
      if (rows.length === 0) {
        await db.insert(appSettings).values({
          companyName: "Imagine Lab CRM",
          timezone: "America/Asuncion",
          language: "es",
          currency: "PYG",
          permissionsMatrix: {
            owner: ["*"],
            admin: [
              "dashboard.*",
              "leads.*",
              "kanban.*",
              "campaigns.*",
              "chat.*",
              "scheduling.*",
              "monitoring.*",
              "analytics.*",
              "reports.*",
              "integrations.*",
              "settings.*",
              "users.*",
            ],
            supervisor: [
              "dashboard.view",
              "leads.view",
              "kanban.view",
              "chat.*",
              "monitoring.*",
              "analytics.view",
              "reports.view",
            ],
            agent: ["dashboard.view", "leads.*", "kanban.*", "chat.*", "scheduling.*"],
            viewer: ["dashboard.view", "leads.view", "kanban.view", "analytics.view", "reports.view"],
          },
          scheduling: { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
        });
        const seeded = await db.select().from(appSettings).limit(1);
        return seeded[0] ?? null;
      }

      return rows[0] ?? null;
    }),

    updateGeneral: adminProcedure
      .input(
        z.object({
          companyName: z.string().min(1).max(120).optional(),
          logoUrl: z.string().url().optional().nullable(),
          timezone: z.string().min(1).max(60).optional(),
          language: z.string().min(2).max(10).optional(),
          currency: z.string().min(1).max(10).optional(),
          scheduling: z
            .object({
              slotMinutes: z.number().min(5).max(120),
              maxPerSlot: z.number().min(1).max(20),
              allowCustomTime: z.boolean(),
            })
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({
            companyName: input.companyName ?? "Imagine Lab CRM",
            logoUrl: input.logoUrl ?? null,
            timezone: input.timezone ?? "America/Asuncion",
            language: input.language ?? "es",
            currency: input.currency ?? "PYG",
            permissionsMatrix: undefined,
            scheduling: input.scheduling ?? { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true },
          });
        } else {
          await db.update(appSettings).set({
            ...(input.companyName ? { companyName: input.companyName } : {}),
            ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
            ...(input.timezone ? { timezone: input.timezone } : {}),
            ...(input.language ? { language: input.language } : {}),
            ...(input.currency ? { currency: input.currency } : {}),
            ...(input.scheduling ? { scheduling: input.scheduling } : {}),
          });
        }

        return { success: true } as const;
      }),

    updatePermissionsMatrix: adminProcedure
      .input(z.object({ permissionsMatrix: z.record(z.string(), z.array(z.string())) }))
      .mutation(async ({ input, ctx }) => {
        if ((ctx.user as any).role !== "owner") {
          throw new Error("Only owner can change permissions");
        }
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({ permissionsMatrix: input.permissionsMatrix as any });
        } else {
          await db.update(appSettings).set({ permissionsMatrix: input.permissionsMatrix as any });
        }
        return { success: true } as const;
      }),

    updateDashboardConfig: adminProcedure
      .input(z.record(z.string(), z.boolean()))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(appSettings).limit(1);
        if (existing.length === 0) {
          await db.insert(appSettings).values({ dashboardConfig: input });
        } else {
          await db.update(appSettings).set({ dashboardConfig: input });
        }
        return { success: true };
      }),

    getScheduling: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true };
      const rows = await db.select().from(appSettings).limit(1);
      return (rows[0] as any)?.scheduling ?? { slotMinutes: 15, maxPerSlot: 6, allowCustomTime: true };
    }),

    myPermissions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db || !ctx.user) return { role: ctx.user?.role ?? "agent", permissions: [] };
      const rows = await db.select().from(appSettings).limit(1);
      const matrix = (rows[0] as any)?.permissionsMatrix ?? {};
      const role = (ctx.user as any).role ?? "agent";
      return { role, permissions: role === "owner" ? ["*"] : (matrix[role] ?? []) };
    }),
  }),

  // Scheduling Router (New)
  scheduling: router({
    getTemplates: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(reminderTemplates).where(eq(reminderTemplates.isActive, true));
    }),

    saveTemplate: permissionProcedure("scheduling.manage")
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        content: z.string().min(1),
        daysBefore: z.number().min(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");
        if (input.id) {
          await db.update(reminderTemplates).set({
            name: input.name, content: input.content, daysBefore: input.daysBefore
          }).where(eq(reminderTemplates.id, input.id));
          return { success: true, id: input.id };
        } else {
          const res = await db.insert(reminderTemplates).values({
            name: input.name, content: input.content, daysBefore: input.daysBefore, isActive: true
          });
          return { success: true, id: res[0].insertId };
        }
      }),

    deleteTemplate: permissionProcedure("scheduling.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB error");
        await db.delete(reminderTemplates).where(eq(reminderTemplates.id, input.id));
        return { success: true };
      }),
  }),

  // Team management (only admin/owner)
  team: router({
    listUsers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select({
        id: users.id,
        openId: users.openId,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      }).from(users).orderBy(desc(users.createdAt));
    }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["owner", "admin", "supervisor", "agent", "viewer"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Only owner can assign owner role
        if (input.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can assign owner");
        }

        // Nobody can downgrade owner except owner itself
        const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can change another owner");
        }

        await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
        return { success: true } as const;
      }),

    setActive: adminProcedure
      .input(z.object({ userId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const target = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (target[0]?.role === "owner" && (ctx.user as any).role !== "owner") {
          throw new Error("Only owner can disable owner");
        }

        await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
        return { success: true } as const;
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6), // Password required for manual creation
        role: z.enum(["admin", "supervisor", "agent", "viewer"]), // Owner cannot be created this way
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if email already exists
        const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (existing.length > 0) {
          throw new Error("User with this email already exists");
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const openId = `local_${nanoid(16)}`; // Generate unique openId for local users

        const result = await db.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          loginMethod: "credentials",
          isActive: true,
          hasSeenTour: false,
        });

        return { id: result[0].insertId, success: true };
      }),
  }),

  // Dashboard router
  dashboard: router({
    getStats: permissionProcedure("dashboard.view").query(async () => {
      const db = await getDb();
      if (!db) {
        return {
          totalLeads: 0,
          totalNumbers: 0,
          activeNumbers: 0,
          warmingUpNumbers: 0,
          blockedNumbers: 0,
          messagesToday: 0,
          conversionRate: 0,
          warmupNumbers: [],
          countriesDistribution: [],
          recentLeads: [],
        };
      }

      // Get lead counts
      const leadCount = await db.select({ count: count() }).from(leads);
      const totalLeads = leadCount[0]?.count ?? 0;

      // Get number stats
      const numberStats = await db.select({
        status: whatsappNumbers.status,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.status);

      const totalNumbers = numberStats.reduce((acc, s) => acc + s.count, 0);
      const activeNumbers = numberStats.find(s => s.status === 'active')?.count ?? 0;
      const warmingUpNumbers = numberStats.find(s => s.status === 'warming_up')?.count ?? 0;
      const blockedNumbers = numberStats.find(s => s.status === 'blocked')?.count ?? 0;

      // Get messages sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const messagesTodayResult = await db.select({
        total: sql<number>`SUM(${whatsappNumbers.messagesSentToday})`,
      }).from(whatsappNumbers);
      const messagesToday = messagesTodayResult[0]?.total ?? 0;

      // Get conversion rate
      const wonLeads = await db.select({ count: count() })
        .from(leads)
        .where(eq(leads.status, 'won'));
      const conversionRate = totalLeads > 0
        ? Math.round((wonLeads[0]?.count ?? 0) / totalLeads * 100)
        : 0;

      // Get warmup numbers
      const warmupNumbers = await db.select()
        .from(whatsappNumbers)
        .where(eq(whatsappNumbers.status, 'warming_up'))
        .orderBy(desc(whatsappNumbers.warmupDay))
        .limit(5);

      // Get countries distribution
      const countriesDistribution = await db.select({
        country: whatsappNumbers.country,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.country);

      // Get recent leads
      const recentLeads = await db.select()
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(5);

      return {
        totalLeads,
        totalNumbers,
        activeNumbers,
        warmingUpNumbers,
        blockedNumbers,
        messagesToday,
        conversionRate,
        warmupNumbers,
        countriesDistribution,
        recentLeads,
      };
    }),
  }),

  // Leads router
  leads: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().default(10)
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const term = `%${input.query}%`;
        return db.select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          email: leads.email
        })
          .from(leads)
          .where(sql`(${leads.name} LIKE ${term} OR ${leads.phone} LIKE ${term})`)
          .limit(input.limit);
      }),

    list: permissionProcedure("leads.view")
      .input(z.object({
        status: z.enum(['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        let query = db.select().from(leads);

        if (input?.status) {
          query = query.where(eq(leads.status, input.status)) as typeof query;
        }

        return query
          .orderBy(desc(leads.createdAt))
          .limit(input?.limit ?? 50)
          .offset(input?.offset ?? 0);
      }),
    getById: permissionProcedure("leads.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(leads)
          .where(eq(leads.id, input.id))
          .limit(1);

        const row = result[0] ?? null;

        if (!row) return null;

        return row;
      }),
    create: permissionProcedure("leads.create")
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
        country: z.string().min(1),
        source: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Calculate commission based on country
        const commission = input.country.toLowerCase() === 'panamá' || input.country.toLowerCase() === 'panama'
          ? '10000.00'
          : '5000.00';

        const result = await db.insert(leads).values({
          ...input,
          commission,
          assignedToId: ctx.user?.id,
        });

        return { id: result[0].insertId, success: true };
      }),
    update: permissionProcedure("leads.update")
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        country: z.string().min(1).optional(),
        status: z.enum(['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost']).optional(),
        source: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, ...data } = input;

        // Recalculate commission if country changed
        if (data.country) {
          (data as Record<string, unknown>).commission = data.country.toLowerCase() === 'panamá' || data.country.toLowerCase() === 'panama'
            ? '10000.00'
            : '5000.00';
        }

        await db.update(leads)
          .set(data)
          .where(eq(leads.id, id));

        return { success: true };
      }),
    updateStatus: permissionProcedure("leads.update")
      .input(z.object({
        id: z.number(),
        status: z.enum(['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(leads)
          .set({ status: input.status })
          .where(eq(leads.id, input.id));

        return { success: true };
      }),
    delete: permissionProcedure("leads.delete")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(leads).where(eq(leads.id, input.id));
        return { success: true };
      }),
    getByStatus: permissionProcedure("leads.view").query(async () => {
      const db = await getDb();
      if (!db) return {
        new: [],
        contacted: [],
        qualified: [],
        negotiation: [],
        won: [],
        lost: [],
      };

      const allLeads = await db.select().from(leads).orderBy(desc(leads.createdAt));

      return {
        new: allLeads.filter(l => l.status === 'new'),
        contacted: allLeads.filter(l => l.status === 'contacted'),
        qualified: allLeads.filter(l => l.status === 'qualified'),
        negotiation: allLeads.filter(l => l.status === 'negotiation'),
        won: allLeads.filter(l => l.status === 'won'),
        lost: allLeads.filter(l => l.status === 'lost'),
      };
    }),
  }),

  // WhatsApp Numbers router
  whatsappNumbers: router({
    list: permissionProcedure("monitoring.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(whatsappNumbers)
        .orderBy(desc(whatsappNumbers.createdAt));
    }),

    getById: permissionProcedure("monitoring.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select({
          number: whatsappNumbers,
          connection: whatsappConnections,
        })
          .from(whatsappNumbers)
          .leftJoin(whatsappConnections, eq(whatsappNumbers.id, whatsappConnections.whatsappNumberId))
          .where(eq(whatsappNumbers.id, input.id))
          .limit(1);

        const row = result[0];
        if (!row) return null;

        return {
          ...row.number,
          accessToken: row.connection?.accessToken ? maskSecret(row.connection.accessToken) : null,
          hasAccessToken: Boolean(row.connection?.accessToken),
        } as any;
      }),

    create: permissionProcedure("monitoring.manage")
      .input(z.object({
        phoneNumber: z.string().min(1),
        displayName: z.string().optional(),
        country: z.string().min(1),
        countryCode: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(whatsappNumbers).values({
          ...input,
          status: 'warming_up',
          warmupDay: 0,
          warmupStartDate: new Date(),
          dailyMessageLimit: 20,
        });

        return { id: result[0].insertId, success: true };
      }),

    updateStatus: permissionProcedure("monitoring.manage")
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'warming_up', 'blocked', 'disconnected']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(whatsappNumbers)
          .set({ status: input.status })
          .where(eq(whatsappNumbers.id, input.id));

        return { success: true };
      }),

    updateConnection: permissionProcedure("monitoring.manage")
      .input(z.object({
        id: z.number(),
        isConnected: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(whatsappNumbers)
          .set({
            isConnected: input.isConnected,
            lastConnected: input.isConnected ? new Date() : undefined,
          })
          .where(eq(whatsappNumbers.id, input.id));

        return { success: true };
      }),

    delete: permissionProcedure("monitoring.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(whatsappNumbers).where(eq(whatsappNumbers.id, input.id));
        return { success: true };
      }),

    getStats: permissionProcedure("monitoring.view").query(async () => {
      const db = await getDb();
      if (!db) return {
        total: 0,
        byStatus: [],
        byCountry: [],
      };

      const total = await db.select({ count: count() }).from(whatsappNumbers);

      const byStatus = await db.select({
        status: whatsappNumbers.status,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.status);

      const byCountry = await db.select({
        country: whatsappNumbers.country,
        count: count(),
      }).from(whatsappNumbers).groupBy(whatsappNumbers.country);

      return {
        total: total[0]?.count ?? 0,
        byStatus,
        byCountry,
      };
    }),

    updateCredentials: permissionProcedure("monitoring.manage")
      .input(z.object({
        id: z.number(),
        phoneNumberId: z.string().min(1),
        businessAccountId: z.string().min(1),
        accessToken: z.string().min(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Check if connection exists
        const existing = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(whatsappConnections).values({
            whatsappNumberId: input.id,
            connectionType: 'api',
            phoneNumberId: input.phoneNumberId,
            businessAccountId: input.businessAccountId,
            accessToken: input.accessToken ? encryptSecret(input.accessToken) : null,
            isConnected: true,
            lastPingAt: new Date(),
          });
        } else {
          await db.update(whatsappConnections)
            .set({
              phoneNumberId: input.phoneNumberId,
              businessAccountId: input.businessAccountId,
              ...(input.accessToken ? { accessToken: encryptSecret(input.accessToken) } : {}),
              isConnected: true,
              lastPingAt: new Date(),
            })
            .where(eq(whatsappConnections.whatsappNumberId, input.id));
        }

        // Also update number status to active if it was warming_up
        await db.update(whatsappNumbers)
          .set({ isConnected: true })
          .where(eq(whatsappNumbers.id, input.id));

        return { success: true };
      }),
  }),

  // Campaigns router
  campaigns: router({
    list: permissionProcedure("campaigns.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt));
    }),

    getById: permissionProcedure("campaigns.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(campaigns)
          .where(eq(campaigns.id, input.id))
          .limit(1);

        return result[0] ?? null;
      }),

    create: permissionProcedure("campaigns.manage")
      .input(z.object({
        name: z.string().min(1),
        message: z.string().min(1),
        scheduledAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(campaigns).values({
          ...input,
          createdById: ctx.user?.id,
        });

        return { id: result[0].insertId, success: true };
      }),

    updateStatus: permissionProcedure("campaigns.manage")
      .input(z.object({
        id: z.number(),
        status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled']),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const updateData: Record<string, unknown> = { status: input.status };

        if (input.status === 'running') {
          updateData.startedAt = new Date();
        } else if (input.status === 'completed') {
          updateData.completedAt = new Date();
        }

        await db.update(campaigns)
          .set(updateData)
          .where(eq(campaigns.id, input.id));

        return { success: true };
      }),

    delete: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(campaigns).where(eq(campaigns.id, input.id));
        return { success: true };
      }),
  }),

  // Integrations router
  integrations: router({
    list: permissionProcedure("integrations.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(integrations)
        .orderBy(desc(integrations.createdAt));
    }),

    getById: permissionProcedure("integrations.view")
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(integrations)
          .where(eq(integrations.id, input.id))
          .limit(1);

        return result[0] ?? null;
      }),

    create: permissionProcedure("integrations.manage")
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(['n8n', 'chatwoot', 'zapier', 'webhook']),
        webhookUrl: z.string().url(),
        whatsappNumberId: z.number(),
        events: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await assertSafeOutboundUrl(input.webhookUrl);

        const result = await db.insert(integrations).values({
          ...input,
          events: input.events ?? ['message_received', 'lead_created', 'lead_updated', 'campaign_sent'],
          createdById: ctx.user?.id,
          isActive: true,
        });

        return { id: result[0].insertId, success: true };
      }),

    update: permissionProcedure("integrations.manage")
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        webhookUrl: z.string().url().optional(),
        whatsappNumberId: z.number().optional(),
        isActive: z.boolean().optional(),
        events: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        if (input.webhookUrl) {
          await assertSafeOutboundUrl(input.webhookUrl);
        }

        const { id, ...updateData } = input;
        await db.update(integrations)
          .set(updateData)
          .where(eq(integrations.id, id));

        return { success: true };
      }),

    delete: permissionProcedure("integrations.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(integrations).where(eq(integrations.id, input.id));
        return { success: true };
      }),

    toggle: permissionProcedure("integrations.manage")
      .input(z.object({
        id: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(integrations)
          .set({ isActive: input.isActive })
          .where(eq(integrations.id, input.id));

        return { success: true };
      }),

    testWebhook: permissionProcedure("integrations.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const integration = await db.select()
          .from(integrations)
          .where(eq(integrations.id, input.id))
          .limit(1);

        if (!integration[0]) throw new Error("Integration not found");

        await assertSafeOutboundUrl(integration[0].webhookUrl);

        // Test webhook by sending a test payload
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10_000);

          const response = await fetch(integration[0].webhookUrl, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              event: 'test',
              timestamp: new Date().toISOString(),
              data: { message: 'Test from Imagine Lab CRM' },
            }),
          });

          clearTimeout(timeout);

          if (response.ok) {
            await db.update(integrations)
              .set({ lastTriggeredAt: new Date() })
              .where(eq(integrations.id, input.id));
            return { success: true, status: response.status };
          } else {
            return { success: false, status: response.status, error: 'Webhook returned error' };
          }
        } catch (error) {
          return { success: false, error: 'Failed to connect to webhook' };
        }
      }),
  }),

  // Scheduling router
  scheduling: router({
    list: permissionProcedure("scheduling.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(appointments)
        .orderBy(desc(appointments.appointmentDate));
    }),

    listReasons: permissionProcedure("scheduling.view").query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db.select()
        .from(appointmentReasons)
        .where(eq(appointmentReasons.isActive, true))
        .orderBy(appointmentReasons.name);
    }),

    create: permissionProcedure("scheduling.manage")
      .input(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().optional(),
        reasonId: z.number().optional(),
        appointmentDate: z.string(),
        appointmentTime: z.string().min(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Normalize to midnight to avoid timezone drift and make equality checks consistent
        const normalizedDate = new Date(input.appointmentDate);
        normalizedDate.setHours(0, 0, 0, 0);

        // Load scheduling rules
        const settingsRows = await db.select().from(appSettings).limit(1);
        const maxPerSlot = (settingsRows[0] as any)?.scheduling?.maxPerSlot ?? 6;

        // Allow up to N appointments per exact time slot (configurable in Settings)
        const existing = await db
          .select({ count: count() })
          .from(appointments)
          .where(
            and(
              eq(appointments.appointmentDate, normalizedDate),
              eq(appointments.appointmentTime, input.appointmentTime)
            )
          );

        const existingCount = existing[0]?.count ?? 0;
        if (existingCount >= maxPerSlot) {
          throw new Error(
            `Ese horario ya está completo (máximo ${maxPerSlot} personas). Elegí otro horario.`
          );
        }

        const result = await db.insert(appointments).values({
          ...input,
          appointmentDate: normalizedDate,
          createdById: ctx.user?.id,
        });

        return { id: result[0].insertId, success: true };
      }),

    update: permissionProcedure("scheduling.manage")
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        reasonId: z.number().optional(),
        appointmentDate: z.string().optional(),
        appointmentTime: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { id, appointmentDate, ...rest } = input;
        const updateData: Record<string, unknown> = { ...rest };
        if (appointmentDate) {
          updateData.appointmentDate = new Date(appointmentDate);
        }

        await db.update(appointments)
          .set(updateData)
          .where(eq(appointments.id, id));

        return { success: true };
      }),

    delete: permissionProcedure("scheduling.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.delete(appointments).where(eq(appointments.id, input.id));
        return { success: true };
      }),

    createReason: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(appointmentReasons).values(input);
        return { id: result[0].insertId, success: true };
      }),

    deleteReason: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(appointmentReasons)
          .set({ isActive: false })
          .where(eq(appointmentReasons.id, input.id));
        return { success: true };
      }),
  }),

  // Conversations/Chat router
  chat: router({
    listConversations: permissionProcedure("chat.view")
      .input(z.object({ whatsappNumberId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        if (input.whatsappNumberId) {
          return db.select()
            .from(conversations)
            .where(eq(conversations.whatsappNumberId, input.whatsappNumberId))
            .orderBy(desc(conversations.lastMessageAt));
        }

        return db.select()
          .from(conversations)
          .orderBy(desc(conversations.lastMessageAt));
      }),

    getMessages: permissionProcedure("chat.view")
      .input(z.object({ conversationId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        return db.select()
          .from(chatMessages)
          .where(eq(chatMessages.conversationId, input.conversationId))
          .orderBy(chatMessages.createdAt);
      }),

    /**
     * Live monitoring feed for supervisors.
     * Returns the most recent messages across all conversations.
     */
    getRecentMessages: permissionProcedure("monitoring.view")
      .input(
        z.object({
          limit: z.number().min(10).max(200).default(50),
          whatsappNumberId: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];

        const baseQuery = db
          .select({
            id: chatMessages.id,
            conversationId: chatMessages.conversationId,
            whatsappNumberId: chatMessages.whatsappNumberId,
            direction: chatMessages.direction,
            messageType: chatMessages.messageType,
            content: chatMessages.content,
            mediaUrl: chatMessages.mediaUrl,
            status: chatMessages.status,
            createdAt: chatMessages.createdAt,
            contactPhone: conversations.contactPhone,
            contactName: conversations.contactName,
            conversationStatus: conversations.status,
            unreadCount: conversations.unreadCount,
            lastMessageAt: conversations.lastMessageAt,
          })
          .from(chatMessages)
          .innerJoin(conversations, eq(chatMessages.conversationId, conversations.id));

        const whereClause = input.whatsappNumberId
          ? eq(chatMessages.whatsappNumberId, input.whatsappNumberId)
          : undefined;

        const rows = whereClause
          ? await baseQuery
            .where(whereClause)
            .orderBy(desc(chatMessages.createdAt))
            .limit(input.limit)
          : await baseQuery
            .orderBy(desc(chatMessages.createdAt))
            .limit(input.limit);

        return rows;
      }),

    markAsRead: permissionProcedure("chat.view")
      .input(z.object({
        conversationId: z.number(),
        whatsappNumberId: z.number().optional(), // optional if we just use convo
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Update local messages status
        await db.update(chatMessages)
          .set({ status: 'read', readAt: new Date() })
          .where(and(
            eq(chatMessages.conversationId, input.conversationId),
            eq(chatMessages.direction, 'inbound'),
            eq(chatMessages.status, 'delivered') // or pending
          ));

        // Reset unread count
        await db.update(conversations)
          .set({ unreadCount: 0 })
          .where(eq(conversations.id, input.conversationId));

        return { success: true };
      }),

    sendMessage: permissionProcedure("chat.send")
      .input(z.object({
        conversationId: z.number(),
        whatsappNumberId: z.number().optional(),
        facebookPageId: z.number().optional(),
        messageType: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'contact', 'template']),
        content: z.string().optional(),
        mediaUrl: z.string().optional(),
        mediaName: z.string().optional(),
        mediaMimeType: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        locationName: z.string().optional(),
        // Template specific
        templateName: z.string().optional(),
        templateLanguage: z.string().optional(),
        templateComponents: z.array(z.any()).optional(),
        // Facebook specific
        isFacebook: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const now = new Date();

        // Lookup conversation to determine channel
        const convRows = await db.select()
          .from(conversations)
          .where(eq(conversations.id, input.conversationId))
          .limit(1);
        const conv = convRows[0];
        if (!conv) throw new Error("Conversation not found");

        const isFacebook = conv.channel === 'facebook';

        const insertRes = await db.insert(chatMessages).values({
          conversationId: input.conversationId,
          whatsappNumberId: isFacebook ? null : (input.whatsappNumberId || conv.whatsappNumberId),
          facebookPageId: isFacebook ? (input.facebookPageId || conv.facebookPageId) : null,
          direction: 'outbound',
          messageType: input.messageType,
          content: input.content ?? (input.templateName ? `Template: ${input.templateName}` : null),
          mediaUrl: input.mediaUrl ?? null,
          mediaName: input.mediaName ?? null,
          mediaMimeType: input.mediaMimeType ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          locationName: input.locationName ?? null,
          status: 'pending',
        } as any);

        const id = insertRes[0].insertId as number;

        // Update conversation lastMessageAt
        await db.update(conversations)
          .set({ lastMessageAt: now })
          .where(eq(conversations.id, input.conversationId));

        if (isFacebook) {
          // --- FACEBOOK SEND LOGIC ---
          const pageId = input.facebookPageId || conv.facebookPageId;
          if (!pageId) throw new Error("Falta facebookPageId");

          // Get Page Access Token
          const { facebookPages } = await import("../drizzle/schema");
          const pageRows = await db.select().from(facebookPages).where(eq(facebookPages.id, pageId)).limit(1);
          const page = pageRows[0];

          if (!page || !page.accessToken) throw new Error("Página de Facebook no conectada o sin token");

          const accessToken = decryptSecret(page.accessToken) || page.accessToken;
          if (!accessToken) throw new Error("Error desencriptando token de Facebook");

          const { sendFacebookMessage } = await import("./_core/facebook");

          // Construct message payload
          let messagePayload: any = {};

          if (input.messageType === 'text') {
            if (!input.content) throw new Error("Mensaje vacío");
            messagePayload = { text: input.content };
          } else if (['image', 'video', 'audio', 'file'].includes(input.messageType)) {
            if (!input.mediaUrl) throw new Error("Falta URL de multimedia");
            messagePayload = {
              attachment: {
                type: input.messageType === 'document' ? 'file' : input.messageType,
                payload: { url: input.mediaUrl, is_reusable: true }
              }
            };
          } else {
            throw new Error(`Tipo de mensaje no soportado para Facebook: ${input.messageType}`);
          }

          try {
            const res = await sendFacebookMessage({
              accessToken,
              recipientId: conv.contactPhone, // In FB, contactPhone holds the PSID
              message: messagePayload
            });

            await db.update(chatMessages)
              .set({
                status: 'sent',
                facebookMessageId: res.messageId,
                sentAt: now,
              })
              .where(eq(chatMessages.id, id));

            return { id, success: true, sent: true };
          } catch (err: any) {
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: err.message, failedAt: now })
              .where(eq(chatMessages.id, id));
            throw err;
          }
        } else {
          // --- WHATSAPP SEND LOGIC ---
          const whatsappNumberId = input.whatsappNumberId || conv.whatsappNumberId;
          if (!whatsappNumberId) throw new Error("Falta whatsappNumberId");

          // Lookup WhatsApp API connection
          const connRows = await db.select()
            .from(whatsappConnections)
            .where(eq(whatsappConnections.whatsappNumberId, whatsappNumberId))
            .limit(1);
          const conn = connRows[0];

          // If not connected via API, keep it pending
          if (!conn || conn.connectionType !== 'api' || !conn.isConnected) {
            return { id, success: true, queued: true } as const;
          }

          const token = decryptSecret(conn.accessToken ?? '') ?? (conn.accessToken ?? null);
          if (!token) {
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: 'Missing accessToken', failedAt: now })
              .where(eq(chatMessages.id, id));
            throw new Error('WhatsApp API no configurada (accessToken faltante)');
          }
          if (!conn.phoneNumberId) {
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: 'Missing phoneNumberId', failedAt: now })
              .where(eq(chatMessages.id, id));
            throw new Error('WhatsApp API no configurada (phoneNumberId faltante)');
          }

          // Build Cloud API payload
          const mt = input.messageType;
          let payload: any;
          let waMessageId: string | undefined;

          try {
            if (mt === 'template') {
              if (!input.templateName) throw new Error("Missing templateName");
              const { sendCloudTemplate } = await import("./whatsapp/cloud");
              const res = await sendCloudTemplate({
                accessToken: token,
                phoneNumberId: conn.phoneNumberId,
                to: conv.contactPhone,
                templateName: input.templateName,
                languageCode: input.templateLanguage || "es",
                components: input.templateComponents,
              });
              waMessageId = res.messageId;

            } else {
              // Standard media/text
              if (mt === 'text') {
                const body = (input.content ?? '').trim();
                if (!body) throw new Error('El mensaje de texto está vacío');
                payload = { type: 'text', body };
              } else if (mt === 'image' || mt === 'video' || mt === 'audio') {
                if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                payload = { type: mt, link: input.mediaUrl, caption: input.content || undefined };
              } else if (mt === 'document') {
                if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                payload = {
                  type: 'document',
                  link: input.mediaUrl,
                  caption: input.content || undefined,
                  filename: input.mediaName || undefined,
                };
              } else if (mt === 'location') {
                if (input.latitude == null || input.longitude == null) throw new Error('Faltan coordenadas');
                payload = {
                  type: 'location',
                  latitude: input.latitude,
                  longitude: input.longitude,
                  name: input.locationName || undefined,
                };
              } else if (mt === 'sticker') {
                if (!input.mediaUrl) throw new Error('Falta mediaUrl');
                payload = { type: 'sticker', link: input.mediaUrl };
              } else if (mt === 'contact') {
                const vcard = (input.content ?? '').trim();
                if (!vcard) throw new Error('Falta vCard para contacto');
                payload = { type: 'contact', vcard };
              }

              // Send standard message
              const res = await sendCloudMessage({
                accessToken: token,
                phoneNumberId: conn.phoneNumberId,
                to: conv.contactPhone,
                payload,
              });
              waMessageId = res.messageId;
            }

            // Update DB on success
            await db.update(chatMessages)
              .set({
                status: 'sent',
                whatsappMessageId: waMessageId,
                sentAt: now,
                errorMessage: null,
                failedAt: null,
              })
              .where(eq(chatMessages.id, id));

            // Bump counters
            await db.update(whatsappNumbers)
              .set({
                messagesSentToday: sql`${whatsappNumbers.messagesSentToday} + 1`,
                totalMessagesSent: sql`${whatsappNumbers.totalMessagesSent} + 1`,
                lastConnected: now,
              })
              .where(eq(whatsappNumbers.id, whatsappNumberId));

            void dispatchIntegrationEvent({
              whatsappNumberId: whatsappNumberId,
              event: "message_sent",
              data: {
                conversationId: input.conversationId,
                chatMessageId: id,
                whatsappMessageId: waMessageId,
                to: conv.contactPhone,
                messageType: mt,
                content: input.content ?? null,
                mediaUrl: input.mediaUrl ?? null,
              },
            });

            return { id, success: true, sent: true, whatsappMessageId: waMessageId } as const;

          } catch (e: any) {
            const message = e?.message ? String(e.message) : 'Failed to send';
            await db.update(chatMessages)
              .set({ status: 'failed', errorMessage: message, failedAt: now })
              .where(eq(chatMessages.id, id));
            throw new Error(message);
          }
        }
      }),

    createConversation: permissionProcedure("chat.send")
      .input(z.object({
        whatsappNumberId: z.number().optional(),
        facebookPageId: z.number().optional(),
        contactPhone: z.string(),
        contactName: z.string().optional(),
        leadId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const channel = input.facebookPageId ? 'facebook' : 'whatsapp';

        // Validate required ID based on channel
        if (channel === 'whatsapp' && !input.whatsappNumberId) {
          throw new Error("Falta whatsappNumberId");
        }
        if (channel === 'facebook' && !input.facebookPageId) {
          throw new Error("Falta facebookPageId");
        }

        const result = await db.insert(conversations).values({
          channel,
          whatsappNumberId: input.whatsappNumberId ?? null,
          facebookPageId: input.facebookPageId ?? null,
          contactPhone: input.contactPhone,
          contactName: input.contactName,
          leadId: input.leadId,
          lastMessageAt: new Date(),
          status: 'active',
        } as any);

        return { id: result[0].insertId, success: true };
      }),
  }),

  // WhatsApp connections router
  whatsappConnections: router({
    get: permissionProcedure("monitoring.view")
      .input(z.object({ whatsappNumberId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
          .limit(1);

        const row = result[0] ?? null;
        if (!row) return null;

        return {
          ...row,
          accessToken: row.accessToken ? maskSecret(row.accessToken) : null,
          hasAccessToken: Boolean(row.accessToken),
        } as any;
      }),

    setupApi: permissionProcedure("monitoring.manage")
      .input(z.object({
        whatsappNumberId: z.number(),
        accessToken: z.string(),
        phoneNumberId: z.string(),
        businessAccountId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        let encryptedToken: string;
        try {
          encryptedToken = encryptSecret(input.accessToken);
        } catch {
          throw new Error("Falta DATA_ENCRYPTION_KEY para encriptar el accessToken");
        }

        // Check if connection exists
        const existing = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
          .limit(1);

        if (existing[0]) {
          await db.update(whatsappConnections)
            .set({
              connectionType: 'api',
              accessToken: encryptedToken,
              phoneNumberId: input.phoneNumberId,
              businessAccountId: input.businessAccountId,
              isConnected: true,
            })
            .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));
        } else {
          await db.insert(whatsappConnections).values({
            whatsappNumberId: input.whatsappNumberId,
            connectionType: 'api',
            accessToken: encryptedToken,
            phoneNumberId: input.phoneNumberId,
            businessAccountId: input.businessAccountId,
            isConnected: true,
          });
        }

        // Update whatsapp number status
        await db.update(whatsappNumbers)
          .set({ isConnected: true, status: 'active' })
          .where(eq(whatsappNumbers.id, input.whatsappNumberId));

        return { success: true };
      }),

    generateQr: permissionProcedure("monitoring.manage")
      .input(z.object({ whatsappNumberId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Generate a placeholder QR code (in real implementation, this would connect to WhatsApp Web)
        const qrCode = `WHATSAPP_QR_${input.whatsappNumberId}_${Date.now()}`;
        const qrExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Check if connection exists
        const existing = await db.select()
          .from(whatsappConnections)
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId))
          .limit(1);

        if (existing[0]) {
          await db.update(whatsappConnections)
            .set({
              connectionType: 'qr',
              qrCode,
              qrExpiresAt,
              isConnected: false,
            })
            .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));
        } else {
          await db.insert(whatsappConnections).values({
            whatsappNumberId: input.whatsappNumberId,
            connectionType: 'qr',
            qrCode,
            qrExpiresAt,
            isConnected: false,
          });
        }

        return { qrCode, expiresAt: qrExpiresAt };
      }),

    disconnect: permissionProcedure("monitoring.manage")
      .input(z.object({ whatsappNumberId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db.update(whatsappConnections)
          .set({ isConnected: false })
          .where(eq(whatsappConnections.whatsappNumberId, input.whatsappNumberId));

        await db.update(whatsappNumbers)
          .set({ isConnected: false, status: 'disconnected' })
          .where(eq(whatsappNumbers.id, input.whatsappNumberId));

        return { success: true };
      }),
  }),


  // Facebook Router
  facebook: router({
    listPages: permissionProcedure("settings.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { facebookPages } = await import("../drizzle/schema"); // Lazy load or assume verified
      return db.select().from(facebookPages).orderBy(desc(facebookPages.createdAt));
    }),

    connectPage: permissionProcedure("settings.manage")
      .input(z.object({
        pageId: z.string(),
        name: z.string(),
        accessToken: z.string(),
        pictureUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { facebookPages } = await import("../drizzle/schema");

        const existing = await db.select().from(facebookPages).where(eq(facebookPages.pageId, input.pageId)).limit(1);

        if (existing[0]) {
          await db.update(facebookPages).set({
            name: input.name,
            accessToken: encryptSecret(input.accessToken),
            pictureUrl: input.pictureUrl,
            isConnected: true,
            updatedAt: new Date(),
          }).where(eq(facebookPages.id, existing[0].id));
        } else {
          await db.insert(facebookPages).values({
            pageId: input.pageId,
            name: input.name,
            accessToken: encryptSecret(input.accessToken),
            pictureUrl: input.pictureUrl,
            isConnected: true,
          });
        }
        return { success: true };
      }),

    disconnectPage: permissionProcedure("settings.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { facebookPages } = await import("../drizzle/schema");

        await db.update(facebookPages)
          .set({ isConnected: false, accessToken: null })
          .where(eq(facebookPages.id, input.id));
        return { success: true };
      }),
  }),

  // Automations router
  automations: router({
    list: permissionProcedure("campaigns.view").query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(workflows).orderBy(desc(workflows.createdAt));
    }),

    create: permissionProcedure("campaigns.manage")
      .input(z.object({
        name: z.string().min(1),
        triggerType: z.enum(["lead_created", "status_changed", "message_received"]),
        conditions: z.record(z.any()).optional(),
        actions: z.array(z.any()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const result = await db.insert(workflows).values({
          ...input,
          isActive: true
        });
        return { success: true, id: result[0].insertId };
      }),

    toggle: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(workflows).set({ isActive: input.isActive }).where(eq(workflows.id, input.id));
        return { success: true };
      }),

    delete: permissionProcedure("campaigns.manage")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(workflows).where(eq(workflows.id, input.id));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
