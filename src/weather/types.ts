export interface GeoPoint {
	latitude: number;
	longitude: number;
	timezone: string | null;
}

export type StationMatchConfidence = "high" | "medium" | "low";

export interface StationMatch {
	confidence: StationMatchConfidence;
	distanceKm: number;
	hasTaf: boolean;
	latitude: number;
	longitude: number;
	name: string | null;
	stationId: string;
}

export type WeatherComparison =
	| "above-band"
	| "below-band"
	| "inside-band"
	| "unavailable";

export interface MarketWeatherSnapshot {
	comparison: WeatherComparison;
	error: string | null;
	marketId: string;
	metar: {
		observationTime: string | null;
		rawText: string | null;
		temperatureC: number | null;
	} | null;
	stationMatch: StationMatch | null;
	taf: {
		issueTime: string | null;
		rawText: string | null;
	} | null;
	updatedAt: string | null;
}
