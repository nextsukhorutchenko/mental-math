# Minecraft skin refresh

The user approved the generated black-and-violet Minecraft character and requested improved versions of every existing skin, installed in the app.

## Design

Keep the 17 existing IDs and names, costume identities and palettes. Generate one transparent, full-body Minecraft-style character per skin, using the current sprite and approved concept as references. Prefer crisp voxel geometry and pixel textures over illustration. Use the same artwork for the full avatar and a separately framed head crop. Keep the existing sprite as an immediate fallback if an image fails to load.

## Implementation

- [x] Export existing sprites as generation references; generate and inspect all 17 replacements.
- [x] Prepare optimized WebP assets and explicit full-body/head framing metadata. Bundle assets with Vite so updates and offline precaching include them.
- [x] Update the existing Avatar renderer to display artwork, retaining accessible labels, animation, fallback and saved skin IDs.
- [x] Verify asset completeness and framing, run tests/build, and inspect the picker, small head badges, persistence and mobile layout in a browser.

## Verification

172 tests passed; production build succeeded. Browser checks confirmed all 17 images decode and every selection persists, head crops are square, a missing image returns to the original sprite, and the 390 px mobile layout has no horizontal overflow. Production was tested under `/mental-math/`: all 17 WebP files were precached, remained available after an offline reload, and the selected skin survived another offline reload. No browser page errors. Total final artwork: 566,142 bytes.

## Constraints and review

No changes to arithmetic, progression, rewards or user data. No added runtime dependencies. Verify all 17 images load, heads remain readable at 30 pixels, full figures fit picker cards, and the production build includes every image. This is an in-app avatar refresh, not a promise of importable Minecraft UV textures.
