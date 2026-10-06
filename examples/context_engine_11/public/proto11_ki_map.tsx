/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiBreadcrumbs,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiSpacer,
  EuiText,
  useEuiTheme,
} from '@elastic/eui';

import {
  typeLabel,
  type HydratedKnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import type { Namespace } from './namespace_data';
import {
  KI_VIZ_TYPES,
  KiNodeShape,
  KNOWLEDGE_BLUE,
  kiTypeShape,
  knowledgeBlueForCount,
  rampInk,
} from './proto11_ki_colors';
import { indicatorSourceGroup, sampleScenarioOf } from './proto11_data';
import { Proto11Coverage, Proto11Flow, type KiModeSource } from './proto11_ki_modes';
import { indicatorRetrievals } from './proto11_usage';

/** A node graph is readable up to this many Knowledge Indicators. */
export const GRAPH_KI_LIMIT = 200;

const SOURCE_X = 118;
const SOURCE_R = 18;
const KI_LEFT = 250;
const KI_GAP = 26;
const BASE_R = 8;
const MAX_R = 16;

type MapMode = 'coverage' | 'graph' | 'flow' | 'treemap';

/** Coverage, graph, flow or treemap, remembered per index for this session. */
const modeByIndex = new Map<string, MapMode>();

const GRAPH_LIMIT_TIP =
  'Graph is available for up to 200 Knowledge Indicators. Pick a source in Coverage to see it as a graph.';

interface Drill {
  source?: string;
  type?: KnowledgeType;
}

interface SourceModel {
  name: string;
  icon: string;
  kind: string;
  kis: HydratedKnowledgeIndicator[];
  gap: boolean;
}

interface GraphNode {
  id: string;
  kind: 'source' | 'ki';
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  r: number;
  sourceName: string;
  ki?: HydratedKnowledgeIndicator;
  icon?: string;
  gap?: boolean;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: 'derived' | 'related';
}

interface Tip {
  x: number;
  y: number;
  title: string;
  lines: string[];
}

interface Weighted {
  key: string;
  value: number;
  area: number;
}

interface Box {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

const relatedIdsOf = (indicator: HydratedKnowledgeIndicator) =>
  indicator.references.flatMap((reference) =>
    reference.relation === 'relates_to' && reference.uri.startsWith('ki://')
      ? [reference.uri.slice('ki://'.length)]
      : []
  );

const sourceIconFor = (kind: string) => {
  if (kind === 'Agent traces') return 'apmTrace';
  if (kind === 'Connector') return 'documents';
  return 'database';
};

const countLabel = (count: number, one: string, many: string) =>
  `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;

const worst = (row: Weighted[], side: number) => {
  const sum = row.reduce((total, item) => total + item.area, 0);
  let max = 0;
  let min = Infinity;
  row.forEach((item) => {
    if (item.area > max) max = item.area;
    if (item.area < min) min = item.area;
  });
  const sumSquared = sum * sum;
  const sideSquared = side * side;
  return Math.max((sideSquared * max) / sumSquared, sumSquared / (sideSquared * min));
};

/** Squarified treemap. Area tracks `value`. */
const squarify = (
  items: Array<{ key: string; value: number }>,
  x: number,
  y: number,
  w: number,
  h: number
): Box[] => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0 || w <= 1 || h <= 1) return [];
  const area = w * h;
  let remaining: Weighted[] = items.map((item) => ({
    key: item.key,
    value: item.value,
    area: (item.value / total) * area,
  }));
  const boxes: Box[] = [];
  let rx = x;
  let ry = y;
  let rw = w;
  let rh = h;
  while (remaining.length > 0) {
    const vertical = rw < rh;
    const side = vertical ? rh : rw;
    const row = [remaining[0]];
    let index = 1;
    while (
      index < remaining.length &&
      worst(row, side) >= worst([...row, remaining[index]], side)
    ) {
      row.push(remaining[index]);
      index += 1;
    }
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    const breadth = rowArea / side;
    let offset = 0;
    row.forEach((item) => {
      const length = item.area / breadth;
      boxes.push(
        vertical
          ? { key: item.key, x: rx, y: ry + offset, w: breadth, h: length }
          : { key: item.key, x: rx + offset, y: ry, w: length, h: breadth }
      );
      offset += length;
    });
    if (vertical) {
      rx += breadth;
      rw -= breadth;
    } else {
      ry += breadth;
      rh -= breadth;
    }
    remaining = remaining.slice(row.length);
  }
  return boxes;
};

const kiRadius = (id: string, retrievals: Map<string, number> | null) => {
  if (!retrievals) return BASE_R;
  const count = retrievals.get(id);
  if (count === undefined) return BASE_R;
  let max = 0;
  retrievals.forEach((value) => {
    if (value > max) max = value;
  });
  if (max <= 0) return BASE_R;
  return BASE_R + (MAX_R - BASE_R) * Math.sqrt(count / max);
};

const layoutGraph = (
  sources: SourceModel[],
  width: number,
  retrievals: Map<string, number> | null
): { nodes: GraphNode[]; edges: GraphEdge[]; height: number } => {
  const maxCols = Math.max(1, Math.floor((width - KI_LEFT - 24) / KI_GAP));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const visibleIds = new Set(sources.flatMap((source) => source.kis.map((ki) => ki.id)));
  const relatedPairs = new Set<string>();
  let cursor = 36;

  sources.forEach((source) => {
    const cols = Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt(source.kis.length || 1))));
    const rows = Math.max(1, Math.ceil((source.kis.length || 1) / cols));
    const block = Math.max(source.gap ? 96 : 76, rows * KI_GAP + 20);
    const sourceY = cursor + block / 2;
    const sourceId = `source:${source.name}`;
    nodes.push({
      id: sourceId,
      kind: 'source',
      x: SOURCE_X,
      y: sourceY,
      homeX: SOURCE_X,
      homeY: sourceY,
      r: SOURCE_R,
      sourceName: source.name,
      icon: source.icon,
      gap: source.gap,
    });
    source.kis.forEach((ki, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = KI_LEFT + col * KI_GAP + KI_GAP / 2;
      const y = cursor + 20 + row * KI_GAP + KI_GAP / 2;
      nodes.push({
        id: ki.id,
        kind: 'ki',
        x,
        y,
        homeX: x,
        homeY: y,
        r: kiRadius(ki.id, retrievals),
        sourceName: source.name,
        ki,
      });
      edges.push({
        id: `derived:${source.name}:${ki.id}`,
        from: sourceId,
        to: ki.id,
        kind: 'derived',
      });
      relatedIdsOf(ki).forEach((relatedId) => {
        if (!visibleIds.has(relatedId)) return;
        const pair = [ki.id, relatedId].sort().join('|');
        if (relatedPairs.has(pair)) return;
        relatedPairs.add(pair);
        edges.push({
          id: `related:${pair}`,
          from: ki.id,
          to: relatedId,
          kind: 'related',
        });
      });
    });
    cursor += block;
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (let step = 0; step < 24; step += 1) {
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left];
        const b = nodes[right];
        if (a.kind === 'source' && b.kind === 'source') continue;
        const dx = a.x - b.x || 0.01;
        const dy = a.y - b.y || 0.01;
        const dist = Math.hypot(dx, dy);
        const min = a.r + b.r + 8;
        if (dist >= min) continue;
        const push = (min - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        if (a.kind === 'ki') {
          a.x += ux * push;
          a.y += uy * push;
        }
        if (b.kind === 'ki') {
          b.x -= ux * push;
          b.y -= uy * push;
        }
      }
    }
    nodes.forEach((node) => {
      if (node.kind === 'source') {
        node.x = node.homeX;
        node.y = node.homeY;
        return;
      }
      node.x += (node.homeX - node.x) * 0.55;
      node.y += (node.homeY - node.y) * 0.65;
      node.x = Math.max(KI_LEFT, Math.min(width - 20, node.x));
      node.y = Math.max(16, node.y);
    });
  }

  // Drop related edges whose ends were filtered out of this layout.
  const laid = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: edges.filter((edge) => laid.has(edge.from) && laid.has(edge.to) && byId.has(edge.from)),
    height: Math.max(480, cursor + 8),
  };
};

/** Lineage map for one AI index: coverage, graph, flow and treemap. */
export const Proto11KiMap = ({
  namespace,
  indicators,
  allIndicators,
  selectedId,
  onSelect,
  onClear,
  onFilterList,
  onModeGroup,
}: {
  namespace: Namespace;
  /** Knowledge Indicators drawn on the map. The list type filter does not apply here. */
  indicators: HydratedKnowledgeIndicator[];
  /** Every Knowledge Indicator on the index, used to tell a real gap from a filter. */
  allIndicators: HydratedKnowledgeIndicator[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  /** Coverage cell, treemap tile, or Flow type: filter the List and leave the map. */
  onFilterList?: (filter: { source: string | null; type: KnowledgeType | 'all' }) => void;
  /** Mode group for the shared toolbar, left of List | Map. */
  onModeGroup?: (group: React.ReactNode) => void;
}) => {
  const { euiTheme, colorMode } = useEuiTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [modeChoice, setModeChoice] = useState<MapMode>(
    () => modeByIndex.get(namespace.name) ?? 'coverage'
  );
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ active: false, x: 0, y: 0, ox: 0, oy: 0, moved: false });

  const retrievals = useMemo(() => indicatorRetrievals(namespace), [namespace]);

  const rememberMode = useCallback(
    (next: MapMode) => {
      modeByIndex.set(namespace.name, next);
      setModeChoice(next);
    },
    [namespace.name]
  );

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const update = () => setWidth(Math.max(640, Math.floor(element.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDrill(null);
    setModeChoice(modeByIndex.get(namespace.name) ?? 'coverage');
    setPan({ x: 0, y: 0 });
  }, [namespace.name]);

  const baseSources = useMemo(() => {
    const known = new Set(
      allIndicators.map(
        (indicator) =>
          indicatorSourceGroup(indicator, namespace.sources, namespace.proto11?.agent).name
      )
    );
    const order: SourceModel[] = namespace.sources.map((source) => ({
      name: source.name,
      icon: source.icon || 'database',
      kind: source.typeLabel || 'Index',
      kis: [],
      gap: !known.has(source.name),
    }));
    const byName = new Map(order.map((source) => [source.name, source]));
    indicators.forEach((indicator) => {
      const group = indicatorSourceGroup(indicator, namespace.sources, namespace.proto11?.agent);
      let source = byName.get(group.name);
      if (!source) {
        source = {
          name: group.name,
          icon: sourceIconFor(group.kind),
          kind: group.kind,
          kis: [],
          gap: false,
        };
        byName.set(group.name, source);
        order.push(source);
      }
      source.kis.push(indicator);
    });
    return order;
  }, [allIndicators, indicators, namespace]);

  const sources = useMemo(() => {
    const narrowed = baseSources.map((source) => ({
      ...source,
      kis: source.kis.filter((indicator) => {
        if (drill?.source && drill.source !== source.name) return false;
        if (drill?.type && indicator.type !== drill.type) return false;
        return true;
      }),
    }));
    return drill?.source ? narrowed.filter((source) => source.name === drill.source) : narrowed;
  }, [baseSources, drill]);

  const sliceCount = sources.reduce((sum, source) => sum + source.kis.length, 0);
  const graphDisabled = sliceCount > GRAPH_KI_LIMIT;
  const flowDisabled = allIndicators.length > GRAPH_KI_LIMIT;
  const mode: MapMode =
    (modeChoice === 'graph' && graphDisabled) || (modeChoice === 'flow' && flowDisabled)
      ? 'coverage'
      : modeChoice;

  useLayoutEffect(() => {
    onModeGroup?.(
      <EuiButtonGroup
        legend="Map layout"
        type="single"
        color="text"
        buttonSize="compressed"
        options={[
          { id: 'coverage', label: 'Coverage', 'data-test-subj': 'proto11KiMapCoverage' },
          {
            id: 'graph',
            label: 'Graph',
            isDisabled: graphDisabled,
            toolTipContent: graphDisabled ? GRAPH_LIMIT_TIP : undefined,
            'data-test-subj': 'proto11KiMapGraph',
          },
          {
            id: 'flow',
            label: 'Flow',
            isDisabled: flowDisabled,
            toolTipContent: flowDisabled ? GRAPH_LIMIT_TIP : undefined,
            'data-test-subj': 'proto11KiMapFlow',
          },
          { id: 'treemap', label: 'Treemap', 'data-test-subj': 'proto11KiMapTreemap' },
        ]}
        idSelected={mode}
        onChange={(id) => {
          const next = id as MapMode;
          if (next === 'graph' && graphDisabled) return;
          if (next === 'flow' && flowDisabled) return;
          rememberMode(next);
        }}
      />
    );
    return () => onModeGroup?.(null);
  }, [flowDisabled, graphDisabled, mode, onModeGroup, rememberMode]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [drill, mode]);

  const layout = useMemo(
    () => (mode === 'graph' ? layoutGraph(sources, width, retrievals) : null),
    [mode, retrievals, sources, width]
  );

  const presentShapes = KI_VIZ_TYPES.filter((type) =>
    sources.some((source) => source.kis.some((indicator) => indicator.type === type))
  );

  const focus = useMemo(() => {
    if (!layout) return null;
    if (hoveredSource) {
      const ids = new Set<string>([`source:${hoveredSource}`]);
      layout.nodes.forEach((node) => {
        if (node.kind === 'ki' && node.sourceName === hoveredSource) ids.add(node.id);
      });
      return ids;
    }
    if (!selectedId) return null;
    const selected = layout.nodes.find((node) => node.id === selectedId);
    if (!selected) return null;
    const ids = new Set<string>([selectedId, `source:${selected.sourceName}`]);
    layout.edges.forEach((edge) => {
      if (edge.kind !== 'related') return;
      if (edge.from === selectedId) ids.add(edge.to);
      if (edge.to === selectedId) ids.add(edge.from);
    });
    return ids;
  }, [hoveredSource, layout, selectedId]);

  const showTip = (event: React.MouseEvent, title: string, lines: string[]) => {
    setTip({ x: event.clientX + 12, y: event.clientY + 14, title, lines });
  };

  const fit = () => {
    setPan({ x: 0, y: 0 });
    wrapRef.current?.scrollTo({ top: 0, left: 0 });
  };

  const onBackgroundPointerDown = (event: React.PointerEvent<SVGRectElement>) => {
    panRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      ox: pan.x,
      oy: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onBackgroundPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const state = panRef.current;
    if (!state.active) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.hypot(dx, dy) > 4) state.moved = true;
    setPan({ x: state.ox + dx, y: state.oy + dy });
  };

  const onBackgroundPointerUp = () => {
    if (panRef.current.active && !panRef.current.moved) onClear();
    panRef.current.active = false;
  };

  const fillFor = (count: number) =>
    knowledgeBlueForCount(count, colorMode) ?? euiTheme.colors.lightestShade;

  const gaps = sources.filter((source) => source.gap);
  const TREEMAP_MAX_HEIGHT = 160;
  const treemapHeight = gaps.length > 0 ? TREEMAP_MAX_HEIGHT - 48 : TREEMAP_MAX_HEIGHT;
  const canvasHeight =
    mode === 'graph' ? layout?.height ?? 520 : mode === 'treemap' ? TREEMAP_MAX_HEIGHT : 520;

  const crumbs = drill
    ? [
        { text: 'All', onClick: () => setDrill(null) },
        ...(drill.source
          ? [
              drill.type
                ? { text: drill.source, onClick: () => setDrill({ source: drill.source }) }
                : { text: drill.source },
            ]
          : []),
        ...(drill.type ? [{ text: typeLabel(drill.type) }] : []),
      ]
    : [];

  const nodeById = new Map((layout?.nodes ?? []).map((node) => [node.id, node]));
  const coverageSources = baseSources.filter((source) => source.kind !== 'Agent traces');
  const traceSource = baseSources.find((source) => source.kind === 'Agent traces');
  const showTraces = Boolean(traceSource) || sampleScenarioOf(namespace) === 'web-ops';
  const tracesRow: KiModeSource | null = showTraces
    ? traceSource ?? {
        name: 'Agent traces',
        icon: 'apmTrace',
        kind: 'Agent traces',
        kis: [],
        gap: true,
      }
    : null;
  const flowSources = coverageSources;

  return (
    <div data-test-subj="proto11KiMap">
      <EuiSpacer size="m" />
      <EuiFlexGroup justifyContent="flexEnd" alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued" textAlign="right">
            <p data-test-subj="proto11KiMapCount">
              {countLabel(allIndicators.length, 'Knowledge Indicator', 'Knowledge Indicators')},{' '}
              {countLabel(namespace.sources.length, 'source', 'sources')},{' '}
              {countLabel(
                namespace.proto11?.connectedAgents?.length ?? 0,
                'connected agent',
                'connected agents'
              )}
            </p>
          </EuiText>
        </EuiFlexItem>
        {namespace.proto11?.sample ? (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">Sample</EuiBadge>
          </EuiFlexItem>
        ) : null}
      </EuiFlexGroup>
      {crumbs.length > 0 ? (
        <>
          <EuiSpacer size="s" />
          <EuiBreadcrumbs
            aria-label="Map drill"
            data-test-subj="proto11KiMapCrumb"
            breadcrumbs={crumbs}
            responsive={false}
            truncate={false}
          />
        </>
      ) : null}
      <div
        ref={wrapRef}
        css={css`
          position: relative;
          margin-top: 12px;
          max-height: 640px;
          overflow: auto;
          border: 1px solid ${euiTheme.colors.borderBaseSubdued};
          border-radius: 6px;
          background: ${euiTheme.colors.emptyShade};
        `}
      >
        {mode === 'coverage' || mode === 'flow' ? (
          <div
            css={css`
              padding: 16px;
            `}
          >
            {mode === 'coverage' ? (
              <Proto11Coverage
                sources={coverageSources}
                tracesRow={tracesRow}
                onlyType={
                  drill?.type && isKiVizType(drill.type) && !drill.source ? drill.type : undefined
                }
                onCell={(source, type) => onFilterList?.({ source, type })}
              />
            ) : (
              <Proto11Flow
                sources={flowSources}
                agents={(namespace.proto11?.connectedAgents ?? []).map((agent) => agent.name)}
                retrievals={retrievals}
                onType={(type) => onFilterList?.({ source: null, type })}
              />
            )}
          </div>
        ) : null}
        {mode === 'graph' ? (
          <EuiButtonEmpty
            size="xs"
            onClick={fit}
            data-test-subj="proto11KiMapFit"
            css={css`
              position: absolute;
              top: 8px;
              right: 8px;
              z-index: 2;
            `}
          >
            Fit
          </EuiButtonEmpty>
        ) : null}
        {mode === 'graph' || mode === 'treemap' ? (
          <svg
            width={width}
            height={canvasHeight}
            role="group"
            aria-label="Knowledge Indicator map"
            data-test-subj="proto11KiMapCanvas"
          >
            {mode === 'graph' && layout ? (
              <>
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={canvasHeight}
                  fill="transparent"
                  data-canvas="true"
                  onPointerDown={onBackgroundPointerDown}
                  onPointerMove={onBackgroundPointerMove}
                  onPointerUp={onBackgroundPointerUp}
                />
                <g transform={`translate(${pan.x} ${pan.y})`}>
                  {layout.edges.map((edge) => {
                    const from = nodeById.get(edge.from);
                    const to = nodeById.get(edge.to);
                    if (!from || !to) return null;
                    const dim = focus !== null && (!focus.has(edge.from) || !focus.has(edge.to));
                    return (
                      <line
                        key={edge.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={euiTheme.colors.lightShade}
                        strokeWidth={1}
                        strokeDasharray={edge.kind === 'related' ? '4 3' : undefined}
                        opacity={dim ? 0.12 : edge.kind === 'related' ? 0.75 : 0.85}
                      />
                    );
                  })}
                  {layout.nodes.map((node) => {
                    const dim = focus !== null && !focus.has(node.id);
                    if (node.kind === 'source') {
                      return (
                        <g
                          key={node.id}
                          data-test-subj="proto11KiMapSource"
                          data-source-name={node.sourceName}
                          opacity={dim ? 0.2 : 1}
                          onMouseEnter={(event) => {
                            setHoveredSource(node.sourceName);
                            showTip(event, node.sourceName, [
                              node.gap
                                ? 'No Knowledge Indicators yet'
                                : countLabel(
                                    sources.find((source) => source.name === node.sourceName)?.kis
                                      .length ?? 0,
                                    'Knowledge Indicator',
                                    'Knowledge Indicators'
                                  ),
                            ]);
                          }}
                          onMouseMove={(event) =>
                            showTip(event, node.sourceName, [
                              node.gap
                                ? 'No Knowledge Indicators yet'
                                : countLabel(
                                    sources.find((source) => source.name === node.sourceName)?.kis
                                      .length ?? 0,
                                    'Knowledge Indicator',
                                    'Knowledge Indicators'
                                  ),
                            ])
                          }
                          onMouseLeave={() => {
                            setHoveredSource(null);
                            setTip(null);
                          }}
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.r}
                            fill={node.gap ? 'transparent' : euiTheme.colors.lightestShade}
                            stroke={
                              node.gap ? euiTheme.colors.warning : euiTheme.colors.borderBaseSubdued
                            }
                            strokeWidth={node.gap ? 1.5 : 1}
                            strokeDasharray={node.gap ? '4 3' : undefined}
                          />
                          <foreignObject x={node.x - 8} y={node.y - 8} width={16} height={16}>
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <EuiIcon
                                type={node.icon || 'database'}
                                size="s"
                                color="text"
                                aria-hidden={true}
                              />
                            </div>
                          </foreignObject>
                          <text
                            x={node.x}
                            y={node.y + node.r + 14}
                            textAnchor="middle"
                            fontSize={11}
                            fill={euiTheme.colors.text}
                          >
                            {truncate(node.sourceName, 28)}
                          </text>
                          {node.gap ? (
                            <text
                              x={node.x}
                              y={node.y + node.r + 28}
                              textAnchor="middle"
                              fontSize={11}
                              fill={euiTheme.colors.subduedText}
                              data-test-subj="proto11KiMapGap"
                            >
                              No Knowledge Indicators yet
                            </text>
                          ) : null}
                        </g>
                      );
                    }
                    const indicator = node.ki;
                    if (!indicator) return null;
                    const selected = indicator.id === selectedId;
                    return (
                      <g
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        aria-label={indicator.title}
                        data-test-subj="proto11KiMapNode"
                        data-ki-id={indicator.id}
                        data-ki-shape={kiTypeShape(indicator.type)}
                        opacity={dim ? 0.15 : 1}
                        style={{ cursor: 'pointer' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(indicator.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(indicator.id);
                          }
                        }}
                        onMouseEnter={(event) =>
                          showTip(event, indicator.title, [
                            typeLabel(indicator.type),
                            node.sourceName,
                          ])
                        }
                        onMouseMove={(event) =>
                          showTip(event, indicator.title, [
                            typeLabel(indicator.type),
                            node.sourceName,
                          ])
                        }
                        onMouseLeave={() => setTip(null)}
                      >
                        <KiNodeShape
                          type={indicator.type}
                          cx={node.x}
                          cy={node.y}
                          r={node.r}
                          fill={KNOWLEDGE_BLUE}
                          stroke={selected ? euiTheme.colors.emptyShade : 'transparent'}
                          strokeWidth={selected ? 2 : 0}
                        />
                      </g>
                    );
                  })}
                </g>
              </>
            ) : (
              <Treemap
                sources={sources}
                width={width}
                height={treemapHeight}
                drill={drill}
                colorMode={colorMode}
                fillFor={fillFor}
                border={euiTheme.colors.emptyShade}
                text={euiTheme.colors.text}
                subdued={euiTheme.colors.subduedText}
                gapStroke={euiTheme.colors.warning}
                onDrillType={(name, type) => onFilterList?.({ source: name, type })}
                onTip={showTip}
                onTipEnd={() => setTip(null)}
              />
            )}
          </svg>
        ) : null}
      </div>
      {mode === 'graph' || mode === 'treemap' ? (
        <div data-test-subj="proto11KiMapLegend">
          <EuiSpacer size="s" />
          <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false} wrap>
            {presentShapes.map((type) => (
              <EuiFlexItem grow={false} key={type}>
                <EuiFlexGroup
                  gutterSize="xs"
                  alignItems="center"
                  responsive={false}
                  data-test-subj="proto11KiShapeLegend"
                  data-ki-shape={kiTypeShape(type)}
                >
                  <EuiFlexItem grow={false}>
                    <svg width={14} height={14} aria-hidden={true}>
                      <KiNodeShape type={type} cx={7} cy={7} r={5} fill={KNOWLEDGE_BLUE} />
                    </svg>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs">
                      <span>{typeLabel(type)}</span>
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
            ))}
            {mode === 'graph' ? (
              <>
                <EuiFlexItem grow={false}>
                  <LegendLine
                    label="Derived from a source"
                    dashed={false}
                    color={euiTheme.colors.lightShade}
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <LegendLine
                    label="Related Knowledge Indicator"
                    dashed
                    color={euiTheme.colors.lightShade}
                  />
                </EuiFlexItem>
              </>
            ) : null}
            {retrievals !== null && mode === 'graph' ? (
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  <span>Size: retrievals in the selected period</span>
                </EuiText>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
        </div>
      ) : null}
      {tip ? (
        <div
          css={css`
            position: fixed;
            left: ${Math.min(tip.x, window.innerWidth - 260)}px;
            top: ${tip.y}px;
            z-index: 5;
            max-width: 240px;
            padding: 8px 10px;
            pointer-events: none;
            background: ${euiTheme.colors.emptyShade};
            border: 1px solid ${euiTheme.colors.borderBaseSubdued};
            border-radius: 6px;
          `}
        >
          <EuiText size="xs">
            <strong>{tip.title}</strong>
            {tip.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </EuiText>
        </div>
      ) : null}
    </div>
  );
};

const LegendLine = ({
  label,
  dashed,
  color,
}: {
  label: string;
  dashed: boolean;
  color: string;
}) => (
  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
    <EuiFlexItem grow={false}>
      <svg width="28" height="10" aria-hidden={true}>
        <line
          x1={0}
          y1={5}
          x2={28}
          y2={5}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
    </EuiFlexItem>
    <EuiFlexItem grow={false}>
      <EuiText size="xs">
        <span>{label}</span>
      </EuiText>
    </EuiFlexItem>
  </EuiFlexGroup>
);

const Treemap = ({
  sources,
  width,
  height,
  drill,
  colorMode,
  fillFor,
  border,
  text,
  subdued,
  gapStroke,
  onDrillType,
  onTip,
  onTipEnd,
}: {
  sources: SourceModel[];
  width: number;
  height: number;
  drill: Drill | null;
  colorMode: 'LIGHT' | 'DARK';
  fillFor: (count: number) => string;
  border: string;
  text: string;
  subdued: string;
  gapStroke: string;
  onDrillType: (name: string, type: KnowledgeType) => void;
  onTip: (event: React.MouseEvent, title: string, lines: string[]) => void;
  onTipEnd: () => void;
}) => {
  const gaps = sources.filter((source) => source.gap);
  const counted = sources.filter((source) => source.kis.length > 0);
  const sourceBoxes = squarify(
    counted.map((source) => ({ key: source.name, value: source.kis.length })),
    4,
    4,
    width - 8,
    height - 8
  );
  const typeDrill =
    Boolean(drill) && !drill?.type && counted.some((source) => source.kis.length > GRAPH_KI_LIMIT);

  return (
    <g>
      {sourceBoxes.map((box) => {
        const source = counted.find((item) => item.name === box.key);
        if (!source) return null;
        const byType = new Map<KnowledgeType, HydratedKnowledgeIndicator[]>();
        source.kis.forEach((indicator) => {
          const list = byType.get(indicator.type) ?? [];
          list.push(indicator);
          byType.set(indicator.type, list);
        });
        const typeBoxes = squarify(
          Array.from(byType.entries()).map(([type, list]) => ({ key: type, value: list.length })),
          box.x + 3,
          box.y + 3,
          Math.max(1, box.w - 6),
          Math.max(1, box.h - 6)
        );
        return (
          <g key={source.name} data-test-subj="proto11KiMapTile" data-source-name={source.name}>
            {typeBoxes.map((typeBox) => {
              const type = typeBox.key as KnowledgeType;
              const list = byType.get(type) ?? [];
              const showLabel = typeBox.w > 72 && typeBox.h > 28;
              const ink = rampInk(list.length, colorMode, text);
              const subInk = ink === '#FFFFFF' ? 'rgba(255,255,255,0.78)' : subdued;
              const mark = typeBox.w > 28 && typeBox.h > 22;
              const textX = typeBox.x + (mark ? 22 : 8);
              return (
                <g key={`${source.name}-${type}`} data-ki-shape={kiTypeShape(type)}>
                  <rect
                    x={typeBox.x}
                    y={typeBox.y}
                    width={Math.max(0, typeBox.w)}
                    height={Math.max(0, typeBox.h)}
                    fill={fillFor(list.length)}
                    stroke={border}
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onDrillType(source.name, type)}
                    onMouseEnter={(event) =>
                      onTip(event, source.name, [
                        `${typeLabel(type)}: ${countLabel(
                          list.length,
                          'Knowledge Indicator',
                          'Knowledge Indicators'
                        )}`,
                      ])
                    }
                    onMouseMove={(event) =>
                      onTip(event, source.name, [
                        `${typeLabel(type)}: ${countLabel(
                          list.length,
                          'Knowledge Indicator',
                          'Knowledge Indicators'
                        )}`,
                      ])
                    }
                    onMouseLeave={onTipEnd}
                  />
                  {mark ? (
                    <KiNodeShape
                      type={type}
                      cx={typeBox.x + 12}
                      cy={typeBox.y + 14}
                      r={5}
                      fill={ink}
                    />
                  ) : null}
                  {showLabel ? (
                    <text x={textX} y={typeBox.y + 16} fontSize={12} fill={ink}>
                      {truncate(
                        typeDrill ? typeLabel(type) : source.name,
                        Math.floor(typeBox.w / 7)
                      )}
                    </text>
                  ) : null}
                  {showLabel && typeBox.h > 36 ? (
                    <text x={textX} y={typeBox.y + 32} fontSize={11} fill={subInk}>
                      {typeDrill
                        ? countLabel(list.length, 'Knowledge Indicator', 'Knowledge Indicators')
                        : typeLabel(type)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
      {gaps.map((source, index) => {
        const band = (width - 8) / gaps.length;
        const x = 4 + index * band;
        const y = height + 8;
        return (
          <g key={source.name} data-test-subj="proto11KiMapGap">
            <rect
              x={x}
              y={y}
              width={Math.max(0, band - 6)}
              height={40}
              fill="transparent"
              stroke={gapStroke}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text x={x + 8} y={y + 18} fontSize={11} fill={text}>
              {truncate(source.name, 32)}
            </text>
            <text x={x + 8} y={y + 32} fontSize={11} fill={subdued}>
              No Knowledge Indicators yet
            </text>
          </g>
        );
      })}
    </g>
  );
};
