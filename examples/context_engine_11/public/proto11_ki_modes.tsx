/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import { css } from '@emotion/react';
import { EuiIcon, EuiText, shade, tint, transparentize, useEuiTheme } from '@elastic/eui';

import type { KnowledgeType } from './knowledge_indicators';
import { KI_VIZ_TYPES, kiTypeShort, kiVizColor, type KiVizType } from './proto11_ki_colors';

export interface KiModeSource {
  name: string;
  icon: string;
  kind: string;
  gap: boolean;
  kis: Array<{ id: string; type: KnowledgeType }>;
}

const countOf = (source: KiModeSource, type: KiVizType) =>
  source.kis.filter((indicator) => indicator.type === type).length;

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}...` : value;

/** Source by type matrix. Empty cells are the gaps an automation could fill. */
export const Proto11Coverage = ({
  sources,
  tracesRow,
  onlyType,
  onCell,
}: {
  sources: KiModeSource[];
  tracesRow: KiModeSource | null;
  onlyType?: KiVizType;
  onCell: (source: string, type: KiVizType) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const columns = onlyType ? [onlyType] : [...KI_VIZ_TYPES];
  const rows = tracesRow ? [...sources, tracesRow] : sources;
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  return (
    <div data-test-subj="proto11KiCoverage">
      <div
        css={css`
          display: grid;
          grid-template-columns: minmax(220px, 280px) repeat(${columns.length}, minmax(72px, 1fr));
          gap: 6px;
          align-items: stretch;
        `}
      >
        <span />
        {columns.map((type) => (
          <EuiText key={type} size="xs" textAlign="center">
            <span
              css={css`
                color: ${kiVizColor(type, euiTheme)};
              `}
            >
              {kiTypeShort(type)}
            </span>
          </EuiText>
        ))}
        {rows.map((source) => {
          const counts = columns.map((type) => countOf(source, type));
          const empty = counts.every((count) => count === 0);
          const muted = source.kind === 'Agent traces';
          return (
            <React.Fragment key={source.name}>
              <EuiText size="xs">
                <span
                  css={css`
                    color: ${muted ? euiTheme.colors.subduedText : euiTheme.colors.text};
                  `}
                >
                  {source.name}
                  {empty ? (
                    <span
                      css={css`
                        display: block;
                        color: ${euiTheme.colors.subduedText};
                      `}
                    >
                      No Knowledge Indicators yet
                    </span>
                  ) : null}
                </span>
              </EuiText>
              {columns.map((type, index) => {
                const count = counts[index];
                const color = kiVizColor(type, euiTheme);
                const gapCell = empty && index === 0;
                return (
                  <button
                    key={type}
                    type="button"
                    data-test-subj="proto11KiCoverageCell"
                    data-source-name={source.name}
                    data-ki-type={type}
                    aria-label={`${count} ${kiTypeShort(type)} from ${source.name}`}
                    onClick={() => onCell(source.name, type)}
                    onMouseEnter={(event) =>
                      setTip({
                        x: event.clientX + 12,
                        y: event.clientY + 14,
                        text: `${count} ${kiTypeShort(type)} from ${source.name}`,
                      })
                    }
                    onMouseLeave={() => setTip(null)}
                    css={css`
                      min-height: 36px;
                      border: ${gapCell
                        ? `1px dashed ${euiTheme.colors.borderBaseWarning}`
                        : '1px solid transparent'};
                      border-radius: 4px;
                      background: ${count > 0 ? tint(color, 0.72) : euiTheme.colors.lightestShade};
                      color: ${gapCell ? euiTheme.colors.textWarning : shade(color, 0.45)};
                      font-weight: 600;
                      cursor: pointer;
                    `}
                  >
                    {count > 0 || gapCell ? count : ''}
                  </button>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <EuiText size="xs" color="subdued">
        <p>Empty cells are where an automation could add knowledge.</p>
      </EuiText>
      {tip ? (
        <div
          css={css`
            position: fixed;
            left: ${Math.min(tip.x, window.innerWidth - 280)}px;
            top: ${tip.y}px;
            z-index: 5;
            max-width: 260px;
            padding: 6px 8px;
            pointer-events: none;
            background: ${euiTheme.colors.emptyShade};
            border: 1px solid ${euiTheme.colors.borderBaseSubdued};
            border-radius: 6px;
          `}
        >
          <EuiText size="xs">
            <span>{tip.text}</span>
          </EuiText>
        </div>
      ) : null}
    </div>
  );
};

interface FlowNode {
  key: string;
  label: string;
  icon?: string;
  gap?: boolean;
  y: number;
  h: number;
}

interface FlowBand {
  key: string;
  x1: number;
  y1: number;
  h1: number;
  x2: number;
  y2: number;
  h2: number;
  color: string;
  tip: string;
}

const stack = (items: Array<Omit<FlowNode, 'y'>>, top: number, gap: number) => {
  let y = top;
  return items.map((item) => {
    const node = { ...item, y };
    y += item.h + gap;
    return node;
  });
};

/** Three-column flow: sources, Knowledge Indicator types, connected agents. */
export const Proto11Flow = ({
  sources,
  agents,
  retrievals,
  onType,
}: {
  sources: KiModeSource[];
  agents: string[];
  retrievals: Map<string, number> | null;
  onType: (type: KiVizType) => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const columns = [...KI_VIZ_TYPES];
  const typeCount = (type: KiVizType) =>
    sources.reduce((sum, source) => sum + countOf(source, type), 0);
  const typeRetrievals = (type: KiVizType) => {
    if (!retrievals) return undefined;
    let sum = 0;
    let any = false;
    sources.forEach((source) => {
      source.kis.forEach((indicator) => {
        if (indicator.type !== type) return;
        const value = retrievals.get(indicator.id);
        if (value === undefined) return;
        any = true;
        sum += value;
      });
    });
    return any ? sum : undefined;
  };

  const sourceWeight = (source: KiModeSource) =>
    Math.max(
      1,
      columns.reduce((sum, type) => sum + countOf(source, type), 0)
    );
  const maxWeight = Math.max(
    1,
    ...sources.map(sourceWeight),
    ...columns.map((type) => Math.max(1, typeCount(type)))
  );
  const heightFor = (weight: number, gap: boolean) =>
    gap ? 18 : Math.max(22, Math.round((weight / maxWeight) * 72));

  const left = stack(
    sources.map((source) => ({
      key: source.name,
      label: source.name,
      icon: source.icon,
      gap: source.gap,
      h: heightFor(sourceWeight(source), source.gap),
    })),
    28,
    10
  );
  const middle = stack(
    columns.map((type) => ({
      key: type,
      label: kiTypeShort(type),
      h: heightFor(Math.max(1, typeCount(type)), typeCount(type) === 0),
    })),
    28,
    10
  );
  const agentWeight = (type: KiVizType) => {
    const measured = typeRetrievals(type);
    if (retrievals && measured !== undefined) return measured;
    return typeCount(type);
  };
  const agentTotal = columns.reduce((sum, type) => sum + agentWeight(type), 0);
  const right = stack(
    agents.map((agent) => ({
      key: agent,
      label: agent,
      icon: 'robot',
      h: Math.max(22, Math.round(64 / Math.max(agents.length, 1))),
    })),
    28,
    10
  );

  const xSource = 8;
  const sourceW = 168;
  const xType = 280;
  const typeW = 120;
  const xAgent = 520;
  const agentW = 150;
  const height =
    Math.max(
      220,
      ...left.map((node) => node.y + node.h),
      ...middle.map((node) => node.y + node.h),
      ...right.map((node) => node.y + node.h)
    ) + 16;

  const bands: FlowBand[] = [];
  const sourceCursor = new Map(left.map((node) => [node.key, node.y]));
  const typeInCursor = new Map(middle.map((node) => [node.key, node.y]));
  sources.forEach((source) => {
    const sourceNode = left.find((node) => node.key === source.name);
    if (!sourceNode || sourceNode.gap) return;
    columns.forEach((type) => {
      const count = countOf(source, type);
      const typeNode = middle.find((node) => node.key === type);
      if (count === 0 || !typeNode) return;
      const h1 = Math.max(2, (sourceNode.h * count) / sourceWeight(source));
      const h2 = Math.max(2, (typeNode.h * count) / Math.max(1, typeCount(type)));
      const y1 = sourceCursor.get(source.name) ?? sourceNode.y;
      const y2 = typeInCursor.get(type) ?? typeNode.y;
      sourceCursor.set(source.name, y1 + h1);
      typeInCursor.set(type, y2 + h2);
      bands.push({
        key: `${source.name}:${type}`,
        x1: xSource + sourceW,
        y1,
        h1,
        x2: xType,
        y2,
        h2,
        color: kiVizColor(type, euiTheme),
        tip: `${count} ${kiTypeShort(type)} from ${source.name}`,
      });
    });
  });

  if (agents.length > 0 && agentTotal > 0) {
    const agentCursor = new Map(right.map((node) => [node.key, node.y]));
    columns.forEach((type) => {
      const typeNode = middle.find((node) => node.key === type);
      const weight = agentWeight(type);
      if (!typeNode || weight === 0) return;
      const perAgent = weight / agents.length;
      agents.forEach((agent) => {
        const agentNode = right.find((node) => node.key === agent);
        if (!agentNode) return;
        const active = columns.filter((item) => agentWeight(item) > 0).length;
        const h1 = Math.max(2, typeNode.h / agents.length);
        const h2 = Math.max(2, agentNode.h / Math.max(1, active));
        const y1 =
          typeNode.y +
          bands
            .filter((band) => band.key.startsWith(`${type}:`))
            .reduce((sum, band) => sum + band.h1, 0);
        const y2 = agentCursor.get(agent) ?? agentNode.y;
        agentCursor.set(agent, y2 + h2);
        const label = retrievals
          ? `${Math.round(perAgent).toLocaleString('en-US')} retrievals`
          : `${Math.round(typeCount(type) / agents.length)} ${kiTypeShort(type)}`;
        bands.push({
          key: `${type}:${agent}`,
          x1: xType + typeW,
          y1,
          h1,
          x2: xAgent,
          y2,
          h2,
          color: kiVizColor(type, euiTheme),
          tip: `${kiTypeShort(type)} to ${agent}: ${label}`,
        });
      });
    });
  }

  const bandPath = (band: FlowBand) => {
    const mid = (band.x1 + band.x2) / 2;
    return `M ${band.x1} ${band.y1} C ${mid} ${band.y1}, ${mid} ${band.y2}, ${band.x2} ${
      band.y2
    } L ${band.x2} ${band.y2 + band.h2} C ${mid} ${band.y2 + band.h2}, ${mid} ${
      band.y1 + band.h1
    }, ${band.x1} ${band.y1 + band.h1} Z`;
  };

  return (
    <div data-test-subj="proto11KiFlow">
      <svg width={700} height={height} role="img" aria-label="Knowledge Indicator flow">
        <text x={xSource} y={16} fontSize={11} fill={euiTheme.colors.subduedText}>
          Sources
        </text>
        <text x={xType} y={16} fontSize={11} fill={euiTheme.colors.subduedText}>
          Types
        </text>
        <text x={xAgent} y={16} fontSize={11} fill={euiTheme.colors.subduedText}>
          Agents
        </text>
        {bands.map((band) => (
          <path
            key={band.key}
            d={bandPath(band)}
            fill={transparentize(band.color, 0.45)}
            onMouseEnter={(event) =>
              setTip({ x: event.clientX + 12, y: event.clientY + 14, text: band.tip })
            }
            onMouseLeave={() => setTip(null)}
          >
            <title>{band.tip}</title>
          </path>
        ))}
        {left.map((node) => (
          <g key={node.key} data-test-subj={node.gap ? 'proto11KiFlowGap' : 'proto11KiFlowSource'}>
            <rect
              x={xSource}
              y={node.y}
              width={sourceW}
              height={node.h}
              rx={4}
              fill={euiTheme.colors.lightestShade}
              stroke={
                node.gap ? euiTheme.colors.borderBaseWarning : euiTheme.colors.borderBaseSubdued
              }
              strokeDasharray={node.gap ? '4 3' : undefined}
            />
            <foreignObject x={xSource + 6} y={node.y} width={sourceW - 12} height={node.h}>
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: euiTheme.colors.text,
                  fontSize: 11,
                }}
              >
                <EuiIcon type={node.icon || 'database'} size="s" aria-hidden={true} />
                <span>{truncate(node.label, 22)}</span>
              </div>
            </foreignObject>
          </g>
        ))}
        {middle.map((node) => {
          const type = node.key as KiVizType;
          return (
            <g key={node.key} onClick={() => onType(type)} style={{ cursor: 'pointer' }}>
              <rect
                x={xType}
                y={node.y}
                width={typeW}
                height={node.h}
                rx={4}
                fill={transparentize(kiVizColor(type, euiTheme), 0.75)}
                stroke={kiVizColor(type, euiTheme)}
              />
              <text
                x={xType + 8}
                y={node.y + node.h / 2 + 4}
                fontSize={11}
                fill={kiVizColor(type, euiTheme)}
              >
                {node.label}
              </text>
            </g>
          );
        })}
        {right.map((node) => (
          <g key={node.key}>
            <rect
              x={xAgent}
              y={node.y}
              width={agentW}
              height={node.h}
              rx={4}
              fill={euiTheme.colors.lightestShade}
              stroke={euiTheme.colors.borderBaseSubdued}
            />
            <foreignObject x={xAgent + 6} y={node.y} width={agentW - 12} height={node.h}>
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: euiTheme.colors.text,
                  fontSize: 11,
                }}
              >
                <EuiIcon type="robot" size="s" aria-hidden={true} />
                <span>{truncate(node.label, 18)}</span>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
      <EuiText size="xs" color="subdued">
        <p>
          Band width is the number of Knowledge Indicators. Retrievals replace it once an agent has
          used this index.
          {retrievals ? ' Band width to agents is retrievals in the selected period.' : ''}
        </p>
      </EuiText>
      {tip ? (
        <div
          css={css`
            position: fixed;
            left: ${Math.min(tip.x, window.innerWidth - 280)}px;
            top: ${tip.y}px;
            z-index: 5;
            max-width: 260px;
            padding: 6px 8px;
            pointer-events: none;
            background: ${euiTheme.colors.emptyShade};
            border: 1px solid ${euiTheme.colors.borderBaseSubdued};
            border-radius: 6px;
          `}
        >
          <EuiText size="xs">
            <span>{tip.text}</span>
          </EuiText>
        </div>
      ) : null}
    </div>
  );
};
