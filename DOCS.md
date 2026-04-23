# Polybot Docs

Polybot is a small Bun and TypeScript app for exploring Polymarket weather markets. The current product reads daily temperature markets from the Polymarket Gamma API, normalizes those raw markets into app-friendly records, stores a short live history of executable CLOB bid/ask prices, and displays the result in a React UI.

## Core Decisions

- **Bun** is the runtime, package manager, test runner, and HTTP server. The app starts from `src/index.ts` and uses `Bun.serve` for the UI and API route.
- **TypeScript** is run in strict mode. External payloads are validated before being treated as internal data.
- **Zod** is used for runtime validation of environment variables and external API responses. This keeps failures early and explicit when Gamma changes shape or local config is missing.
- **React** powers the browser UI. It is bundled by Bun from `src/ui/index.html` and `src/ui/app.tsx`.
- **Plotly** powers the CLOB bid/ask graphs. The UI uses `react-plotly.js` with `plotly.js`.
- **No database yet.** Market snapshots, CLOB price history, city/station matches, and weather snapshots are in memory only, so they reset when the Bun process restarts.

## Runtime Flow

`src/index.ts` validates env config, starts the Gamma polling loop, then serves:

- `/` for the React UI.
- `/api/temperature-markets` for the latest in-memory temperature market snapshot.

The only required environment variable today is:

- `POLYMARKET_GAMMA_BASE_URL`, validated as a URL in `src/config/env.ts`.
- `POLYMARKET_CLOB_BASE_URL`, defaulting to `https://clob.polymarket.com`.

Weather-related environment values also live in `src/config/env.ts` and have defaults:

- `AVIATION_WEATHER_BASE_URL`, defaulting to `https://aviationweather.gov/api/data`.
- `OPEN_METEO_GEOCODING_BASE_URL`, defaulting to `https://geocoding-api.open-meteo.com/v1`.
- `APP_USER_AGENT`, sent with external weather requests.

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

## Gamma vs CLOB Responsibilities

Gamma remains the discovery and metadata source. It tells the app which events and markets exist, which tag they belong to, whether a market is active/closed, the market title, city-like labels, temperature bands, and the CLOB token IDs needed for trading data.

CLOB is used only after Gamma has identified the relevant market and token IDs. It supplies executable top-of-book prices and, later, is the correct API surface for order books, order placement, cancellation, and other trading operations.

This split is intentional:

- Gamma is event/market oriented and is better for browsing and filtering daily temperature markets.
- CLOB is token/orderbook oriented and is better for prices and execution.
- The internal model keeps Gamma metadata separate from CLOB bid/ask prices so display fields and executable trading data are not confused.

## Internal Market Shape

Gamma payloads are validated with Zod schemas in `src/gamma/markets.ts`, then normalized into `TemperatureMarket`.

The normalized market keeps the Gamma-derived fields the app needs for display, grouping, and future weather comparison:

- IDs and names: `eventId`, `eventSlug`, `eventTitle`, `marketId`, `marketSlug`, `marketTitle`.
- City: `city`.
- Temperature target: `temperatureKind`, `temperatureMin`, `temperatureMax`, `unit`.
- Dates: `marketDate`, `marketEndDate`, `eventUpdatedAt`, `marketUpdatedAt`.
- Market state: `active`, `closed`, `acceptingOrders`.
- Gamma display prices/liquidity: `bestBid`, `bestAsk`, `lastTradePrice`, `volume`, `liquidity`.

Executable CLOB bid/ask prices are not stored on `TemperatureMarket`. They are tracked separately in `marketPriceHistoryByMarketId` so the app does not mix Gamma metadata/display prices with CLOB top-of-book trading data.

Market status labels in the UI come from Polymarket/Gamma fields only:

- `closed=true` renders `Closed`.
- `active=false` renders `Inactive`.
- `acceptingOrders=false` renders `Not accepting orders`.
- Otherwise the market renders `Open`.

Weather observations are not used to infer whether a market is closed.

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

## CLOB Price History

`src/gamma/market-price-history.ts` stores a rolling one-hour CLOB top-of-book time series per market.

- Gamma's `outcomes` and `clobTokenIds` fields are JSON parsed together.
- The app finds the `Yes` and `No` outcome indexes, then maps each outcome to its CLOB token ID.
- CLOB `POST /prices` is queried for both token IDs with both sides:
  - `BUY` is the ask price you would pay to buy that outcome.
  - `SELL` is the bid price you would receive to sell that outcome.
- Gamma `outcomePrices` are not used for the graph or trading-style history because they are display/mark prices, not necessarily executable prices.
- Each point stores `marketId`, `timestamp`, `yesBid`, `yesAsk`, `noBid`, and `noAsk`.
- History is retained for 60 minutes and is session-only.

The low-level CLOB response is token-based, but the app normalizes it into one internal object per binary market per poll:

```ts
type MarketPricePoint = {
	marketId: string;
	timestamp: string;
	yesBid: number | null;
	yesAsk: number | null;
	noBid: number | null;
	noAsk: number | null;
};
```

That shape is deliberate for current temperature markets because they are binary Yes/No markets and the UI usually needs the Yes and No quotes together. A lower-level per-outcome quote shape may be useful later for a generic trading engine or multi-outcome markets, but the current snapshot API exposes market-level points to avoid rejoining Yes and No quotes throughout the UI.

The snapshot exposes this as:

```ts
marketPriceHistoryByMarketId: Record<string, MarketPricePoint[]>
```

## Weather Edge Layer

The `src/weather` module enriches daily temperature markets with free public aviation/weather data.

Data sources:

- Open-Meteo Geocoding API converts a Gamma-derived market city into coordinates.
- NOAA Aviation Weather Center station metadata locates nearby aviation weather stations.
- NOAA Aviation Weather Center METAR observations provide the latest observed station temperature.
- NOAA Aviation Weather Center TAF forecasts provide terminal forecast context when the matched station publishes TAFs.

City and station matching:

1. The weather poller reads the current normalized Gamma markets from the in-memory snapshot.
2. Each unique city is geocoded once per process and cached.
3. The app queries AWC `stationinfo` with expanding bounding boxes around the city coordinates.
4. It selects the nearest station with a `METAR` site type.
5. The selected station records id, name, coordinates, distance, confidence, and whether the station has TAF data.

Weather polling is separate from Gamma polling:

- Gamma markets still poll every 5 seconds.
- METAR data polls around every 60 seconds.
- TAF data polls around every 10 minutes.
- Geocoding and station matching are cached for the Bun process.

Weather snapshots are stored by market id:

```ts
weatherByMarketId: Record<string, MarketWeatherSnapshot>
```

`MarketWeatherSnapshot` normalizes the external data into:

- `stationMatch`: station id, station name, coordinates, distance, confidence, and TAF availability.
- `metar`: observed temperature in Celsius, observation time, and raw METAR text.
- `taf`: issue time and raw TAF text.
- `comparison`: whether the observed temperature is below, inside, or above the market's temperature band.
- `error`: a per-market weather error/status so Gamma data remains usable if weather data is missing.

## React UI

The UI polls `/api/temperature-markets` every 5 seconds, matching the backend Gamma polling cadence.

The view model in `src/ui/view-model.ts` groups records as:

1. City
2. Event
3. Market

The UI uses nested `<details>` sections. Expensive market detail content is lazy-rendered only after a user opens that section. This matters because there can be thousands of markets, and Plotly graphs are heavy if rendered for every market at once.

Each opened market shows:

- A lazy-loaded Weather edge panel with station match, latest METAR, TAF context, and observed-temperature band comparison.
- Two Plotly CLOB bid/ask graphs: one for Yes and one for No, each with bid and ask lines.
- Horizon controls: `1m`, `2m`, `3m`, `4m`, `5m`, `All retained`.
- Mapped Gamma market fields.
- Raw Gamma event payload.
- Raw Gamma market payload.

The graph view model displays CLOB prices as dollar-denominated contract prices, filters history by the selected horizon, pads the x-axis by 5% on both sides of the visible points, and narrows each graph's y-axis around its own bid/ask data so the spread remains visible.

## Testing and Checks

Current scripts:

- `bun run test` runs Bun tests.
- `bun run check` runs TypeScript with `tsc --noEmit`.
- `bun run lint` runs Ultracite.
- `bun run lint:fix` applies Ultracite fixes.

Existing tests cover:

- Gamma market normalization.
- CLOB token mapping, executable bid/ask history, and rolling retention.
- Weather API parsing, no-data behavior, geocoding parsing, station matching, distance calculation, and temperature-band comparison.
- UI grouping, range rendering, graph horizon filtering, dollar price graph values, padded graph ranges, and empty graph series behavior.

## Current Data Sources

Current live data sources:

- Polymarket Gamma API for active daily temperature events and markets.
- Polymarket CLOB API for executable Yes/No bid and ask prices.
- Open-Meteo Geocoding API for city coordinates.
- NOAA Aviation Weather Center Data API for METAR, TAF, and station metadata.

Current city location strategy:

- City names are derived from Gamma tags or event titles.
- City names are geocoded with Open-Meteo.
- Geocoded coordinates are mapped to the nearest METAR-capable AWC station.

Current polling:

- Gamma daily temperature markets: every 5 seconds.
- CLOB bid/ask prices: once per successful Gamma poll, currently every 5 seconds.
- UI snapshot refresh: every 5 seconds.
- CLOB price history: recorded once per successful CLOB price poll.
- METAR observations: around every 60 seconds.
- TAF forecasts: around every 10 minutes.

## Next Planned Edge Work

The weather panel is display-only. The next likely step is to turn the weather evidence into a simple market-facing signal, such as highlighting markets where observed temperatures are already outside a band, or adding model forecast data to compare against market-implied probabilities.
