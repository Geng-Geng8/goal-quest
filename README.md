# H4 Goal Quest — Phase 1 Starter

This repository starts with **V4 exactly as it worked** as a standalone HTML file. The goal is to refactor it into maintainable, zero-build ES modules **without changing behavior**. No app features or data integrations have been added here.

## What's here

- `index.html` — working V4 student app (initially unchanged; GitHub Pages entry point).
- `reference/capstone_quest_v4.html` — **do not edit**; regression baseline.
- `docs/H4_Goal_Quest_V1_Complete_Product_Brief.md` — complete product vision; distinguishes working, planned and future features.
- `AGENTS.md` — constraints for Codex / Antigravity.
- `docs/PHASE_1_2_CODEX_PROMPT.md` — ready-to-paste implementation assignment.
- `tests/baseline.test.mjs` — no-dependency integrity/syntax check for the frozen baseline.
- `.nojekyll` — GitHub Pages compatibility.

## Run on your computer

1. Open this folder in Antigravity, Codex, VS Code or a terminal.
2. Start a local static server, for example:
   - **Windows:** `py -m http.server 8000`
   - **macOS / Linux:** `python3 -m http.server 8000`
3. Visit `http://localhost:8000/` in your browser.
4. To run baseline tests (Node.js required): `node --test tests/baseline.test.mjs`.

Data is saved **only in your browser**, under the key `h4_goal_quest_v4`. It is not synced. Browser data can be lost, so do not use this pre-pilot build for important long-term student records.

## Create the GitHub repository

1. In GitHub, create a **new repository** named `h4-goal-quest`. Start it **private** until you're ready for a public student pilot.
2. Upload the contents of this package to the repository root, retaining the folders (or clone the repo and commit these files).
3. Confirm `index.html`, `AGENTS.md`, `docs/` and `reference/` appear at the root.
4. Open the repo in Codex or Antigravity; paste `docs/PHASE_1_2_CODEX_PROMPT.md`.
5. Review the PR and the tests. **Do not merge or enable GitHub Pages yet.**

## Scope and safety

- No framework, bundler, backend or AI APIs.
- External AI coach uses student-copied prompts only.
- No actual live sharing between students and mentors.
- Do not use a real student's information during early testing.
- Baseline functionality must work before any features are changed.
