# MatchVision Football — Indonesian League MVP

A starter project for a real football analytics website:
- Express backend; API keys stay on the server.
- API-Football proxy endpoints for fixtures, standings, lineups, injuries, stats and predictions.
- 4:5 (1080×1350) SVG poster generation for completed matches.
- Optional Instagram Graph API publishing, gated behind `AUTO_POST_INSTAGRAM=true`.
- Scheduler checks finished matches and avoids posting the same fixture twice using a local JSON state file.

## Requirements
- Node.js 20+
- API-Football account/key: https://www.api-football.com/
- For Instagram automation: Instagram Professional account and the required Meta app/permissions, a valid access token, Instagram user ID, and a public HTTPS deployment.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env`
3. Add `API_FOOTBALL_KEY`
4. Start with `npm start`
5. Open `http://localhost:3000`

## Find the correct Indonesia league ID
Open `http://localhost:3000/api/leagues?country=Indonesia&season=2026` after configuring the key. Confirm the competition and season against the provider dashboard. Set `API_FOOTBALL_LEAGUE_ID` and `API_FOOTBALL_SEASON` in `.env`. Coverage and available fields can differ by season and plan.

## Instagram setup
1. Create/configure a Meta app and connect an Instagram Professional account.
2. Obtain the correct account ID and access token with publishing permission.
3. Deploy to a public HTTPS host and set `PUBLIC_BASE_URL` to that origin.
4. Test poster output and fixture detection with `AUTO_POST_INSTAGRAM=false`.
5. Only after validating results, set `AUTO_POST_INSTAGRAM=true`.

The publisher uses the Graph API two-step flow: create `/media` with `image_url` and caption, then `/media_publish` with the returned `creation_id`. The image URL must be public HTTPS. Check Meta's current documentation and API version before production.

## API endpoints
- `GET /api/health`
- `GET /api/leagues?country=Indonesia&season=2026`
- `GET /api/fixtures?date=2026-10-17` (or `from` and `to`)
- `GET /api/standings`
- `GET /api/lineups?fixture=FIXTURE_ID`
- `GET /api/statistics?fixture=FIXTURE_ID&team=TEAM_ID`
- `GET /api/injuries?team=TEAM_ID`
- `GET /api/predictions?fixture=FIXTURE_ID`
- `POST /api/poster` with JSON `{ "fixtureId": 123 }`; returns a public poster URL when deployed.
- `POST /api/publish/:fixtureId` manually attempts publishing (requires AUTO_POST_INSTAGRAM=true).
- `GET /api/config-status` shows whether keys are configured, never their values.

## Important limitations
- The free provider plan is quota-limited; do not poll too often. The scheduled job is disabled unless required API credentials and league ID exist.
- Starting lineups are usually available closer to kickoff and may not exist for every match.
- Injury/news coverage varies by competition and provider. This starter does not invent injury reports or news.
- Predictions are provider-supplied where available, not guarantees.
- This MVP stores deduplication state in a local JSON file. For multi-instance production deployments, replace it with a durable database/queue and add authentication, rate limiting, logs, and retry controls.
- Auto-publishing is intentionally disabled by default. Never commit `.env` or expose tokens in browser code.
