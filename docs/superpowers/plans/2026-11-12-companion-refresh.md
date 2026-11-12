# Minecraft companion refresh

The user approved the black dog and bison preview direction and requested regenerated versions of every companion installed in the app.

## Design

Generate separate transparent Minecraft-style images for all 10 existing companions: fox, cat, dog, wolf, bear, boar, tiger, lion, bison and T. rex. Keep the existing IDs, names, species, defining colors and friendly tone. Preserve the selected pet, gender-aware phrases and mood animations. Use the existing sprite as the image-error fallback.

## Implementation

- [x] Export original sprites for references, generate and inspect all 10 images.
- [x] Optimize transparent WebP files and add a statically imported artwork catalog so Vite's offline build includes them.
- [x] Update PetSprite and size the images for the picker and companion scenes.
- [x] Verify all selections, saved state, phrases, image-error fallback, mobile layout and production offline behavior. Run the test suite and build.

## Verification

184 tests passed across 20 files; production build and diff whitespace checks passed. All 10 WebP images retain transparency and total 342,584 bytes. In the production browser under `/mental-math/`, all images loaded and all selections persisted; dog selection survived reload, and bison selection survived an offline reload. The 390 px mobile layout has no horizontal overflow. A blocked fox image displayed its original sprite. No browser page errors. Picker, every companion scene, mobile scene and collection preview were visually inspected. Existing IDs, names and gender-aware phrases are covered by tests.

## Constraints

No arithmetic, curriculum, reward, or save-format changes. No added runtime dependencies. Keep this change separate from the previously completed avatar refresh.
