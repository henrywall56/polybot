import type { TemperatureMarket } from "../gamma/markets.ts";
import {
	getTemperatureMarketSnapshot,
	setTemperatureMarketWeather,
} from "../gamma/store.ts";
import {
	type AviationMetar,
	type AviationTaf,
	fetchMetarsByStationIds,
	fetchTafsByStationIds,
} from "./aviation-weather.ts";
import {
	compareTemperatureToMarketBand,
	resolveStationMatchForMarket,
} from "./station-matching.ts";
import { setWeatherByMarketId } from "./store.ts";
import type { MarketWeatherSnapshot, StationMatch } from "./types.ts";

const METAR_POLL_INTERVAL_MS = 60 * 1000;
const TAF_POLL_INTERVAL_MS = 10 * 60 * 1000;

let latestMetarByStationId = new Map<string, AviationMetar>();
let latestTafByStationId = new Map<string, AviationTaf>();

export function startWeatherPolling(): void {
	let isRunning = false;
	let lastTafFetchMs = 0;

	const runCycle = async (): Promise<void> => {
		if (isRunning) {
			console.log(
				"Skipping weather poll because the previous cycle is still running"
			);
			return;
		}

		isRunning = true;

		try {
			const snapshot = getTemperatureMarketSnapshot();
			const { markets } = snapshot;

			if (markets.length === 0) {
				return;
			}

			const stationMatchesByMarketId = await resolveStationMatches(markets);
			const stationIds = getUniqueStationIds(stationMatchesByMarketId);
			const nowMs = Date.now();
			const shouldFetchTaf = nowMs - lastTafFetchMs >= TAF_POLL_INTERVAL_MS;

			if (stationIds.length > 0) {
				latestMetarByStationId = await fetchMetarMap(stationIds);
			}

			if (shouldFetchTaf) {
				const tafStationIds = getUniqueTafStationIds(stationMatchesByMarketId);
				latestTafByStationId = await fetchTafMap(tafStationIds);
				lastTafFetchMs = nowMs;
			}

			const weatherByMarketId = buildWeatherByMarketId(
				markets,
				stationMatchesByMarketId,
				new Date().toISOString()
			);

			setWeatherByMarketId(weatherByMarketId);
			setTemperatureMarketWeather(weatherByMarketId);
		} catch (error) {
			console.error("Weather poll failed:", error);
		} finally {
			isRunning = false;
		}
	};

	runCycle().catch((error: unknown) => {
		console.error("Initial weather poll failed:", error);
	});
	setInterval(runCycle, METAR_POLL_INTERVAL_MS);
}

async function resolveStationMatches(markets: TemperatureMarket[]): Promise<
	Map<
		string,
		{
			error: string | null;
			stationMatch: StationMatch | null;
		}
	>
> {
	const matchesByMarketId = new Map<
		string,
		{ error: string | null; stationMatch: StationMatch | null }
	>();
	const byCity = new Map<string, TemperatureMarket>();

	for (const market of markets) {
		if (market.city) {
			byCity.set(market.city, market);
			continue;
		}

		matchesByMarketId.set(market.marketId, {
			error: "Market city is unavailable",
			stationMatch: null,
		});
	}

	const resolvedByCity = new Map<
		string,
		{ error: string | null; stationMatch: StationMatch | null }
	>();

	for (const [city, market] of byCity) {
		resolvedByCity.set(city, await resolveStationMatchForMarket(market));
	}

	for (const market of markets) {
		if (!market.city) {
			continue;
		}

		matchesByMarketId.set(
			market.marketId,
			resolvedByCity.get(market.city) ?? {
				error: `No station match for ${market.city}`,
				stationMatch: null,
			}
		);
	}

	return matchesByMarketId;
}

function buildWeatherByMarketId(
	markets: TemperatureMarket[],
	stationMatchesByMarketId: Awaited<ReturnType<typeof resolveStationMatches>>,
	updatedAt: string
): Record<string, MarketWeatherSnapshot> {
	const weatherByMarketId: Record<string, MarketWeatherSnapshot> = {};

	for (const market of markets) {
		const stationResult = stationMatchesByMarketId.get(market.marketId) ?? {
			error: "No station match result",
			stationMatch: null,
		};
		const stationId = stationResult.stationMatch?.stationId ?? null;
		const metar = stationId ? latestMetarByStationId.get(stationId) : null;
		const taf = stationId ? latestTafByStationId.get(stationId) : null;

		weatherByMarketId[market.marketId] = {
			comparison: compareTemperatureToMarketBand(market, metar?.temp ?? null),
			error: stationResult.error,
			marketId: market.marketId,
			metar: metar
				? {
						observationTime: metar.reportTime ?? null,
						rawText: metar.rawOb ?? null,
						temperatureC: metar.temp ?? null,
					}
				: null,
			stationMatch: stationResult.stationMatch,
			taf: taf
				? {
						issueTime: taf.issueTime ?? null,
						rawText: taf.rawTAF ?? null,
					}
				: null,
			updatedAt,
		};
	}

	return weatherByMarketId;
}

async function fetchMetarMap(
	stationIds: string[]
): Promise<Map<string, AviationMetar>> {
	const metars = await fetchMetarsByStationIds(stationIds);

	return new Map(metars.map((metar) => [metar.icaoId, metar]));
}

async function fetchTafMap(
	stationIds: string[]
): Promise<Map<string, AviationTaf>> {
	const tafs = await fetchTafsByStationIds(stationIds);

	return new Map(tafs.map((taf) => [taf.icaoId, taf]));
}

function getUniqueStationIds(
	stationMatchesByMarketId: Awaited<ReturnType<typeof resolveStationMatches>>
): string[] {
	return [
		...new Set(
			[...stationMatchesByMarketId.values()].flatMap(({ stationMatch }) =>
				stationMatch ? [stationMatch.stationId] : []
			)
		),
	];
}

function getUniqueTafStationIds(
	stationMatchesByMarketId: Awaited<ReturnType<typeof resolveStationMatches>>
): string[] {
	return [
		...new Set(
			[...stationMatchesByMarketId.values()].flatMap(({ stationMatch }) =>
				stationMatch?.hasTaf ? [stationMatch.stationId] : []
			)
		),
	];
}
