/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
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
  EuiProgress,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useGeneratedHtmlId,
} from '@elastic/eui';

import { toIndicatorDocument, typeLabel, type KnowledgeIndicator } from './knowledge_indicators';

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

/** Labelled neutral bar, proportional to `max`. */
export const ComparisonBar = ({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) => (
  <div>
    <EuiText size="xs">
      <p>{label}</p>
    </EuiText>
    <EuiSpacer size="xs" />
    <EuiProgress value={value} max={max} size="s" color="subdued" aria-label={label} />
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
