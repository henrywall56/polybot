import { afterEach, describe, expect, test } from "bun:test";
import { geocodeCity } from "../../src/weather/geocoding.ts";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response): void {
	globalThis.fetch = (() => Promise.resolve(response)) as typeof fetch;
}

describe("Open-Meteo geocoding client", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("returns the first geocoding result as a GeoPoint", async () => {
		mockFetch(
			Response.json({
				results: [
					{
						latitude: 47.606_21,
						longitude: -122.332_07,
						timezone: "America/Los_Angeles",
					},
				],
			})
		);

		expect(await geocodeCity("Seattle")).toEqual({
			latitude: 47.606_21,
			longitude: -122.332_07,
			timezone: "America/Los_Angeles",
		});
	});

	test("returns null when no geocoding result is available", async () => {
		mockFetch(Response.json({}));

		expect(await geocodeCity("Not a city")).toBeNull();
	});
});
