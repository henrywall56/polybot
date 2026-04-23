import { afterEach, describe, expect, test } from "bun:test";
import {
	fetchMetarsByStationIds,
	fetchStationsByBoundingBox,
	fetchTafsByStationIds,
} from "../../src/weather/aviation-weather.ts";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response): void {
	globalThis.fetch = (() => Promise.resolve(response)) as typeof fetch;
}

describe("aviation weather client", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("parses stationinfo JSON", async () => {
		mockFetch(
			Response.json([
				{
					id: "KSEA",
					icaoId: "KSEA",
					lat: 47.444_67,
					lon: -122.314_42,
					site: "Seattle-Tacoma Intl",
					siteType: ["METAR", "TAF"],
				},
			])
		);

		const stations = await fetchStationsByBoundingBox({
			maxLatitude: 48,
			maxLongitude: -122,
			minLatitude: 47,
			minLongitude: -123,
		});

		expect(stations).toEqual([
			{
				id: "KSEA",
				icaoId: "KSEA",
				lat: 47.444_67,
				lon: -122.314_42,
				site: "Seattle-Tacoma Intl",
				siteType: ["METAR", "TAF"],
			},
		]);
	});

	test("parses METAR JSON and returns empty arrays for 204 responses", async () => {
		mockFetch(
			Response.json([
				{
					icaoId: "KSEA",
					rawOb: "METAR KSEA 231053Z 18007KT 10SM OVC070 08/05 A3018",
					reportTime: "2026-04-23T11:00:00.000Z",
					temp: 7.8,
				},
			])
		);

		expect(await fetchMetarsByStationIds(["KSEA"])).toEqual([
			{
				icaoId: "KSEA",
				rawOb: "METAR KSEA 231053Z 18007KT 10SM OVC070 08/05 A3018",
				reportTime: "2026-04-23T11:00:00.000Z",
				temp: 7.8,
			},
		]);

		mockFetch(new Response(null, { status: 204 }));

		expect(await fetchMetarsByStationIds(["KSEA"])).toEqual([]);
	});

	test("parses TAF JSON", async () => {
		mockFetch(
			Response.json([
				{
					icaoId: "KSEA",
					issueTime: "2026-04-23T09:16:00.000Z",
					rawTAF: "TAF KSEA 230916Z 2309/2412 17010KT P6SM SCT060",
				},
			])
		);

		expect(await fetchTafsByStationIds(["KSEA"])).toEqual([
			{
				icaoId: "KSEA",
				issueTime: "2026-04-23T09:16:00.000Z",
				rawTAF: "TAF KSEA 230916Z 2309/2412 17010KT P6SM SCT060",
			},
		]);
	});
});
