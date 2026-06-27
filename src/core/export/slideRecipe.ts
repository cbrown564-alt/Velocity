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
  status: 'ready' | 'warning' | 'blocked';
  canExport: boolean;
  slideCount: number;
  blockedSlideCount: number;
  warningCount: number;
  issues: SlideRecipeIssue[];
}

export interface DatasetReplacementSlideReview {
  slideId: string;
  slideTitle: string;
  status: 'ready' | 'warning' | 'blocked';
  blockers: SlideRecipeIssue[];
  warnings: SlideRecipeIssue[];
}

export interface DatasetReplacementReview {
  status: 'ready' | 'warning' | 'blocked';
  canReplace: boolean;
  slideCount: number;
  blockedSlideCount: number;
  warningCount: number;
  slideReviews: DatasetReplacementSlideReview[];
  issues: SlideRecipeIssue[];
  missingReferenceIds: string[];
}

interface RecipeAssessmentInput {
  slides: Slide[];
  variableSets: VariableSet[];
  variables: Variable[];
  analysisStateOverrides?: Record<string, SlideAnalysisState>;
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

function hardenIssuesForExport(issues: SlideRecipeIssue[]): SlideRecipeIssue[] {
  return issues.map((issue) => {
    if (issue.code !== 'unresolved_filter_var' && issue.code !== 'unresolved_weight_var') {
      return issue;
    }

    return {
      ...issue,
      severity: 'block',
      message: issue.message.replace('will be ignored', 'must be resolved').replace(
        'export will use the dataset default',
        'resolve it before export'
      ),
    };
  });
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

export function buildDatasetReplacementReview(
  input: RecipeAssessmentInput & { slideIds?: string[] }
): DatasetReplacementReview {
  const scopedSlides = input.slideIds
    ? input.slideIds
      .map((slideId) => input.slides.find((slide) => slide.id === slideId))
      .filter((slide): slide is Slide => slide !== undefined)
    : input.slides;
  const normalizedSlides = scopedSlides.map((slide) => {
    const overrideState = input.analysisStateOverrides?.[slide.id];
    if (!overrideState) {
      return slide;
    }
    return {
      ...slide,
      analysisState: overrideState,
    };
  });

  const slideReviews = normalizedSlides.map((slide): DatasetReplacementSlideReview => {
    const issues = assessSlideRecipe(slide, input.variableSets, input.variables);
    const blockers = issues.filter((issue) => issue.severity === 'block');
    const warnings = issues.filter((issue) => issue.severity === 'warn');
    const status: DatasetReplacementSlideReview['status'] = blockers.length > 0
      ? 'blocked'
      : warnings.length > 0
        ? 'warning'
        : 'ready';

    return {
      slideId: slide.id,
      slideTitle: slide.title?.trim() || 'Untitled Slide',
      status,
      blockers,
      warnings,
    };
  });

  const issues = slideReviews.flatMap((review) => [...review.blockers, ...review.warnings]);
  const blockedSlideCount = slideReviews.filter((review) => review.status === 'blocked').length;
  const warningCount = slideReviews.reduce((total, review) => total + review.warnings.length, 0);
  const missingReferenceIds = [
    ...new Set(
      issues
        .filter((issue) => issue.referenceId)
        .map((issue) => issue.referenceId as string)
    ),
  ];
  const status: DatasetReplacementReview['status'] = blockedSlideCount > 0
    ? 'blocked'
    : warningCount > 0
      ? 'warning'
      : 'ready';

  return {
    status,
    canReplace: status !== 'blocked',
    slideCount: normalizedSlides.length,
    blockedSlideCount,
    warningCount,
    slideReviews,
    issues,
    missingReferenceIds,
  };
}

export function buildExportReview(
  input: RecipeAssessmentInput & { slideIds: string[] }
): ExportReview {
  const selectedSlides = input.slideIds
    .map((slideId) => input.slides.find((slide) => slide.id === slideId))
    .filter((slide): slide is Slide => slide !== undefined);
  const normalizedSlides = selectedSlides.map((slide) => {
    const overrideState = input.analysisStateOverrides?.[slide.id];
    if (!overrideState) {
      return slide;
    }
    return {
      ...slide,
      analysisState: overrideState,
    };
  });

  const issues = hardenIssuesForExport(
    normalizedSlides.flatMap((slide) =>
      assessSlideRecipe(slide, input.variableSets, input.variables)
    )
  );
  const summary = summarizeAssessment(normalizedSlides, issues);
  const warningCount = issues.filter((issue) => issue.severity === 'warn').length;
  const canExport = summary.ready && normalizedSlides.length > 0;
  const status: ExportReview['status'] = !canExport
    ? 'blocked'
    : warningCount > 0
      ? 'warning'
      : 'ready';

  return {
    status,
    canExport,
    slideCount: normalizedSlides.length,
    blockedSlideCount: summary.blockedSlides,
    warningCount,
    issues,
  };
}
