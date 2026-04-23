# Polybot Docs

Polybot is a small Bun and TypeScript app for exploring Polymarket weather markets. The current product reads daily temperature markets from the Polymarket Gamma API, normalizes those raw markets into app-friendly records, stores a short live history of implied probabilities, and displays the result in a React UI.

## Core Decisions

- **Bun** is the runtime, package manager, test runner, and HTTP server. The app starts from `src/index.ts` and uses `Bun.serve` for the UI and API route.
- **TypeScript** is run in strict mode. External payloads are validated before being treated as internal data.
- **Zod** is used for runtime validation of environment variables and external API responses. This keeps failures early and explicit when Gamma changes shape or local config is missing.
- **React** powers the browser UI. It is bundled by Bun from `src/ui/index.html` and `src/ui/app.tsx`.
- **Plotly** powers the implied-probability graphs. The UI uses `react-plotly.js` with `plotly.js`.
- **No database yet.** Market snapshots and probability history are in memory only, so they reset when the Bun process restarts.

## Runtime Flow

`src/index.ts` validates env config, starts the Gamma polling loop, then serves:

- `/` for the React UI.
- `/api/temperature-markets` for the latest in-memory temperature market snapshot.

The only required environment variable today is:

- `POLYMARKET_GAMMA_BASE_URL`, validated as a URL in `src/config/env.ts`.

## Gamma API Access

The app talks to the Polymarket Gamma API through `src/gamma`.

1. On startup, `src/gamma/poller.ts` resolves the Gamma tag slug `daily-temperature` through `fetchTagBySlug`.
2. Every 5 seconds, it fetches active, non-closed events for that tag.
3. Events are fetched from `/events` with pagination:
   - `active=true`
   - `closed=false`
   - `tag_id=<daily-temperature tag id>`
   - `limit=100`
   - `offset=<page offset>`
4. Gamma returns events with nested `markets`; the app unfolds those nested markets into a flat internal market list.
5. The snapshot keeps both normalized data and raw payloads:
   - `events`: raw validated Gamma events.
   - `markets`: normalized `TemperatureMarket[]`.
   - `records`: `{ event, market, rawMarket }[]` so the UI can show normalized fields and raw Gamma details together.

The poller prevents overlapping fetches. If a poll is still running when the next interval fires, that cycle is skipped. Logging is intentionally quiet: it logs startup, tag resolution, errors, and market-count changes rather than dumping raw market data every poll.

## Internal Market Shape

Gamma payloads are validated with Zod schemas in `src/gamma/markets.ts`, then normalized into `TemperatureMarket`.

The normalized market keeps the fields the app needs for display, grouping, and future weather comparison:

- IDs and names: `eventId`, `eventSlug`, `eventTitle`, `marketId`, `marketSlug`, `marketTitle`.
- City: `city`.
- Temperature target: `temperatureKind`, `temperatureMin`, `temperatureMax`, `unit`.
- Dates: `marketDate`, `marketEndDate`, `eventUpdatedAt`, `marketUpdatedAt`.
- Market state: `active`, `closed`, `acceptingOrders`.
- Prices/liquidity: `bestBid`, `bestAsk`, `lastTradePrice`, `volume`, `liquidity`.

City extraction currently uses Gamma metadata first:

1. Prefer a non-generic event tag label.
2. Fall back to parsing the event title with `temperature in <city> on`.

Temperature kind currently uses tags or title text:

- `highest-temperature` or "highest temperature" maps to `high`.
- `lowest-temperature` or "lowest temperature" maps to `low`.

Temperature bands are parsed from `groupItemTitle`:

- `"57°F or below"` becomes `temperatureMax=57`, `temperatureMin=null`, `unit="F"`.
- `"74°F or higher"` becomes `temperatureMin=74`, `temperatureMax=null`, `unit="F"`.
- `"3-4°C"` becomes `temperatureMin=3`, `temperatureMax=4`, `unit="C"`.
- A single value becomes both min and max.

## Implied Probability History

`src/gamma/probability-history.ts` stores a rolling one-hour time series per market.

- Gamma's `outcomePrices` field is JSON parsed.
- `outcomePrices[0]` is treated as the implied Yes probability.
- Example: `["0.9995", "0.0005"]` becomes `99.95% Yes`.
- Missing, malformed, non-array, or out-of-range prices are skipped.
- Each point stores `marketId`, `timestamp`, and `yesProbability`.
- History is retained for 60 minutes and is session-only.

The snapshot exposes this as:

```ts
probabilityHistoryByMarketId: Record<string, MarketProbabilityPoint[]>
```

## React UI

The UI polls `/api/temperature-markets` every 5 seconds, matching the backend Gamma polling cadence.

The view model in `src/ui/view-model.ts` groups records as:

1. City
2. Event
3. Market

The UI uses nested `<details>` sections. Expensive market detail content is lazy-rendered only after a user opens that section. This matters because there can be thousands of markets, and Plotly graphs are heavy if rendered for every market at once.

Each opened market shows:

- A Plotly implied Yes probability graph.
- Horizon controls: `1m`, `2m`, `3m`, `4m`, `5m`, `All retained`.
- Mapped internal fields.
- Raw Gamma event payload.
- Raw Gamma market payload.

The graph view model converts decimal probabilities to percentages and filters history by the selected horizon.

## Testing and Checks

Current scripts:

- `bun run test` runs Bun tests.
- `bun run check` runs TypeScript with `tsc --noEmit`.
- `bun run lint` runs Ultracite.
- `bun run lint:fix` applies Ultracite fixes.

Existing tests cover:

- Gamma market normalization.
- Implied probability parsing and rolling retention.
- UI grouping, range rendering, graph horizon filtering, percent conversion, and empty graph series behavior.

## Current Data Sources

Current live data source:

- Polymarket Gamma API for active daily temperature events and markets.

Current city location strategy:

- City names are derived from Gamma tags or event titles.
- The app does not yet geocode cities or map them to weather stations.

Current polling:

- Gamma daily temperature markets: every 5 seconds.
- UI snapshot refresh: every 5 seconds.
- Implied probability history: recorded once per successful Gamma poll.

## Next Planned Weather Edge Layer

The next implementation step is to add an aviation/weather data layer for daily temperature markets.

Planned v1 scope:

- Use free public feeds.
- Keep the feature display-only; no trade recommendations yet.
- Add a lazy-loaded "Weather edge" panel inside each opened market.

Planned data sources:

- NOAA Aviation Weather Center Data API for METAR observations and TAF forecasts.
- Open-Meteo Geocoding API to convert market city names into coordinates.
- AWC station metadata to map city coordinates to the nearest aviation weather station.

Planned polling:

- METAR: around once per minute.
- TAF: around every 10 minutes.
- Geocoding and station metadata: cached in memory for the process.

Planned API addition:

```ts
weatherByMarketId: Record<string, MarketWeatherSnapshot>
```

Planned normalized weather fields:

- Station match: station id, name, coordinates, distance, confidence/status.
- METAR: observed temperature, observation time, raw report if available.
- TAF: forecast summary/raw report if available.
- Market comparison: below band, inside band, above band, or unavailable.
- Error/status fields per market so Gamma data remains usable if weather fetches fail.

Suggested commit message for that future work:

```text
weather: add aviation data edge panel
```
