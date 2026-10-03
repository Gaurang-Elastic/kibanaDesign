/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiCode,
  EuiCodeBlock,
  EuiConfirmModal,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiProgress,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useGeneratedHtmlId,
} from '@elastic/eui';

import type { Namespace } from './namespace_data';
import {
  FIRST_PASS_TICKS,
  TEMPLATES,
  currentReasoningLine,
  failureGroupsFor,
  outstandingRejected,
  rejectedTotal,
} from './proto11_data';
import type { Proto11Meta } from './proto11_types';

const kiCount = (count: number) =>
  count === 1 ? '1 Knowledge Indicator' : `${count} Knowledge Indicators`;

/** The first-pass, sample-ready and full-run states above the overview panels. */
export const Proto11RunCallout = ({
  namespace,
  meta,
  runFilled,
  onRunAll,
  onAdjust,
}: {
  namespace: Namespace;
  meta: Proto11Meta;
  runFilled: boolean;
  onRunAll: () => void;
  onAdjust: () => void;
}) => {
  if (meta.sample) return null;
  if (meta.phase === 'firstPass') {
    return (
      <EuiCallOut
        announceOnMount
        color="primary"
        iconType="clock"
        title="Building first Knowledge Indicators from a sample of your data"
        data-test-subj="proto11FirstPass"
      >
        <EuiProgress
          value={meta.tick}
          max={FIRST_PASS_TICKS}
          size="xs"
          color="primary"
          aria-label="First pass progress"
        />
        <EuiSpacer size="s" />
        <EuiText size="xs" color="subdued">
          <p aria-live="polite">{currentReasoningLine(meta)}</p>
        </EuiText>
      </EuiCallOut>
    );
  }
  if (meta.phase === 'sampleReady') {
    return (
      <EuiCallOut
        announceOnMount
        color="success"
        iconType="checkCircleFill"
        title={`${kiCount(
          namespace.indicators.length
        )} ready from a sample. Check a few before running on all your data.`}
        data-test-subj="proto11SampleReady"
      >
        <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiButton
              size="s"
              color="success"
              fill={runFilled}
              onClick={onRunAll}
              data-test-subj="proto11RunAll"
            >
              Run on all data
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink onClick={onAdjust}>Adjust first</EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiCallOut>
    );
  }
  if (meta.phase === 'fullRun') {
    return (
      <EuiCallOut
        announceOnMount
        size="s"
        color="primary"
        iconType="refresh"
        title={`Running on all data, ${namespace.indicators.length} so far`}
        data-test-subj="proto11FullRun"
      />
    );
  }
  return null;
};

/** Rejected KIs inside the automation card that produced them. */
export const Proto11RejectedNotice = ({
  meta,
  onFix,
}: {
  meta: Proto11Meta;
  onFix: () => void;
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const total = rejectedTotal(meta);
  if (meta.sample || meta.phase === 'firstPass' || total === 0) return null;

  if (meta.fix === 'rerunning') {
    return (
      <EuiCallOut
        announceOnMount
        size="s"
        color="primary"
        iconType="refresh"
        title={`Re-running ${kiCount(total)}, ${meta.written.fixed} saved so far`}
        className="contextEnginePrototype__automationNotice"
      />
    );
  }
  if (meta.fix === 'fixed') {
    return (
      <EuiCallOut
        announceOnMount
        size="s"
        color="success"
        iconType="check"
        title={`${kiCount(total)} passed verification and were saved.`}
        className="contextEnginePrototype__automationNotice"
      />
    );
  }
  if (outstandingRejected(meta) === 0) return null;

  const groups = failureGroupsFor(meta);
  return (
    <EuiCallOut
      size="s"
      color="warning"
      iconType="warning"
      title={`${kiCount(
        total
      )} were rejected and not saved. Their ES|QL did not pass verification, so your agent will not see them.`}
      className="contextEnginePrototype__automationNotice"
      data-test-subj="proto11Rejected"
    >
      <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButton size="s" color="text" iconType="productAgent" onClick={onFix}>
            Fix with Elastic AI Agent
          </EuiButton>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiLink onClick={() => setDetailsOpen((open) => !open)}>
            {detailsOpen ? 'Hide details' : 'Show details'}
          </EuiLink>
        </EuiFlexItem>
      </EuiFlexGroup>
      {detailsOpen ? (
        <div className="contextEnginePrototype__rejectedDetails">
          {groups.map((group) => (
            <EuiPanel key={group.source} hasBorder paddingSize="s" color="plain">
              <EuiText size="s">
                <p>
                  <strong>
                    {group.count} rejected on {group.sourceName}
                  </strong>
                </p>
              </EuiText>
              <EuiText size="xs" color="subdued">
                <p>
                  {group.reason}. For example, {group.example}.
                </p>
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiCodeBlock language="esql" fontSize="s" paddingSize="s">
                {group.query}
              </EuiCodeBlock>
              <EuiSpacer size="xs" />
              <EuiText size="xs">
                <p>
                  <EuiCode>{group.error}</EuiCode>
                </p>
              </EuiText>
            </EuiPanel>
          ))}
        </div>
      ) : null}
    </EuiCallOut>
  );
};

/** Mocked Elastic AI Agent turn that proposes fixes for the rejected KIs. */
export const Proto11FixFlyout = ({
  namespace,
  meta,
  onClose,
  onRerun,
}: {
  namespace: Namespace;
  meta: Proto11Meta;
  onClose: () => void;
  onRerun: () => void;
}) => {
  const total = rejectedTotal(meta);
  const groups = failureGroupsFor(meta);
  const automationTitle = TEMPLATES[meta.runTemplates[0]].title;
  return (
    <EuiFlyout
      ownFocus
      size="s"
      onClose={onClose}
      aria-labelledby="context-engine-11-fix-flyout-title"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiIcon type="productAgent" size="l" aria-hidden={true} />
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiTitle size="s">
              <h2 id="context-engine-11-fix-flyout-title">Elastic AI Agent</h2>
            </EuiTitle>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="xs" />
        <EuiText size="xs" color="subdued">
          <p>{namespace.displayName}</p>
        </EuiText>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <div className="contextEnginePrototype__agentUserTurn">
          <EuiText size="s">
            <p>Fix the {kiCount(total)} that were rejected.</p>
          </EuiText>
        </div>
        <EuiText size="s">
          <p>I checked each rejected query against its index. Here is what was wrong:</p>
          <ul>
            {groups.map((group) => (
              <li key={group.source}>
                <strong>
                  {group.count} on {group.sourceName}.
                </strong>{' '}
                {group.fix}
              </li>
            ))}
          </ul>
          <p>
            I have updated the {automationTitle} automation. Re-run the {total} rejected Knowledge
            Indicators?
          </p>
        </EuiText>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={onClose}>Not now</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton fill onClick={onRerun} data-test-subj="proto11RerunRejected">
              Re-run rejected
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};

/** Slim note on the sample index, with removal behind a confirm. */
export const Proto11SampleCallout = ({
  namespace,
  onRemove,
}: {
  namespace: Namespace;
  onRemove: () => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  const confirmTitleId = useGeneratedHtmlId();
  return (
    <>
      <EuiCallOut
        size="s"
        color="primary"
        iconType="info"
        data-test-subj="proto11SampleCallout"
        title={
          <>
            This is sample data so you can see what Context produces. Remove it any time.{' '}
            <EuiLink onClick={() => setConfirming(true)}>Remove sample data</EuiLink>
          </>
        }
      />
      {confirming ? (
        <EuiConfirmModal
          title="Remove sample data?"
          aria-labelledby={confirmTitleId}
          titleProps={{ id: confirmTitleId }}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onRemove();
          }}
          cancelButtonText="Cancel"
          confirmButtonText="Remove sample data"
          buttonColor="danger"
        >
          <EuiText size="s">
            <p>
              This deletes {namespace.displayName} and its {kiCount(namespace.indicators.length)}.
              Your own AI indices are not affected.
            </p>
          </EuiText>
        </EuiConfirmModal>
      ) : null}
    </>
  );
};
