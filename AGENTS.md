# Project Rules

- When creating or substantially updating project-facing documentation, if the workspace contains an Obsidian vault inside the project or in a sibling directory, use `$obsidian-vault-sync` to collect the document into the vault and update the relevant index or overview note unless the user explicitly says not to sync it.
- When generating UI art assets with image2.0/imagegen for this project, generate each asset individually with a solid chroma-key background for clean cutout, then export separated transparent PNG files for direct game/frontend use. Avoid relying on one combined asset sheet that must be manually split later unless the user explicitly asks for a preview sheet.
