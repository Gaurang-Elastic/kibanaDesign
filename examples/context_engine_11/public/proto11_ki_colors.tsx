/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { css } from '@emotion/react';
import { EuiBadge, EuiText, useEuiTheme } from '@elastic/eui';
import type { EuiThemeComputed } from '@elastic/eui';

import { typeLabel, type KnowledgeIndicator, type KnowledgeType } from './knowledge_indicators';

/** The four Knowledge Indicator types that carry a vis colour. */
export const KI_VIZ_TYPES = ['index_metadata', 'document', 'unit_profile', 'query_guide'] as const;

export type KiVizType = (typeof KI_VIZ_TYPES)[number];

export const isKiVizType = (type: KnowledgeType): type is KiVizType =>
  (KI_VIZ_TYPES as readonly KnowledgeType[]).includes(type);

const SHORT_LABEL: Record<KiVizType, string> = {
  index_metadata: 'index metadata',
  document: 'document',
  unit_profile: 'profile',
  query_guide: 'query guide',
};

/** Vis colour for a Knowledge Indicator type. Types outside the four stay ink. */
export const kiVizColor = (type: KnowledgeType, theme: EuiThemeComputed): string => {
  switch (type) {
    case 'index_metadata':
      return theme.colors.vis.euiColorVis0;
    case 'document':
      return theme.colors.vis.euiColorVis1;
    case 'query_guide':
      return theme.colors.vis.euiColorVis2;
    case 'unit_profile':
      return theme.colors.vis.euiColorVis3;
    default:
      return theme.colors.text;
  }
};

export const kiTypeShort = (type: KnowledgeType): string =>
  isKiVizType(type) ? SHORT_LABEL[type] : type.replace(/_/g, ' ');

/** Hollow type badge: type colour for the text and the border. */
export const KiTypeBadge = ({ type }: { type: KnowledgeType }) => {
  const { euiTheme } = useEuiTheme();
  const tone = kiVizColor(type, euiTheme);
  return (
    <EuiBadge color="hollow" style={{ color: tone, boxShadow: `inset 0 0 0 1px ${tone}` }}>
      {typeLabel(type)}
    </EuiBadge>
  );
};

const countsFor = (indicators: KnowledgeIndicator[]) => {
  const counts = new Map<KnowledgeType, number>();
  indicators.forEach((indicator) => {
    counts.set(indicator.type, (counts.get(indicator.type) ?? 0) + 1);
  });
  const ordered: KnowledgeType[] = [
    ...KI_VIZ_TYPES.filter((item) => (counts.get(item) ?? 0) > 0),
    ...[...counts.keys()].filter((item) => !isKiVizType(item)),
  ];
  return ordered.map((item) => ({ type: item, count: counts.get(item) ?? 0 }));
};

/** Segmented type bar and muted legend for an AI index card. */
export const KiTypeStrip = ({ indicators }: { indicators: KnowledgeIndicator[] }) => {
  const { euiTheme } = useEuiTheme();
  const parts = countsFor(indicators);
  const total = indicators.length;
  return (
    <div data-test-subj="proto11TypeStrip">
      <div
        css={css`
          display: flex;
          height: 6px;
          overflow: hidden;
          border-radius: 3px;
          background: ${total === 0 ? euiTheme.colors.lightestShade : 'transparent'};
        `}
      >
        {parts.map(({ type, count }) => (
          <span
            key={type}
            css={css`
              display: block;
              height: 6px;
              width: ${(count / Math.max(total, 1)) * 100}%;
              background: ${kiVizColor(type, euiTheme)};
            `}
          />
        ))}
      </div>
      <EuiText size="xs" color="subdued">
        <p
          css={css`
            margin: 4px 0 0;
          `}
        >
          {total === 0
            ? 'No Knowledge Indicators yet'
            : parts.map(({ type, count }) => `${kiTypeShort(type)} ${count}`).join(' · ')}
        </p>
      </EuiText>
    </div>
  );
};
