---
name: ui-mode-change
description: Use when changing React UI, layout, theme tokens, Variable Manager vs Analysis Canvas behavior, or keyboard/interaction flows. Follow the UI mode change playbook.
---

# UI Mode Change

**Mandatory playbook:** `docs/playbooks/ui_mode_change.md`

Read and follow that playbook end-to-end before merging UI changes.

## When to use

- Variable Manager or Analysis Canvas
- theme tokens, typography, spacing, components
- new panels, commands, shortcuts, deck/slide interactions
- anything that blurs Manager vs Canvas responsibilities

## Also read

- `docs/design_01_system.md`
- `docs/design_02_ux_modes.md`
- `docs/arch_08_testing.md` for component test patterns
- `performance-pass` if the change triggers expensive recompute

## Completion criteria

- mode separation preserved
- tokens/components used instead of one-off styling
- no heavy compute moved to the main thread
- component or integration tests updated for changed behavior
