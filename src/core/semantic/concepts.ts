/**
 * Concept Entity Storage & Linking — Phase 4
 *
 * A Concept links variables across datasets and waves that measure
 * the same underlying construct (e.g. "Overall Satisfaction").
 *
 * Ref: docs/design_phase4_semantic_layer.md §1.3
 */

import type { Concept, ConceptVariableRef } from '../../types/semantic';

let conceptIdCounter = 0;

function generateConceptId(): string {
  return `concept-${Date.now()}-${++conceptIdCounter}`;
}

// ============================================================================
// ConceptStore
// ============================================================================

export class ConceptStore {
  private concepts: Map<string, Concept> = new Map();

  // ---- CRUD ----------------------------------------------------------------

  createConcept(spec: {
    name: string;
    aliases?: string[];
    canonicalScale?: Concept['canonicalScale'];
  }): Concept {
    const concept: Concept = {
      id: generateConceptId(),
      name: spec.name,
      aliases: spec.aliases ?? [],
      canonicalScale: spec.canonicalScale,
      variableRefs: [],
    };
    this.concepts.set(concept.id, concept);
    return concept;
  }

  getConcept(id: string): Concept | undefined {
    return this.concepts.get(id);
  }

  listConcepts(): Concept[] {
    return Array.from(this.concepts.values());
  }

  deleteConcept(id: string): boolean {
    return this.concepts.delete(id);
  }

  /** Add an alias to an existing concept (enables synonym expansion in search) */
  addAlias(conceptId: string, alias: string): void {
    const concept = this.concepts.get(conceptId);
    if (!concept) throw new Error(`Concept not found: ${conceptId}`);
    if (!concept.aliases.includes(alias)) {
      concept.aliases = [...concept.aliases, alias];
    }
  }

  // ---- Variable Linking ----------------------------------------------------

  linkVariable(
    conceptId: string,
    ref: Omit<ConceptVariableRef, never>
  ): void {
    const concept = this.concepts.get(conceptId);
    if (!concept) throw new Error(`Concept not found: ${conceptId}`);

    const exists = concept.variableRefs.some(
      (r) => r.datasetId === ref.datasetId && r.variableId === ref.variableId
    );
    if (!exists) {
      concept.variableRefs = [...concept.variableRefs, ref];
    } else {
      // Update existing ref
      concept.variableRefs = concept.variableRefs.map((r) =>
        r.datasetId === ref.datasetId && r.variableId === ref.variableId ? ref : r
      );
    }
  }

  unlinkVariable(conceptId: string, datasetId: string, variableId: string): void {
    const concept = this.concepts.get(conceptId);
    if (!concept) return;
    concept.variableRefs = concept.variableRefs.filter(
      (r) => !(r.datasetId === datasetId && r.variableId === variableId)
    );
  }

  /** Find concepts linked to a given variable */
  conceptsForVariable(datasetId: string, variableId: string): Concept[] {
    return this.listConcepts().filter((c) =>
      c.variableRefs.some((r) => r.datasetId === datasetId && r.variableId === variableId)
    );
  }

  /** Find concepts by name or alias (case-insensitive) */
  findByName(query: string): Concept[] {
    const q = query.toLowerCase();
    return this.listConcepts().filter(
      (c) =>
        c.name.toLowerCase() === q ||
        c.aliases.some((a) => a.toLowerCase() === q)
    );
  }

  // ---- Merge ---------------------------------------------------------------

  /**
   * Merge two concepts, consolidating their variable refs.
   * Removes the source concept after merging.
   */
  mergeConcepts(targetId: string, sourceId: string): Concept {
    const target = this.concepts.get(targetId);
    const source = this.concepts.get(sourceId);
    if (!target) throw new Error(`Target concept not found: ${targetId}`);
    if (!source) throw new Error(`Source concept not found: ${sourceId}`);

    // Merge aliases (deduplicated)
    const mergedAliases = Array.from(new Set([...target.aliases, source.name, ...source.aliases]));

    // Merge variable refs (deduplicated by datasetId+variableId)
    const refMap = new Map<string, ConceptVariableRef>();
    for (const ref of [...target.variableRefs, ...source.variableRefs]) {
      const key = `${ref.datasetId}:${ref.variableId}`;
      const existing = refMap.get(key);
      if (!existing || ref.matchConfidence > existing.matchConfidence) {
        refMap.set(key, ref);
      }
    }

    target.aliases = mergedAliases;
    target.variableRefs = Array.from(refMap.values());
    this.concepts.delete(sourceId);

    return target;
  }

  // ---- Serialization -------------------------------------------------------

  toJSON(): Concept[] {
    return this.listConcepts();
  }

  fromJSON(concepts: Concept[]): void {
    this.concepts.clear();
    for (const concept of concepts) {
      this.concepts.set(concept.id, concept);
    }
  }

  clear(): void {
    this.concepts.clear();
  }
}
