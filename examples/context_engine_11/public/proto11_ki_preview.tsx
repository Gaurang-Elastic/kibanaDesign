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
  transparentize,
  useEuiTheme,
  useGeneratedHtmlId,
} from '@elastic/eui';

import { toIndicatorDocument, type KnowledgeIndicator } from './knowledge_indicators';
import { AGENT_TEAL, AGENT_TEAL_INK, KiTypeBadge, KNOWLEDGE_BLUE } from './proto11_ki_colors';
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
        <KiTypeBadge type={indicator.type} />
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
        <KiTypeBadge type={indicator.type} />
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
 * With Context is knowledge blue. Without Context is the agent teal.
 * The retry step stays a warning.
 */
const WITH_STEPS = [
  { label: 'retrieve', tone: 'knowledge' },
  { label: 'answer', tone: 'neutral' },
] as const;

const WITHOUT_STEPS = [
  { label: 'list indices', tone: 'agent' },
  { label: 'read mapping', tone: 'agent' },
  { label: 'sample documents', tone: 'agent' },
  { label: 'write query', tone: 'agent' },
  { label: 'retry after field error', tone: 'warning' },
  { label: 'answer', tone: 'agent' },
] as const;

/** Retrieve and answer beside the dry-run steps, above the token bars. */
const ComparisonSteps = () => {
  const { euiTheme } = useEuiTheme();
  const rows = [
    { label: 'With Context', steps: WITH_STEPS },
    { label: 'Without Context', steps: WITHOUT_STEPS },
  ];
  return (
    <div data-test-subj="proto11ComparisonSteps">
      {rows.map((row) => (
        <div
          key={row.label}
          css={css`
            display: flex;
            flex-wrap: nowrap;
            align-items: center;
            gap: 4px;
            margin-bottom: 6px;
          `}
        >
          <EuiText size="xs">
            <span
              css={css`
                display: inline-block;
                width: 110px;
              `}
            >
              {row.label}
            </span>
          </EuiText>
          {row.steps.map((step) => {
            const background =
              step.tone === 'knowledge'
                ? KNOWLEDGE_BLUE
                : step.tone === 'agent'
                ? AGENT_TEAL
                : step.tone === 'warning'
                ? transparentize(euiTheme.colors.warning, 0.75)
                : euiTheme.colors.lightestShade;
            const color =
              step.tone === 'knowledge'
                ? '#FFFFFF'
                : step.tone === 'agent'
                ? AGENT_TEAL_INK
                : step.tone === 'warning'
                ? euiTheme.colors.textWarning
                : euiTheme.colors.text;
            return (
              <span
                key={step.label}
                css={css`
                  display: inline-flex;
                  align-items: center;
                  flex: none;
                  height: 18px;
                  padding: 0 3px;
                  border-radius: 2px;
                  background: ${background};
                  color: ${color};
                  font-size: 10px;
                  white-space: nowrap;
                `}
              >
                {step.label}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

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
        <ComparisonSteps />
        <EuiSpacer size="s" />
        <ComparisonBars comparison={comparison} />
        <EuiSpacer size="m" />
      </>
    ) : null}
    <EuiText size="xs" color="subdued">
      <p>{note}</p>
    </EuiText>
  </div>
);

/** With Context is a short blue bar. Without Context is a full teal bar. */
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
              background: ${euiTheme.colors.lightestShade};
              overflow: hidden;
            `}
          >
            <div
              css={css`
                height: 100%;
                background: ${label === 'With Context' ? KNOWLEDGE_BLUE : AGENT_TEAL};
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
            <KiTypeBadge type={indicator.type} />
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
