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
import { AGENT_TEAL, KiTypeBadge, KNOWLEDGE_BLUE } from './proto11_ki_colors';
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
          <span>{indicator.title}</span>
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

/** Retrieve is knowledge blue. Other steps are neutral grey. The retry step stays a warning. */
const WITH_STEPS = [
  { label: 'retrieve', tone: 'knowledge' },
  { label: 'answer', tone: 'neutral' },
] as const;

const WITHOUT_STEPS = [
  { label: 'list indices', tone: 'neutral' },
  { label: 'read mapping', tone: 'neutral' },
  { label: 'sample documents', tone: 'neutral' },
  { label: 'write query', tone: 'neutral' },
  { label: 'retry after field error', tone: 'warning' },
  { label: 'answer', tone: 'neutral' },
] as const;

interface CompareStep {
  label: string;
  tone: 'knowledge' | 'neutral' | 'warning';
}

const comparisonCaption = (countLabel: string, tokens: number) =>
  `${countLabel} · about ${tokens.toLocaleString('en-US')} tokens`;

/** Label and chips on one line, caption pinned right, full-width bar underneath. */
const ContextCompare = ({
  label,
  steps,
  caption,
  share,
}: {
  label: string;
  steps: readonly CompareStep[];
  caption: string;
  share: number;
}) => {
  const { euiTheme } = useEuiTheme();
  return (
    <div
      data-test-subj={label === 'With Context' ? 'proto11CompareWith' : 'proto11CompareWithout'}
      css={css`
        display: flex;
        flex-direction: column;
        gap: ${euiTheme.size.m};
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: flex-start;
          gap: ${euiTheme.size.s};
        `}
      >
        <div
          data-test-subj="proto11ComparisonSteps"
          css={css`
            display: flex;
            flex: 1;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px;
            min-width: 0;
          `}
        >
          <EuiText size="xs">
            <span
              css={css`
                font-weight: 500;
                white-space: nowrap;
              `}
            >
              {label}
            </span>
          </EuiText>
          {steps.map((step) => {
            const background =
              step.tone === 'knowledge'
                ? KNOWLEDGE_BLUE
                : step.tone === 'warning'
                ? transparentize(euiTheme.colors.warning, 0.75)
                : euiTheme.colors.lightestShade;
            const color =
              step.tone === 'knowledge'
                ? '#FFFFFF'
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
        <EuiText
          size="xs"
          color="subdued"
          data-test-subj="proto11ComparisonCaption"
          css={css`
            flex: none;
          `}
        >
          <span
            css={css`
              white-space: nowrap;
            `}
          >
            {caption}
          </span>
        </EuiText>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${caption}`}
        data-test-subj="proto11ComparisonBars"
        css={css`
          height: ${euiTheme.size.xs};
          border-radius: ${euiTheme.size.xxs};
          background: ${AGENT_TEAL};
          overflow: hidden;
        `}
      >
        <div
          css={css`
            height: 100%;
            background: ${KNOWLEDGE_BLUE};
          `}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
};

/** Headline, With and Without Context, and an optional estimate line under them. */
export const ComparisonBlock = ({
  comparison,
  showHeadline = true,
  note,
  sample = false,
}: {
  comparison?: TokenComparison;
  showHeadline?: boolean;
  note?: string;
  /** Hollow Sample badge beside the headline. Used by the landing sample band. */
  sample?: boolean;
}) => (
  <div data-test-subj="proto11Comparison">
    {comparison ? (
      <>
        {showHeadline ? (
          <>
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h4>{comparisonHeadline(comparison)}</h4>
                </EuiTitle>
              </EuiFlexItem>
              {sample ? (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow" data-test-subj="proto11SampleHeadlineBadge">
                    Sample
                  </EuiBadge>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
            <div
              css={css`
                height: 20px;
              `}
            />
          </>
        ) : null}
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: 20px;
          `}
        >
          <ContextCompare
            label="With Context"
            steps={WITH_STEPS}
            caption={comparisonCaption('1 retrieval', comparison.withContext.tokens)}
            share={Math.min(
              1,
              comparison.withContext.tokens / Math.max(1, comparison.withoutContext.tokens)
            )}
          />
          <ContextCompare
            label="Without Context"
            steps={WITHOUT_STEPS}
            caption={comparisonCaption(
              `${comparison.withoutContext.calls} calls`,
              comparison.withoutContext.tokens
            )}
            share={1}
          />
        </div>
      </>
    ) : null}
    {note ? (
      <>
        {comparison ? (
          <div
            css={css`
              height: 20px;
            `}
          />
        ) : null}
        <EuiText size="xs" color="subdued">
          <p>{note}</p>
        </EuiText>
      </>
    ) : null}
  </div>
);

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
