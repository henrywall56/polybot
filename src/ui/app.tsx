import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
	GammaEvent,
	GammaMarket,
	TemperatureMarket,
} from "../gamma/markets.ts";
import type { TemperatureMarketSnapshot } from "../gamma/store.ts";
import "./styles.css";

interface TemperatureMarketRecord {
	event: GammaEvent;
	market: TemperatureMarket;
	rawMarket: GammaMarket;
}

interface GroupedEvent {
	event: GammaEvent;
	records: TemperatureMarketRecord[];
}

interface GroupedCity {
	city: string;
	events: GroupedEvent[];
}

type ApiSnapshot = Omit<TemperatureMarketSnapshot, "records"> & {
	records: Array<{
		event: GammaEvent;
		market: TemperatureMarket;
		rawMarket: GammaMarket;
	}>;
};

async function fetchSnapshot(): Promise<ApiSnapshot> {
	const response = await fetch("/api/temperature-markets");

	if (!response.ok) {
		throw new Error(`Snapshot fetch failed: ${response.status}`);
	}

	return response.json();
}

function groupByCity(records: TemperatureMarketRecord[]): GroupedCity[] {
	const cityMap = new Map<string, Map<string, GroupedEvent>>();

	for (const record of records) {
		const city = record.market.city ?? "Unknown";
		const eventGroups = cityMap.get(city) ?? new Map<string, GroupedEvent>();
		const existing = eventGroups.get(record.event.id) ?? {
			event: record.event,
			records: [],
		};

		existing.records.push(record);
		eventGroups.set(record.event.id, existing);
		cityMap.set(city, eventGroups);
	}

	return [...cityMap.entries()]
		.map(([city, eventGroups]) => ({
			city,
			events: [...eventGroups.values()],
		}))
		.sort((left, right) => left.city.localeCompare(right.city));
}

function renderValue(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function App() {
	const [snapshot, setSnapshot] = useState<ApiSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		const load = () => {
			fetchSnapshot()
				.then((nextSnapshot) => {
					if (!cancelled) {
						setSnapshot(nextSnapshot);
						setError(null);
					}
				})
				.catch((nextError: unknown) => {
					if (!cancelled) {
						setError(
							nextError instanceof Error
								? nextError.message
								: "Unknown UI fetch error"
						);
					}
				});
		};

		load();
		const intervalId = window.setInterval(load, 5000);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, []);

	const groupedCities = groupByCity(snapshot?.records ?? []);

	return (
		<main className="page">
			<header className="page-header">
				<h1>Temperature Market Viewer</h1>
				<p>Grouped by city, then event, then market.</p>
				<p>Latest snapshot: {snapshot?.updatedAt ?? "Not loaded yet"}</p>
				{snapshot?.error ? <p className="error">{snapshot.error}</p> : null}
				{error ? <p className="error">{error}</p> : null}
			</header>

			<section className="summary">
				<div>
					<strong>Cities:</strong> {groupedCities.length}
				</div>
				<div>
					<strong>Events:</strong> {snapshot?.events.length ?? 0}
				</div>
				<div>
					<strong>Markets:</strong> {snapshot?.markets.length ?? 0}
				</div>
			</section>

			<section className="group-list">
				{groupedCities.map((cityGroup) => (
					<details className="group-card" key={cityGroup.city}>
						<summary>
							<span>{cityGroup.city}</span>
							<span>{cityGroup.events.length} events</span>
						</summary>

						<div className="group-content">
							{cityGroup.events.map((eventGroup) => (
								<details className="event-card" key={eventGroup.event.id}>
									<summary>
										<span>{eventGroup.event.title ?? eventGroup.event.id}</span>
										<span>{eventGroup.records.length} markets</span>
									</summary>

									<div className="group-content">
										{eventGroup.records.map((record) => (
											<details
												className="market-card"
												key={record.market.marketId}
											>
												<summary>
													<span>{renderTemperatureRange(record.market)}</span>
													<span>
														{record.market.temperatureKind ?? "unknown"} /{" "}
														{record.market.unit ?? "?"}
													</span>
												</summary>

												<div className="group-content">
													<details open>
														<summary>Mapped fields</summary>
														<pre>{renderValue(record.market)}</pre>
													</details>

													<details>
														<summary>Raw event</summary>
														<pre>{renderValue(record.event)}</pre>
													</details>

													<details>
														<summary>Raw market</summary>
														<pre>{renderValue(record.rawMarket)}</pre>
													</details>
												</div>
											</details>
										))}
									</div>
								</details>
							))}
						</div>
					</details>
				))}
			</section>
		</main>
	);
}

function renderTemperatureRange(market: TemperatureMarket): string {
	if (market.temperatureMin == null && market.temperatureMax == null) {
		return market.marketTitle ?? market.marketId;
	}

	if (market.temperatureMin == null) {
		return `${market.temperatureMax}${market.unit ?? ""} or below`;
	}

	if (market.temperatureMax == null) {
		return `${market.temperatureMin}${market.unit ?? ""} or higher`;
	}

	if (market.temperatureMin === market.temperatureMax) {
		return `${market.temperatureMin}${market.unit ?? ""}`;
	}

	return `${market.temperatureMin}-${market.temperatureMax}${market.unit ?? ""}`;
}

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

createRoot(root).render(<App />);
