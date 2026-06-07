Current Status
v1.0 — Feature Complete (Claude Projects artifact)
The tool currently runs as a Claude Projects artifact. Local packaging (Tauri/Electron) is a planned next step.
What's working

PDF and image upload for manual parsing
Runner card display with expand/collapse
Structured part data extraction
Stable UI with resolved CSS grid alignment

In progress

Schema mapping to Veda's JSON intake format
Local model integration
Tauri/Electron packaging for standalone desktop use


How to Run (Current Method)
Since local packaging isn't ready yet, the tool runs inside Claude's sandbox via Claude Projects:

Go to claude.ai and create a new Project (not a regular chat)
Upload GundamNucleus.jsx to the project
Start a conversation and prompt: "Run Gundam Nucleus"
Claude will render and run the tool in its sandbox

That's it — no installs, no dependencies to manage.

Roadmap

 Schema mapping → Veda JSON intake format
 Local model integration
 Tauri or Electron packaging for standalone desktop app
 Full pipeline: given a manual, output all parts and sections


Contributing
This tool is being developed in collaboration with the Veda project. If you have feedback on the extraction schema or want to contribute, reach out via Reddit or open an issue here.

Built for the Gunpla community.
