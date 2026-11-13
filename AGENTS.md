# Project direction

Motion Automation Hub is an automation-first local motion graphics pipeline.
The user's priority is scenario/data/code -> generated timeline -> preview -> video,
then external automation. The user now obtains motion JavaScript from official AI models outside this server and injects the ready code via HTTP. Do not implement AI-service integration or local automation in the current stage. Do not prioritize expanding manual graphical panels.
Keep play, pause, restart and seek controls for inspecting automatic output.

Develop step by step. Validate each stage with actual rendered behavior before the next.
Present a plan for user approval before substantial new phases. Do not build AI or automation integration while the prerequisite motion/render pipeline is unresolved. Basic MP4 rendering is now authorized; do not design professional-library/plugin infrastructure yet.
Keep media-mcp independent and unchanged. Read README.md and docs/automation.md.

Use the existing checkout; do not create a worktree unless explicitly requested.
Preserve user projects, scenario files and backups. Generated output must be validated,
repeatable and backed up before replacement. The previously JSON-only model rule was superseded by user approval: accept trusted motion JavaScript modules with composition metadata and a synchronous createMotion({stage, gsap}) returning a paused GSAP timeline. Execute motion code only in the renderer browser, never in Node.js. JSON remains the scenario/project data format. Rendering runtime must not require cloud services or CDN access. Future advanced libraries/skills are a stated goal only; do not design their architecture in the current phase.

Validation: npm test, npm run test:browser, and npm run test:render (real Chromium/FFmpeg/ffprobe integration). Browser tests start isolated servers
and temporary project files; they must not overwrite projects/demo.json or user projects.
Use a local Chromium via CHROMIUM_PATH or /usr/bin/chromium when available.
