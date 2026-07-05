import { processAnalysisData } from '../analysis/analysisProcessor';
import type { Dataset, Filter, Variable, VariableSet } from '../../types';
import type { SlideAnalysisState } from '../../types/slides';
import type { DeckRecipe } from '../deck/deckRecipe';
import type { SlideRecipe } from './slideRecipe';
import { resolveAnalysisVariables } from './resolveAnalysisVariables';
import { resolveSlideTitle, resolveSlideSubtitle } from './resolveSlideDefaults';
import { runCrosstabForExport } from './runCrosstabForExport';
import type { CrosstabEnginePort } from './crosstabEnginePort';
import {
  mergeDisplayOptions,
  type MaterializedDeck,
  type MaterializedSlide,
  type MaterializedSlideDisplayOptions,
} from './materializedDeck';

interface AnalysisSignificanceSettings {
  comparisonMethod: 'cell_vs_rest' | 'pairwise';
  correctionType: 'none' | 'bonferroni' | 'fdr';
  significanceLevel: 0.95 | 0.9 | 0.8;
}

export interface MaterializeDeckRecipeInput {
  recipe: DeckRecipe;
  engine: CrosstabEnginePort;
  dataset: Dataset;
  variableSets: VariableSet[];
  analysisSettings?: AnalysisSignificanceSettings;
  displayOptions?: Partial<MaterializedSlideDisplayOptions>;
  resolveTitle?: (slideRecipe: SlideRecipe, rowVariables: Variable[], colVariable: Variable | null) => string;
}

function resolveLabeledReference(referenceId: string, variableSets: VariableSet[], variables: Variable[]) {
  const variableSet = variableSets.find((set) => set.id === referenceId);
  if (variableSet) return { id: variableSet.id, name: variableSet.name, label: variableSet.name };
  const variable = variables.find((candidate) => candidate.id === referenceId);
  if (variable) return { id: variable.id, name: variable.name, label: variable.label || variable.name };
  return { id: referenceId, name: referenceId, label: referenceId };
}

function defaultResolveTitle(
  slideRecipe: SlideRecipe,
  analysisState: SlideAnalysisState,
  variableSets: VariableSet[],
  variables: Variable[],
) {
  const trimmedTitle = slideRecipe.title?.trim();
  if (trimmedTitle && trimmedTitle !== 'New Slide') return trimmedTitle;
  return resolveSlideTitle(
    analysisState.rowVars.map((rowVarId) => resolveLabeledReference(rowVarId, variableSets, variables)),
    analysisState.colVar ? resolveLabeledReference(analysisState.colVar, variableSets, variables) : null,
  );
}

export async function materializeDeckRecipe(input: MaterializeDeckRecipeInput): Promise<MaterializedDeck> {
  const displayOptions = mergeDisplayOptions(input.displayOptions);
  const slides: MaterializedSlide[] = [];
  for (const slideRecipe of input.recipe.slideRecipes) {
    const analysisState = slideRecipe.analysisState;
    if (analysisState.rowVars.length === 0) continue;
    const weightVar = analysisState.weightVar ?? input.dataset.weightVariable ?? null;
    const { rowVariables, colVariable, firstRowVarSet } = resolveAnalysisVariables(
      analysisState,
      input.variableSets,
      input.dataset.variables,
    );
    if (rowVariables.length === 0) continue;
    const crosstab = await runCrosstabForExport({
      engine: input.engine,
      dataset: input.dataset,
      variableSets: input.variableSets,
      rowVars: analysisState.rowVars,
      colVar: analysisState.colVar,
      filters: analysisState.filters,
      weightVar,
      analysisSettings: input.analysisSettings,
    });
    const processed = processAnalysisData({
      data: crosstab.data,
      rowVariables,
      colVariable,
      isWeighted: !!weightVar,
      isMultipleResponse: firstRowVarSet?.structure === 'multiple',
    });
    if (!processed) continue;
    const weightVariable = weightVar ? input.dataset.variables.find((variable) => variable.id === weightVar) : null;
    slides.push({
      slideId: slideRecipe.slideId,
      label:
        input.resolveTitle?.(slideRecipe, rowVariables, colVariable) ??
        defaultResolveTitle(slideRecipe, analysisState, input.variableSets, input.dataset.variables),
      subtitle:
        slideRecipe.subtitle?.trim() ||
        resolveSlideSubtitle(
          analysisState.filters as Filter[],
          weightVariable ?? null,
          input.dataset.rowCount,
          !!weightVar,
        ),
      notes: slideRecipe.notes,
      sectionId: slideRecipe.sectionId,
      result: processed,
      visualizationType: slideRecipe.visualizationType,
      chartType: slideRecipe.chartType,
      options: displayOptions,
    });
  }
  return {
    title: input.recipe.title?.trim() || 'Analysis Report',
    subtitle: input.recipe.subtitle,
    sections: input.recipe.sections,
    slides,
    branding: input.recipe.branding,
  };
}
