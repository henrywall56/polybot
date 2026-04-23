import { ClobMarketPriceStream } from "../clob/market-websocket.ts";
import {
	getOrderBookByMarketId,
	recordOrderBookLevelUpdate,
	recordOrderBookSnapshot,
} from "../clob/order-book.ts";
import {
	buildOutcomeTokenMappings,
	getPriceHistoryByMarketId,
	type OutcomeTokenMapping,
	recordClobPriceUpdate,
} from "./market-price-history.ts";
import {
	fetchAllActiveEventsByTagId,
	type GammaMarket,
	mapTemperatureMarkets,
} from "./markets.ts";
import {
	getTemperatureMarketSnapshot,
	setTemperatureMarketSnapshot,
} from "./store.ts";
import { fetchTagBySlug } from "./tags.ts";

const POLL_INTERVAL_MS = 5000;
const TEMPERATURE_TAG_SLUG = "daily-temperature";

export async function startTemperatureMarketPolling(): Promise<void> {
	const tag = await fetchTagBySlug(TEMPERATURE_TAG_SLUG);

	console.log(`Resolved Gamma tag "${TEMPERATURE_TAG_SLUG}" to id ${tag.id}`);

	let isRunning = false;
	let lastLoggedMarketCount: number | null = null;
	let tokenMappingByTokenId = new Map<string, OutcomeTokenMapping>();
	const syncTradingDataSnapshot = (): void => {
		const snapshot = getTemperatureMarketSnapshot();
		setTemperatureMarketSnapshot({
			...snapshot,
			marketPriceHistoryByMarketId: getPriceHistoryByMarketId(),
			orderBookByMarketId: getOrderBookByMarketId(),
		});
	};
	const clobStream = new ClobMarketPriceStream({
		onError: (error) => {
			console.error("CLOB market websocket error:", error);
		},
		onFallbackRequested: () => {
			console.error("CLOB market websocket disconnected; reconnecting");
		},
		onOrderBookLevelUpdate: (update) => {
			const mapping = tokenMappingByTokenId.get(update.tokenId);

			if (!mapping) {
				return;
			}

			recordOrderBookLevelUpdate(mapping, update);
			syncTradingDataSnapshot();
		},
		onOrderBookSnapshotUpdate: (update) => {
			const mapping = tokenMappingByTokenId.get(update.tokenId);

			if (!mapping) {
				return;
			}

			recordOrderBookSnapshot(mapping, update);
			syncTradingDataSnapshot();
		},
		onPriceUpdate: (update) => {
			const mapping = tokenMappingByTokenId.get(update.tokenId);

			if (!mapping) {
				return;
			}

			recordClobPriceUpdate(mapping, update);
			syncTradingDataSnapshot();
		},
	});

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
			tokenMappingByTokenId = buildOutcomeTokenMappings(rawMarkets);
			clobStream.updateAssetIds(tokenMappingByTokenId.keys());
			const elapsedMs = Date.now() - startedAt;

			setTemperatureMarketSnapshot({
				error: null,
				events,
				marketPriceHistoryByMarketId: getPriceHistoryByMarketId(),
				markets,
				orderBookByMarketId: getOrderBookByMarketId(),
				records,
				updatedAt,
				weatherByMarketId: getTemperatureMarketSnapshot().weatherByMarketId,
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
				marketPriceHistoryByMarketId: getPriceHistoryByMarketId(),
				markets: [],
				orderBookByMarketId: getOrderBookByMarketId(),
				records: [],
				updatedAt: null,
				weatherByMarketId: getTemperatureMarketSnapshot().weatherByMarketId,
			});
			console.error("Gamma poll failed:", error);
		} finally {
			isRunning = false;
		}
	};

	await runCycle();
	setInterval(runCycle, POLL_INTERVAL_MS);
}
