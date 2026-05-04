#!/usr/bin/env node
/**
 * Local static server + same-origin proxy for GolfCourseAPI.
 * Fixes browser "Failed to fetch" caused by GolfCourseAPI CORS (GET not allowed on preflight).
 *
 *   node server.mjs
 *   open http://127.0.0.1:8765/app.html   (default PORT=8765; override with env PORT)
 *
 * Serves `/api/golfcourse/v1/...` as a proxy to api.golfcourseapi.com. The browser app uses that same-origin
 * URL automatically on localhost / 127.0.0.1 / ::1 (see `js/golfcourse-api.js`); `/.dev-proxy-health` is still
 * used so LAN IPs (e.g. http://192.168.x.x:8765) pick up the proxy after a successful health check.
 */

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8765;
const UPSTREAM = "api.golfcourseapi.com";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function proxyToApi(req, res) {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const rest = u.pathname.replace(/^\/api\/golfcourse/, "") + u.search;

  const headers = {
    "User-Agent": "golf-handicap-local-proxy/1.0",
  };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers.key) headers.Key = req.headers.key;

  const opts = {
    hostname: UPSTREAM,
    path: rest,
    method: req.method,
    headers,
  };

  const preq = https.request(opts, (pres) => {
    const out = { ...pres.headers };
    delete out["transfer-encoding"];
    res.writeHead(pres.statusCode || 502, out);
    pres.pipe(res);
  });
  preq.on("error", (e) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: e.message }));
  });
  preq.end();
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Not found");
      }
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Server error");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === "/.dev-proxy-health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("OK");
  }

  if (u.pathname.startsWith("/api/golfcourse/")) {
    return proxyToApi(req, res);
  }

  let rel = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
  let fp = path.join(ROOT, rel);
  fp = path.normalize(fp);
  if (!fp.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Forbidden");
  }

  fs.stat(fp, (err, st) => {
    if (!err && st.isDirectory()) {
      fp = path.join(fp, "index.html");
    }
    sendFile(res, fp);
  });
});

server.listen(PORT, () => {
  console.log(`Golf handicap: http://127.0.0.1:${PORT}/`);
  console.log(`Calculator:    http://127.0.0.1:${PORT}/app.html`);
  console.log(`(Built-in API proxy active — course search works here; python -m http.server does not include the proxy.)`);
});
