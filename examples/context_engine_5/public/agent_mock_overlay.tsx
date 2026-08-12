/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { AI_AGENT_ICON, type ContextAgentSeed } from './ai_agent';

interface AgentMockOverlayProps {
  seed: ContextAgentSeed | null;
}

/**
 * Prototype-only mock agent turn rendered inside the real chrome AI Agent sidebar.
 * Does not own a header, composer, or model picker; those come from openChat.
 */
export function AgentMockOverlay({ seed }: AgentMockOverlayProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [applied, setApplied] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setReady(false);
    setApplied(false);
    setDiscarded(false);
    setHost(null);

    if (!seed) return undefined;

    let cancelled = false;
    let attempts = 0;
    const findHost = () => {
      if (cancelled) return;
      const panel = document.querySelector<HTMLElement>('[data-test-subj="sidebarPanel"]');
      if (panel) {
        if (getComputedStyle(panel).position === 'static') {
          panel.style.position = 'relative';
        }
        let mount = panel.querySelector<HTMLElement>('[data-test-subj="contextEngineAgentMock"]');
        if (!mount) {
          mount = document.createElement('div');
          mount.setAttribute('data-test-subj', 'contextEngineAgentMock');
          mount.className = 'contextEnginePrototype__agentMockMount';
          panel.appendChild(mount);
        }
        setHost(mount);
        timers.current.push(
          window.setTimeout(() => {
            if (!cancelled) setReady(true);
          }, 700)
        );
        return;
      }
      attempts += 1;
      if (attempts < 40) {
        timers.current.push(window.setTimeout(findHost, 100));
      }
    };
    findHost();

    return () => {
      cancelled = true;
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
      const mount = document.querySelector('[data-test-subj="contextEngineAgentMock"]');
      mount?.parentElement?.removeChild(mount);
    };
  }, [seed]);

  if (!seed || !host || !ready) return null;

  const replyText =
    seed.kind === 'improvement-discuss'
      ? 'I checked the evidence against the source. The proposed fix is bounded and should stop the raw-data loop. Approve it on the card, or Apply below to take the same path.'
      : seed.kind === 'automation-edit'
        ? 'I would narrow the extract step to the fields your agent actually asks about, and add a daily refresh so new rows land as Knowledge Indicators without a full re-scan.'
        : seed.kind === 'suggest-automations'
          ? 'I looked at the attached sources and drafted two bounded extract automations. Apply to add them to this index, or discard to leave the list unchanged.'
          : seed.kind === 'improvement-watch'
            ? 'Reading the latest traces for this pattern and confirming the automation update landed.'
            : 'I can help reshape this. Here is a concrete next change based on what you shared.';

  const proposal =
    seed.proposalText ||
    (seed.kind === 'automation-edit'
      ? 'Update the automation to extract owner and account fields, refresh daily, and skip sandbox rows.'
      : seed.kind === 'suggest-automations'
        ? 'Add the suggested extract automations for the attached sources.'
        : 'Apply a bounded scope change so the next run covers this gap.');

  const showProposal = Boolean(seed.onApply) && !applied && !discarded && seed.kind !== 'improvement-watch';

  return ReactDOM.createPortal(
    <div className="contextEnginePrototype__agentMock" aria-live="polite">
      <div className="contextEnginePrototype__agentMockMsg contextEnginePrototype__agentMockMsg--user">
        <EuiText size="s">{seed.userMessage}</EuiText>
        <EuiSpacer size="xs" />
        <EuiBadge color="hollow">{seed.contextChip}</EuiBadge>
      </div>
      <div className="contextEnginePrototype__agentMockMsg contextEnginePrototype__agentMockMsg--agent">
        <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiIcon type={AI_AGENT_ICON} size="m" aria-hidden={true} />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">
              Elastic AI Agent
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="xs" />
        <EuiText size="s">{replyText}</EuiText>
        <EuiSpacer size="xs" />
        <EuiText size="xs" color="subdued">
          2 tools responded ›
        </EuiText>
        {showProposal ? (
          <>
            <EuiSpacer size="s" />
            <div className="contextEnginePrototype__agentMockProposal">
              <EuiText size="s">{proposal}</EuiText>
              <EuiSpacer size="s" />
              <EuiFlexGroup gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    size="s"
                    fill
                    onClick={() => {
                      seed.onApply?.();
                      setApplied(true);
                    }}
                  >
                    ✓ Apply this change
                  </EuiButton>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty size="s" onClick={() => setDiscarded(true)}>
                    Discard
                  </EuiButtonEmpty>
                </EuiFlexItem>
              </EuiFlexGroup>
            </div>
          </>
        ) : null}
        {applied ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s" color="success">
              Fix applied. The page content refreshed from the tool result.
            </EuiText>
          </>
        ) : null}
        {discarded ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              Discarded. The page is unchanged.
            </EuiText>
          </>
        ) : null}
      </div>
    </div>,
    host
  );
}
