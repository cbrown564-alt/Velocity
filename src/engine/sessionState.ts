import { exportSession as exportSessionFile, importSession as importSessionFile } from '../core/session';
import type { VelocitySessionFile } from '../core/session';
import type { Filter } from '../types';
import type { Slide, SlideSection } from '../types/slides';
import type {
  BuiltDeck,
  ClearFiltersResult,
  CommitDeckResult,
  FilterMutationResult,
  RemoveFilterResult,
  ResultEnvelope,
  WeightMutationResult,
} from './types';
import { VelocityError } from './types';
import type { SemanticStateSnapshot, VelocityEngineHost } from './velocityEngineTypes';

export function cloneFilter(filter: Filter): Filter {
  return {
    ...filter,
    value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
  };
}

export class SessionState {
  constructor(
    private readonly host: VelocityEngineHost,
    private readonly readSemanticState: () => SemanticStateSnapshot,
    private readonly restoreSemanticState: (state: SemanticStateSnapshot) => void,
  ) {}

  resetSessionState(): void {
    const { state } = this.host;
    state.folders = [];
    state.transformLog = [];
    state.tableConfig = { rowVars: [], colVar: null };
    state.activeFilters = [];
    state.analysisSettings = undefined;
    state.slides = [];
    state.sections = [];
    state.harmonizationSession = null;
    state.semanticAnnotations = new Map();
    state.conceptStore.clear();
  }

  getSession(): ResultEnvelope<VelocitySessionFile> {
    return this.host.wrapSync('getSession', {}, () => this.buildSessionFile());
  }

  buildSessionFile(): VelocitySessionFile {
    const dataset = this.host.requireDataset();
    const { state } = this.host;
    return exportSessionFile({
      dataset,
      variableSets: state.variableSets,
      folders: state.folders,
      transformLog: state.transformLog,
      tableConfig: state.tableConfig,
      activeFilters: state.activeFilters,
      analysisSettings: state.analysisSettings,
      slides: state.slides,
      sections: state.sections,
      harmonizationSession: state.harmonizationSession,
      semantic: this.readSemanticState(),
      velocityVersion: this.host.engineVersion,
    });
  }

  setWeight(variableId: string | null): ResultEnvelope<WeightMutationResult> {
    return this.host.wrapSync('setWeight', { variableId }, () => {
      if (variableId !== null) {
        this.host.requireVariable(variableId);
      }
      const dataset = this.host.requireDataset();
      dataset.weightVariable = variableId ?? undefined;
      return { variableId };
    });
  }

  addFilter(filter: Filter): ResultEnvelope<FilterMutationResult> {
    return this.host.wrapSync('addFilter', { filterId: filter.id, variableId: filter.variableId }, () => {
      this.host.requireVariable(filter.variableId);
      const cloned = cloneFilter(filter);
      this.host.state.activeFilters = [...this.host.state.activeFilters, cloned];
      return { filter: cloned };
    });
  }

  removeFilter(filterId: string): ResultEnvelope<RemoveFilterResult> {
    return this.host.wrapSync('removeFilter', { filterId }, () => {
      const before = this.host.state.activeFilters.length;
      this.host.state.activeFilters = this.host.state.activeFilters.filter((filter) => filter.id !== filterId);
      return { filterId, removed: this.host.state.activeFilters.length < before };
    });
  }

  clearFilters(): ResultEnvelope<ClearFiltersResult> {
    return this.host.wrapSync('clearFilters', {}, () => {
      const clearedCount = this.host.state.activeFilters.length;
      this.host.state.activeFilters = [];
      return { clearedCount };
    });
  }

  getActiveFilters(): ResultEnvelope<Filter[]> {
    return this.host.wrapSync('getActiveFilters', {}, () => this.host.state.activeFilters.map(cloneFilter));
  }

  async exportSession(): Promise<ResultEnvelope<VelocitySessionFile>> {
    return this.host.wrap('exportSession', {}, async () => this.buildSessionFile());
  }

  commitDeck(deck: BuiltDeck): ResultEnvelope<CommitDeckResult> {
    return this.host.wrapSync(
      'commitDeck',
      { slideCount: deck.slides.length, sectionCount: deck.spec.sections.length },
      () => {
        const now = Date.now();
        const sectionMap = new Map<string, string>();

        const newSections: SlideSection[] = deck.spec.sections.map((sec, i) => {
          const id = `deck-section-${i}-${now}`;
          sectionMap.set(sec.title, id);
          return { id, title: sec.title };
        });

        const newSlides: Slide[] = deck.slides.map((builtSlide, i) => ({
          id: `deck-slide-${i}-${now}`,
          title: builtSlide.resolvedTitle,
          subtitle: builtSlide.resolvedSubtitle,
          notes: builtSlide.spec.notes,
          analysisState: {
            rowVars: builtSlide.spec.rowVars,
            colVar: builtSlide.spec.colVar ?? null,
            filters: builtSlide.spec.filters ?? [],
            weightVar: builtSlide.spec.weightVar ?? null,
          },
          visualizationType: builtSlide.spec.visualizationType ?? 'table',
          chartType: builtSlide.resolvedChartType,
          layoutMode: 'focus' as const,
          cells: [],
          sectionId: sectionMap.get(builtSlide.sectionTitle),
          createdAt: now,
          updatedAt: now,
        }));

        this.host.state.slides = [...this.host.state.slides, ...newSlides];
        this.host.state.sections = [...this.host.state.sections, ...newSections];

        return {
          committedSlides: deck.slides.length,
          committedSections: deck.spec.sections.length,
        };
      },
    );
  }

  async importSession(
    session: VelocitySessionFile,
  ): Promise<ResultEnvelope<ReturnType<typeof importSessionFile>['diagnostics']>> {
    return this.host.wrap('importSession', { formatVersion: session.formatVersion }, async () => {
      const dataset = this.host.requireDataset();

      try {
        const result = importSessionFile(session, dataset);
        const { state } = this.host;
        state.dataset = result.patch.dataset;
        state.variableSets = result.patch.variableSets;
        state.folders = result.patch.folders;
        state.transformLog = result.patch.transformLog;
        state.tableConfig = result.patch.tableConfig;
        state.activeFilters = result.patch.activeFilters;
        state.analysisSettings = result.patch.analysisSettings;
        state.slides = result.patch.slides;
        state.sections = result.patch.sections;
        state.harmonizationSession = result.patch.harmonizationSession;
        this.restoreSemanticState(session.semantic ?? { annotations: {}, concepts: [] });
        return result.diagnostics;
      } catch (error) {
        if (error instanceof VelocityError) throw error;
        throw new VelocityError('SESSION_INVALID', 'Failed to import session.', error);
      }
    });
  }
}
