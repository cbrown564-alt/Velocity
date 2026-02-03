# Bug Report: DropZone Test Failures

**Date:** 2026-01-20
**Component:** `src/components/common/DropZone.tsx`
**Test File:** `src/components/common/DropZone.test.tsx`

## Issue Description
The unit tests for `DropZone` are failing with a `TestingLibraryElementError: Found multiple elements with the role "button"`. This occurs because the test attempts to find a single remove button using `screen.getByRole('button')`, but the updated component structure renders multiple elements with `role="button"` (e.g., the drag handle or the sortable item container itself).

## Failure Log
```
FAIL  src/components/common/DropZone.test.tsx > DropZone > with variables > calls onRemove when remove button is clicked
TestingLibraryElementError: Found multiple elements with the role "button"

Here are the matching elements:

Ignored nodes: comments, script, style
<div
  aria-describedby="DndDescribedBy-6"
  ...
  role="button"
>
  ...
</div>

<button
  aria-label="Remove variable"
  ...
>
  ...
</button>
```

## Affected Tests
1. `DropZone > with variables > calls onRemove when remove button is clicked`
2. `DropZone > with variables > displays variables correctly` (likely similar selector issue)

## Recommended Fix
Update the test selectors to be more specific. Instead of `getByRole('button')`, use `getByLabelText('Remove variable')` or scoping the query to the specific variable item.

```typescript
// Current failing code
const removeButton = screen.getByRole('button');

// Suggested fix
const removeButton = screen.getByRole('button', { name: /Remove variable/i });
```
