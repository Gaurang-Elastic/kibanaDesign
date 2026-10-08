/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useRef, useState } from 'react';
import { css } from '@emotion/react';
import {
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiCallOut,
  EuiCode,
  EuiCodeBlock,
  EuiConfirmModal,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiIcon,
  EuiLink,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  EuiToolTip,
  useEuiTheme,
  useGeneratedHtmlId,
} from '@elastic/eui';

import type { Automation, Namespace } from './namespace_data';
import { KNOWLEDGE_BLUE } from './proto11_ki_colors';
import {
  TEMPLATES,
  currentReasoningLine,
  failureGroupsFor,
  firstPassDots,
  outstandingRejected,
  rejectedTotal,
  rejectionMetaForAutomation,
} from './proto11_data';
import type { Proto11Meta } from './proto11_types';

export const FirstPassDotGrid = ({ meta }: { meta: Proto11Meta }) => {
  const { euiTheme } = useEuiTheme();
  const { dots, written, rejected } = firstPassDots(meta);
  return (
    <div data-test-subj="proto11FirstPassDots">
      <div
        css={css`
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        `}
      >
        {dots.map((dot) => {
          const fill = dot.rejected ? euiTheme.colors.warning : KNOWLEDGE_BLUE;
          return (
            <span
              key={dot.id}
              css={css`
                width: 12px;
                height: 12px;
                box-sizing: border-box;
                border-radius: 12px;
                border: 1px solid ${dot.filled ? fill : euiTheme.colors.borderBaseSubdued};
                background: ${dot.filled ? fill : 'transparent'};
                @media (prefers-reduced-motion: no-preference) {
                  transition: background-color 200ms ease-out, border-color 200ms ease-out;
                }
              `}
            />
          );
        })}
      </div>
      <EuiSpacer size="s" />
      <EuiFlexGroup
        justifyContent="spaceBetween"
        alignItems="center"
        responsive={false}
        gutterSize="s"
      >
        <EuiFlexItem>
          <EuiText size="xs" color="subdued">
            <p aria-live="polite">{currentReasoningLine(meta)}</p>
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">
            <p>
              {written} written · {rejected} rejected
            </p>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
    </div>
  );
};

const kiCount = (count: number) =>
  count === 1 ? '1 Knowledge Indicator' : `${count} Knowledge Indicators`;

/** The first-pass and full-run states above the overview panels. */
export const Proto11RunCallout = ({
  namespace,
  meta,
}: {
  namespace: Namespace;
  meta: Proto11Meta;
}) => {
  const addon = meta.addon?.phase === 'firstPass' ? meta.addon : undefined;
  const calloutMeta: Proto11Meta = addon
    ? {
        ...meta,
        phase: 'firstPass',
        tick: addon.tick,
        sourceIds: addon.sourceIds,
        runTemplates: [addon.template],
        written: { ...meta.written, sample: addon.written },
        sample: false,
      }
    : meta;

  if (!addon && meta.sample) return null;
  if (calloutMeta.phase === 'firstPass') {
    return (
      <EuiCallOut
        announceOnMount
        color="primary"
        iconType="clock"
        title="Building first Knowledge Indicators from a sample of your data"
        data-test-subj="proto11FirstPass"
      >
        <FirstPassDotGrid meta={calloutMeta} />
      </EuiCallOut>
    );
  }
  if (meta.phase === 'sampleReady') return null;
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

/** Rejected KIs for this automation, including a finished add-on pass. */
export const Proto11AutomationRejection = ({
  namespace,
  automation,
  onFix,
}: {
  namespace: Namespace;
  automation: Automation;
  onFix: () => void;
}) => {
  const noticeMeta = rejectionMetaForAutomation(namespace, automation);
  if (!noticeMeta) return null;
  return <Proto11RejectedNotice meta={noticeMeta} onFix={onFix} />;
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
  const [noteOpen, setNoteOpen] = useState(true);
  const total = rejectedTotal(meta);
  useEffect(() => {
    if (meta.fix !== 'fixed') {
      setNoteOpen(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setNoteOpen(false), 4000);
    return () => window.clearTimeout(timer);
  }, [meta.fix, meta.fixAutomationId]);
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
    if (!noteOpen) return null;
    return (
      <EuiCallOut
        announceOnMount
        size="s"
        color="success"
        iconType="check"
        title={`${kiCount(total)} passed verification and were saved.`}
        className="contextEnginePrototype__automationNotice"
        data-test-subj="proto11RejectionFixed"
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

const RerunCard = ({
  meta,
  passed,
  onRerun,
  onDecline,
}: {
  meta: Proto11Meta;
  passed: number;
  onRerun: () => void;
  onDecline: () => void;
}) => {
  const total = rejectedTotal(meta);
  const card = meta.fixChat?.card ?? 'confirm';
  if (card === 'rerun') {
    const running = meta.fix === 'rerunning';
    return (
      <EuiPanel
        hasBorder
        paddingSize="m"
        className="contextEnginePrototype__agentConfirmCard"
        data-test-subj="proto11RerunCard"
      >
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            {running ? (
              <EuiLoadingSpinner size="m" />
            ) : (
              <EuiIcon type="checkCircleFill" color="success" aria-hidden={true} />
            )}
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="s">
              <p aria-live="polite">
                {running ? `Re-running ${kiCount(total)}` : `Re-ran ${kiCount(total)}`}
              </p>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  }
  return (
    <EuiPanel
      hasBorder
      paddingSize="m"
      className="contextEnginePrototype__agentConfirmCard"
      data-test-subj="proto11RerunCard"
    >
      <EuiTitle size="xs">
        <h3>
          Re-run the {total} rejected {total === 1 ? 'Knowledge Indicator' : 'Knowledge Indicators'}
          ?
        </h3>
      </EuiTitle>
      <EuiSpacer size="xs" />
      <EuiText size="s" color="subdued">
        <p>Only the rejected ones; the {passed} that passed are untouched.</p>
      </EuiText>
      {card === 'confirm' ? (
        <>
          <EuiSpacer size="m" />
          <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty size="s" onClick={onDecline} data-test-subj="proto11RerunNotNow">
                Not now
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton size="s" fill onClick={onRerun} data-test-subj="proto11RerunRejected">
                Re-run rejected
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      ) : null}
    </EuiPanel>
  );
};

/** Mocked Elastic AI Agent turn that proposes fixes for the rejected KIs. */
export const Proto11FixFlyout = ({
  namespace,
  meta,
  onClose,
  onRerun,
  onDecline,
  onSend,
}: {
  namespace: Namespace;
  meta: Proto11Meta;
  onClose: () => void;
  onRerun: () => void;
  onDecline: () => void;
  onSend: (message: string) => void;
}) => {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const total = rejectedTotal(meta);
  const groups = failureGroupsFor(meta);
  const automationTitle = TEMPLATES[meta.runTemplates[0]].title;
  const turns = meta.fixChat?.turns ?? [];
  const passed = namespace.indicators.length - meta.written.fixed;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

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
                  {group.count} on {group.sourceName}:
                </strong>{' '}
                {group.fix}
              </li>
            ))}
          </ul>
          <p>I have updated the {automationTitle} automation.</p>
        </EuiText>
        <RerunCard meta={meta} passed={passed} onRerun={onRerun} onDecline={onDecline} />
        {turns.map((turn, index) => (
          <React.Fragment key={index}>
            <EuiSpacer size="m" />
            {turn.role === 'user' ? (
              <div className="contextEnginePrototype__agentUserTurn">
                <EuiText size="s">
                  <p>{turn.text}</p>
                </EuiText>
              </div>
            ) : (
              <EuiText size="s" data-test-subj="proto11FixAgentTurn">
                <p>{turn.text}</p>
              </EuiText>
            )}
          </React.Fragment>
        ))}
        <div ref={endRef} />
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
            <EuiFlexItem>
              <EuiFieldText
                fullWidth
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Message Elastic AI Agent"
                aria-label="Message Elastic AI Agent"
                data-test-subj="proto11FixComposer"
              />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiToolTip content="Send" disableScreenReaderOutput>
                <EuiButtonIcon
                  type="submit"
                  iconType="sortUp"
                  display="base"
                  size="m"
                  isDisabled={!draft.trim()}
                  aria-label="Send"
                  data-test-subj="proto11FixSend"
                />
              </EuiToolTip>
            </EuiFlexItem>
          </EuiFlexGroup>
        </form>
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
