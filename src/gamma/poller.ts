import {
	fetchAllActiveEventsByTagId,
	type GammaMarket,
	mapTemperatureMarkets,
} from "./markets.ts";
import { setTemperatureMarketSnapshot } from "./store.ts";
import { fetchTagBySlug } from "./tags.ts";

const POLL_INTERVAL_MS = 5000;
const TEMPERATURE_TAG_SLUG = "daily-temperature";

export async function startTemperatureMarketPolling(): Promise<void> {
	const tag = await fetchTagBySlug(TEMPERATURE_TAG_SLUG);

	console.log(`Resolved Gamma tag "${TEMPERATURE_TAG_SLUG}" to id ${tag.id}`);

	let isRunning = false;

	const runCycle = async (): Promise<void> => {
		if (isRunning) {
			console.log(
				"Skipping Gamma poll because the previous cycle is still running"
			);
			return;
		}

		isRunning = true;

		const startedAt = Date.now();

		try {
			const events = await fetchAllActiveEventsByTagId(tag.id);
			const markets = mapTemperatureMarkets(events);
			const marketMap = new Map<string, GammaMarket>();
			for (const event of events) {
				for (const market of event.markets) {
					marketMap.set(market.id, market);
				}
			}
			const records = markets.flatMap((market) => {
				const event = events.find((item) => item.id === market.eventId);
				const rawMarket = marketMap.get(market.marketId);

				if (!(event && rawMarket)) {
					return [];
				}

				return [{ event, market, rawMarket }];
			});
			const updatedAt = new Date().toISOString();
			const sample = markets
				.slice(0, 3)
				.map((market) =>
					JSON.stringify({
						city: market.city,
						temperatureKind: market.temperatureKind,
						temperatureBand: market.temperatureBand,
						unit: market.unit,
					})
				)
				.join(", ");
			const elapsedMs = Date.now() - startedAt;

			setTemperatureMarketSnapshot({
				error: null,
				events,
				markets,
				records,
				updatedAt,
			});

			console.log(
				`Gamma poll fetched ${markets.length} markets in ${elapsedMs}ms`
			);

			if (sample) {
				console.log(`Sample markets: ${sample}`);
			}
		} catch (error) {
			setTemperatureMarketSnapshot({
				error: error instanceof Error ? error.message : String(error),
				events: [],
				markets: [],
				records: [],
				updatedAt: null,
			});
			console.error("Gamma poll failed:", error);
		} finally {
			isRunning = false;
		}
	};

	await runCycle();
	setInterval(runCycle, POLL_INTERVAL_MS);
}
