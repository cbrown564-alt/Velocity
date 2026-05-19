# Changelog: Legacy UI Refactor (Milestone 1.5)

**Date:** January 19, 2026
**Focus:** Design System alignment & Prototype technical debt removal.

## Overview

This refactor successfully updated the early prototype components of Velocity to align with the **"Research Desk" Design System** (`docs/design_01_system.md`). The primary goal was to remove inconsistent Tailwind utility classes and replace them with standard CSS variables and typography tokens.

## Key Changes

### 1. Global Design Tokens
We have replaced hardcoded hex values and Tailwind color palettes (Slate/Indigo) with semantic CSS variables:
- **Typography:** Implemented `Newsreader` (headers) and `Atkinson Hyperlegible` (body) across all updated components.
- **Colors:** Switched to the "Ink & Paper" palette:
    - `bg-white` → `bg-[var(--color-paper)]` (Warm off-white)
    - `text-slate-900` → `text-[var(--color-ink)]`
    - `text-indigo-600` → `text-[var(--color-terracotta)]` (Accent)

### 2. Component Updates

| Component | Status | Key Changes |
| :--- | :--- | :--- |
| **DataTable** | ✅ Complete | Refactored to "Editorial Table" style.<br>- Removed vertical borders.<br>- Added significance marker styling.<br>- Updated chart colors to design palette. |
| **DraggableVariable** | ✅ Complete |- Updated card background to `var(--color-parchment)`.<br>- Added `terracotta` ring for active drag states.<br>- Replaced icons with Lucide-React consistent sizing. |
| **DropZone** | ✅ Complete | - Standardized drop active states.<br>- Unified dotted border styling. |
| **DataDrawer** | ✅ Complete | - Updated "X-Ray View" to use `Newsreader` headers.<br>- Fixed backdrop transparency. |
| **RecodeModal** | ✅ Complete | - Full visual overhaul to match new modal design patterns. |
| **CollaboratorCursor** | ✅ Complete | - Updated multiplayer cursor labels to match font stack. |

## Technical Debt Removed
- Removed ~50 instances of `text-slate-*` colors.
- Removed ~40 instances of `bg-indigo-*` backgrounds.
- Standardized 10+ ad-hoc shadow definitions to `var(--shadow-*)` tokens.

## Next Steps
- Verify visual consistency in the deployed staging environment.
- Proceed to **Phase 2: The Strategic Workbench**.
