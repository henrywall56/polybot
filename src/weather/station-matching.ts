import type { TemperatureMarket } from "../gamma/markets.ts";
import type { AviationStation } from "./aviation-weather.ts";
import { fetchStationsByBoundingBox } from "./aviation-weather.ts";
import { geocodeCity } from "./geocoding.ts";
import type {
	GeoPoint,
	StationMatch,
	StationMatchConfidence,
} from "./types.ts";

const BOUNDING_BOX_SPANS_DEGREES = [0.5, 1, 2, 5];
const EARTH_RADIUS_KM = 6371;

const stationMatchCache = new Map<
	string,
	{ error: string | null; stationMatch: StationMatch | null }
>();

export function clearStationMatchCache(): void {
	stationMatchCache.clear();
}

export function calculateDistanceKm(left: GeoPoint, right: GeoPoint): number {
	const leftLat = toRadians(left.latitude);
	const rightLat = toRadians(right.latitude);
	const deltaLat = toRadians(right.latitude - left.latitude);
	const deltaLon = toRadians(right.longitude - left.longitude);
	const a =
		Math.sin(deltaLat / 2) ** 2 +
		Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return EARTH_RADIUS_KM * c;
}

export function compareTemperatureToMarketBand(
	market: TemperatureMarket,
	temperatureC: number | null
) {
	const comparableTemperature = convertTemperatureForMarket(
		temperatureC,
		market.unit
	);

	if (comparableTemperature == null) {
		return "unavailable";
	}

	if (
		market.temperatureMin != null &&
		comparableTemperature < market.temperatureMin
	) {
		return "below-band";
	}

	if (
		market.temperatureMax != null &&
		comparableTemperature > market.temperatureMax
	) {
		return "above-band";
	}

	if (market.temperatureMin == null && market.temperatureMax == null) {
		return "unavailable";
	}

	return "inside-band";
}

export async function resolveStationMatchForMarket(
	market: TemperatureMarket
): Promise<{ error: string | null; stationMatch: StationMatch | null }> {
	if (!market.city) {
		return {
			error: "Market city is unavailable",
			stationMatch: null,
		};
	}

	const cached = stationMatchCache.get(market.city);
	if (cached) {
		return cached;
	}

	try {
		const cityPoint = await geocodeCity(market.city);

		if (!cityPoint) {
			const result = {
				error: `No geocoding result for ${market.city}`,
				stationMatch: null,
			};
			stationMatchCache.set(market.city, result);
			return result;
		}

		const station = await findNearestMetarStation(cityPoint);

		if (!station) {
			const result = {
				error: `No METAR-capable station found near ${market.city}`,
				stationMatch: null,
			};
			stationMatchCache.set(market.city, result);
			return result;
		}

		const distanceKm = calculateDistanceKm(cityPoint, {
			latitude: station.lat,
			longitude: station.lon,
			timezone: null,
		});
		const result = {
			error: null,
			stationMatch: {
				confidence: getConfidence(distanceKm),
				distanceKm,
				hasTaf: station.siteType.includes("TAF"),
				latitude: station.lat,
				longitude: station.lon,
				name: station.site ?? null,
				stationId: station.icaoId ?? station.id,
			},
		};

		stationMatchCache.set(market.city, result);
		return result;
	} catch (error) {
		const result = {
			error: error instanceof Error ? error.message : String(error),
			stationMatch: null,
		};
		stationMatchCache.set(market.city, result);
		return result;
	}
}

export function selectNearestMetarStation(
	point: GeoPoint,
	stations: AviationStation[]
): AviationStation | null {
	const metarStations = stations.filter(
		(station) =>
			station.icaoId != null &&
			station.siteType.includes("METAR") &&
			Number.isFinite(station.lat) &&
			Number.isFinite(station.lon)
	);

	return (
		metarStations
			.map((station) => ({
				distanceKm: calculateDistanceKm(point, {
					latitude: station.lat,
					longitude: station.lon,
					timezone: null,
				}),
				station,
			}))
			.sort((left, right) => left.distanceKm - right.distanceKm)[0]?.station ??
		null
	);
}

async function findNearestMetarStation(
	point: GeoPoint
): Promise<AviationStation | null> {
	for (const span of BOUNDING_BOX_SPANS_DEGREES) {
		const stations = await fetchStationsByBoundingBox({
			maxLatitude: point.latitude + span,
			maxLongitude: point.longitude + span,
			minLatitude: point.latitude - span,
			minLongitude: point.longitude - span,
		});
		const nearestStation = selectNearestMetarStation(point, stations);

		if (nearestStation) {
			return nearestStation;
		}
	}

	return null;
}

function convertTemperatureForMarket(
	temperatureC: number | null,
	unit: TemperatureMarket["unit"]
): number | null {
	if (temperatureC == null) {
		return null;
	}

	if (unit === "C") {
		return temperatureC;
	}

	if (unit === "F") {
		return temperatureC * (9 / 5) + 32;
	}

	return null;
}

function getConfidence(distanceKm: number): StationMatchConfidence {
	if (distanceKm <= 25) {
		return "high";
	}

	if (distanceKm <= 75) {
		return "medium";
	}

	return "low";
}

function toRadians(value: number): number {
	return value * (Math.PI / 180);
}
