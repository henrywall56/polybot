# AGENTS

## Working Style

- Keep changes small and related so they can be staged as clear commits.
- Prefer the smallest amount of code that solves the current problem.
- Do not add abstractions before they are needed.
- Explain new Bun, TypeScript, or Zod concepts briefly when they first appear.
- Update `DOCS.md` whenever making a large feature, architecture change, or durable technical decision.
- Update this file when the user gives a reusable repo workflow preference, such as adding a testing framework or changing how future agents should work.
- Include appropriate tests with each implementation step, or explicitly explain why tests were not added.

## Project Conventions

- Use Bun as the runtime, package manager, and script runner.
- Use strict TypeScript settings.
- Use Zod for runtime validation of external data and environment variables.
- Prefer Bun's built-in `fetch` before adding more dependencies.

## Early Architecture

- Start with a runnable app, not a large framework.
- Add modules when a real responsibility appears, such as markets, weather, or strategy logic.
- Keep configuration validation close to startup so failures happen early.
