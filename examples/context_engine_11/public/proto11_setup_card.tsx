/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiLink,
  EuiLoadingSpinner,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  EuiToolTip,
} from '@elastic/eui';

import type { Namespace } from './namespace_data';
import { KNOWLEDGE_BLUE } from './proto11_ki_colors';
import { overviewPurpose } from './proto11_data';
import { proto11MemoryOn, proto11SetupSteps, type Proto11SetupStepId } from './proto11_setup';

type CodingTool = 'claude' | 'cursor' | 'codex' | 'mcp';

const TRACES_ENDPOINT = 'https://{your-kibana}/api/agent_builder/traces';

const TOOLS: Array<{ id: CodingTool; label: string }> = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'codex', label: 'Codex' },
  { id: 'mcp', label: 'Other (MCP)' },
];

const shortPurpose = (purpose: string): string => {
  const stripped = purpose.replace(/\.+$/, '');
  const match = stripped.match(/^Answers (.+?) questions/i);
  return match ? match[1] : stripped;
};

const codingPrompt = (tool: CodingTool, indexName: string, purpose: string): string => {
  const about = shortPurpose(purpose);
  const shared = [
    `Add the MCP server \`elastic-context\` at https://{your-kibana}/api/agent_builder/mcp with the header \`Authorization: ApiKey {key}\`.`,
    `Use the AI index \`${indexName}\`: before answering questions about ${about}, retrieve its Knowledge Indicators.`,
    `Turn on OpenTelemetry tracing to ${TRACES_ENDPOINT} so Context can learn from your mistakes.`,
    'Save useful facts you learn as memories in this index.',
    'When done, call `context.ping` and tell me the result.',
  ].join(' ');
  if (tool === 'cursor') {
    return `Connect this project to Elastic Context Engine from Cursor. ${shared}`;
  }
  if (tool === 'codex') {
    return `Connect this project to Elastic Context Engine from Codex. ${shared}`;
  }
  return `Connect this project to Elastic Context Engine. ${shared}`;
};

const mcpSnippet = (indexName: string): string => {
  const json = JSON.stringify(
    {
      mcpServers: {
        'elastic-context': {
          type: 'http',
          url: 'https://<your-kibana>/api/agent_builder/mcp',
          headers: { Authorization: 'ApiKey {key}' },
        },
      },
    },
    null,
    2
  );
  return [
    json,
    '',
    `Turn on OpenTelemetry tracing to ${TRACES_ENDPOINT} so Context can learn from your mistakes.`,
    `Save useful facts you learn as memories in the AI index ${indexName}.`,
  ].join('\n');
};

const apiSnippet = (indexName: string): string =>
  [
    `curl -X POST "https://<your-kibana>/api/context/ai_indices/${indexName}/_retrieve" \\`,
    '  -H "Authorization: ApiKey <your-api-key>" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "kbn-xsrf: true" \\',
    `  -d '{ "question": "<your question>" }'`,
  ].join('\n');

const optionalLine = (tracesDone: boolean, memoryOn: boolean, memoryDone: boolean): string => {
  const tracesLeft = !tracesDone;
  const memoryLeft = memoryOn && !memoryDone;
  if (tracesLeft && memoryLeft) {
    return 'Setup complete. Optional: add traces, send your first memory.';
  }
  if (tracesLeft) return 'Setup complete. Optional: add traces.';
  return 'Setup complete. Optional: send your first memory.';
};

/** Checklist for finishing an AI index, including the coding-agent setup prompt. */
export const Proto11SetupCard = ({
  namespace,
  fillAction,
  apiKeysHref,
  onAddSources,
  onRunAll,
  onViewKnowledge,
  onAddElasticAgent,
  onAddTraces,
  onConnectExternal,
  onMemoryReceived,
  onDismiss,
}: {
  namespace: Namespace;
  /** False while another editor on the page owns the filled button. */
  fillAction: boolean;
  apiKeysHref: string;
  onAddSources: () => void;
  onRunAll: () => void;
  onViewKnowledge: () => void;
  onAddElasticAgent: () => void;
  onAddTraces: () => void;
  onConnectExternal: () => void;
  onMemoryReceived: () => void;
  onDismiss: () => void;
}): JSX.Element | null => {
  const meta = namespace.proto11;
  const steps = proto11SetupSteps(namespace);
  const memoryOn = proto11MemoryOn(namespace);
  const done = steps.filter((step) => step.done).length;
  const total = steps.length;
  const requiredDone = steps.filter((step) => !step.optional).every((step) => step.done);
  const allDone = steps.every((step) => step.done);
  const current = steps.find((step) => !step.done) ?? null;
  const [opened, setOpened] = useState<Proto11SetupStepId | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tool, setTool] = useState<CodingTool>('claude');
  const [copied, setCopied] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [memoryHold, setMemoryHold] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const wasComplete = useRef(allDone);
  const memoryTimer = useRef<number | undefined>(undefined);
  const agentDone = (meta?.connectedAgents?.length ?? 0) > 0;

  useEffect(() => {
    if (agentDone) setPanelOpen(false);
  }, [agentDone]);

  useEffect(() => {
    return () => {
      if (memoryTimer.current !== undefined) window.clearTimeout(memoryTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!allDone) {
      wasComplete.current = false;
      return;
    }
    if (wasComplete.current) return;
    wasComplete.current = true;
    setCelebrating(true);
    setPanelOpen(false);
    const timer = window.setTimeout(() => setCelebrating(false), 3000);
    return () => window.clearTimeout(timer);
  }, [allDone]);

  if (!meta || meta.sample || meta.setupDismissed) return null;

  if (allDone) {
    if (wasComplete.current && !celebrating) return null;
    return (
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__panel"
        data-test-subj="proto11SetupComplete"
      >
        <EuiText size="s">
          <p>Setup complete</p>
        </EuiText>
      </EuiPanel>
    );
  }

  const tracesDone = steps.some((step) => step.id === 'traces' && step.done);
  const memoryDone = steps.some((step) => step.id === 'memory' && step.done);
  const collapsed = requiredDone && !panelOpen && !memoryHold;

  if (collapsed) {
    return (
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__panel"
        data-test-subj="proto11SetupCollapsed"
      >
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem>
            <EuiText size="s">
              <p>{optionalLine(tracesDone, memoryOn, memoryDone)}</p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiToolTip content="Dismiss" disableScreenReaderOutput>
              <EuiButtonIcon
                iconType="cross"
                color="text"
                aria-label="Dismiss"
                onClick={onDismiss}
                data-test-subj="proto11SetupDismiss"
              />
            </EuiToolTip>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  }

  const purpose = overviewPurpose(namespace);
  const promptText =
    tool === 'mcp' ? mcpSnippet(namespace.name) : codingPrompt(tool, namespace.name, purpose);
  const show = (id: Proto11SetupStepId) => current?.id === id || opened === id;
  const filled = (id: Proto11SetupStepId) => fillAction && !panelOpen && current?.id === id;

  const copyPrompt = () => {
    const write = navigator.clipboard?.writeText(promptText);
    if (write) {
      write.then(
        () => setCopied(true),
        () => setCopied(true)
      );
    } else {
      setCopied(true);
    }
  };

  const simulate = () => {
    onConnectExternal();
    if (!memoryOn) return;
    setMemoryHold(true);
    if (memoryTimer.current !== undefined) window.clearTimeout(memoryTimer.current);
    memoryTimer.current = window.setTimeout(() => {
      memoryTimer.current = undefined;
      setMemoryHold(false);
      onMemoryReceived();
    }, 4000);
  };

  return (
    <EuiPanel
      hasBorder
      paddingSize="l"
      className="contextEnginePrototype__panel"
      data-test-subj="proto11SetupCard"
    >
      <div className="contextEnginePrototype__panelHeader">
        <div className="contextEnginePrototype__panelHeaderText">
          <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
            <h2>Set up this AI index</h2>
          </EuiTitle>
        </div>
        <EuiText size="s" color="subdued">
          <p data-test-subj="proto11SetupCount">
            {done} of {total}
          </p>
        </EuiText>
      </div>
      <EuiSpacer size="s" />
      <div
        className="contextEnginePrototype__setupProgress"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${done} of ${total}`}
        data-test-subj="proto11SetupProgress"
      >
        <div
          className="contextEnginePrototype__setupProgressFill"
          style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
        />
      </div>
      <EuiSpacer size="m" />
      <div className="contextEnginePrototype__setupSteps">
        {steps.map((step) => {
          const isCurrent = current?.id === step.id;
          const future = !step.done && !isCurrent;
          return (
            <div
              key={step.id}
              className={`contextEnginePrototype__setupStep${
                isCurrent ? ' contextEnginePrototype__setupStep--current' : ''
              }${future ? ' contextEnginePrototype__setupStep--future' : ''}`}
              data-test-subj={`proto11SetupStep-${step.id}`}
              data-current={isCurrent ? 'true' : 'false'}
              data-done={step.done ? 'true' : 'false'}
            >
              <div className="contextEnginePrototype__setupStepRow">
                {step.done ? (
                  <EuiIcon type="check" color="success" size="m" aria-hidden={true} />
                ) : (
                  <span
                    className={`contextEnginePrototype__setupMark${
                      isCurrent ? ' contextEnginePrototype__setupMark--current' : ''
                    }`}
                    style={isCurrent ? { background: KNOWLEDGE_BLUE } : undefined}
                  />
                )}
                <button
                  type="button"
                  className="contextEnginePrototype__setupStepName"
                  onClick={() => setOpened((open) => (open === step.id ? null : step.id))}
                >
                  {step.label}
                </button>
                {step.optional ? (
                  <EuiBadge color="hollow" className="contextEnginePrototype__cardBadge">
                    Optional
                  </EuiBadge>
                ) : null}
              </div>
              {(step.done ? opened === step.id : show(step.id)) ? (
                <div className="contextEnginePrototype__setupDetail">
                  {step.id === 'source' ? (
                    <EuiButton
                      size="s"
                      fill={filled('source')}
                      onClick={onAddSources}
                      data-test-subj="proto11SetupAddSources"
                    >
                      Add sources
                    </EuiButton>
                  ) : null}
                  {step.id === 'indicators' ? (
                    <>
                      <EuiText size="s" color="subdued">
                        <p>
                          {namespace.indicators.length} ready from a sample. Check a few, then run
                          on everything.
                        </p>
                      </EuiText>
                      <EuiSpacer size="s" />
                      <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false}>
                        <EuiFlexItem grow={false}>
                          <EuiButton
                            size="s"
                            fill={filled('indicators')}
                            isDisabled={meta.phase !== 'sampleReady'}
                            onClick={onRunAll}
                            data-test-subj="proto11RunAll"
                          >
                            Run on all data
                          </EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiLink
                            color="subdued"
                            onClick={onViewKnowledge}
                            data-test-subj="proto11ViewKnowledge"
                          >
                            View Knowledge Indicators
                          </EuiLink>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </>
                  ) : null}
                  {step.id === 'agent' ? (
                    <>
                      <EuiText size="s" color="subdued">
                        <p>So your agent can use these Knowledge Indicators.</p>
                      </EuiText>
                      <EuiSpacer size="s" />
                      <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false} wrap>
                        <EuiFlexItem grow={false}>
                          <EuiButton
                            size="s"
                            fill={filled('agent')}
                            onClick={() => setPanelOpen((open) => !open)}
                            data-test-subj="proto11ConnectCodingAgent"
                          >
                            Connect a coding agent
                          </EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiLink
                            color="subdued"
                            onClick={onAddElasticAgent}
                            data-test-subj="proto11AddElasticAgent"
                          >
                            Add to an Elastic agent
                          </EuiLink>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiLink
                            color="subdued"
                            onClick={() => setApiOpen((open) => !open)}
                            data-test-subj="proto11UseApi"
                          >
                            Use the API
                          </EuiLink>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                      {apiOpen ? (
                        <>
                          <EuiSpacer size="m" />
                          <EuiCodeBlock language="bash" fontSize="s" paddingSize="m" isCopyable>
                            {apiSnippet(namespace.name)}
                          </EuiCodeBlock>
                        </>
                      ) : null}
                      {panelOpen ? (
                        <div data-test-subj="proto11CodingAgentPanel">
                          <EuiSpacer size="l" />
                          <EuiTitle size="xxs">
                            <h3>Connect your coding agent</h3>
                          </EuiTitle>
                          <EuiSpacer size="s" />
                          <EuiText size="s" color="subdued">
                            <p>
                              Paste this into your agent. It adds Context, turns on traces and
                              memory, and checks the connection.
                            </p>
                          </EuiText>
                          <EuiSpacer size="m" />
                          <EuiButtonGroup
                            legend="Coding agent"
                            options={TOOLS}
                            idSelected={tool}
                            onChange={(id) => {
                              setTool(id as CodingTool);
                              setCopied(false);
                            }}
                            type="single"
                            buttonSize="compressed"
                            color="text"
                            data-test-subj="proto11CodingAgentTools"
                          />
                          <EuiSpacer size="m" />
                          <EuiCodeBlock
                            language={tool === 'mcp' ? 'json' : 'text'}
                            fontSize="s"
                            paddingSize="m"
                            data-test-subj="proto11CodingPrompt"
                          >
                            {promptText}
                          </EuiCodeBlock>
                          <EuiSpacer size="s" />
                          <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false} wrap>
                            <EuiFlexItem grow={false}>
                              <EuiButton
                                size="s"
                                fill
                                onClick={copyPrompt}
                                data-test-subj="proto11CopyPrompt"
                              >
                                Copy prompt
                              </EuiButton>
                            </EuiFlexItem>
                            <EuiFlexItem grow={false}>
                              <EuiLink
                                color="subdued"
                                href={apiKeysHref}
                                target="_blank"
                                data-test-subj="proto11CreateApiKey"
                              >
                                Create an API key
                              </EuiLink>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                          <EuiSpacer size="s" />
                          <EuiText size="xs" color="subdued">
                            <p>Replace {'{key}'} with an API key that can read this index.</p>
                          </EuiText>
                          {copied ? (
                            <>
                              <EuiSpacer size="m" />
                              <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                                <EuiFlexItem grow={false}>
                                  <EuiLoadingSpinner size="m" />
                                </EuiFlexItem>
                                <EuiFlexItem>
                                  <EuiText size="s" color="subdued">
                                    <p data-test-subj="proto11CodingWait">
                                      Waiting for your agent to connect…
                                    </p>
                                  </EuiText>
                                </EuiFlexItem>
                              </EuiFlexGroup>
                              <EuiSpacer size="s" />
                              <EuiLink
                                color="subdued"
                                onClick={simulate}
                                data-test-subj="proto11SimulateConnection"
                              >
                                Simulate connection (demo)
                              </EuiLink>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  {step.id === 'traces' ? (
                    <>
                      <EuiText size="s" color="subdued">
                        <p>Traces show what your agent got wrong, so Context can fill the gaps.</p>
                      </EuiText>
                      <EuiSpacer size="s" />
                      <EuiButton
                        size="s"
                        fill={filled('traces')}
                        onClick={onAddTraces}
                        data-test-subj="proto11SetupAddTraces"
                      >
                        Add traces
                      </EuiButton>
                    </>
                  ) : null}
                  {step.id === 'memory' ? (
                    <>
                      <EuiText size="s" color="subdued">
                        <p>
                          {step.done
                            ? 'First memory received'
                            : 'Your agent saves its first memory while it works.'}
                        </p>
                      </EuiText>
                      {!step.done && steps.some((item) => item.id === 'agent' && item.done) ? (
                        <>
                          <EuiSpacer size="s" />
                          <EuiFlexGroup
                            gutterSize="s"
                            alignItems="center"
                            responsive={false}
                            data-test-subj="proto11MemoryWait"
                          >
                            <EuiFlexItem grow={false}>
                              <EuiLoadingSpinner size="s" />
                            </EuiFlexItem>
                            <EuiFlexItem>
                              <EuiText size="s" color="subdued">
                                <p>Waiting for the first memory</p>
                              </EuiText>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </EuiPanel>
  );
};
