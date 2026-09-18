# Pre-presentation contract test matrix

The benchmark now treats its evaluation infrastructure as software rather than prose.

| Contract | Automated invariant |
|---|---|
| JSON schemas | Every shared schema is a valid Draft 2020-12 schema |
| Scoring | Dimension weights total 100; presentation weight is exactly zero |
| Experiment design | E1–E5 exist; stability requires at least five replicates |
| Exposure | Hidden generator/trap/reference/scoring material is forbidden |
| Study scope | SBT-002/003 explicitly stop before presentation |
| Finding inventories | Unique IDs; mandatory and do-not-elevate tiers both present |
| Renderer neutrality | Reference findings contain analytical relationships, not slide/PPT instructions |
| Selection scoring | Known fixture reproduces mandatory recall, precision, unsupported and restraint metrics |
| Repository structure | Required study/generator/reference/freeze-validator files exist |

## Execution tests still pending

The following deliberately require a runtime and remain gates rather than remotely asserted successes:

1. run SBT-002 generator → reference analysis → freeze validator;
2. run SBT-003 generator → reference analysis → freeze validator;
3. validate generated datasets against fingerprints;
4. bind realised evidence values;
5. validate all generated JSON against shared schemas;
6. run first E3 model only after freeze PASS.

A structural test passing does **not** imply that a synthetic study's realised latent truths passed. Those remain separate pre-model execution gates.
