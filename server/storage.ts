import fs from "fs";
import path from "path";
import { ENV } from './_core/env';

// Determine if we should use local storage or external forge
// For this v1, we default to local if forge keys are missing
const USE_LOCAL = !ENV.forgeApiUrl || !ENV.forgeApiKey;

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads dir exists
if (USE_LOCAL) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log("[Storage] Created local uploads directory:", UPLOADS_DIR);
  }
}

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {

  if (USE_LOCAL) {
    const key = normalizeKey(relKey);
    // Sanitize path to prevent directory traversal
    const safeKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(UPLOADS_DIR, safeKey);

    // Ensure parent dir exists
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const buffer = typeof data === 'string'
      ? Buffer.from(data, 'utf-8')
      : Buffer.from(data);

    await fs.promises.writeFile(fullPath, buffer);

    // Construct public URL
    // We assume the app is served at HOST:PORT or via domain
    // Since we don't know the exact domain here easily without env, we make relative or best guess
    // Ideally we use a PUBLIC_URL env var.
    const baseUrl = process.env.VITE_OAUTH_PORTAL_URL || "http://localhost:3000";
    const url = `${baseUrl}/uploads/${safeKey}`;

    return { key: safeKey, url };
  }

  // Fallback to Forge (External)
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  if (USE_LOCAL) {
    const key = normalizeKey(relKey);
    const safeKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    // Check if file exists
    const fullPath = path.join(UPLOADS_DIR, safeKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error("File not found locally");
    }
    const baseUrl = process.env.VITE_OAUTH_PORTAL_URL || "http://localhost:3000";
    return {
      key: safeKey,
      url: `${baseUrl}/uploads/${safeKey}`
    };
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
