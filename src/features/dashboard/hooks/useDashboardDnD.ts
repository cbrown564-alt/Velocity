import React, { useCallback, useState } from 'react';
import {
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { useVelocityStore, type VariableSet } from '../../../store';
import { allowsNumericStats } from '../../../types';
import { applyCanvasPlacement, placeVariableSet } from '../../../core/grid/gridUtils';

export function useDashboardDnD() {
  const {
    dataset,
    tableConfig,
    setTableConfig,
    setDraggingId,
    reorderRowVars,
    setWeightVariable,
    setSelectedVariableSetId,
    openRecodeModal,
  } = useVelocityStore();

  const [activeDragSet, setActiveDragSet] = useState<VariableSet | null>(null);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [variableContextMenu, setVariableContextMenu] = useState<{
    set: VariableSet;
    x: number;
    y: number;
  } | null>(null);
  const [weightEnabled, setWeightEnabled] = useState(true);
  const [rememberedWeightVar, setRememberedWeightVar] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const customCollisionDetection = (args: Parameters<typeof closestCenter>[0]) => {
    const { active } = args;
    const activeData = active?.data?.current;
    const isDraggingFromSidebar = activeData?.variableSet && !activeData?.type?.includes('sortable');
    const isReordering = activeData?.type === 'sortable-row';

    if (isReordering) {
      const sortableCollisions = closestCenter(args);
      if (sortableCollisions.length > 0) {
        const firstCollision = sortableCollisions[0];
        if (tableConfig.rowVars.includes(firstCollision.id as string)) {
          return sortableCollisions;
        }
      }
    }

    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) {
      const dropZoneCollision = rectCollisions.find(c =>
        c.id === 'drop-zone-rows' || c.id === 'drop-zone-cols' || c.id === 'drop-zone-weight' || c.id === 'canvas'
      );
      if (dropZoneCollision && isDraggingFromSidebar) {
        return [dropZoneCollision];
      }
      return rectCollisions;
    }

    return pointerWithin(args);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const set = event.active.data.current?.variableSet;
    if (set) {
      setActiveDragSet(set);
      setDraggingId(set.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveDragSet(null);
    setDraggingId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (tableConfig.rowVars.includes(activeId) && tableConfig.rowVars.includes(overId)) {
      const oldIndex = tableConfig.rowVars.indexOf(activeId);
      const newIndex = tableConfig.rowVars.indexOf(overId);
      if (oldIndex !== newIndex) {
        reorderRowVars(arrayMove(tableConfig.rowVars, oldIndex, newIndex));
      }
      return;
    }

    if (active.data.current?.variableSet) {
      const zoneId = over.id;
      const variableSet = active.data.current.variableSet;
      const setId = variableSet.id;

      if (zoneId === 'drop-zone-weight') {
        if (variableSet.structure !== 'grid') {
          const variable = dataset?.variables.find(v => v.id === variableSet.variableIds[0]);
          if (variable && allowsNumericStats(variable.type, variable.orderedScoring)) {
            const varId = variableSet.variableIds[0];
            setWeightVariable(varId);
            setRememberedWeightVar(varId);
            setWeightEnabled(true);
          }
        }
        return;
      }

      if (
        zoneId === 'drop-zone-rows' ||
        zoneId === 'drop-zone-cols' ||
        zoneId === 'canvas'
      ) {
        const placement = placeVariableSet(
          setId,
          variableSet.structure,
          zoneId,
          tableConfig,
        );
        if (placement) {
          setTableConfig(placement);
        }
      }
    }
  };

  const handleVariableClick = useCallback((set: VariableSet, e: React.MouseEvent) => {
    setSelectedVariableSetId(set.id);

    if (e.metaKey || e.ctrlKey) {
      const newSelected = new Set(selectedSetIds);
      if (newSelected.has(set.id)) newSelected.delete(set.id);
      else newSelected.add(set.id);
      setSelectedSetIds(newSelected);
      return;
    }

    setTableConfig(applyCanvasPlacement(set.id, set.structure, tableConfig));
  }, [selectedSetIds, setSelectedVariableSetId, setTableConfig, tableConfig]);

  const handleContextMenu = useCallback((set: VariableSet, e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedSetIds.has(set.id)) {
      setSelectedSetIds(new Set([set.id]));
    }
    setVariableContextMenu({ set, x: e.clientX, y: e.clientY });
  }, [selectedSetIds]);

  const handleRecodeClick = useCallback((set: VariableSet) => {
    const variable = dataset?.variables.find(v => v.id === set.variableIds[0]);
    if (variable) openRecodeModal(variable);
  }, [dataset?.variables, openRecodeModal]);

  const handleToggleWeight = useCallback(() => {
    if (weightEnabled && dataset?.weightVariable) {
      setRememberedWeightVar(dataset.weightVariable);
      setWeightVariable(null);
      setWeightEnabled(false);
    } else if (!weightEnabled && rememberedWeightVar) {
      setWeightVariable(rememberedWeightVar);
      setWeightEnabled(true);
    }
  }, [weightEnabled, dataset?.weightVariable, rememberedWeightVar, setWeightVariable]);

  const handleWeightRemove = useCallback(() => {
    setWeightVariable(null);
    setRememberedWeightVar(null);
    setWeightEnabled(true);
  }, [setWeightVariable]);

  return {
    sensors,
    customCollisionDetection,
    activeDragSet,
    selectedSetIds,
    variableContextMenu,
    setVariableContextMenu,
    weightEnabled,
    rememberedWeightVar,
    handleDragStart,
    handleDragEnd,
    handleVariableClick,
    handleContextMenu,
    handleRecodeClick,
    handleToggleWeight,
    handleWeightRemove,
  };
}
