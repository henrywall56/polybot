# polybot

Small TypeScript/Bun project for exploring Polymarket trading ideas with external data sources.

Initial focus:
- read market data from the Polymarket Gamma API
- compare implied probabilities against fresher weather data

## Setup

Install dependencies:

```sh
bun install
```

Create a local env file:

```sh
cp .env.example .env
```

Run the app:

```sh
bun run start
```

Run in watch mode:

```sh
bun run dev
```

Check TypeScript types:

```sh
bun run check
```
