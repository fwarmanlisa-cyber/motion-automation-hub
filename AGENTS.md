# Project direction

Motion Automation Hub is an automation-first local motion graphics pipeline.
The user's priority is scenario/data/code -> generated timeline -> preview -> video,
then local AI through AIProvider. Do not prioritize expanding manual graphical panels.
Keep play, pause, restart and seek controls for inspecting automatic output.

Develop step by step. Validate each stage with actual rendered behavior before the next.
Present a plan for user approval before substantial new phases. Do not build AI or
video rendering while the prerequisite motion/scenario pipeline is unresolved.
Keep media-mcp independent and unchanged. Read README.md and docs/automation.md.

Use the existing checkout; do not create a worktree unless explicitly requested.
Preserve user projects, scenario files and backups. Generated output must be validated,
repeatable and backed up before replacement. AI must produce structured data, never
executable JavaScript. Runtime must not require cloud services or CDN access.

Validation: npm test and npm run test:browser. Browser tests start isolated servers
and temporary project files; they must not overwrite projects/demo.json or user projects.
Use a local Chromium via CHROMIUM_PATH or /usr/bin/chromium when available.
