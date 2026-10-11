# Contributing

Thanks for your interest in contributing! This document explains how to set up
your development environment and what we expect from contributions.

## Development setup

### Prerequisites

- **Node.js 22+**
- **Ollama** running locally (the app uses it for local AI inference)

### Getting started

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Running checks

- **Tests:** `npm run test`
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`

## Eval framework

To benchmark model performance locally:

```bash
npm run eval:models -- --runs 3 --out evals/output/benchmark.json
```

## Guidelines

- Keep changes small and focused — one logical change per PR.
- Run all checks (tests, lint, typecheck) before submitting.
- Write tests for new logic.
