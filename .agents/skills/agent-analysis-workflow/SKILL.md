---
name: agent-analysis-workflow
description: Use when an AI agent analyzes a survey dataset via Velocity MCP tools and builds a presentation deck. Follow the agent analysis workflow playbook and quickstart.
---

# Agent Analysis Workflow

**Mandatory playbook:** `docs/playbooks/agent_analysis_workflow.md`

**Tool reference:** `docs/guide_agent_quickstart.md`

Read both before calling MCP tools. Follow the playbook phases in order unless the user narrows scope.

## When to use

- MCP-driven dataset exploration, crosstabs, charts, deck export
- agent sessions that should end in a reviewable deck artifact

## Related skills

- `agent-eval-run` — scoring capability evals and gap classification (not the same as a single analysis session)
- `engine-boundary-change` — if tool behavior requires engine contract changes

## Completion criteria

- orient → analyze → deck phases completed or explicitly scoped down
- outputs are reviewable (not raw plumbing dumps)
- limitations and weighting caveats recorded when relevant
