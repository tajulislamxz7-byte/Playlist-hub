// Link-preview pages: /s/c/<category> and /s/i/<id>. Chat apps read the meta tags; people are redirected into the app.
import { getStore } from "@netlify/blobs";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const key = (s) => String(s || "").trim().toLowerCase();
const thumb = (p) => (/^https:\/\//.test(p.thumbnail || "") ? p.thumbnail : p.type === "video" ? "https://i.ytimg.com/vi/" + p.playlistId + "/hqdefault.jpg" : "");
export default async (req) => {
  const u = new URL(req.url), m = u.pathname.match(/^\/s\/([ci])\/(.+)$/);
  let d = null;
  try { d = await getStore("hub").get("data", { type: "json" }); } catch (e) {}
  d = d || { pl: [], cats: [], set: {} };
  const site = (d.set && d.set.websiteName) || "Playlist Hub";
  let title = site, desc = (d.set && d.set.description) || "", img = u.origin + "/icon-512.png", dest = "/";
  if (m) {
    const v = decodeURIComponent(m[2]);
    if (m[1] === "c") {
      const items = d.pl.filter((p) => p.published && key(p.category) === key(v));
      if (items.length) {
        const c = d.cats.find((x) => key(x.name) === key(v)), t = items.map(thumb).find(Boolean);
        title = (c ? c.name : items[0].category) + " - " + site;
        desc = items.filter((p) => p.type !== "video").length + " playlists, " + items.filter((p) => p.type === "video").length + " videos";
        if (t) img = t;
        dest = "/#c=" + encodeURIComponent(key(v));
      }
    } else {
      const p = d.pl.find((x) => x.id === v && x.published);
      if (p) { title = p.title + " - " + site; desc = p.description || p.category; img = thumb(p) || img; dest = "/#i=" + encodeURIComponent(v); }
    }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(img)}"><meta property="og:url" content="${esc(u.href)}">
<meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${esc(dest)}"></head><body><a href="${esc(dest)}">Open ${esc(title)}</a><script>location.replace(${JSON.stringify(dest).replace(/</g, "\\u003c")})</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
};
export const config = { path: "/s/*" };
