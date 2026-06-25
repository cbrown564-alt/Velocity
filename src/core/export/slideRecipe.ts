import type { Variable, VariableSet } from '../../types';
import type { ChartType } from '../../types/charts';
import type { Slide, SlideAnalysisState } from '../../types/slides';
import { resolveAnalysisVariables } from './resolveAnalysisVariables';

export type SlideRecipeIssueCode =
  | 'no_row_vars'
  | 'unresolved_row_var'
  | 'unresolved_col_var'
  | 'unresolved_weight_var'
  | 'unresolved_filter_var';

export type SlideRecipeIssueSeverity = 'block' | 'warn';

export interface SlideRecipeIssue {
  slideId: string;
  slideTitle: string;
  code: SlideRecipeIssueCode;
  referenceId?: string;
  severity: SlideRecipeIssueSeverity;
  message: string;
}

/** Persisted analysis recipe for one slide (PILOT-3 contract). */
export interface SlideRecipe {
  slideId: string;
  title: string;
  subtitle: string;
  notes?: string;
  analysisState: SlideAnalysisState;
  visualizationType: 'table' | 'chart';
  chartType?: ChartType;
  sectionId?: string;
}

export interface DatasetReplacementAssessment {
  ready: boolean;
  totalSlides: number;
  blockedSlides: number;
  issues: SlideRecipeIssue[];
  missingReferenceIds: string[];
}

export interface ExportReview {
  canExport: boolean;
  slideCount: number;
  blockedSlideCount: number;
  warningCount: number;
  issues: SlideRecipeIssue[];
}

interface RecipeAssessmentInput {
  slides: Slide[];
  variableSets: VariableSet[];
  variables: Variable[];
}

function isResolvableReference(
  referenceId: string,
  variableSets: VariableSet[],
  variables: Variable[]
): boolean {
  const variableSet = variableSets.find((set) => set.id === referenceId);
  if (variableSet) {
    return variableSet.variableIds.some((variableId) =>
      variables.some((variable) => variable.id === variableId)
    );
  }

  return variables.some((variable) => variable.id === referenceId);
}

function assessSlideRecipe(
  slide: Slide,
  variableSets: VariableSet[],
  variables: Variable[]
): SlideRecipeIssue[] {
  const issues: SlideRecipeIssue[] = [];
  const slideTitle = slide.title?.trim() || 'Untitled Slide';
  const analysisState = slide.analysisState ?? {
    rowVars: [],
    colVar: null,
    filters: [],
    weightVar: null,
  };

  if (analysisState.rowVars.length === 0) {
    issues.push({
      slideId: slide.id,
      slideTitle,
      code: 'no_row_vars',
      severity: 'block',
      message: `${slideTitle}: add at least one row variable before export.`,
    });
    return issues;
  }

  for (const rowVarId of analysisState.rowVars) {
    if (!isResolvableReference(rowVarId, variableSets, variables)) {
      issues.push({
        slideId: slide.id,
        slideTitle,
        code: 'unresolved_row_var',
        referenceId: rowVarId,
        severity: 'block',
        message: `${slideTitle}: row variable "${rowVarId}" is missing from the dataset.`,
      });
    }
  }

  const { rowVariables, colVariable } = resolveAnalysisVariables(
    analysisState,
    variableSets,
    variables
  );

  if (rowVariables.length === 0) {
    issues.push({
      slideId: slide.id,
      slideTitle,
      code: 'unresolved_row_var',
      severity: 'block',
      message: `${slideTitle}: row variables could not be resolved for export.`,
    });
  }

  if (analysisState.colVar && !colVariable) {
    issues.push({
      slideId: slide.id,
      slideTitle,
      code: 'unresolved_col_var',
      referenceId: analysisState.colVar,
      severity: 'block',
      message: `${slideTitle}: column variable "${analysisState.colVar}" is missing from the dataset.`,
    });
  }

  if (analysisState.weightVar && !variables.some((variable) => variable.id === analysisState.weightVar)) {
    issues.push({
      slideId: slide.id,
      slideTitle,
      code: 'unresolved_weight_var',
      referenceId: analysisState.weightVar,
      severity: 'warn',
      message: `${slideTitle}: weight variable "${analysisState.weightVar}" is missing; export will use the dataset default.`,
    });
  }

  for (const filter of analysisState.filters ?? []) {
    if (!variables.some((variable) => variable.id === filter.variableId)) {
      issues.push({
        slideId: slide.id,
        slideTitle,
        code: 'unresolved_filter_var',
        referenceId: filter.variableId,
        severity: 'warn',
        message: `${slideTitle}: filter on "${filter.variableId}" will be ignored because it is missing from the dataset.`,
      });
    }
  }

  return issues;
}

function summarizeAssessment(
  slides: Slide[],
  issues: SlideRecipeIssue[]
): Pick<DatasetReplacementAssessment, 'ready' | 'blockedSlides' | 'missingReferenceIds'> {
  const blockedSlideIds = new Set(
    issues.filter((issue) => issue.severity === 'block').map((issue) => issue.slideId)
  );
  const missingReferenceIds = [
    ...new Set(
      issues
        .filter((issue) => issue.severity === 'block' && issue.referenceId)
        .map((issue) => issue.referenceId as string)
    ),
  ];

  return {
    ready: blockedSlideIds.size === 0,
    blockedSlides: blockedSlideIds.size,
    missingReferenceIds,
  };
}

export function slideToRecipe(slide: Slide): SlideRecipe {
  return {
    slideId: slide.id,
    title: slide.title,
    subtitle: slide.subtitle,
    notes: slide.notes,
    analysisState: slide.analysisState,
    visualizationType: slide.visualizationType,
    chartType: slide.chartType,
    sectionId: slide.sectionId,
  };
}

export function slidesToRecipes(slides: Slide[]): SlideRecipe[] {
  return slides.map(slideToRecipe);
}

export function assessDatasetReplacement(
  slides: Slide[],
  variableSets: VariableSet[],
  variables: Variable[]
): DatasetReplacementAssessment {
  const issues = slides.flatMap((slide) => assessSlideRecipe(slide, variableSets, variables));
  const summary = summarizeAssessment(slides, issues);

  return {
    totalSlides: slides.length,
    issues,
    ...summary,
  };
}

export function buildExportReview(
  input: RecipeAssessmentInput & { slideIds: string[] }
): ExportReview {
  const selectedSlides = input.slideIds
    .map((slideId) => input.slides.find((slide) => slide.id === slideId))
    .filter((slide): slide is Slide => slide !== undefined);

  const issues = selectedSlides.flatMap((slide) =>
    assessSlideRecipe(slide, input.variableSets, input.variables)
  );
  const summary = summarizeAssessment(selectedSlides, issues);
  const warningCount = issues.filter((issue) => issue.severity === 'warn').length;

  return {
    canExport: summary.ready && selectedSlides.length > 0,
    slideCount: selectedSlides.length,
    blockedSlideCount: summary.blockedSlides,
    warningCount,
    issues,
  };
}
