# Gate 3 Designer Spec: Persistent Deck Recipe Metadata

**Status:** implemented  
**Date:** 2026-06-27  

## Contract

`VelocitySessionFile.deckRecipe` is an optional additive block:

- `recipeVersion: 1`
- `sections`
- `slideRecipes`

The exported deck recipe is derived from current slides and sections. It duplicates recipe metadata, not respondent rows or cached query results.

The importer always returns `patch.deckRecipe`, deriving it from sanitized slides and sections. If an imported `deckRecipe` references slide IDs that do not exist after slide sanitation, those IDs are recorded in import diagnostics.

## Compatibility

No session version bump is required because the field is optional and additive. v1/v2 sessions without `deckRecipe` continue to import.

## Tests

- exporter includes deck recipe and excludes OPFS/runtime internals
- importer derives deck recipe from sanitized slides
- stale deck recipe slide IDs surface diagnostics
- session round trip preserves deck recipe metadata
- diagnostics message helpers include dropped deck-recipe slide references
