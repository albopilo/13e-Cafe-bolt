import { createClient } from "npm:@supabase/supabase-js@2";

const OLSERA_API_BASE = "https://api-open.olsera.co.id";

export interface OlseraToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_refresh_token: number;
}

/**
 * Get a valid Olsera access token, using the cached token if still fresh,
 * or requesting a new one via app_id + secret_key.
 * Returns null if Olsera credentials are not configured.
 */
export async function getOlseraAccessToken(): Promise<string | null> {
  const appId = Deno.env.get("OLSSERA_APP_ID");
  const secretKey = Deno.env.get("OLSSERA_SECRET_KEY");

  if (!appId || !secretKey) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Check cache
  const { data: cached } = await supabase
    .from("olsera_token_cache")
    .select("access_token, refresh_token, expires_at, refresh_expires_at")
    .eq("id", 1)
    .maybeSingle();

  const now = new Date();

  // If cached token is still valid (with 5 min buffer), use it
  if (cached && cached.access_token && new Date(cached.expires_at) > new Date(now.getTime() + 5 * 60 * 1000)) {
    return cached.access_token;
  }

  // Try refresh token first if available and not expired
  if (cached?.refresh_token && cached.refresh_expires_at && new Date(cached.refresh_expires_at) > now) {
    const refreshed = await refreshToken(cached.refresh_token);
    if (refreshed) {
      await cacheToken(supabase, refreshed);
      return refreshed.access_token;
    }
  }

  // Request new token with app_id + secret_key
  const newToken = await requestToken(appId, secretKey);
  if (newToken) {
    await cacheToken(supabase, newToken);
    return newToken.access_token;
  }

  return null;
}

async function requestToken(appId: string, secretKey: string): Promise<OlseraToken | null> {
  try {
    const resp = await fetch(`${OLSSERA_API_BASE}/token`, {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: new URLSearchParams({
        app_id: appId,
        secret_key: secretKey,
        grant_type: "secret_key",
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.access_token) return null;

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 86400,
      expires_refresh_token: data.expires_refresh_token || 2592000,
    };
  } catch {
    return null;
  }
}

async function refreshToken(refreshToken: string): Promise<OlseraToken | null> {
  try {
    const resp = await fetch(`${OLSSERA_API_BASE}/token`, {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.access_token) return null;

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: data.expires_in || 86400,
      expires_refresh_token: data.expires_refresh_token || 2592000,
    };
  } catch {
    return null;
  }
}

async function cacheToken(supabase: ReturnType<typeof createClient>, token: OlseraToken): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + token.expires_in * 1000);
  const refreshExpiresAt = new Date(now.getTime() + token.expires_refresh_token * 1000);

  await supabase
    .from("olsera_token_cache")
    .upsert({
      id: 1,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt.toISOString(),
      refresh_expires_at: refreshExpiresAt.toISOString(),
      updated_at: now.toISOString(),
    });
}

/**
 * Check if Olsera integration is configured.
 */
export function isOlseraConfigured(): boolean {
  return !!(Deno.env.get("OLSSERA_APP_ID") && Deno.env.get("OLSSERA_SECRET_KEY"));
}

/**
 * Get the Olsera Store ID for API requests.
 */
export function getOlseraStoreId(): string | null {
  return Deno.env.get("OLSSERA_STORE_ID") || null;
}

/**
 * Build common headers for Olsera API requests.
 */
export async function getOlseraHeaders(): Promise<Record<string, string> | null> {
  const accessToken = await getOlseraAccessToken();
  if (!accessToken) return null;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  const storeId = getOlseraStoreId();
  if (storeId) headers["X-Store-ID"] = storeId;
  return headers;
}
