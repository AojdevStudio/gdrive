import { AuthManager } from "../auth/AuthManager.js";

type AnyObj = Record<string, unknown>;

export type ApiRequest = {
  method: string;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
};

function toQueryString(q: ApiRequest["query"]): string {
  if (!q) {
    return "";
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) {
      continue;
    }
    params.set(k, String(v));
  }

  const s = params.toString();
  return s ? `?${s}` : "";
}

export function makeGoogleApiRequest({
  auth,
  userAgent = "gdrive-mcp-codemode",
  maxResponseBytes = 2_000_000,
}: {
  auth: AuthManager;
  userAgent?: string;
  maxResponseBytes?: number;
}) {
  return async function request(req: AnyObj) {
    const r = req as ApiRequest;
    const method = (r.method || "GET").toUpperCase();
    const p = r.path;

    if (!p || typeof p !== "string" || !p.startsWith("/")) {
      throw new Error("api.request requires { path: string starting with '/' }");
    }

    // Refresh token if needed.
    if (auth.getState() !== "authenticated") {
      try {
        await auth.refreshToken();
      } catch {
        // ignore; getAccessToken will throw if unusable
      }
    }

    const oauth = auth.getOAuth2Client();
    const tokenResp = await oauth.getAccessToken();
    const token = tokenResp?.token;
    if (!token) {
      throw new Error("No access token available; authenticate first");
    }

    const qs = toQueryString(r.query);
    const url = `https://www.googleapis.com${p}${qs}`;

    const headers: Record<string, string> = {
      authorization: `Bearer ${token}`,
      "user-agent": userAgent,
      ...(r.headers || {}),
    };

    let body: string | undefined;
    if (r.body !== undefined && r.body !== null && method !== "GET" && method !== "HEAD") {
      body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
      if (!headers["content-type"]) {
        headers["content-type"] = "application/json";
      }
    }

    const resp = await fetch(url, { method, headers, body: body ?? null });

    const ab = await resp.arrayBuffer();
    if (ab.byteLength > maxResponseBytes) {
      throw new Error(`Response too large: ${ab.byteLength} bytes (limit ${maxResponseBytes})`);
    }

    const text = new TextDecoder().decode(ab);
    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    const data = isJson
      ? (() => {
          try {
            return JSON.parse(text) as unknown;
          } catch {
            return text;
          }
        })()
      : text;

    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      data,
    };
  };
}
