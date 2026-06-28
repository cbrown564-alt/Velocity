import { autoAnnotate } from '../core/semantic/annotator';
import { buildConceptsFromAnnotations } from '../core/semantic/conceptDiscovery';
import { buildSearchIndex, listVariablesByCategory, searchVariables } from '../core/semantic/search';
import { collectTopicGuidanceWarnings } from '../core/semantic/analysisGuardrails';
import { suggestAnalyses, suggestBreaks, suggestHarmonizations } from '../core/semantic/suggestions';
import type {
  AnalysisSuggestion,
  BreakSuggestion,
  Concept,
  HarmonizationSuggestion,
  MeasurementIntent,
  SemanticAnnotation,
  SemanticSearchResult,
} from '../types/semantic';
import type { ResultEnvelope } from './types';
import { VelocityError } from './types';
import type { SemanticStateSnapshot, VelocityEngineHost } from './velocityEngineTypes';

function cloneConcept(concept: Concept): Concept {
  return {
    ...concept,
    aliases: [...concept.aliases],
    canonicalScale: concept.canonicalScale
      ? {
          ...concept.canonicalScale,
          anchors: concept.canonicalScale.anchors ? { ...concept.canonicalScale.anchors } : undefined,
        }
      : undefined,
    variableRefs: concept.variableRefs.map((ref) => ({ ...ref })),
  };
}

function cloneConcepts(concepts: Concept[]): Concept[] {
  return concepts.map((concept) => cloneConcept(concept));
}

export class SemanticFacade {
  constructor(private readonly host: VelocityEngineHost) {}

  readSemanticState(): SemanticStateSnapshot {
    const annotations: Record<string, SemanticAnnotation> = {};
    for (const [id, ann] of this.host.state.semanticAnnotations) {
      annotations[id] = { ...ann };
    }
    return { annotations, concepts: cloneConcepts(this.host.state.conceptStore.toJSON()) };
  }

  restoreSemanticState(state: SemanticStateSnapshot): void {
    const mergedAnnotations = new Map(this.host.state.semanticAnnotations);
    for (const [id, annotation] of Object.entries(state.annotations)) {
      mergedAnnotations.set(id, { ...annotation });
    }
    this.host.state.semanticAnnotations = mergedAnnotations;

    const conceptMap = new Map<string, Concept>();
    for (const concept of this.host.state.conceptStore.toJSON()) {
      conceptMap.set(concept.id, cloneConcept(concept));
    }
    for (const concept of state.concepts) {
      conceptMap.set(concept.id, cloneConcept(concept));
    }
    this.host.state.conceptStore.fromJSON([...conceptMap.values()]);

    const dataset = this.host.state.dataset;
    if (dataset) {
      dataset.variables = dataset.variables.map((v) => {
        const ann = this.host.state.semanticAnnotations.get(v.id);
        return ann ? { ...v, semantic: { ...ann } } : v;
      });
    }
  }

  async annotateDataset(): Promise<ResultEnvelope<{ annotated: number; total: number }>> {
    return this.host.wrap('annotateDataset', {}, async () => {
      const dataset = this.host.requireDataset();
      const annotations = autoAnnotate(dataset.variables, this.host.state.variableSets);
      this.host.state.semanticAnnotations = annotations;

      dataset.variables = dataset.variables.map((variable) => {
        const annotation = annotations.get(variable.id);
        return annotation ? { ...variable, semantic: annotation } : variable;
      });

      buildConceptsFromAnnotations(
        dataset.variables,
        this.host.state.variableSets,
        annotations,
        dataset.id,
        this.host.state.conceptStore,
      );

      return { annotated: annotations.size, total: dataset.variables.length };
    });
  }

  annotateVariable(
    variableId: string,
    annotation: Partial<SemanticAnnotation> & Pick<SemanticAnnotation, 'topic' | 'measurementIntent'>,
  ): void {
    const dataset = this.host.requireDataset();
    const variable = this.host.requireVariable(variableId);

    const full: SemanticAnnotation = {
      source: 'manual',
      confidence: 1.0,
      ...annotation,
    };

    this.host.state.semanticAnnotations.set(variableId, full);
    dataset.variables = dataset.variables.map((v) => (v.id === variableId ? { ...v, semantic: full } : v));
    void variable;
  }

  getAnnotation(variableId: string): ResultEnvelope<SemanticAnnotation | undefined> {
    return this.host.wrapSync('getAnnotation', { variableId }, () => {
      const annotation = this.host.state.semanticAnnotations.get(variableId);
      return annotation ? { ...annotation } : undefined;
    });
  }

  async searchVariables(
    query: string,
    options: { limit?: number } = {},
  ): Promise<ResultEnvelope<SemanticSearchResult[]>> {
    return this.host.wrap('searchVariables', { query, ...options }, async () => {
      const dataset = this.host.requireDataset();
      const concepts = this.host.state.conceptStore.listConcepts();
      const index = buildSearchIndex(dataset.variables, dataset.id, this.host.state.semanticAnnotations, concepts);
      return searchVariables(query, index, options.limit ?? 20);
    });
  }

  listConcepts(): ResultEnvelope<Concept[]> {
    return this.host.wrapSync('listConcepts', {}, () => cloneConcepts(this.host.state.conceptStore.listConcepts()));
  }

  createConcept(spec: {
    name: string;
    aliases?: string[];
    canonicalScale?: Concept['canonicalScale'];
  }): ResultEnvelope<Concept> {
    return this.host.wrapSync('createConcept', { name: spec.name }, () => {
      const concept = this.host.state.conceptStore.createConcept(spec);
      return cloneConcept(concept);
    });
  }

  linkVariableToConcept(variableId: string, conceptId: string): void {
    const dataset = this.host.requireDataset();
    this.host.requireVariable(variableId);
    const annotation = this.host.state.semanticAnnotations.get(variableId);
    this.host.state.conceptStore.linkVariable(conceptId, {
      datasetId: dataset.id,
      variableId,
      matchConfidence: annotation?.confidence ?? 1.0,
    });
  }

  async suggestAnalyses(variableIds: string[]): Promise<ResultEnvelope<AnalysisSuggestion[]>> {
    return this.host.wrap('suggestAnalyses', { variableIds }, async () => {
      const dataset = this.host.requireDataset();
      const annotatedVars = variableIds.map((id) => {
        const variable = dataset.variables.find((v) => v.id === id);
        if (!variable) throw new VelocityError('INVALID_VARIABLE', `Unknown variable: ${id}`);
        return { variable, annotation: this.host.state.semanticAnnotations.get(id) };
      });
      return suggestAnalyses(annotatedVars);
    });
  }

  suggestHarmonizations(): ResultEnvelope<HarmonizationSuggestion[]> {
    return this.host.wrapSync('suggestHarmonizations', {}, () =>
      suggestHarmonizations(this.host.state.conceptStore.listConcepts()),
    );
  }

  listVariablesByCategory(
    category: MeasurementIntent,
    options?: { includeUnannotated?: boolean; limit?: number },
  ): ResultEnvelope<SemanticSearchResult[]> {
    return this.host.wrapSync('listVariablesByCategory', { category, ...options }, () => {
      const dataset = this.host.requireDataset();
      const concepts = this.host.state.conceptStore.listConcepts();
      const index = buildSearchIndex(dataset.variables, dataset.id, this.host.state.semanticAnnotations, concepts);
      return listVariablesByCategory(index.entries, category, options);
    });
  }

  suggestBreaks(variableId: string, options?: { limit?: number }): ResultEnvelope<BreakSuggestion[]> {
    const topicVar = this.host.requireVariable(variableId);
    const warnings = collectTopicGuidanceWarnings(topicVar, this.host.state.semanticAnnotations.get(variableId));

    return this.host.wrapSync(
      'suggestBreaks',
      { variableId, ...options },
      () => {
        const dataset = this.host.requireDataset();
        const topicAnnotated = {
          variable: topicVar,
          annotation: this.host.state.semanticAnnotations.get(variableId),
        };
        const allAnnotated = dataset.variables.map((v) => ({
          variable: v,
          annotation: this.host.state.semanticAnnotations.get(v.id),
        }));
        return suggestBreaks(topicAnnotated, allAnnotated, options);
      },
      warnings,
    );
  }

  getSemanticState(): ResultEnvelope<SemanticStateSnapshot> {
    return this.host.wrapSync('getSemanticState', {}, () => this.readSemanticState());
  }
}
