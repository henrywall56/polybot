import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import PlotComponent from "react-plotly.js";
import type {
	GammaEvent,
	GammaMarket,
	TemperatureMarket,
} from "../gamma/markets.ts";
import type { MarketProbabilityPoint } from "../gamma/probability-history.ts";
import type { TemperatureMarketSnapshot } from "../gamma/store.ts";
import {
	buildProbabilityGraphSeries,
	filterProbabilityHistory,
	groupByCity,
	type ProbabilityGraphHorizon,
	probabilityGraphHorizons,
	renderTemperatureRange,
} from "./view-model.ts";
import "./styles.css";

const Plot =
	(PlotComponent as unknown as { default?: typeof PlotComponent }).default ??
	PlotComponent;

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

function renderValue(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function ProbabilityGraph({
	history,
	marketTitle,
}: {
	history: MarketProbabilityPoint[];
	marketTitle: string | null;
}) {
	const [horizon, setHorizon] = useState<ProbabilityGraphHorizon>(null);
	const filteredHistory = filterProbabilityHistory(history, horizon);
	const series = buildProbabilityGraphSeries(filteredHistory);

	return (
		<section className="probability-panel">
			<fieldset
				aria-label="Probability graph horizon"
				className="probability-toolbar"
			>
				{probabilityGraphHorizons.map((option) => (
					<button
						aria-pressed={horizon === option.value}
						key={option.label}
						onClick={() => setHorizon(option.value)}
						type="button"
					>
						{option.label}
					</button>
				))}
			</fieldset>

			{series.timestamps.length === 0 ? (
				<p className="empty-state">No valid implied probability history yet.</p>
			) : (
				<Plot
					className="probability-plot"
					config={{
						displaylogo: false,
						modeBarButtonsToRemove: ["lasso2d", "select2d"],
						responsive: true,
					}}
					data={[
						{
							hovertemplate: "%{x}<br>Yes: %{y:.2f}%<extra></extra>",
							line: { color: "#146c5f", width: 2 },
							marker: { color: "#146c5f", size: 5 },
							mode: "lines+markers",
							name: "Yes",
							type: "scatter",
							x: series.timestamps,
							y: series.percentValues,
						},
					]}
					layout={{
						autosize: true,
						dragmode: "pan",
						font: {
							color: "#13211a",
							family:
								"Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, serif",
						},
						margin: { b: 44, l: 54, r: 20, t: 28 },
						paper_bgcolor: "rgba(255, 251, 244, 0)",
						plot_bgcolor: "rgba(255, 251, 244, 0.68)",
						title: {
							font: { size: 15 },
							text: marketTitle ?? "Implied Yes probability",
						},
						xaxis: {
							gridcolor: "rgba(19, 33, 26, 0.12)",
							title: { text: "Time" },
							type: "date",
						},
						yaxis: {
							gridcolor: "rgba(19, 33, 26, 0.12)",
							range: [0, 100],
							ticksuffix: "%",
							title: { text: "Yes probability" },
						},
					}}
					style={{ height: "320px", width: "100%" }}
					useResizeHandler
				/>
			)}
		</section>
	);
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
	const probabilityHistoryByMarketId =
		snapshot?.probabilityHistoryByMarketId ?? {};

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
													<ProbabilityGraph
														history={
															probabilityHistoryByMarketId[
																record.market.marketId
															] ?? []
														}
														marketTitle={record.market.marketTitle}
													/>

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

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

createRoot(root).render(<App />);
