<!-- Written by tools/coverage-table.mjs from the coverage summary: run the tests with coverage, then the script. -->

# Code coverage

How much of the code the unit tests run, per folder. It says what ran, not that the behaviour is checked; branches say the most. A table to find untested parts, never a number to hit: CI reports fresh coverage; optional enforcement fails regressions against the main-branch baseline.

| Folder | Files | Lines | Statements | Branches | Functions |
|---|---|---|---|---|---|
| `src/app/` | 10 | 89.5 % | 85.7 % | 82.0 % | 95.2 % |
| **all** | 11 | 89.2 % | 85.4 % | 82.0 % | 93.8 % |

## Files no unit test runs

- `src/app/`: `app.config.ts`, `app.routes.ts`
