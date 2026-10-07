// Weekly automatic backup of the playlist data (keeps the 8 newest copies).
import { getStore } from "@netlify/blobs";
export default async () => {
  const d = await getStore("hub").get("data", { type: "json" });
  if (!d) return;
  const b = getStore("backups");
  await b.setJSON("backup-" + new Date().toISOString().slice(0, 10), d);
  const ks = (await b.list()).blobs.map((x) => x.key).sort();
  for (const k of ks.slice(0, Math.max(0, ks.length - 8))) await b.delete(k);
};
export const config = { schedule: "@weekly" };
