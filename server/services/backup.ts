import { getDb } from "../db";
import { leads, campaigns, conversations, chatMessages, users, whatsappNumbers } from "../../drizzle/schema";

interface BackupData {
    version: string;
    timestamp: string;
    data: {
        leads: any[];
        campaigns: any[];
        conversations: any[];
        chatMessages: any[];
        whatsappNumbers: any[];
    };
}

/**
 * Create a full backup of critical CRM data
 */
export async function createBackup(): Promise<BackupData> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [
        leadsData,
        campaignsData,
        conversationsData,
        messagesData,
        numbersData,
    ] = await Promise.all([
        db.select().from(leads),
        db.select().from(campaigns),
        db.select().from(conversations),
        db.select().from(chatMessages),
        db.select().from(whatsappNumbers),
    ]);

    return {
        version: "1.0",
        timestamp: new Date().toISOString(),
        data: {
            leads: leadsData,
            campaigns: campaignsData,
            conversations: conversationsData,
            chatMessages: messagesData,
            whatsappNumbers: numbersData,
        },
    };
}

/**
 * Validate backup file structure
 */
export function validateBackupFile(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    if (!data.version || !data.timestamp || !data.data) return false;
    if (!data.data.leads || !Array.isArray(data.data.leads)) return false;
    return true;
}

/**
 * Convert leads to CSV format
 */
export function leadsToCSV(leadsData: any[]): string {
    if (leadsData.length === 0) return "nombre,telefono,email,pais,estado,notas\n";

    const headers = ["nombre", "telefono", "email", "pais", "estado", "notas"];
    const rows = leadsData.map(lead => [
        lead.name || "",
        lead.phone || "",
        lead.email || "",
        lead.country || "",
        lead.status || "",
        (lead.notes || "").replace(/"/g, '""'), // Escape quotes
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    return csvContent;
}

/**
 * Parse CSV and return structured data
 */
export function parseCSV(csvContent: string): any[] {
    const lines = csvContent.split("\n").filter(line => line.trim());
    if (lines.length < 2) return []; // No data

    const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ""));
        const row: any = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || "";
        });
        data.push(row);
    }

    return data;
}

/**
 * Import leads from CSV with deduplication
 */
export async function importLeadsFromCSV(csvData: any[]): Promise<{ imported: number; duplicates: number; errors: number }> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    // Get existing phone numbers for deduplication
    const existingLeads = await db.select().from(leads);
    const existingPhones = new Set(existingLeads.map(l => l.phone));

    for (const row of csvData) {
        try {
            const phone = row.telefono || row.phone;
            const name = row.nombre || row.name;

            if (!phone || !name) {
                errors++;
                continue;
            }

            // Check for duplicate
            if (existingPhones.has(phone)) {
                duplicates++;
                continue;
            }

            // Insert new lead
            await db.insert(leads).values({
                name,
                phone,
                email: row.email || null,
                country: row.pais || row.country || "Paraguay",
                status: (row.estado || row.status || "new") as any,
                notes: row.notas || row.notes || null,
            } as any);

            existingPhones.add(phone);
            imported++;
        } catch (error) {
            console.error("[Import] Failed to import lead:", error);
            errors++;
        }
    }

    return { imported, duplicates, errors };
}
