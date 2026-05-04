/**
 * Cloudflare Worker: forwards /v1/* to https://api.golfcourseapi.com/v1/*
 * and adds permissive CORS so browsers can call GolfCourseAPI (their OPTIONS
 * response omits GET from Access-Control-Allow-Methods, which breaks direct fetch).
 *
 * Deploy: cd proxy && npx wrangler deploy
 * Then in the app, set "API proxy base" to your worker URL + /v1, e.g.
 * https://golf-handicap-proxy.your-account.workers.dev/v1
 */

const UPSTREAM = "https://api.golfcourseapi.com";

export default {
  async fetch(request) {
    const reqHeaders = request.headers;
    const acrh = reqHeaders.get("Access-Control-Request-Headers");
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": acrh || "Authorization, Content-Type, Key",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const u = new URL(request.url);
    if (!u.pathname.startsWith("/v1/")) {
      return new Response("Use paths under /v1/…", { status: 404, headers: cors });
    }

    const target = UPSTREAM + u.pathname + u.search;
    const fwd = new Headers();
    const auth = reqHeaders.get("Authorization");
    if (auth) fwd.set("Authorization", auth);
    const key = reqHeaders.get("Key");
    if (key) fwd.set("Key", key);

    const upstream = await fetch(target, {
      method: request.method,
      headers: fwd,
    });

    const out = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) {
      out.set(k, v);
    }
    out.delete("access-control-allow-origin");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    });
  },
};
