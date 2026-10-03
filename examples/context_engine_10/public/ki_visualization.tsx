/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EuiAccordion,
  EuiBadge,
  EuiBasicTable,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutHeader,
  EuiIcon,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import {
  KNOWLEDGE_TYPE_ORDER,
  indicatorSourceLabel,
  toIndicatorDocument,
  typeBadgeColor,
  typeFilterLabel,
  typeLabel,
  type HydratedKnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import type { Namespace } from './namespace_data';

export type KiExplorationMode = 'grouped' | 'coverage' | 'usage' | 'graph' | 'treemap';
type GroupBy = 'type' | 'source' | 'automation';
type UsageSort = 'most' | 'least' | 'newest';

const PREVIEW_LENGTH = 240;

const relativeTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const elapsed = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(elapsed / 60000);
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return days === 1 ? '1 day ago' : `${days} days ago`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
};

const automationName = (indicator: HydratedKnowledgeIndicator) =>
  indicator.governance.provenance.created_by.metadata.automation || indicator.extractedBy;

const pluralLabel = (label: string, count: number) => {
  if (count === 1 || label === 'Index metadata') return label;
  if (label === 'FAQ') return 'FAQs';
  if (label.endsWith('y')) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
};

const compositionLine = (indicators: HydratedKnowledgeIndicator[]) => {
  const counts = new Map<KnowledgeType, number>();
  indicators.forEach((indicator) => {
    counts.set(indicator.type, (counts.get(indicator.type) ?? 0) + 1);
  });
  return KNOWLEDGE_TYPE_ORDER.filter((type) => counts.has(type))
    .map((type) => {
      const count = counts.get(type) ?? 0;
      const label = pluralLabel(typeLabel(type), count);
      return `${count} ${label}`;
    })
    .join(', ');
};

const provenanceLine = (indicator: HydratedKnowledgeIndicator) => {
  const source = indicatorSourceLabel(indicator);
  const automation = automationName(indicator);
  const updated = relativeTime(indicator.updated_at);
  const parts = [
    source ? `From ${source}` : '',
    automation ? `via ${automation}` : '',
    updated ? `updated ${updated}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
};

const hasTraces = (namespace: Namespace) =>
  (namespace.traces?.length ?? 0) > 0 || (namespace.traceCount ?? 0) > 0;

const KiCard = ({
  indicator,
  showUsage,
  tracesExist,
  onInspect,
  onOpenTraces,
}: {
  indicator: HydratedKnowledgeIndicator;
  showUsage: boolean;
  tracesExist: boolean;
  onInspect: () => void;
  onOpenTraces: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const content = indicator.content || '';
  const truncated = content.length > PREVIEW_LENGTH;
  const preview = truncated && !expanded ? `${content.slice(0, PREVIEW_LENGTH).trimEnd()}...` : content;
  const count = indicator.retrieval_count ?? 0;
  const never = count === 0;

  return (
    <EuiPanel hasBorder paddingSize="m" className="contextEnginePrototype__kiCard">
      <div className="contextEnginePrototype__kiCardTop">
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiBadge color={typeBadgeColor(indicator.type)}>{typeLabel(indicator.type)}</EuiBadge>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="s">
              <strong>{indicator.title}</strong>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiButtonIcon
          iconType="inspect"
          aria-label={`View JSON for ${indicator.title}`}
          onClick={onInspect}
          data-test-subj="contextEngineKiInspect"
        />
      </div>
      <EuiSpacer size="s" />
      <EuiText size="s">
        <p className="contextEnginePrototype__kiCardBody">{preview}</p>
      </EuiText>
      {truncated ? (
        <EuiButtonEmpty size="xs" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Show less' : 'Show more'}
        </EuiButtonEmpty>
      ) : null}
      <EuiSpacer size="s" />
      <div className="contextEnginePrototype__kiCardFooter">
        <EuiText size="xs" color="subdued">
          <p>{provenanceLine(indicator)}</p>
        </EuiText>
        {showUsage && tracesExist ? (
          <button
            type="button"
            className={`contextEnginePrototype__kiRetrieval${
              never ? ' contextEnginePrototype__kiRetrieval--never' : ''
            }`}
            onClick={onOpenTraces}
            data-test-subj="contextEngineKiRetrieval"
          >
            {never ? 'Never retrieved' : `Retrieved ${count} times`}
          </button>
        ) : null}
      </div>
    </EuiPanel>
  );
};

const JsonFlyout = ({
  indicator,
  onClose,
}: {
  indicator: HydratedKnowledgeIndicator;
  onClose: () => void;
}) => (
  <EuiFlyout ownFocus size="m" onClose={onClose} aria-labelledby="context-engine-ki-json-title">
    <EuiFlyoutHeader hasBorder>
      <EuiTitle size="s">
        <h2 id="context-engine-ki-json-title">{indicator.title}</h2>
      </EuiTitle>
    </EuiFlyoutHeader>
    <EuiFlyoutBody>
      <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable overflowHeight={480}>
        {JSON.stringify(toIndicatorDocument(indicator), null, 2)}
      </EuiCodeBlock>
    </EuiFlyoutBody>
  </EuiFlyout>
);

const TraceFlyout = ({
  indicator,
  namespace,
  onClose,
}: {
  indicator: HydratedKnowledgeIndicator;
  namespace: Namespace;
  onClose: () => void;
}) => {
  const agent = namespace.traces?.[0]?.value || 'Agent';
  const matched = namespace.tryQuestions.filter(
    (item) => item.hit && item.indicatorId === indicator.id && item.question
  );
  const extras = Math.max(0, Math.min(indicator.retrieval_count ?? 0, 4) - matched.length);
  const traces = [
    ...matched.map((item) => ({
      id: item.question,
      question: item.question,
      when: relativeTime(indicator.last_retrieved_at) || 'recently',
    })),
    ...Array.from({ length: extras }, (_, index) => ({
      id: `${indicator.id}-trace-${index}`,
      question: `Retrieved while answering a question about ${indicator.title}`,
      when: relativeTime(indicator.last_retrieved_at) || 'recently',
    })),
  ];

  return (
    <EuiFlyout ownFocus size="m" onClose={onClose} aria-labelledby="context-engine-ki-trace-title">
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id="context-engine-ki-trace-title">{indicator.title}</h2>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="xs" color="subdued">
          <p>Traces that retrieved this Knowledge Indicator</p>
        </EuiText>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        {traces.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>No traces retrieved this Knowledge Indicator.</p>
          </EuiText>
        ) : (
          <div className="contextEnginePrototype__kiTraceList">
            {traces.map((trace) => (
              <div key={trace.id} className="contextEnginePrototype__kiTraceRow">
                <EuiText size="s">
                  <p>{trace.question}</p>
                </EuiText>
                <EuiText size="xs" color="subdued">
                  <p>
                    {agent} · {trace.when}
                  </p>
                </EuiText>
              </div>
            ))}
          </div>
        )}
      </EuiFlyoutBody>
    </EuiFlyout>
  );
};

const TYPE_FILL: Record<KnowledgeType, string> = {
  fact: '#00bfb3',
  playbook: '#0077cc',
  policy: '#f5a700',
  faq: '#bd1b8e',
  glossary: '#69707d',
  workflow: '#006bb4',
  index_metadata: '#98a2b3',
};

interface GraphNode {
  id: string;
  kind: 'ki' | 'source' | 'cluster';
  label: string;
  fill: string;
  radius: number;
  x: number;
  y: number;
  indicatorId?: string;
  clusterKey?: string;
}

const kiRadius = (count: number) => Math.min(28, 10 + Math.sqrt(Math.max(count, 0)) * 4);

const layoutNodes = (nodes: GraphNode[], edges: Array<{ source: string; target: string }>) => {
  const width = 920;
  const height = 520;
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    node.x = width / 2 + Math.cos(angle) * 280;
    node.y = height / 2 + Math.sin(angle) * 180;
  });
  const velocity = nodes.map(() => ({ x: 0, y: 0 }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const labelWidth = (node: GraphNode) => Math.min(node.label.length, 22) * 6.4;
  for (let step = 0; step < 260; step += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.hypot(dx, dy) || 0.1;
        const minX = (labelWidth(a) + labelWidth(b)) / 2 + 12;
        const minY = a.radius + b.radius + 28;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        const min = a.radius + b.radius + 48;
        let push = Math.max(1400 / (dist * dist), dist < min ? (min - dist) * 0.08 : 0);
        if (overlapX > 0 && overlapY > 0) push = Math.max(push, 1.4);
        dx /= dist;
        dy /= dist;
        velocity[i].x += dx * push;
        velocity[i].y += dy * push;
        velocity[j].x -= dx * push;
        velocity[j].y -= dy * push;
      }
    }
    edges.forEach((edge) => {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) return;
      const ia = nodes.indexOf(a);
      const ib = nodes.indexOf(b);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.1;
      const pull = (dist - 170) * 0.012;
      velocity[ia].x += (dx / dist) * pull;
      velocity[ia].y += (dy / dist) * pull;
      velocity[ib].x -= (dx / dist) * pull;
      velocity[ib].y -= (dy / dist) * pull;
    });
    nodes.forEach((node, index) => {
      velocity[index].x = (velocity[index].x + (width / 2 - node.x) * 0.004) * 0.8;
      velocity[index].y = (velocity[index].y + (height / 2 - node.y) * 0.004) * 0.8;
      node.x += velocity[index].x;
      node.y += velocity[index].y;
    });
  }
  for (let step = 0; step < 48; step += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const aLeft = a.x - labelWidth(a) / 2;
        const aRight = a.x + labelWidth(a) / 2;
        const bLeft = b.x - labelWidth(b) / 2;
        const bRight = b.x + labelWidth(b) / 2;
        const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft);
        const overlapY =
          Math.min(a.y + a.radius + 18, b.y + b.radius + 18) -
          Math.max(a.y - a.radius, b.y - b.radius);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const shift = (overlapX / 2 + 6) * (a.x >= b.x ? 1 : -1);
          a.x += shift;
          b.x -= shift;
        } else {
          const shift = (overlapY / 2 + 6) * (a.y >= b.y ? 1 : -1);
          a.y += shift;
          b.y -= shift;
        }
      }
    }
  }
  return nodes;
};

const citedKiId = (uri: string, indicators: HydratedKnowledgeIndicator[]) => {
  if (!uri.startsWith('ki://')) return null;
  const id = uri.slice('ki://'.length);
  return indicators.some((indicator) => indicator.id === id) ? id : null;
};

const buildGraph = (
  indicators: HydratedKnowledgeIndicator[],
  clusterBy: 'type' | 'source',
  expanded: string | null
) => {
  const clusterKey = (indicator: HydratedKnowledgeIndicator) =>
    clusterBy === 'type' ? typeLabel(indicator.type) : indicatorSourceLabel(indicator);
  const visible =
    indicators.length > 40 && expanded
      ? indicators.filter((indicator) => clusterKey(indicator) === expanded)
      : indicators;
  const clustered = indicators.length > 40 && !expanded;
  const nodes: GraphNode[] = [];
  const edges: Array<{ source: string; target: string }> = [];
  const sourceIds = new Set<string>();
  const addSource = (name: string) => {
    const id = `source:${name}`;
    if (!sourceIds.has(id)) {
      sourceIds.add(id);
      nodes.push({ id, kind: 'source', label: name, fill: '#d3dae6', radius: 9, x: 0, y: 0 });
    }
    return id;
  };

  if (clustered) {
    const groups = new Map<string, HydratedKnowledgeIndicator[]>();
    indicators.forEach((indicator) => {
      const key = clusterKey(indicator);
      groups.set(key, [...(groups.get(key) ?? []), indicator]);
    });
    groups.forEach((items, key) => {
      const type = items[0]?.type;
      nodes.push({
        id: `cluster:${key}`,
        kind: 'cluster',
        label: `${key} · ${items.length}`,
        fill: type ? TYPE_FILL[type] : '#0077cc',
        radius: Math.min(36, 16 + Math.sqrt(items.length) * 6),
        x: 0,
        y: 0,
        clusterKey: key,
      });
      const sources = new Set(items.map((indicator) => indicatorSourceLabel(indicator)).filter(Boolean));
      sources.forEach((name) => {
        edges.push({ source: `cluster:${key}`, target: addSource(name) });
      });
    });
  } else {
    visible.forEach((indicator) => {
      nodes.push({
        id: indicator.id,
        kind: 'ki',
        label: indicator.title,
        fill: TYPE_FILL[indicator.type],
        radius: kiRadius(indicator.retrieval_count ?? 0),
        x: 0,
        y: 0,
        indicatorId: indicator.id,
      });
      const source = indicatorSourceLabel(indicator);
      if (source) edges.push({ source: indicator.id, target: addSource(source) });
      indicator.references.forEach((reference) => {
        const target = citedKiId(reference.uri, visible);
        if (target && target !== indicator.id) edges.push({ source: indicator.id, target });
      });
    });
  }

  return { nodes: layoutNodes(nodes, edges), edges, clustered };
};

const shortLabel = (label: string) => (label.length > 22 ? `${label.slice(0, 21)}...` : label);

const KiGraph = ({
  indicators,
  onInspect,
}: {
  indicators: HydratedKnowledgeIndicator[];
  onInspect: (id: string) => void;
}) => {
  const [clusterBy, setClusterBy] = useState<'type' | 'source'>('type');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState({ x: 20, y: 16, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const graph = useMemo(
    () => buildGraph(indicators, clusterBy, expanded),
    [clusterBy, expanded, indicators]
  );

  useEffect(() => {
    setExpanded(null);
    setView({ x: 20, y: 16, k: 1 });
  }, [indicators, clusterBy]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((current) => {
        const nextK = Math.min(2.6, Math.max(0.45, current.k * (event.deltaY > 0 ? 0.9 : 1.1)));
        const scale = nextK / current.k;
        return { k: nextK, x: px - (px - current.x) * scale, y: py - (py - current.y) * scale };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const fit = () => {
    const svg = svgRef.current;
    if (!svg || graph.nodes.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const minX = Math.min(...graph.nodes.map((node) => node.x - node.radius));
    const maxX = Math.max(...graph.nodes.map((node) => node.x + node.radius));
    const minY = Math.min(...graph.nodes.map((node) => node.y - node.radius));
    const maxY = Math.max(...graph.nodes.map((node) => node.y + node.radius + 16));
    const k = Math.min(rect.width / (maxX - minX + 48), rect.height / (maxY - minY + 48), 1.5);
    setView({
      k,
      x: (rect.width - (maxX + minX) * k) / 2,
      y: (rect.height - (maxY + minY) * k) / 2,
    });
  };

  return (
    <div data-test-subj="contextEngineKiGraph">
      <div className="contextEnginePrototype__kiGraphBar">
        <EuiText size="xs" color="subdued">
          <p>A test of the Sep 25 critique. A cluster of dots, not the recommended view.</p>
        </EuiText>
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          {indicators.length > 40 ? (
            <EuiFlexItem grow={false}>
              <EuiButtonGroup
                legend="Cluster by"
                type="single"
                color="text"
                buttonSize="compressed"
                options={[
                  { id: 'type', label: 'Type' },
                  { id: 'source', label: 'Source' },
                ]}
                idSelected={clusterBy}
                onChange={(id) => setClusterBy(id as 'type' | 'source')}
              />
            </EuiFlexItem>
          ) : null}
          {expanded ? (
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty size="xs" onClick={() => setExpanded(null)}>
                All clusters
              </EuiButtonEmpty>
            </EuiFlexItem>
          ) : null}
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty size="xs" onClick={fit} data-test-subj="contextEngineKiGraphFit">
              Fit to view
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
      <svg
        ref={svgRef}
        className="contextEnginePrototype__kiGraph"
        role="img"
        aria-label="Knowledge Indicator graph"
      >
        <rect
          className="contextEnginePrototype__kiGraphSurface"
          x={-2000}
          y={-2000}
          width={5000}
          height={5000}
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setView((current) => ({
              ...current,
              x: drag.current!.vx + event.clientX - drag.current!.x,
              y: drag.current!.vy + event.clientY - drag.current!.y,
            }));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {graph.edges.map((edge) => {
            const source = graph.nodes.find((node) => node.id === edge.source);
            const target = graph.nodes.find((node) => node.id === edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className="contextEnginePrototype__kiGraphEdge"
              />
            );
          })}
          {graph.nodes.map((node) => (
            <g
              key={node.id}
              className={node.kind === 'source' ? undefined : 'contextEnginePrototype__kiGraphNode'}
              onClick={(event) => {
                event.stopPropagation();
                if (node.kind === 'cluster' && node.clusterKey) setExpanded(node.clusterKey);
                if (node.kind === 'ki' && node.indicatorId) onInspect(node.indicatorId);
              }}
            >
              <circle cx={node.x} cy={node.y} r={node.radius} fill={node.fill} />
              <text x={node.x} y={node.y + node.radius + 14} textAnchor="middle">
                {shortLabel(node.label)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

const KiTreemap = ({
  indicators,
  selected,
  onSelect,
}: {
  indicators: HydratedKnowledgeIndicator[];
  selected: KnowledgeType | null;
  onSelect: (type: KnowledgeType) => void;
}) => {
  const topics = KNOWLEDGE_TYPE_ORDER.map((type) => ({
    type,
    count: indicators.filter((indicator) => indicator.type === type).length,
  })).filter((topic) => topic.count > 0);

  return (
    <div className="contextEnginePrototype__kiTreemap" data-test-subj="contextEngineKiTreemap">
      {topics.map((topic) => (
        <button
          key={topic.type}
          type="button"
          className={`contextEnginePrototype__kiTreemapCell${
            selected === topic.type ? ' contextEnginePrototype__kiTreemapCell--active' : ''
          }`}
          style={{ flex: topic.count, background: TYPE_FILL[topic.type] }}
          onClick={() => onSelect(topic.type)}
        >
          <span>{typeLabel(topic.type)}</span>
          <strong>{topic.count}</strong>
        </button>
      ))}
    </div>
  );
};

export const KiVisualization = ({
  mode,
  namespace,
  indicators,
}: {
  mode: KiExplorationMode;
  namespace: Namespace;
  indicators: HydratedKnowledgeIndicator[];
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('source');
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | 'all'>('all');
  const [cell, setCell] = useState<{ source: string; type: KnowledgeType | 'all' } | null>(null);
  const [sort, setSort] = useState<UsageSort>('most');
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [topic, setTopic] = useState<KnowledgeType | null>(null);
  const tracesExist = hasTraces(namespace);

  useEffect(() => {
    setGroupBy('source');
    setTypeFilter('all');
    setCell(null);
    setSort('most');
    setInspectId(null);
    setTraceId(null);
    setTopic(null);
  }, [namespace.name, mode]);

  const typeCounts = useMemo(() => {
    const counts = {} as Record<KnowledgeType, number>;
    indicators.forEach((indicator) => {
      counts[indicator.type] = (counts[indicator.type] ?? 0) + 1;
    });
    return counts;
  }, [indicators]);
  const presentTypes = KNOWLEDGE_TYPE_ORDER.filter((type) => (typeCounts[type] ?? 0) > 0);

  const filteredByType = indicators.filter(
    (indicator) => typeFilter === 'all' || indicator.type === typeFilter
  );

  const sourceOf = (indicator: HydratedKnowledgeIndicator) => indicatorSourceLabel(indicator);
  const automationForSource = (sourceName: string) =>
    namespace.automations.find((automation) => automation.reads.includes(sourceName));

  const groups = useMemo(() => {
    if (mode !== 'grouped') return [];
    if (groupBy === 'type') {
      return presentTypes.map((type) => {
        const visible = filteredByType.filter((indicator) => indicator.type === type);
        return {
          id: type,
          name: typeLabel(type),
          icon: 'document',
          items: visible,
          emptyLine: visible.length === 0 ? 'No Knowledge Indicators match this filter.' : '',
        };
      });
    }
    if (groupBy === 'automation') {
      const names = [
        ...namespace.automations.map((automation) => automation.title),
        ...indicators
          .map((indicator) => automationName(indicator))
          .filter((name) => !namespace.automations.some((automation) => automation.title === name)),
      ];
      const unique = names.filter((name, index) => name && names.indexOf(name) === index);
      return unique.map((name) => {
        const automation = namespace.automations.find((item) => item.title === name);
        const owned = indicators.filter((indicator) => automationName(indicator) === name);
        const visible = filteredByType.filter((indicator) => automationName(indicator) === name);
        const source = automation?.reads[0];
        return {
          id: name,
          name,
          icon: 'gear',
          items: visible,
          emptyLine:
            owned.length === 0
              ? source
                ? `No Knowledge Indicators yet. ${name} has not run against this source.`
                : 'No Knowledge Indicators yet.'
              : visible.length === 0
                ? 'No Knowledge Indicators match this filter.'
                : '',
        };
      });
    }
    const sourceNames = [
      ...namespace.sources.map((source) => source.name),
      ...indicators
        .map(sourceOf)
        .filter((name) => !namespace.sources.some((source) => source.name === name)),
    ];
    const unique = sourceNames.filter((name, index) => name && sourceNames.indexOf(name) === index);
    return unique.map((name) => {
      const owned = indicators.filter((indicator) => sourceOf(indicator) === name);
      const visible = filteredByType.filter((indicator) => sourceOf(indicator) === name);
      const automation = automationForSource(name);
      const icon = namespace.sources.find((source) => source.name === name)?.icon || 'database';
      return {
        id: name,
        name,
        icon,
        items: visible,
        emptyLine:
          owned.length === 0
            ? automation
              ? `No Knowledge Indicators yet. ${automation.title} has not run against this source.`
              : 'No Knowledge Indicators yet.'
            : visible.length === 0
              ? 'No Knowledge Indicators match this filter.'
              : '',
      };
    });
  }, [filteredByType, groupBy, indicators, mode, namespace.automations, namespace.sources, presentTypes]);

  const matrix = useMemo(() => {
    const extraSources = indicators
      .map(sourceOf)
      .filter((name, index, all) => name && all.indexOf(name) === index)
      .filter((name) => !namespace.sources.some((source) => source.name === name));
    const rowNames = [...namespace.sources.map((source) => source.name), ...extraSources];
    const rows = rowNames.map((name) => {
      const counts = {} as Record<string, number>;
      presentTypes.forEach((type) => {
        counts[type] = indicators.filter(
          (indicator) => sourceOf(indicator) === name && indicator.type === type
        ).length;
      });
      const total = presentTypes.reduce((sum, type) => sum + counts[type], 0);
      return { id: name, label: name, counts, total };
    });
    const totalCounts = {} as Record<string, number>;
    presentTypes.forEach((type) => {
      totalCounts[type] = rows.reduce((sum, row) => sum + row.counts[type], 0);
    });
    rows.push({
      id: '__total',
      label: 'Total',
      counts: totalCounts,
      total: rows.reduce((sum, row) => sum + row.total, 0),
    });
    return rows;
  }, [indicators, namespace.sources, presentTypes]);

  const emptySources = namespace.sources.filter(
    (source) => !indicators.some((indicator) => sourceOf(indicator) === source.name)
  );
  const contributing = new Set(indicators.map(sourceOf).filter(Boolean)).size;
  const coverageSentence =
    emptySources.length === 0
      ? `${indicators.length} Knowledge Indicators. Every source has contributed.`
      : `${indicators.length} Knowledge Indicators from ${contributing} sources. ${emptySources
          .map((source) => source.name)
          .join(' and ')} ${emptySources.length === 1 ? 'has' : 'have'} none yet.`;

  const coverageItems = indicators.filter((indicator) => {
    if (!cell) return true;
    const sourceMatch = cell.source === '__total' || sourceOf(indicator) === cell.source;
    const typeMatch = cell.type === 'all' || indicator.type === cell.type;
    return sourceMatch && typeMatch;
  });

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const retrievedThisWeek = indicators.reduce((sum, indicator) => {
    if (!indicator.last_retrieved_at) return sum;
    if (new Date(indicator.last_retrieved_at).getTime() < weekAgo) return sum;
    return sum + (indicator.retrieval_count ?? 0);
  }, 0);
  const neverRetrieved = indicators.filter((indicator) => (indicator.retrieval_count ?? 0) === 0).length;
  const mostRetrieved = [...indicators].sort(
    (a, b) => (b.retrieval_count ?? 0) - (a.retrieval_count ?? 0)
  )[0];
  const usageItems = [...indicators].sort((a, b) => {
    if (sort === 'newest') {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    const delta = (a.retrieval_count ?? 0) - (b.retrieval_count ?? 0);
    return sort === 'least' ? delta : -delta;
  });

  const treemapItems = indicators.filter((indicator) => !topic || indicator.type === topic);
  const visible =
    mode === 'grouped' || mode === 'graph'
      ? []
      : mode === 'coverage'
        ? coverageItems
        : mode === 'treemap'
          ? treemapItems
          : usageItems;
  const inspect = indicators.find((indicator) => indicator.id === inspectId) ?? null;
  const trace = indicators.find((indicator) => indicator.id === traceId) ?? null;

  const toggleCell = (source: string, type: KnowledgeType | 'all') => {
    setCell((current) =>
      current && current.source === source && current.type === type ? null : { source, type }
    );
  };

  const typeGroupOptions = [
    { id: 'all', label: `All (${indicators.length})` },
    ...presentTypes.map((type) => ({
      id: type,
      label: `${typeFilterLabel(type)} (${typeCounts[type]})`,
    })),
  ];

  const matrixColumns = [
    {
      field: 'label',
      name: 'Source',
      render: (label: string) => <strong>{label}</strong>,
    },
    ...presentTypes.map((type) => ({
      field: 'counts' as const,
      name: typeLabel(type),
      align: 'center' as const,
      render: (counts: Record<string, number>, row: (typeof matrix)[number]) => {
        const count = counts[type] ?? 0;
        const active = cell?.source === row.id && cell.type === type;
        const max = Math.max(1, ...matrix.flatMap((item) => presentTypes.map((key) => item.counts[key] ?? 0)));
        return (
          <button
            type="button"
            className={`contextEnginePrototype__kiHeat${
              active ? ' contextEnginePrototype__kiHeat--active' : ''
            }${count === 0 ? ' contextEnginePrototype__kiHeat--zero' : ''}`}
            style={
              count === 0
                ? undefined
                : { background: `rgba(0, 119, 204, ${0.12 + 0.55 * (count / max)})` }
            }
            onClick={() => toggleCell(row.id, type)}
            aria-label={`${row.label} ${typeLabel(type)} ${count}`}
          >
            {count === 0 ? '' : count}
          </button>
        );
      },
    })),
    {
      field: 'total',
      name: 'Total',
      align: 'center' as const,
      render: (total: number, row: (typeof matrix)[number]) => {
        const active = cell?.source === row.id && cell.type === 'all';
        return (
          <button
            type="button"
            className={`contextEnginePrototype__kiHeat contextEnginePrototype__kiHeat--total${
              active ? ' contextEnginePrototype__kiHeat--active' : ''
            }`}
            onClick={() => toggleCell(row.id, 'all')}
          >
            {total}
          </button>
        );
      },
    },
  ];

  return (
    <div data-test-subj={`contextEngineKi${mode}`}>
      {mode === 'grouped' ? (
        <>
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiText size="s">
                <strong>Group by</strong>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonGroup
                legend="Group by"
                type="single"
                color="text"
                buttonSize="compressed"
                options={[
                  { id: 'type', label: 'Type' },
                  { id: 'source', label: 'Source' },
                  { id: 'automation', label: 'Automation' },
                ]}
                idSelected={groupBy}
                onChange={(id) => setGroupBy(id as GroupBy)}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="m" />
          <EuiButtonGroup
            legend="Filter by type"
            type="single"
            color="text"
            buttonSize="compressed"
            options={typeGroupOptions}
            idSelected={typeFilter}
            onChange={(id) => setTypeFilter(id as KnowledgeType | 'all')}
          />
          <EuiSpacer size="m" />
          {groups.map((group) => (
            <EuiAccordion
              key={group.id}
              id={`ki-group-${group.id}`}
              initialIsOpen
              buttonContent={
                <span className="contextEnginePrototype__kiGroupHead">
                  <EuiIcon type={group.icon} size="m" />
                  <strong>{group.name}</strong>
                  <EuiBadge color="hollow">{group.items.length}</EuiBadge>
                  {group.items.length > 0 ? (
                    <span className="contextEnginePrototype__kiGroupSummary">
                      {compositionLine(group.items)}
                    </span>
                  ) : null}
                </span>
              }
              paddingSize="m"
            >
              {group.emptyLine ? (
                <EuiText size="s" color="subdued">
                  <p>{group.emptyLine}</p>
                </EuiText>
              ) : (
                <div className="contextEnginePrototype__kiCardList">
                  {group.items.map((indicator) => (
                    <KiCard
                      key={indicator.id}
                      indicator={indicator}
                      showUsage={false}
                      tracesExist={tracesExist}
                      onInspect={() => setInspectId(indicator.id)}
                      onOpenTraces={() => setTraceId(indicator.id)}
                    />
                  ))}
                </div>
              )}
            </EuiAccordion>
          ))}
        </>
      ) : null}

      {mode === 'coverage' ? (
        <>
          <div className="contextEnginePrototype__kiMatrix">
            <EuiBasicTable items={matrix} columns={matrixColumns} tableLayout="auto" />
          </div>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            <p data-test-subj="contextEngineKiCoverageSentence">{coverageSentence}</p>
          </EuiText>
          <EuiSpacer size="m" />
        </>
      ) : null}

      {mode === 'usage' ? (
        <>
          <div className="contextEnginePrototype__kiUsageStats">
            <div>
              <EuiText size="xs" color="subdued">
                <p>Retrieved in the last 7 days</p>
              </EuiText>
              <EuiText size="m">
                <strong>{tracesExist ? String(retrievedThisWeek) : 'No data'}</strong>
              </EuiText>
            </div>
            <div>
              <EuiText size="xs" color="subdued">
                <p>Never retrieved</p>
              </EuiText>
              <EuiText size="m">
                <strong>{tracesExist ? String(neverRetrieved) : 'No data'}</strong>
              </EuiText>
            </div>
            <div>
              <EuiText size="xs" color="subdued">
                <p>Most retrieved</p>
              </EuiText>
              <EuiText size="m">
                <strong>
                  {tracesExist && mostRetrieved && (mostRetrieved.retrieval_count ?? 0) > 0
                    ? mostRetrieved.title
                    : 'No data'}
                </strong>
              </EuiText>
            </div>
          </div>
          {!tracesExist ? (
            <>
              <EuiSpacer size="s" />
              <EuiText size="s" color="subdued">
                <p>Usage appears once agents retrieve from this index.</p>
              </EuiText>
            </>
          ) : (
            <>
              <EuiSpacer size="m" />
              <EuiButtonGroup
                legend="Sort Knowledge Indicators"
                type="single"
                color="text"
                buttonSize="compressed"
                options={[
                  { id: 'most', label: 'Most retrieved' },
                  { id: 'least', label: 'Least retrieved' },
                  { id: 'newest', label: 'Newest' },
                ]}
                idSelected={sort}
                onChange={(id) => setSort(id as UsageSort)}
              />
            </>
          )}
          <EuiSpacer size="m" />
        </>
      ) : null}

      {mode === 'graph' ? <KiGraph indicators={indicators} onInspect={setInspectId} /> : null}

      {mode === 'treemap' ? (
        <>
          <KiTreemap
            indicators={indicators}
            selected={topic}
            onSelect={(type) => setTopic((current) => (current === type ? null : type))}
          />
          <EuiSpacer size="m" />
        </>
      ) : null}

      {mode !== 'grouped' && mode !== 'graph' ? (
        <div className="contextEnginePrototype__kiCardList">
          {visible.length === 0 ? (
            <EuiText size="s" color="subdued">
              <p>No Knowledge Indicators match this filter.</p>
            </EuiText>
          ) : (
            visible.map((indicator) => (
              <KiCard
                key={indicator.id}
                indicator={indicator}
                showUsage={mode === 'usage'}
                tracesExist={tracesExist}
                onInspect={() => setInspectId(indicator.id)}
                onOpenTraces={() => setTraceId(indicator.id)}
              />
            ))
          )}
        </div>
      ) : null}

      {inspect ? <JsonFlyout indicator={inspect} onClose={() => setInspectId(null)} /> : null}
      {trace ? (
        <TraceFlyout indicator={trace} namespace={namespace} onClose={() => setTraceId(null)} />
      ) : null}
    </div>
  );
};
