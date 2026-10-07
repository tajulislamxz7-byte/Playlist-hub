// Playlist Hub API: public read, password-protected write. Data is stored in Netlify Blobs.
// Set ADMIN_EMAIL, ADMIN_PASSWORD and SESSION_SECRET in Netlify (Site configuration > Environment variables).
import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

const EMAIL = () => process.env.ADMIN_EMAIL || "businesswithtajul@gmail.com";
const PASS = () => process.env.ADMIN_PASSWORD || "admin123";
const SECRET = () => process.env.SESSION_SECRET || "secret:" + PASS();
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const sign = (p) => createHmac("sha256", SECRET()).update(p).digest("base64url");
const mint = () => { const p = String(Date.now() + 7 * 864e5); return p + "." + sign(p); };
const check = (t) => { const [p, s] = String(t || "").split("."); return !!(p && s && eq(sign(p), s) && Number(p) > Date.now()); };
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const D = "2026-01-01T00:00:00.000Z";
const DEFAULT = {
  pl: [{ id: "seed1", title: "Physics first chapter (Delowar sir)", url: "https://youtube.com/playlist?list=PLGMsl7MDxovdz7UT_mzbCw8RBCA7ogVJM&si=qzx7HIta70IRQmiU", playlistId: "PLGMsl7MDxovdz7UT_mzbCw8RBCA7ogVJM", thumbnail: "", category: "Education", description: "", published: true, order: 0, createdAt: D, updatedAt: D }],
  cats: ["Programming", "Web Development", "Cyber Security", "Artificial Intelligence", "Education", "Gaming", "Tutorials", "Entertainment", "Other"].map((name, i) => ({ id: "c" + i, name })),
  set: {},
};

function clean(d) {
  if (!d || !Array.isArray(d.pl) || !Array.isArray(d.cats) || d.pl.length > 2000 || d.cats.length > 200) return null;
  const cats = d.cats.map((c, i) => ({ id: str(c && c.id, 40) || "c" + i, name: str(c && c.name, 60).trim(), icon: str(c && c.icon, 8), color: c && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : "" })).filter((c) => c.name);
  const pl = d.pl.map((p, i) => ({
    id: str(p && p.id, 40), type: p && p.type === "video" ? "video" : "playlist", tags: Array.isArray(p && p.tags) ? p.tags.slice(0, 8).map((x) => str(x, 30).trim()).filter(Boolean) : [], title: str(p && p.title, 120), url: str(p && p.url, 300), playlistId: str(p && p.playlistId, 80),
    thumbnail: p && typeof p.thumbnail === "string" && /^https:\/\//.test(p.thumbnail) ? p.thumbnail.slice(0, 500) : "",
    category: str(p && p.category, 60), description: str(p && p.description, 400), published: !p || p.published !== false,
    order: p && Number.isFinite(p.order) ? p.order : i, createdAt: str(p && p.createdAt, 40), updatedAt: str(p && p.updatedAt, 40),
  }));
  if (pl.some((p) => !p.id || !p.title || !/^[\w-]{10,}$/.test(p.playlistId))) return null;
  const s = d.set && typeof d.set === "object" ? d.set : {};
  const set = { websiteName: str(s.websiteName, 50) || "Playlist Hub", tagline: str(s.tagline, 80) || "Discover Your Next Playlist", description: str(s.description, 300) || "Explore carefully organized YouTube playlists across multiple categories.", theme: s.theme === "light" ? "light" : "dark", showDesc: s.showDesc !== false, showBadge: s.showBadge !== false, accent: /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : "" };
  return { pl, cats, set };
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/$/, "");
  try {
    const store = getStore("hub");
    if (path === "/api/data" && req.method === "GET") return json((await store.get("data", { type: "json" })) || DEFAULT);
    if (path === "/api/login" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (eq(String(b.email || "").trim(), EMAIL()) && eq(b.password || "", PASS())) return json({ token: mint(), email: EMAIL() });
      return json({ error: "Incorrect email or password." }, 401);
    }
    if (path === "/api/data" && req.method === "PUT") {
      const t = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
      if (!check(t)) return json({ error: "Unauthorized" }, 401);
      const d = clean(await req.json().catch(() => null));
      if (!d) return json({ error: "Invalid data" }, 400);
      const bs = getStore("backups");
      if (!(await bs.list()).blobs.length) { const prev = await store.get("data", { type: "json" }); if (prev) await bs.setJSON("backup-" + new Date().toISOString().slice(0, 10), prev); }
      await store.setJSON("data", d);
      return json({ ok: true });
    }
    if (path === "/api/backups" && req.method === "GET") {
      if (!check((req.headers.get("authorization") || "").replace(/^Bearer /, ""))) return json({ error: "Unauthorized" }, 401);
      return json({ keys: (await getStore("backups").list()).blobs.map((x) => x.key).sort().reverse() });
    }
    if (path === "/api/restore" && req.method === "POST") {
      if (!check((req.headers.get("authorization") || "").replace(/^Bearer /, ""))) return json({ error: "Unauthorized" }, 401);
      const b = await req.json().catch(() => ({}));
      const d = clean(await getStore("backups").get(String(b.key || ""), { type: "json" }));
      if (!d) return json({ error: "Backup not found" }, 404);
      await store.setJSON("data", d);
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: "Server error" }, 500);
  }
};

export const config = { path: ["/api/data", "/api/login", "/api/backups", "/api/restore"] };
