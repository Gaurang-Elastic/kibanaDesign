/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License, v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { EuiBadge } from '@elastic/eui';

import { typeLabel, type KnowledgeType } from './knowledge_indicators';

/** Knowledge Context produced. */
export const KNOWLEDGE_BLUE = '#0B64DD';

/** The agent. */
export const AGENT_TEAL = '#48EFCF';

/** Teal used for text and 1px lines. The fill stays #48EFCF. */
export const AGENT_TEAL_INK = '#0E8C76';

/** The four product types. Shape distinguishes them; colour does not. */
export const KI_VIZ_TYPES = ['index_metadata', 'document', 'unit_profile', 'query_guide'] as const;

export type KiVizType = (typeof KI_VIZ_TYPES)[number];

export type KiShape = 'circle' | 'square' | 'diamond' | 'triangle';

export const isKiVizType = (type: KnowledgeType): type is KiVizType =>
  (KI_VIZ_TYPES as readonly KnowledgeType[]).includes(type);

const SHORT_LABEL: Record<KiVizType, string> = {
  index_metadata: 'index metadata',
  document: 'document',
  unit_profile: 'profile',
  query_guide: 'query guide',
};

/** Light mode, low count to high: pale blue up to brand blue. */
const LIGHT_BLUE_RAMP = ['#E8F1FF', '#BFD6F7', '#85B1EE', '#3D84E3', '#0B64DD'] as const;

/**
 * Dark mode inverts that ramp into navy. Low counts stay dark; the top step is still brand blue.
 */
const DARK_BLUE_RAMP = ['#0E2344', '#14315C', '#1A4684', '#1E5CB0', '#0B64DD'] as const;

export type ColorMode = 'LIGHT' | 'DARK';

const rampIndex = (count: number) => Math.min(4, Math.floor(Math.log2(Math.max(1, count))));

/** Blue ramp step for a positive count. Empty counts have no knowledge colour. */
export const knowledgeBlueForCount = (count: number, colorMode: ColorMode): string | null => {
  if (count <= 0) return null;
  const ramp = colorMode === 'DARK' ? DARK_BLUE_RAMP : LIGHT_BLUE_RAMP;
  return ramp[rampIndex(count)];
};

/** Ink that stays readable on a ramp cell. Dark mode uses the light ink on every step. */
export const rampInk = (count: number, colorMode: ColorMode, lightInk: string): string => {
  if (count <= 0) return lightInk;
  if (colorMode === 'DARK') return '#FFFFFF';
  return rampIndex(count) >= 3 ? '#FFFFFF' : lightInk;
};

export const kiTypeShape = (type: KnowledgeType): KiShape => {
  switch (type) {
    case 'document':
      return 'square';
    case 'unit_profile':
      return 'diamond';
    case 'query_guide':
      return 'triangle';
    default:
      return 'circle';
  }
};

export const kiTypeShort = (type: KnowledgeType): string =>
  isKiVizType(type) ? SHORT_LABEL[type] : type.replace(/_/g, ' ');

/** Knowledge node. The shape is the type; the fill is knowledge blue unless a caller overrides it. */
export const KiNodeShape = ({
  type,
  cx,
  cy,
  r,
  fill,
  stroke = 'none',
  strokeWidth = 0,
}: {
  type: KnowledgeType;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) => {
  const shape = kiTypeShape(type);
  if (shape === 'square') {
    return (
      <rect
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === 'diamond') {
    return (
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  if (shape === 'triangle') {
    const h = r * 1.15;
    return (
      <polygon
        points={`${cx},${cy - h} ${cx + h},${cy + h * 0.75} ${cx - h},${cy + h * 0.75}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
};

/** Hollow type badge. Type is never a colour. */
export const KiTypeBadge = ({ type }: { type: KnowledgeType }) => (
  <EuiBadge color="hollow">{typeLabel(type)}</EuiBadge>
);
