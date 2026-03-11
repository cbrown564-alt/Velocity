/**
 * Concept Discovery — Phase 4
 *
 * Clusters annotated variables into Concept entities based on shared
 * (topic, measurementIntent) pairs and similar value label structures.
 *
 * Ref: docs/design_phase4_semantic_layer.md §1.4
 */

import type { Variable, VariableSet } from '../../types';
import type { Concept, SemanticAnnotation } from '../../types/semantic';
import type { ConceptStore } from './concepts';

interface AnnotatedVariable {
  variable: Variable;
  datasetId: string;
  annotation: SemanticAnnotation;
}

interface ConceptGroup {
  topic: string;
  measurementIntent: string;
  conceptFamily?: string;
  members: AnnotatedVariable[];
}

function groupKey(a: SemanticAnnotation): string {
  return `${a.topic}::${a.measurementIntent}`;
}

function scalePointCount(variable: Variable): number {
  return variable.valueLabels.length;
}

/** Jaccard similarity between two value label sets (text-based) */
function valueLabelSimilarity(v1: Variable, v2: Variable): number {
  const labels1 = new Set(v1.valueLabels.map((vl) => vl.label.toLowerCase().trim()));
  const labels2 = new Set(v2.valueLabels.map((vl) => vl.label.toLowerCase().trim()));
  if (labels1.size === 0 && labels2.size === 0) return 1;
  if (labels1.size === 0 || labels2.size === 0) return 0;
  const intersection = new Set([...labels1].filter((l) => labels2.has(l)));
  const union = new Set([...labels1, ...labels2]);
  return intersection.size / union.size;
}

/**
 * Discover concept entities from a set of annotated variables.
 *
 * Algorithm:
 * 1. Group by (topic, measurementIntent)
 * 2. Within each group, sub-cluster by scale point count and label similarity
 * 3. For each sub-cluster, create or update a Concept in the store
 */
export function discoverConcepts(
  annotatedVars: AnnotatedVariable[],
  store: ConceptStore,
  options: { mergeThreshold?: number } = {}
): Concept[] {
  const mergeThreshold = options.mergeThreshold ?? 0.8;

  // Step 1: Group by topic::intent
  const groups = new Map<string, ConceptGroup>();
  for (const av of annotatedVars) {
    const key = groupKey(av.annotation);
    if (!groups.has(key)) {
      groups.set(key, {
        topic: av.annotation.topic,
        measurementIntent: av.annotation.measurementIntent,
        conceptFamily: av.annotation.conceptFamily,
        members: [],
      });
    }
    groups.get(key)!.members.push(av);
  }

  const discovered: Concept[] = [];

  for (const group of groups.values()) {
    const { topic, conceptFamily, members } = group;

    // Step 2: Sub-cluster by scale point count similarity
    const subClusters = subClusterByScale(members, mergeThreshold);

    for (const cluster of subClusters) {
      if (cluster.length === 0) continue;

      const repVar = cluster[0].variable;
      const pointCount = scalePointCount(repVar);
      const scaleLabel = pointCount > 0 ? ` (${pointCount}pt)` : '';
      const conceptName = conceptFamily
        ? `${conceptFamily}${scaleLabel}`
        : `${topic}${scaleLabel}`;

      // Check if a concept with this name already exists
      const existing = store.findByName(conceptName)[0];
      const concept = existing ?? store.createConcept({
        name: conceptName,
        aliases: conceptFamily && conceptFamily !== conceptName ? [conceptFamily] : [],
        ...(pointCount > 0
          ? { canonicalScale: { points: pointCount, direction: 'ascending' as const } }
          : {}),
      });

      // Link all variables in the cluster
      for (const av of cluster) {
        store.linkVariable(concept.id, {
          datasetId: av.datasetId,
          variableId: av.variable.id,
          matchConfidence: av.annotation.confidence,
        });
      }

      if (!discovered.some((c) => c.id === concept.id)) {
        discovered.push(concept);
      }
    }
  }

  return discovered;
}

/**
 * Sub-cluster a group of annotated variables by scale (point count + label similarity).
 * Returns an array of clusters.
 */
function subClusterByScale(
  members: AnnotatedVariable[],
  mergeThreshold: number
): AnnotatedVariable[][] {
  if (members.length === 0) return [];

  // Sort by scale point count for stability
  const sorted = [...members].sort(
    (a, b) => scalePointCount(a.variable) - scalePointCount(b.variable)
  );

  const clusters: AnnotatedVariable[][] = [];

  for (const member of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      const rep = cluster[0];
      const samePts = scalePointCount(rep.variable) === scalePointCount(member.variable);
      const sim = samePts
        ? valueLabelSimilarity(rep.variable, member.variable)
        : 0;

      // Merge if same point count and high label similarity, or both have 0 value labels
      const bothEmpty =
        rep.variable.valueLabels.length === 0 && member.variable.valueLabels.length === 0;
      if (samePts && (sim >= mergeThreshold || bothEmpty)) {
        cluster.push(member);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([member]);
    }
  }

  return clusters;
}

/**
 * Convenience wrapper: auto-annotate and discover concepts in one pass.
 * Used by VelocityEngine after dataset load.
 */
export function buildConceptsFromAnnotations(
  variables: Variable[],
  variableSets: VariableSet[],
  annotations: Map<string, SemanticAnnotation>,
  datasetId: string,
  store: ConceptStore
): Concept[] {
  const annotatedVars: AnnotatedVariable[] = [];

  for (const variable of variables) {
    const annotation = annotations.get(variable.id);
    if (!annotation) continue;
    // Only auto-link variables with conceptFamily set (higher-signal matches)
    if (!annotation.conceptFamily) continue;
    annotatedVars.push({ variable, datasetId, annotation });
  }

  return discoverConcepts(annotatedVars, store);
}
