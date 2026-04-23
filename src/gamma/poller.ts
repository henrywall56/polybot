import {
	fetchAllActiveEventsByTagId,
	type GammaMarket,
	mapTemperatureMarkets,
} from "./markets.ts";
import {
	getProbabilityHistoryByMarketId,
	recordMarketProbabilityHistory,
} from "./probability-history.ts";
import { setTemperatureMarketSnapshot } from "./store.ts";
import { fetchTagBySlug } from "./tags.ts";

const POLL_INTERVAL_MS = 5000;
const TEMPERATURE_TAG_SLUG = "daily-temperature";

export async function startTemperatureMarketPolling(): Promise<void> {
	const tag = await fetchTagBySlug(TEMPERATURE_TAG_SLUG);

	console.log(`Resolved Gamma tag "${TEMPERATURE_TAG_SLUG}" to id ${tag.id}`);

	let isRunning = false;
	let lastLoggedMarketCount: number | null = null;

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
			const rawMarkets = events.flatMap((event) => event.markets);
			const markets = mapTemperatureMarkets(events);
			const marketMap = new Map<string, GammaMarket>();
			for (const market of rawMarkets) {
				marketMap.set(market.id, market);
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
			recordMarketProbabilityHistory(rawMarkets, new Date(updatedAt));
			const elapsedMs = Date.now() - startedAt;

			setTemperatureMarketSnapshot({
				error: null,
				events,
				markets,
				probabilityHistoryByMarketId: getProbabilityHistoryByMarketId(),
				records,
				updatedAt,
			});

			if (markets.length !== lastLoggedMarketCount) {
				console.log(
					`Gamma poll tracking ${markets.length} markets; latest cycle took ${elapsedMs}ms`
				);
				lastLoggedMarketCount = markets.length;
			}
		} catch (error) {
			setTemperatureMarketSnapshot({
				error: error instanceof Error ? error.message : String(error),
				events: [],
				markets: [],
				probabilityHistoryByMarketId: getProbabilityHistoryByMarketId(),
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
