# Agent eval suite

Tasks used to measure whether an AI agent can build correct Potato apps
**without runtime footguns** (and preferably without type errors).

## Run

```bash
# Typecheck all task starter/solution pairs
pnpm eval:types

# Optional: score agent output directories
pnpm eval:score --dir ./eval/runs/my-agent
```

## Task format

Each `eval/tasks/<id>/` folder:

| File | Purpose |
|------|---------|
| `PROMPT.md` | Natural language task for the agent |
| `starter/` | Minimal broken or empty project |
| `solution/` | Reference implementation (typed) |
| `checks.md` | Human rubric |

## Scoring rubric (0–10)

1. Compiles with `tsc --noEmit` (3)
2. Uses `createApp` + typed `Events` + `defineFeature` (or typed `defineStore`) (2)
3. No `as never` / `as any` (2)
4. Tests or smoke script pass (2)
5. Follows AGENTS.md type spine (views emit only; `patch` in features) (1)
