import type { AnalysisSettings, Filter, TableConfig } from '../../types/analysis';
import type {
  DataTransform,
  Dataset,
  Folder,
  MissingValueDef,
  ValueLabel,
  Variable,
  VariableSet,
} from '../../types/dataset';
import type { HarmonizationSession } from '../../types/harmonization';
import type { LayoutMode, Slide, SlideCell, SlideSection } from '../../types/slides';
import type { SessionDeckRecipe, SessionWorkspaceSnapshot, VelocitySessionFile } from './sessionTypes';
import { buildSessionDeckRecipe, findStaleDeckRecipeSlideIds } from './sessionDeckRecipe';
import { validateSessionFile } from './sessionValidator';

const VALID_LAYOUT_MODES: LayoutMode[] = ['focus', 'grid', 'comparison', 'freeform'];

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function cloneValueLabels(valueLabels: ValueLabel[] = []): ValueLabel[] {
  return valueLabels.map((valueLabel) => ({
    value: valueLabel.value,
    label: valueLabel.label,
  }));
}

function cloneMissingValues(missingValues: MissingValueDef = {}): MissingValueDef {
  return {
    discrete: missingValues.discrete ? [...missingValues.discrete] : undefined,
    range: missingValues.range
      ? { low: missingValues.range.low, high: missingValues.range.high }
      : undefined,
  };
}

function cloneFilter(filter: Filter): Filter {
  return {
    ...filter,
    value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
  };
}

function cloneCell(cell: SlideCell): SlideCell {
  return {
    ...cell,
    layout: cell.layout ? { ...cell.layout } : undefined,
    content: { ...cell.content },
  };
}

function buildFallbackVariableSets(variables: Variable[]): VariableSet[] {
  return variables.map((variable) => ({
    id: `vs_${variable.id}`,
    name: variable.label || variable.name,
    variableIds: [variable.id],
    structure: 'single',
    type: variable.type,
    orderedStyle: variable.orderedStyle,
    orderedScoring: variable.orderedScoring,
  }));
}

function buildVariableToSetMap(variableSets: VariableSet[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const variableSet of variableSets) {
    for (const variableId of variableSet.variableIds) {
      if (!map.has(variableId)) {
        map.set(variableId, variableSet.id);
      }
    }
  }
  return map;
}

function resolveVariableSetReference(
  candidate: string,
  validVariableSetIds: Set<string>,
  variableToSetMap: Map<string, string>
): string | null {
  if (validVariableSetIds.has(candidate)) return candidate;
  return variableToSetMap.get(candidate) ?? null;
}

function mergeDatasetVariables(dataset: Dataset, sessionFile: VelocitySessionFile): Variable[] {
  const byId = new Map(sessionFile.variables.map((variable) => [variable.id, variable]));

  return dataset.variables.map((variable) => {
    const fromSession = byId.get(variable.id);
    if (!fromSession) return { ...variable };

    return {
      ...variable,
      name: fromSession.name ?? variable.name,
      label: fromSession.label ?? variable.label,
      type: fromSession.type ?? variable.type,
      orderedStyle: fromSession.orderedStyle,
      orderedScoring: fromSession.orderedScoring,
      valueLabels: cloneValueLabels(fromSession.valueLabels ?? variable.valueLabels),
      missingValues: cloneMissingValues(fromSession.missingValues ?? variable.missingValues),
      synthetic: fromSession.synthetic ?? variable.synthetic,
      sourceGridId: fromSession.sourceGridId ?? variable.sourceGridId,
    };
  });
}

function sanitizeSlides(
  slides: Slide[],
  validVariableSetIds: Set<string>,
  variableToSetMap: Map<string, string>,
  validVariableIds: Set<string>,
  validSectionIds: Set<string>,
  diagnostics: SessionImportDiagnostics
): Slide[] {
  const seenSlideIds = new Set<string>();
  const sanitizedSlides: Slide[] = [];

  slides.forEach((slide, index) => {
    let slideId = typeof slide.id === 'string' && slide.id.length > 0 ? slide.id : `slide-import-${index + 1}`;
    if (seenSlideIds.has(slideId)) {
      slideId = `${slideId}-${index + 1}`;
    }
    seenSlideIds.add(slideId);

    const analysisState = slide.analysisState ?? { rowVars: [], colVar: null, filters: [], weightVar: null };
    const rowVars = uniqueStrings(analysisState.rowVars ?? []).map((rowVarId) => {
      const resolved = resolveVariableSetReference(rowVarId, validVariableSetIds, variableToSetMap);
      if (!resolved) diagnostics.droppedRowVarIds.add(rowVarId);
      return resolved;
    }).filter((rowVarId): rowVarId is string => rowVarId !== null);

    let colVar = analysisState.colVar ?? null;
    if (colVar) {
      const resolved = resolveVariableSetReference(colVar, validVariableSetIds, variableToSetMap);
      if (!resolved) {
        diagnostics.droppedColVarIds.add(colVar);
        colVar = null;
      } else {
        colVar = resolved;
      }
    }

    const filters = (analysisState.filters ?? []).filter((filter) => {
      const ok = validVariableIds.has(filter.variableId);
      if (!ok) {
        diagnostics.droppedFilterIds.add(filter.id);
        diagnostics.missingVariableIds.add(filter.variableId);
      }
      return ok;
    }).map(cloneFilter);

    let weightVar = analysisState.weightVar ?? null;
    if (weightVar && !validVariableIds.has(weightVar)) {
      diagnostics.missingVariableIds.add(weightVar);
      weightVar = null;
    }

    let sectionId = slide.sectionId;
    if (sectionId && !validSectionIds.has(sectionId)) {
      diagnostics.missingSectionIds.add(sectionId);
      sectionId = undefined;
    }

    const cells = Array.isArray(slide.cells) && slide.cells.length > 0
      ? slide.cells.map(cloneCell)
      : [{ id: `${slideId}-cell-1`, content: { type: 'table' as const } }];

    const layoutMode = VALID_LAYOUT_MODES.includes(slide.layoutMode) ? slide.layoutMode : 'focus';
    const visualizationType = slide.visualizationType === 'chart' ? 'chart' : 'table';
    const now = Date.now();

    sanitizedSlides.push({
      ...slide,
      id: slideId,
      sectionId,
      visualizationType,
      layoutMode,
      cells,
      analysisState: {
        rowVars,
        colVar,
        filters,
        weightVar,
      },
      createdAt: typeof slide.createdAt === 'number' ? slide.createdAt : now + index,
      updatedAt: typeof slide.updatedAt === 'number' ? slide.updatedAt : now + index,
    });
  });

  return sanitizedSlides;
}

export interface SessionStatePatch {
  dataset: Dataset;
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: DataTransform[];
  tableConfig: TableConfig;
  activeFilters: Filter[];
  analysisSettings?: Partial<AnalysisSettings>;
  slides: Slide[];
  sections: SlideSection[];
  deckRecipe: SessionDeckRecipe;
  activeSlideId: string | null;
  harmonizationSession: HarmonizationSession | null;
}

export interface SessionImportDiagnostics {
  missingVariableIds: Set<string>;
  droppedVariableSetIds: Set<string>;
  droppedFilterIds: Set<string>;
  droppedRowVarIds: Set<string>;
  droppedColVarIds: Set<string>;
  missingSectionIds: Set<string>;
  droppedDeckRecipeSlideIds: Set<string>;
  skippedTransforms: number;
  fallbackVariableSetsGenerated: boolean;
}

export interface SessionImportDiagnosticsSummary {
  missingVariableIds: string[];
  droppedVariableSetIds: string[];
  droppedFilterIds: string[];
  droppedRowVarIds: string[];
  droppedColVarIds: string[];
  missingSectionIds: string[];
  droppedDeckRecipeSlideIds: string[];
  skippedTransforms: number;
  fallbackVariableSetsGenerated: boolean;
}

export interface SessionImportResult {
  patch: SessionStatePatch;
  workspaceSnapshot?: SessionWorkspaceSnapshot;
  diagnostics: SessionImportDiagnosticsSummary;
}

export function importSession(sessionFile: VelocitySessionFile, dataset: Dataset): SessionImportResult {
  const validation = validateSessionFile(sessionFile);
  if (!validation.valid) {
    throw new Error(`Invalid session file: ${validation.errors.join('; ')}`);
  }

  const diagnostics: SessionImportDiagnostics = {
    missingVariableIds: new Set<string>(),
    droppedVariableSetIds: new Set<string>(),
    droppedFilterIds: new Set<string>(),
    droppedRowVarIds: new Set<string>(),
    droppedColVarIds: new Set<string>(),
    missingSectionIds: new Set<string>(),
    droppedDeckRecipeSlideIds: new Set<string>(),
    skippedTransforms: 0,
    fallbackVariableSetsGenerated: false,
  };

  const mergedVariables = mergeDatasetVariables(dataset, sessionFile);
  const validVariableIds = new Set(mergedVariables.map((variable) => variable.id));

  let variableSets = sessionFile.variableSets.map((variableSet) => {
    const variableIds = uniqueStrings(variableSet.variableIds ?? []).filter((variableId) => {
      const ok = validVariableIds.has(variableId);
      if (!ok) diagnostics.missingVariableIds.add(variableId);
      return ok;
    });

    if (variableIds.length === 0) {
      diagnostics.droppedVariableSetIds.add(variableSet.id);
      return null;
    }

    return {
      ...variableSet,
      variableIds,
    };
  }).filter((variableSet): variableSet is VariableSet => variableSet !== null);

  if (variableSets.length === 0) {
    variableSets = buildFallbackVariableSets(mergedVariables);
    diagnostics.fallbackVariableSetsGenerated = true;
  }

  const validFolderIds = new Set(sessionFile.folders.map((folder) => folder.id));
  variableSets = variableSets.map((variableSet) => {
    if (!variableSet.folderId || validFolderIds.has(variableSet.folderId)) return variableSet;
    return { ...variableSet, folderId: undefined };
  });

  const validVariableSetIds = new Set(variableSets.map((variableSet) => variableSet.id));
  const variableToSetMap = buildVariableToSetMap(variableSets);
  const rowVars = uniqueStrings(sessionFile.tableConfig.rowVars ?? []).map((rowVarId) => {
    const resolved = resolveVariableSetReference(rowVarId, validVariableSetIds, variableToSetMap);
    if (!resolved) diagnostics.droppedRowVarIds.add(rowVarId);
    return resolved;
  }).filter((rowVarId): rowVarId is string => rowVarId !== null);

  let colVar = sessionFile.tableConfig.colVar ?? null;
  if (colVar) {
    const resolved = resolveVariableSetReference(colVar, validVariableSetIds, variableToSetMap);
    if (!resolved) {
      diagnostics.droppedColVarIds.add(colVar);
      colVar = null;
    } else {
      colVar = resolved;
    }
  }

  const activeFilters = (sessionFile.activeFilters ?? []).filter((filter) => {
    const ok = validVariableIds.has(filter.variableId);
    if (!ok) {
      diagnostics.droppedFilterIds.add(filter.id);
      diagnostics.missingVariableIds.add(filter.variableId);
    }
    return ok;
  }).map(cloneFilter);

  const sectionsById = new Map<string, SlideSection>();
  for (const section of sessionFile.sections ?? []) {
    if (!section?.id || sectionsById.has(section.id)) continue;
    sectionsById.set(section.id, { ...section });
  }
  const sections = [...sectionsById.values()];
  const validSectionIds = new Set(sections.map((section) => section.id));

  const slides = sanitizeSlides(
    sessionFile.slides ?? [],
    validVariableSetIds,
    variableToSetMap,
    validVariableIds,
    validSectionIds,
    diagnostics
  );
  for (const slideId of findStaleDeckRecipeSlideIds(sessionFile.deckRecipe, slides)) {
    diagnostics.droppedDeckRecipeSlideIds.add(slideId);
  }
  const deckRecipe = buildSessionDeckRecipe(slides, sections);

  const transformLog: DataTransform[] = [];
  for (const transform of sessionFile.transformLog ?? []) {
    if (transform.type === 'recode') {
      transformLog.push({ ...transform });
    } else {
      diagnostics.skippedTransforms += 1;
    }
  }

  const nextDataset: Dataset = {
    ...dataset,
    variables: mergedVariables,
  };

  const importedWeightVariable = sessionFile.weightVariable ?? null;
  if (importedWeightVariable && !validVariableIds.has(importedWeightVariable)) {
    diagnostics.missingVariableIds.add(importedWeightVariable);
    nextDataset.weightVariable = undefined;
  } else {
    nextDataset.weightVariable = importedWeightVariable ?? undefined;
  }

  const analysisSettings =
    sessionFile.analysisSettings && Object.keys(sessionFile.analysisSettings).length > 0
      ? { ...sessionFile.analysisSettings }
      : undefined;

  const patch: SessionStatePatch = {
    dataset: nextDataset,
    variableSets,
    folders: (sessionFile.folders ?? []).map((folder) => ({ ...folder })),
    transformLog,
    tableConfig: { rowVars, colVar },
    activeFilters,
    analysisSettings,
    slides,
    sections,
    deckRecipe,
    activeSlideId: slides[0]?.id ?? null,
    harmonizationSession: sessionFile.harmonizationSession ?? null,
  };

  return {
    patch,
    workspaceSnapshot: sessionFile.workspace
      ? {
        projects: sessionFile.workspace.projects.map((project) => ({ ...project })),
        datasetLinks: sessionFile.workspace.datasetLinks.map((link) => ({ ...link })),
      }
      : undefined,
    diagnostics: {
      missingVariableIds: [...diagnostics.missingVariableIds],
      droppedVariableSetIds: [...diagnostics.droppedVariableSetIds],
      droppedFilterIds: [...diagnostics.droppedFilterIds],
      droppedRowVarIds: [...diagnostics.droppedRowVarIds],
      droppedColVarIds: [...diagnostics.droppedColVarIds],
      missingSectionIds: [...diagnostics.missingSectionIds],
      droppedDeckRecipeSlideIds: [...diagnostics.droppedDeckRecipeSlideIds],
      skippedTransforms: diagnostics.skippedTransforms,
      fallbackVariableSetsGenerated: diagnostics.fallbackVariableSetsGenerated,
    },
  };
}
