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
import {
  EuiBadge,
  EuiButtonEmpty,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useEuiTheme,
  useGeneratedHtmlId,
} from '@elastic/eui';

import { toIndicatorDocument, typeLabel, type KnowledgeIndicator } from './knowledge_indicators';
import { comparisonHeadline, type TokenComparison } from './proto11_data';

/** Small clickable KI card: title, hollow type badge, source in muted text. */
export const KiPreviewCard = ({
  indicator,
  sourceName,
  onOpen,
}: {
  indicator: KnowledgeIndicator;
  sourceName: string;
  onOpen: () => void;
}) => (
  <EuiPanel
    hasBorder
    paddingSize="s"
    className="contextEnginePrototype__proto11Enter"
    onClick={onOpen}
    aria-label={`Open ${indicator.title}`}
    data-test-subj="proto11KiPreviewCard"
  >
    <EuiText size="s" textAlign="left">
      <strong>{indicator.title}</strong>
    </EuiText>
    <EuiSpacer size="xs" />
    <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
      <EuiFlexItem grow={false}>
        <EuiBadge color="hollow">{typeLabel(indicator.type)}</EuiBadge>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiText size="xs" color="subdued">
          {sourceName}
        </EuiText>
      </EuiFlexItem>
    </EuiFlexGroup>
  </EuiPanel>
);

/** One-line clickable KI row: title, hollow type badge and source. */
export const KiPreviewRow = ({
  indicator,
  sourceName,
  onOpen,
}: {
  indicator: KnowledgeIndicator;
  sourceName: string;
  onOpen: () => void;
}) => (
  <EuiPanel
    hasBorder
    paddingSize="s"
    className="contextEnginePrototype__proto11Enter"
    onClick={onOpen}
    aria-label={`Open ${indicator.title}`}
    data-test-subj="proto11KiPreviewRow"
  >
    <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
      <EuiFlexItem className="contextEnginePrototype__proto11KiRowTitle">
        <EuiText size="s" textAlign="left">
          <strong>{indicator.title}</strong>
        </EuiText>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiBadge color="hollow">{typeLabel(indicator.type)}</EuiBadge>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiText size="xs" color="subdued">
          {sourceName}
        </EuiText>
      </EuiFlexItem>
    </EuiFlexGroup>
  </EuiPanel>
);

/**
 * Elastic brand teal, used deliberately to match the hero illustration.
 * This is the only non-token colour in the plugin's TypeScript; the older
 * stylesheet rules in app.scss carry their own literal fallbacks.
 */
const BRAND_TEAL = '#48EFCF';

/** Optional headline, With and Without Context bars, and the estimate or sample note under them. */
export const ComparisonBlock = ({
  comparison,
  showHeadline = true,
  note,
}: {
  comparison?: TokenComparison;
  showHeadline?: boolean;
  note: string;
}) => (
  <div data-test-subj="proto11Comparison">
    {comparison ? (
      <>
        {showHeadline ? (
          <>
            <EuiTitle size="xs">
              <h4>{comparisonHeadline(comparison)}</h4>
            </EuiTitle>
            <EuiSpacer size="m" />
          </>
        ) : null}
        <ComparisonBars comparison={comparison} />
        <EuiSpacer size="m" />
      </>
    ) : null}
    <EuiText size="xs" color="subdued">
      <p>{note}</p>
    </EuiText>
  </div>
);

/** With and Without Context bars on one scale: blue fill over a teal track, Without Context full. */
const ComparisonBars = ({
  comparison: { withContext, withoutContext },
}: {
  comparison: TokenComparison;
}) => {
  const { euiTheme } = useEuiTheme();
  const ratio = Math.min(1, withContext.tokens / Math.max(1, withoutContext.tokens));
  const rows = [
    { label: 'With Context', detail: withContext.detail, share: ratio },
    { label: 'Without Context', detail: withoutContext.detail, share: 1 },
  ];
  return (
    <div
      data-test-subj="proto11ComparisonBars"
      css={css`
        display: grid;
        grid-template-columns: 110px minmax(${euiTheme.size.xxxxl}, 1fr) auto;
        align-items: center;
        column-gap: ${euiTheme.size.m};
        row-gap: ${euiTheme.size.s};
      `}
    >
      {rows.map(({ label, detail, share }) => (
        <React.Fragment key={label}>
          <EuiText size="xs">
            <p>{label}</p>
          </EuiText>
          <div
            role="img"
            aria-label={`${label}: ${detail}`}
            css={css`
              height: ${euiTheme.size.xs};
              border-radius: ${euiTheme.size.xxs};
              background: ${BRAND_TEAL};
              overflow: hidden;
            `}
          >
            <div
              css={css`
                height: 100%;
                background: ${euiTheme.colors.primary};
              `}
              style={{ width: `${share * 100}%` }}
            />
          </div>
          <EuiText size="xs">
            <p>{detail}</p>
          </EuiText>
        </React.Fragment>
      ))}
    </div>
  );
};

/** KI flyout with the raw document, as stored in the AI index. */
export const KiJsonFlyout = ({
  indicator,
  sourceName,
  sample,
  onClose,
}: {
  indicator: KnowledgeIndicator;
  sourceName: string;
  sample: boolean;
  onClose: () => void;
}) => {
  const titleId = useGeneratedHtmlId({ prefix: 'proto11KiJson' });
  return (
    <EuiFlyout ownFocus size="m" onClose={onClose} aria-labelledby={titleId}>
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id={titleId}>{indicator.title}</h2>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiFlexGroup gutterSize="xs" responsive={false} wrap alignItems="center">
          {sample ? (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">Sample</EuiBadge>
            </EuiFlexItem>
          ) : null}
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{typeLabel(indicator.type)}</EuiBadge>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{sourceName}</EuiBadge>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable>
          {JSON.stringify(toIndicatorDocument(indicator), null, 2)}
        </EuiCodeBlock>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiButtonEmpty onClick={onClose}>Close</EuiButtonEmpty>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};
