import express from "express";
import dotenv from "dotenv";
import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));
app.use("/generated", express.static(path.join(root, "public", "generated")));

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_FOOTBALL_KEY || "";
const API_BASE = "https://v3.football.api-sports.io";
const leagueId = process.env.API_FOOTBALL_LEAGUE_ID || "";
const season = process.env.API_FOOTBALL_SEASON || "2026";
const generatedDir = path.join(root, "public", "generated");
const dataDir = path.join(root, "data");
const stateFile = path.join(dataDir, "posted-fixtures.json");

await fs.mkdir(generatedDir, { recursive: true });
await fs.mkdir(dataDir, { recursive: true });

async function readPosted() {
  try { return JSON.parse(await fs.readFile(stateFile, "utf8")); }
  catch { return {}; }
}
async function writePosted(data) {
  await fs.writeFile(stateFile, JSON.stringify(data, null, 2));
}
function requireApiKey(_req, res, next) {
  if (!API_KEY || API_KEY === "PASTE_API_FOOTBALL_KEY") {
    return res.status(503).json({ error: "API-Football belum dikonfigurasi. Isi API_FOOTBALL_KEY di .env." });
  }
  next();
}
async function football(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors && Object.keys(body.errors).length) {
    throw new Error(`API-Football error (${response.status}): ${JSON.stringify(body.errors || body.message || {})}`);
  }
  return body;
}
function asyncRoute(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch(err => {
    console.error(err);
    res.status(502).json({ error: "Permintaan data gagal.", detail: err.message });
  });
}
function leagueParams(extra = {}) {
  return { league: leagueId, season, ...extra };
}
function escapeXml(value = "") {
  return String(value).replace(/[<>&'"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '"':"&quot;" }[c]));
}
function posterSvg(fixture) {
  const home = fixture.teams?.home?.name || "HOME";
  const away = fixture.teams?.away?.name || "AWAY";
  const hs = fixture.goals?.home ?? "-";
  const as = fixture.goals?.away ?? "-";
  const date = fixture.fixture?.date ? new Date(fixture.fixture.date).toLocaleDateString("id-ID", { day:"2-digit", month:"long", year:"numeric", timeZone:"Asia/Jakarta" }) : "HASIL PERTANDINGAN";
  const venue = fixture.fixture?.venue?.name || "LIGA INDONESIA";
  const homeLogo = fixture.teams?.home?.logo || "";
  const awayLogo = fixture.teams?.away?.logo || "";
  const logo = (url, x, y) => url ? `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="170" height="170" preserveAspectRatio="xMidYMid meet"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#061629"/><stop offset=".55" stop-color="#0b3150"/><stop offset="1" stop-color="#07111f"/></linearGradient><linearGradient id="accent"><stop stop-color="#32d5ff"/><stop offset="1" stop-color="#52f2b5"/></linearGradient></defs>
  <rect width="1080" height="1350" fill="url(#bg)"/><circle cx="900" cy="170" r="260" fill="#20c9f8" opacity=".08"/><circle cx="120" cy="1160" r="330" fill="#3af0b0" opacity=".07"/>
  <path d="M0 0H1080V22H0Z" fill="url(#accent)"/>
  <text x="540" y="110" fill="#56e6fa" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" letter-spacing="6">MATCHVISION FOOTBALL</text>
  <text x="540" y="210" fill="#ffffff" font-family="Arial,sans-serif" font-size="48" font-weight="800" text-anchor="middle">HASIL PERTANDINGAN</text>
  <text x="540" y="265" fill="#a9c5d8" font-family="Arial,sans-serif" font-size="28" text-anchor="middle">${escapeXml(date)}</text>
  <rect x="70" y="350" width="940" height="610" rx="36" fill="#0b2035" stroke="#2a5068" stroke-width="2"/>
  ${logo(homeLogo, 170, 465)}${logo(awayLogo, 740, 465)}
  <text x="270" y="680" fill="#ffffff" font-family="Arial,sans-serif" font-size="35" font-weight="700" text-anchor="middle">${escapeXml(home)}</text>
  <text x="810" y="680" fill="#ffffff" font-family="Arial,sans-serif" font-size="35" font-weight="700" text-anchor="middle">${escapeXml(away)}</text>
  <text x="540" y="610" fill="#ffffff" font-family="Arial,sans-serif" font-size="104" font-weight="900" text-anchor="middle">${escapeXml(hs)} : ${escapeXml(as)}</text>
  <rect x="390" y="735" width="300" height="54" rx="27" fill="url(#accent)"/><text x="540" y="772" fill="#052036" font-family="Arial,sans-serif" font-size="26" font-weight="800" text-anchor="middle">FULL TIME</text>
  <text x="540" y="870" fill="#a9c5d8" font-family="Arial,sans-serif" font-size="25" text-anchor="middle">${escapeXml(venue)}</text>
  <text x="540" y="1110" fill="#ffffff" font-family="Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle">IKUTI UPDATE SEPAK BOLA</text>
  <text x="540" y="1165" fill="#a9c5d8" font-family="Arial,sans-serif" font-size="25" text-anchor="middle">Statistik • Lineup • Klasemen • Analisis</text>
  <path d="M90 1230H990" stroke="#2a5068" stroke-width="2"/><text x="540" y="1288" fill="#56e6fa" font-family="Arial,sans-serif" font-size="24" text-anchor="middle">DATA: API-FOOTBALL • PERIKSA SUMBER RESMI KLUB</text>
  </svg>`;
}
async function getFixture(id) {
  const data = await football("/fixtures", { id });
  return data.response?.[0];
}
async function createPoster(fixture) {
  const svg = posterSvg(fixture);
  const filename = `match-${fixture.fixture.id}.svg`;
  await fs.writeFile(path.join(generatedDir, filename), svg, "utf8");
  return filename;
}
async function publishInstagram(fixture, imageUrl) {
  if (process.env.AUTO_POST_INSTAGRAM !== "true") throw new Error("AUTO_POST_INSTAGRAM belum true; publikasi otomatis dinonaktifkan.");
  const igId = process.env.INSTAGRAM_USER_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!igId || !token) throw new Error("INSTAGRAM_USER_ID atau INSTAGRAM_ACCESS_TOKEN belum dikonfigurasi.");
  if (!imageUrl.startsWith("https://")) throw new Error("PUBLIC_BASE_URL harus HTTPS dan dapat diakses publik.");
  const caption = `${fixture.teams.home.name} ${fixture.goals.home}–${fixture.goals.away} ${fixture.teams.away.name}\n\nHasil akhir pertandingan Liga Indonesia.\n#SepakBolaIndonesia #LigaIndonesia #MatchVisionFootball`;
  const version = process.env.META_GRAPH_VERSION || "v23.0";
  const createUrl = `https://graph.facebook.com/${version}/${igId}/media`;
  const form = new URLSearchParams({ image_url: imageUrl, caption, access_token: token });
  const createResp = await fetch(createUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: form });
  const created = await createResp.json();
  if (!createResp.ok || created.error || !created.id) throw new Error(`Gagal membuat media Instagram: ${JSON.stringify(created.error || created)}`);
  const publishResp = await fetch(`https://graph.facebook.com/${version}/${igId}/media_publish`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: created.id, access_token: token })
  });
  const published = await publishResp.json();
  if (!publishResp.ok || published.error || !published.id) throw new Error(`Gagal menerbitkan media Instagram: ${JSON.stringify(published.error || published)}`);
  return published.id;
}
async function handleFinishedFixture(fixture) {
  const id = String(fixture.fixture.id);
  const posted = await readPosted();
  if (posted[id]?.status === "published" || posted[id]?.status === "generated") return;
  const filename = await createPoster(fixture);
  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const imageUrl = base ? `${base}/generated/${filename}` : "";
  if (process.env.AUTO_POST_INSTAGRAM === "true") {
    if (!imageUrl) throw new Error("Set PUBLIC_BASE_URL ke domain HTTPS publik sebelum auto-post.");
    const mediaId = await publishInstagram(fixture, imageUrl);
    posted[id] = { status: "published", mediaId, filename, publishedAt: new Date().toISOString() };
  } else {
    posted[id] = { status: "generated", filename, imageUrl, generatedAt: new Date().toISOString() };
  }
  await writePosted(posted);
  console.log(`Fixture ${id}: poster ${filename}; status=${posted[id].status}`);
}
async function pollFinishedMatches() {
  if (!API_KEY || !leagueId) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await football("/fixtures", leagueParams({ from: today, to: today, timezone: "Asia/Jakarta" }));
    for (const fixture of data.response || []) {
      const status = fixture.fixture?.status?.short;
      if (["FT", "AET", "PEN"].includes(status)) {
        try { await handleFinishedFixture(fixture); }
        catch (e) { console.error("Auto-publish fixture failed:", fixture.fixture?.id, e.message); }
      }
    }
  } catch (e) { console.error("Fixture polling failed:", e.message); }
}
const pollCron = process.env.POLL_CRON || "*/10 * * * *";
if (cron.validate(pollCron)) cron.schedule(pollCron, pollFinishedMatches);
else console.warn("POLL_CRON invalid; scheduled polling disabled.");

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "MatchVision Football", time: new Date().toISOString() }));
app.get("/api/config-status", (_req, res) => res.json({
  apiKeyConfigured: Boolean(API_KEY && API_KEY !== "PASTE_API_FOOTBALL_KEY"),
  leagueConfigured: Boolean(leagueId),
  season,
  instagramConfigured: Boolean(process.env.INSTAGRAM_USER_ID && process.env.INSTAGRAM_ACCESS_TOKEN),
  autoPostEnabled: process.env.AUTO_POST_INSTAGRAM === "true",
  note: "Secrets are never returned by this endpoint."
}));
app.get("/api/leagues", requireApiKey, asyncRoute(async (req, res) => {
  const result = await football("/leagues", { country: req.query.country || "Indonesia", season: req.query.season || season });
  res.json(result);
}));
app.get("/api/fixtures", requireApiKey, asyncRoute(async (req, res) => {
  const params = { ...leagueParams(), date: req.query.date, from: req.query.from, to: req.query.to, timezone: "Asia/Jakarta", last: req.query.last, next: req.query.next };
  delete params.league;
  if (leagueId) params.league = leagueId;
  const result = await football("/fixtures", params);
  res.json(result);
}));
app.get("/api/standings", requireApiKey, asyncRoute(async (_req, res) => res.json(await football("/standings", leagueParams()))));
app.get("/api/lineups", requireApiKey, asyncRoute(async (req, res) => {
  if (!req.query.fixture) return res.status(400).json({ error: "fixture wajib diisi." });
  res.json(await football("/fixtures/lineups", { fixture: req.query.fixture }));
}));
app.get("/api/statistics", requireApiKey, asyncRoute(async (req, res) => {
  if (!req.query.fixture || !req.query.team) return res.status(400).json({ error: "fixture dan team wajib diisi." });
  res.json(await football("/fixtures/statistics", { fixture: req.query.fixture, team: req.query.team }));
}));
app.get("/api/injuries", requireApiKey, asyncRoute(async (req, res) => {
  if (!req.query.team) return res.status(400).json({ error: "team wajib diisi." });
  res.json(await football("/injuries", { team: req.query.team, league: leagueId, season }));
}));
app.get("/api/predictions", requireApiKey, asyncRoute(async (req, res) => {
  if (!req.query.fixture) return res.status(400).json({ error: "fixture wajib diisi." });
  res.json(await football("/predictions", { fixture: req.query.fixture }));
}));
app.post("/api/poster", requireApiKey, asyncRoute(async (req, res) => {
  if (!req.body.fixtureId) return res.status(400).json({ error: "fixtureId wajib diisi." });
  const fixture = await getFixture(req.body.fixtureId);
  if (!fixture) return res.status(404).json({ error: "Pertandingan tidak ditemukan." });
  const filename = await createPoster(fixture);
  const base = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
  res.json({ filename, posterUrl: `${base}/generated/${filename}`, width: 1080, height: 1350, format: "SVG" });
}));
app.post("/api/publish/:fixtureId", requireApiKey, asyncRoute(async (req, res) => {
  const fixture = await getFixture(req.params.fixtureId);
  if (!fixture) return res.status(404).json({ error: "Pertandingan tidak ditemukan." });
  const status = fixture.fixture?.status?.short;
  if (!["FT", "AET", "PEN"].includes(status)) return res.status(409).json({ error: "Pertandingan belum selesai; publikasi ditolak.", status });
  const filename = await createPoster(fixture);
  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return res.status(503).json({ error: "PUBLIC_BASE_URL HTTPS publik harus dikonfigurasi." });
  const mediaId = await publishInstagram(fixture, `${base}/generated/${filename}`);
  const posted = await readPosted();
  posted[String(fixture.fixture.id)] = { status: "published", mediaId, filename, publishedAt: new Date().toISOString() };
  await writePosted(posted);
  res.json({ ok: true, mediaId, filename });
}));
app.get("/api/posted", asyncRoute(async (_req, res) => res.json(await readPosted())));
app.get("*", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`MatchVision running on http://localhost:${PORT}`);
  pollFinishedMatches();
});
