/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { css, keyframes } from '@emotion/react';
import React, { useEffect, useRef, useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiCheckbox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiIcon,
  EuiIconTip,
  EuiLink,
  EuiPanel,
  EuiPopover,
  EuiSpacer,
  EuiSwitch,
  EuiText,
  EuiTextArea,
  useEuiTheme,
} from '@elastic/eui';

import type { IndexTrace, Namespace, NamespaceSource } from './namespace_data';
import { FirstPassDotGrid } from './proto11_overview';
import { overviewPurpose, type Proto11Proposal } from './proto11_data';
import { Proto11IndexProposal } from './proto11_landing';
import {
  proto11CurrentStepId,
  proto11RequiredSetupDone,
  proto11SetupSteps,
  type Proto11SetupStep,
  type Proto11SetupStepId,
} from './proto11_setup';
import type { Proto11Meta } from './proto11_types';
import { AgentTracesPanel } from './traces_panel';
import {
  allDraftSources,
  draftFromSources,
  SourcesPicker,
  type SourcesDraft,
} from './sources_picker';

type CodingTool = 'agent' | 'langchain' | 'claude' | 'cursor' | 'codex' | 'mcp';
type MemoryScope = 'team' | 'me';
type MemoryType = 'Episodic' | 'Semantic' | 'Procedural';
type SimulateBeat = 'agent' | 'traces' | 'retrieval' | 'memory';

const DESCRIPTION_HELPER =
  'Important: This description shapes generated automation workflows and helps agents decide when the index is relevant.';
const MEMORY_TIP = 'Agents can save and recall task memory.';
const TRACES_ENDPOINT = 'https://{your-kibana}/api/agent_builder/traces';
const SAMPLE_MEMORY = 'Noted a fact from the last task.';
const MEMORY_TYPES: MemoryType[] = ['Episodic', 'Semantic', 'Procedural'];

const TOOLS: Array<{ id: CodingTool; label: string; icon: string }> = [
  { id: 'agent', label: 'Agent Builder', icon: 'productAgent' },
  { id: 'langchain', label: 'LangChain', icon: 'link' },
  { id: 'claude', label: 'Claude Code', icon: 'appConsole' },
  { id: 'cursor', label: 'Cursor', icon: 'pencil' },
  { id: 'codex', label: 'Codex', icon: 'code' },
  { id: 'mcp', label: 'MCP', icon: 'documents' },
];

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const shortPurpose = (purpose: string): string => {
  const stripped = purpose.replace(/\.+$/, '');
  const match = stripped.match(/^Answers (.+?) questions/i);
  return match ? match[1] : stripped;
};

const firstWords = (text: string, count = 6): string => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= count) return words.join(' ');
  return `${words.slice(0, count).join(' ')}…`;
};

const dotGridMeta = (meta: Proto11Meta | undefined): Proto11Meta | undefined => {
  if (!meta) return undefined;
  if (meta.addon?.phase === 'firstPass') {
    return {
      ...meta,
      phase: 'firstPass',
      tick: meta.addon.tick,
      sourceIds: meta.addon.sourceIds,
      runTemplates: [meta.addon.template],
      written: { ...meta.written, sample: meta.addon.written },
      sample: false,
    };
  }
  return meta.phase === 'firstPass' ? meta : undefined;
};

const scopeLabel = (scope: MemoryScope): string => (scope === 'team' ? 'Team' : 'Just me');

const toolLabel = (tool: CodingTool): string =>
  TOOLS.find((item) => item.id === tool)?.label ?? tool;

const agentResult = (namespace: Namespace): string => {
  const agent =
    namespace.proto11?.connectedAgents?.find((item) => !item.sample) ??
    namespace.proto11?.connectedAgents?.[0];
  return agent ? agent.name.replace(/ \(external\)$/, '') : '';
};

const stepResult = (step: Proto11SetupStep, namespace: Namespace): string => {
  if (!step.done) return '';
  const meta = namespace.proto11;
  if (step.id === 'describe') return firstWords(namespace.intent);
  if (step.id === 'source') return `${namespace.sources.length} sources`;
  if (step.id === 'indicators') {
    const ready = namespace.indicators.length;
    const fixed = meta?.written.fixed ?? 0;
    return fixed > 0 ? `${ready} ready · ${fixed} fixed` : `${ready} ready`;
  }
  if (step.id === 'agent') return agentResult(namespace);
  if (step.id === 'traces')
    return meta?.tracesViaPrompt ? 'via prompt' : `${namespace.traces?.length ?? 0} traces`;
  if (step.id === 'memory') return firstWords(meta?.firstMemoryLine || SAMPLE_MEMORY);
  return '';
};

const codingPrompt = (
  tool: CodingTool,
  indexName: string,
  purpose: string,
  scope: MemoryScope,
  types: MemoryType[]
): string => {
  const about = shortPurpose(purpose) || 'this index';
  const scopeText = scopeLabel(scope);
  const typeText = types.length > 0 ? types.join(', ') : 'None';
  const from =
    tool === 'cursor'
      ? ' from Cursor'
      : tool === 'codex'
      ? ' from Codex'
      : tool === 'langchain'
      ? ' from LangChain'
      : '';
  const shared = [
    `Add the MCP server \`elastic-context\` at https://{your-kibana}/api/agent_builder/mcp with the header \`Authorization: ApiKey {key}\`.`,
    `Use the AI index \`${indexName}\`: before answering questions about ${about}, retrieve its Knowledge Indicators.`,
    `Turn on OpenTelemetry tracing to ${TRACES_ENDPOINT} so Context can learn from your mistakes.`,
    'Save useful facts you learn as memories in this index.',
    `Memory scope is ${scopeText}. Memory types: ${typeText}.`,
    'When done, call `context.ping` and tell me the result.',
  ].join(' ');
  if (tool === 'mcp') {
    const json = JSON.stringify(
      {
        mcpServers: {
          'elastic-context': {
            type: 'http',
            url: 'https://{your-kibana}/api/agent_builder/mcp',
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
      `Use the AI index ${indexName}: before answering questions about ${about}, retrieve its Knowledge Indicators.`,
      `Turn on OpenTelemetry tracing to ${TRACES_ENDPOINT} so Context can learn from your mistakes.`,
      `Save useful facts you learn as memories in this index. Memory scope is ${scopeText}. Memory types: ${typeText}.`,
    ].join('\n');
  }
  return `Connect this project to Elastic Context Engine${from}. ${shared}`;
};

const Highlighted = ({ text, tokens }: { text: string; tokens: string[] }) => {
  const { euiTheme } = useEuiTheme();
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const marks = tokens.filter((token) => token.length > 0);
  while (rest.length > 0) {
    let found: { index: number; token: string } | null = null;
    for (const token of marks) {
      const index = rest.indexOf(token);
      if (index < 0) continue;
      if (
        !found ||
        index < found.index ||
        (index === found.index && token.length > found.token.length)
      ) {
        found = { index, token };
      }
    }
    if (!found) {
      parts.push(rest);
      break;
    }
    if (found.index > 0) parts.push(rest.slice(0, found.index));
    parts.push(
      <span
        key={key}
        css={css`
          color: ${euiTheme.colors.primary};
        `}
      >
        {found.token}
      </span>
    );
    key += 1;
    rest = rest.slice(found.index + found.token.length);
  }
  return <>{parts}</>;
};

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  pulse?: boolean;
  memory?: { line: string; tool: string };
}

const activityItems = (
  namespace: Namespace,
  copied: boolean,
  waitingTool: string | null
): ActivityItem[] => {
  const meta = namespace.proto11;
  const items: ActivityItem[] = [{ id: 'created', text: 'Index created', time: 'just now' }];
  if (namespace.intent.trim())
    items.push({ id: 'desc', text: 'Description added', time: 'just now' });
  if (namespace.sources.length > 0) {
    items.push({
      id: 'sources',
      text: `${namespace.sources.length} sources connected`,
      time: 'just now',
    });
  }
  if ((namespace.traces?.length ?? 0) > 0 && !meta?.tracesViaPrompt) {
    items.push({ id: 'traces', text: 'Traces arriving', time: 'just now' });
  }
  const passStarted =
    meta &&
    (meta.phase === 'firstPass' ||
      meta.phase === 'fullRun' ||
      meta.phase === 'complete' ||
      meta.tick > 0 ||
      meta.runTemplates.length > 0);
  if (passStarted) items.push({ id: 'pass', text: 'First pass started', time: 'just now' });
  if (namespace.indicators.length > 0 && meta && meta.phase !== 'firstPass') {
    items.push({
      id: 'ready',
      text: `${namespace.indicators.length} Knowledge Indicators ready`,
      time: 'just now',
    });
  }
  if ((meta?.written.fixed ?? 0) > 0) {
    items.push({
      id: 'fixed',
      text: `${meta?.written.fixed} rejected, fixed by Elastic AI Agent`,
      time: 'just now',
    });
  }
  if (copied) items.push({ id: 'copied', text: 'Prompt copied', time: 'just now' });
  const connected = agentResult(namespace);
  if (waitingTool && !connected) {
    items.push({
      id: 'waiting',
      text: `Waiting for ${waitingTool}`,
      time: 'just now',
      pulse: true,
    });
  }
  if (connected) {
    items.push({ id: 'agent', text: `Agent connected: ${connected}`, time: 'just now' });
  }
  if (meta?.tracesViaPrompt) {
    items.push({ id: 'traces', text: 'Traces arriving', time: 'just now' });
  }
  if (meta?.firstRetrievalTitle) {
    items.push({
      id: 'retrieval',
      text: `First retrieval: ${meta.firstRetrievalTitle}`,
      time: 'just now',
    });
  }
  if (meta?.firstMemoryReceived) {
    items.push({
      id: 'memory',
      text: 'First memory saved',
      time: 'just now',
      memory: { line: meta.firstMemoryLine || SAMPLE_MEMORY, tool: connected || 'your agent' },
    });
  }
  return items.reverse();
};

/** Ordered setup rail. In Setup mode this panel is the whole Overview tab. */
export const Proto11OnboardingRail = ({
  namespace,
  fillAction,
  apiKeysHref,
  onSaveDescription,
  onSaveSources,
  onSaveTraces,
  onViewKnowledge,
  onAddElasticAgent,
  onSimulateBeat,
  onExpandedChange,
  onSimulatingChange,
  onAddProposal,
  onRerunProposal,
  indicatorsCards,
  readOnly = false,
}: {
  namespace: Namespace;
  fillAction: boolean;
  apiKeysHref: string;
  onSaveDescription: (intent: string, memoryEnabled: boolean) => void;
  onSaveSources: (sources: NamespaceSource[]) => void;
  onSaveTraces: (traces: IndexTrace[]) => void;
  onViewKnowledge: () => void;
  onAddElasticAgent: () => void;
  onSimulateBeat: (beat: SimulateBeat, tool: string, memoryLine: string) => void;
  onExpandedChange: (expanded: boolean) => void;
  onSimulatingChange?: (active: boolean) => void;
  onAddProposal: (proposal: Proto11Proposal) => void;
  onRerunProposal: (proposal: Proto11Proposal) => void;
  indicatorsCards?: React.ReactNode;
  readOnly?: boolean;
}) => {
  const { euiTheme } = useEuiTheme();
  const steps = proto11SetupSteps(namespace);
  const currentId = proto11CurrentStepId(namespace);
  const requiredDone = proto11RequiredSetupDone(namespace);
  const preferred = namespace.proto11?.onboardingView;
  const [viewed, setViewed] = useState<Proto11SetupStepId>(() => {
    if (preferred && steps.some((step) => step.id === preferred)) return preferred;
    return currentId ?? steps[steps.length - 1].id;
  });
  const [intent, setIntent] = useState(namespace.intent);
  const [memoryOn, setMemoryOn] = useState(namespace.memoryEnabled !== false);
  const [sourcesDraft, setSourcesDraft] = useState<SourcesDraft>(() =>
    draftFromSources(namespace.sources)
  );
  const [tracesDraft, setTracesDraft] = useState<IndexTrace[]>(namespace.traces ?? []);
  const [tool, setTool] = useState<CodingTool>('claude');
  const [scope, setScope] = useState<MemoryScope>('team');
  const [types, setTypes] = useState<MemoryType[]>(MEMORY_TYPES);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waitingTool, setWaitingTool] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const [proposalVisible, setProposalVisible] = useState(true);
  const prevCurrent = useRef(currentId);
  const timers = useRef<number[]>([]);

  const dismissed = Boolean(namespace.proto11?.setupDismissed);
  const expanded = readOnly || (!dismissed && !(requiredDone && !simulating));

  useEffect(() => {
    if (readOnly) return;
    onExpandedChange(expanded);
  }, [expanded, onExpandedChange, readOnly]);

  useEffect(() => {
    onSimulatingChange?.(simulating);
  }, [simulating, onSimulatingChange]);

  useEffect(() => () => onSimulatingChange?.(false), [onSimulatingChange]);

  useEffect(() => () => onExpandedChange(false), [onExpandedChange]);

  useEffect(() => {
    if (!currentId) {
      prevCurrent.current = undefined;
      return;
    }
    if (prevCurrent.current && prevCurrent.current !== currentId) {
      const previous = prevCurrent.current;
      setViewed((view) => (view === previous ? currentId : view));
    }
    prevCurrent.current = currentId;
  }, [currentId]);

  useEffect(() => {
    setIntent(namespace.intent);
  }, [namespace.name, namespace.intent]);

  useEffect(() => {
    setMemoryOn(namespace.memoryEnabled !== false);
  }, [namespace.memoryEnabled]);

  useEffect(() => {
    if ((namespace.proto11?.connectedAgents?.length ?? 0) > 0) setWaitingTool(null);
  }, [namespace.proto11?.connectedAgents?.length]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    []
  );

  const viewedStep = steps.find((step) => step.id === viewed) ?? steps[0];
  const actionFill = fillAction && viewed === currentId;
  const doneCount = steps.filter((step) => step.done).length;
  const purpose = overviewPurpose(namespace);
  const prompt = codingPrompt(tool, namespace.name, purpose, scope, types);
  const highlightTokens = [namespace.name, shortPurpose(purpose), scopeLabel(scope), ...types];
  const items = activityItems(namespace, copied, waitingTool);
  const visibleItems = showEarlier ? items : items.slice(0, 6);
  const hiddenCount = items.length - visibleItems.length;

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const simulate = () => {
    clearTimers();
    setSimulating(true);
    const label = toolLabel(tool);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gap = reduce ? 0 : 1500;
    const beats: SimulateBeat[] = ['agent', 'traces', 'retrieval', 'memory'];
    beats.forEach((beat, index) => {
      const id = window.setTimeout(() => {
        onSimulateBeat(beat, label, SAMPLE_MEMORY);
        if (beat === 'memory') {
          const done = window.setTimeout(() => setSimulating(false), reduce ? 0 : 600);
          timers.current.push(done);
        }
      }, gap * index);
      timers.current.push(id);
    });
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // The waiting line still shows when the browser blocks clipboard writes.
    }
    setCopied(true);
    setWaitingTool(toolLabel(tool));
  };

  if (!expanded) return null;

  const renderContent = () => {
    if (viewedStep.id === 'describe') {
      const dirty = intent.trim() !== namespace.intent.trim();
      return (
        <>
          <EuiText size="s">
            <p>One sentence on what this index is for.</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiTextArea
            fullWidth
            rows={3}
            value={intent}
            readOnly={readOnly}
            onChange={(event) => setIntent(event.target.value)}
            aria-label="Description"
            data-test-subj="proto11SetupDescription"
          />
          <EuiText size="xs" color="subdued">
            <p>{DESCRIPTION_HELPER}</p>
          </EuiText>
          <EuiSpacer size="m" />
          <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiSwitch
                label={memoryOn ? 'Memory: on' : 'Memory: off'}
                checked={memoryOn}
                compressed
                disabled={readOnly}
                onChange={(event) => {
                  const next = event.target.checked;
                  setMemoryOn(next);
                  onSaveDescription(namespace.intent, next);
                }}
                data-test-subj="proto11SetupMemory"
              />
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiIconTip content={MEMORY_TIP} aria-label={MEMORY_TIP} position="top" />
            </EuiFlexItem>
          </EuiFlexGroup>
          {readOnly ? null : (
            <>
          <EuiSpacer size="s" />
          {actionFill ? (
            <EuiButton
              size="s"
              fill
              onClick={() => onSaveDescription(intent.trim(), memoryOn)}
              isDisabled={!dirty || intent.trim().length === 0}
              data-test-subj="proto11SetupSaveDescription"
            >
              Save
            </EuiButton>
          ) : (
            <EuiButtonEmpty
              size="s"
              onClick={() => onSaveDescription(intent.trim(), memoryOn)}
              isDisabled={!dirty || intent.trim().length === 0}
              data-test-subj="proto11SetupSaveDescription"
            >
              Save
            </EuiButtonEmpty>
          )}
            </>
          )}
        </>
      );
    }
    if (viewedStep.id === 'source') {
      if (readOnly) {
        return namespace.sources.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>No sources yet.</p>
          </EuiText>
        ) : (
          <EuiText size="s">
            {namespace.sources.map((source) => (
              <p key={source.id}>{source.name}</p>
            ))}
          </EuiText>
        );
      }
      const next = allDraftSources(sourcesDraft);
      const dirty =
        next.map((source) => source.id).join('|') !==
        namespace.sources.map((source) => source.id).join('|');
      return (
        <>
          <SourcesPicker
            draft={sourcesDraft}
            onChange={setSourcesDraft}
            accordionId="proto11-setup-sources"
          />
          {readOnly ? null : (
            <>
          <EuiSpacer size="s" />
          {actionFill ? (
            <EuiButton
              size="s"
              fill
              onClick={() => onSaveSources(next)}
              isDisabled={!dirty || next.length === 0}
              data-test-subj="proto11SetupSaveSources"
            >
              Save
            </EuiButton>
          ) : (
            <EuiButtonEmpty
              size="s"
              onClick={() => onSaveSources(next)}
              isDisabled={!dirty || next.length === 0}
            >
              Save
            </EuiButtonEmpty>
          )}
            </>
          )}
        </>
      );
    }
    if (viewedStep.id === 'indicators') {
      const meta = namespace.proto11;
      const running = namespace.automations.some(
        (automation) => automation.runStatus === 'firstPass' || automation.runStatus === 'running'
      );
      const dotMeta = dotGridMeta(meta);
      if (namespace.automations.length === 0) {
        if (!proposalVisible) {
          return (
            <EuiLink onClick={() => setProposalVisible(true)} data-test-subj="proto11ProposeAgain">
              Propose automation
            </EuiLink>
          );
        }
        return (
          <Proto11IndexProposal
            namespace={namespace}
            actions={readOnly ? 'none' : actionFill ? 'fill' : 'empty'}
            onCreateAndRun={(proposal) => onAddProposal(proposal)}
            onRerun={(proposal) => onRerunProposal(proposal)}
            onCancel={() => setProposalVisible(false)}
          />
        );
      }
      return (
        <>
          {running && dotMeta ? (
            <>
              <FirstPassDotGrid meta={dotMeta} />
              <EuiSpacer size="m" />
            </>
          ) : null}
          {indicatorsCards}
          {running ? null : (
            <>
              <EuiSpacer size="s" />
              <EuiLink onClick={onViewKnowledge} data-test-subj="proto11ViewKnowledge">
                View Knowledge Indicators
              </EuiLink>
            </>
          )}
        </>
      );
    }
    if (viewedStep.id === 'agent') {
      const label = toolLabel(tool);
      return (
        <>
          <div
            role="group"
            aria-label="Connect with"
            data-test-subj="proto11CodingTools"
            css={css`
              display: flex;
              flex-wrap: wrap;
              gap: ${euiTheme.size.xs};
            `}
          >
            {TOOLS.map((item) => {
              const selected = tool === item.id;
              return (
                <EuiButton
                  key={item.id}
                  size="s"
                  color="text"
                  iconType={item.icon}
                  aria-pressed={selected}
                  onClick={() => {
                    setTool(item.id);
                    setCopied(false);
                    setWaitingTool(null);
                  }}
                  css={css`
                    box-shadow: ${selected ? `inset 0 0 0 1px ${euiTheme.colors.primary}` : 'none'};
                  `}
                >
                  {item.label}
                </EuiButton>
              );
            })}
          </div>
          <EuiSpacer size="m" />
          {tool === 'agent' ? (
            <>
              <EuiText size="s">
                <p>
                  Add this index to an Elastic agent so it can retrieve these Knowledge Indicators.
                </p>
              </EuiText>
              {readOnly ? null : (
                <>
              <EuiSpacer size="s" />
              {actionFill ? (
                <EuiButton
                  size="s"
                  fill
                  iconType="productAgent"
                  onClick={onAddElasticAgent}
                  data-test-subj="proto11AddElasticAgent"
                >
                  Add to an Elastic agent
                </EuiButton>
              ) : (
                <EuiButtonEmpty
                  size="s"
                  iconType="productAgent"
                  onClick={onAddElasticAgent}
                  data-test-subj="proto11AddElasticAgent"
                >
                  Add to an Elastic agent
                </EuiButtonEmpty>
              )}
                </>
              )}
            </>
          ) : (
            <>
              <EuiText size="s">
                <p>
                  Paste one prompt. It connects your agent, turns on traces and memory, and checks
                  the link.
                </p>
              </EuiText>
              <EuiSpacer size="s" />
              <EuiText size="s">
                <p>
                  Memory: {scopeLabel(scope)} · {types.length > 0 ? types.join(', ') : 'None'} ·{' '}
                  <EuiPopover
                    aria-label="Change memory settings"
                    button={
                      <EuiLink
                        onClick={() => setMemoryOpen((open) => !open)}
                        data-test-subj="proto11MemoryChange"
                      >
                        Change
                      </EuiLink>
                    }
                    isOpen={memoryOpen}
                    closePopover={() => setMemoryOpen(false)}
                    panelPaddingSize="m"
                  >
                    <EuiFormRow label="Scope">
                      <EuiButtonGroup
                        legend="Memory scope"
                        type="single"
                        buttonSize="compressed"
                        idSelected={scope}
                        onChange={(id) => setScope(id as MemoryScope)}
                        options={[
                          { id: 'me', label: 'Just me' },
                          { id: 'team', label: 'Team' },
                        ]}
                      />
                    </EuiFormRow>
                    <EuiSpacer size="s" />
                    {MEMORY_TYPES.map((type) => (
                      <div key={type}>
                        <EuiCheckbox
                          id={`proto11-memory-type-${type}`}
                          label={type}
                          checked={types.includes(type)}
                          onChange={() =>
                            setTypes((current) =>
                              current.includes(type)
                                ? current.filter((item) => item !== type)
                                : [...current, type]
                            )
                          }
                        />
                      </div>
                    ))}
                  </EuiPopover>
                  <EuiIconTip
                    content="Defaults follow the Memory PRD, to be confirmed"
                    aria-label="Defaults follow the Memory PRD, to be confirmed"
                    position="top"
                    anchorProps={{
                      css: css`
                        margin-left: ${euiTheme.size.xs};
                        vertical-align: text-bottom;
                      `,
                    }}
                  />
                </p>
              </EuiText>
              <EuiSpacer size="s" />
              <div
                data-test-subj="proto11CodingPrompt"
                css={css`
                  font-family: ${euiTheme.font.familyCode ?? euiTheme.font.family};
                  font-size: 12px;
                  line-height: 1.5;
                  white-space: pre-wrap;
                  overflow-wrap: anywhere;
                  background: ${euiTheme.colors.backgroundBaseSubdued};
                  border-radius: ${euiTheme.border.radius.small};
                  padding: ${euiTheme.size.m};
                  opacity: ${copied ? 0.55 : 1};
                  @media (prefers-reduced-motion: no-preference) {
                    transition: opacity 200ms ease-out;
                  }
                `}
              >
                <Highlighted text={prompt} tokens={highlightTokens} />
              </div>
              {readOnly ? null : (
                <>
              <EuiSpacer size="s" />
              <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
                <EuiFlexItem grow={false}>
                  {actionFill && !copied ? (
                    <EuiButton
                      size="s"
                      fill
                      onClick={copyPrompt}
                      data-test-subj="proto11CopyPrompt"
                    >
                      Copy prompt
                    </EuiButton>
                  ) : (
                    <EuiButtonEmpty
                      size="s"
                      onClick={copyPrompt}
                      isDisabled={copied}
                      data-test-subj="proto11CopyPrompt"
                    >
                      {copied ? 'Copied' : 'Copy prompt'}
                    </EuiButtonEmpty>
                  )}
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiLink href={apiKeysHref} target="_blank" data-test-subj="proto11CreateApiKey">
                    Create an API key
                  </EuiLink>
                </EuiFlexItem>
              </EuiFlexGroup>
              {waitingTool ? (
                <>
                  <EuiSpacer size="s" />
                  <EuiFlexGroup
                    gutterSize="s"
                    alignItems="center"
                    responsive={false}
                    data-test-subj="proto11CodingWait"
                  >
                    <EuiFlexItem grow={false}>
                      <span
                        css={css`
                          display: inline-block;
                          width: 8px;
                          height: 8px;
                          border-radius: 8px;
                          background: ${euiTheme.colors.primary};
                          @media (prefers-reduced-motion: no-preference) {
                            animation: ${pulse} 1.4s ease-in-out infinite;
                          }
                        `}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="s">
                        <p>Waiting for {label} to call Context…</p>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </>
              ) : null}
              <EuiSpacer size="s" />
              <EuiLink
                color="subdued"
                onClick={simulate}
                data-test-subj="proto11SimulateConnection"
              >
                Simulate connection (demo)
              </EuiLink>
                </>
              )}
            </>
          )}
        </>
      );
    }
    if (viewedStep.id === 'traces') {
      if (readOnly) {
        const traces = namespace.traces ?? [];
        return traces.length === 0 ? (
          <EuiText size="s" color="subdued">
            <p>No traces yet.</p>
          </EuiText>
        ) : (
          <EuiText size="s">
            {traces.map((trace) => (
              <p key={`${trace.type}-${trace.value}`}>{trace.value}</p>
            ))}
          </EuiText>
        );
      }
      const dirty = JSON.stringify(tracesDraft) !== JSON.stringify(namespace.traces ?? []);
      return (
        <>
          {namespace.proto11?.tracesViaPrompt ? (
            <>
              <EuiText size="s" color="subdued">
                <p>Traces are on from the prompt.</p>
              </EuiText>
              <EuiSpacer size="s" />
            </>
          ) : null}
          <AgentTracesPanel
            bare
            traces={tracesDraft}
            onChange={setTracesDraft}
            accordionId="proto11-setup-traces"
            description={null}
          />
          <EuiSpacer size="s" />
          {actionFill ? (
            <EuiButton
              size="s"
              fill
              onClick={() => onSaveTraces(tracesDraft)}
              isDisabled={!dirty}
              data-test-subj="proto11SetupSaveTraces"
            >
              Save
            </EuiButton>
          ) : (
            <EuiButtonEmpty size="s" onClick={() => onSaveTraces(tracesDraft)} isDisabled={!dirty}>
              Save
            </EuiButtonEmpty>
          )}
        </>
      );
    }
    const memoryLine = namespace.proto11?.firstMemoryLine || SAMPLE_MEMORY;
    return (
      <>
        <EuiText size="s">
          <p>Your agent saves its first memory while it works.</p>
        </EuiText>
        <EuiSpacer size="s" />
        <EuiPanel hasBorder paddingSize="s" data-test-subj="proto11MemoryPreview">
          <EuiBadge color="hollow">Episodic</EuiBadge>
          <EuiSpacer size="xs" />
          <EuiText size="s">
            <p>{memoryLine}</p>
          </EuiText>
        </EuiPanel>
      </>
    );
  };

  return (
    <EuiPanel hasBorder paddingSize="none" data-test-subj="proto11Onboarding">
      <div
        css={css`
          display: grid;
          grid-template-columns: 230px minmax(0, 1fr);
          @media (max-width: 1000px) {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <div
          css={css`
            background: ${euiTheme.colors.backgroundBaseSubdued};
            padding: ${euiTheme.size.l};
          `}
        >
          <EuiText size="s">
            <p data-test-subj="proto11OnboardingCount">
              Setup · {doneCount} of {steps.length}
            </p>
          </EuiText>
          <EuiSpacer size="s" />
          <div
            data-test-subj="proto11OnboardingProgress"
            css={css`
              height: 3px;
              border-radius: 3px;
              background: ${euiTheme.colors.emptyShade};
              overflow: hidden;
            `}
          >
            <div
              css={css`
                height: 100%;
                width: ${steps.length === 0 ? 0 : (doneCount / steps.length) * 100}%;
                background: ${euiTheme.colors.primary};
                @media (prefers-reduced-motion: no-preference) {
                  transition: width 400ms ease-out;
                }
              `}
            />
          </div>
          <EuiSpacer size="m" />
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: ${euiTheme.size.xs};
            `}
          >
            {steps.map((step) => {
              const current = step.id === currentId;
              const selected = step.id === viewed;
              const result = stepResult(step, namespace);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setViewed(step.id)}
                  data-test-subj={`proto11SetupStep-${step.id}`}
                  aria-current={current ? 'step' : undefined}
                  css={css`
                    display: flex;
                    gap: ${euiTheme.size.s};
                    align-items: flex-start;
                    width: 100%;
                    text-align: left;
                    border: none;
                    cursor: pointer;
                    color: ${current || selected || step.done
                      ? euiTheme.colors.text
                      : euiTheme.colors.textSubdued};
                    background: ${current || selected ? euiTheme.colors.emptyShade : 'transparent'};
                    border-radius: ${euiTheme.border.radius.small};
                    padding: ${euiTheme.size.s};
                  `}
                >
                  <span
                    css={css`
                      flex: none;
                      width: 16px;
                      height: 16px;
                      margin-top: 2px;
                      border-radius: 16px;
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      box-sizing: border-box;
                      border: 1px solid
                        ${current ? euiTheme.colors.primary : euiTheme.colors.borderBaseSubdued};
                      box-shadow: ${current ? `0 0 0 2px ${euiTheme.colors.primary}` : 'none'};
                      background: ${step.done
                        ? euiTheme.colors.backgroundBaseSuccess
                        : 'transparent'};
                      @media (prefers-reduced-motion: no-preference) {
                        transition: background-color 200ms ease-out, border-color 200ms ease-out,
                          box-shadow 200ms ease-out;
                      }
                    `}
                  >
                    {step.done ? (
                      <EuiIcon type="check" size="s" color="success" aria-hidden={true} />
                    ) : null}
                  </span>
                  <span>
                    <span
                      css={css`
                        display: flex;
                        align-items: center;
                        gap: ${euiTheme.size.xs};
                        flex-wrap: wrap;
                      `}
                    >
                      {step.label}
                      {step.optional ? <EuiBadge color="hollow">Optional</EuiBadge> : null}
                    </span>
                    {result ? (
                      <span
                        css={css`
                          display: block;
                          color: ${euiTheme.colors.textSubdued};
                          font-size: 12px;
                          margin-top: 2px;
                        `}
                      >
                        {result}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          css={css`
            display: grid;
            grid-template-columns: minmax(0, 3fr) minmax(220px, 2fr);
            @media (max-width: 1000px) {
              grid-template-columns: minmax(0, 1fr);
            }
          `}
        >
          <div
            css={css`
              padding: ${euiTheme.size.l};
              min-width: 0;
            `}
          >
            {renderContent()}
          </div>
          <div
            data-test-subj="proto11OnboardingFeed"
            css={css`
              background: ${euiTheme.colors.backgroundBaseSubdued};
              padding: ${euiTheme.size.l};
              min-width: 0;
            `}
          >
            <EuiText size="s">
              <p>Live activity</p>
            </EuiText>
            <EuiSpacer size="s" />
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: ${euiTheme.size.s};
              `}
            >
              {visibleItems.map((item) => (
                <div key={item.id} data-test-subj={`proto11Activity-${item.id}`}>
                  <EuiFlexGroup gutterSize="s" alignItems="flexStart" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <span
                        css={css`
                          display: inline-block;
                          width: 8px;
                          height: 8px;
                          margin-top: 6px;
                          border-radius: 8px;
                          background: ${item.pulse
                            ? euiTheme.colors.primary
                            : euiTheme.colors.textSubdued};
                          @media (prefers-reduced-motion: no-preference) {
                            animation: ${item.pulse ? pulse : 'none'} 1.4s ease-in-out infinite;
                          }
                        `}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs">
                        <p>{item.text}</p>
                      </EuiText>
                      {item.memory ? (
                        <EuiPanel paddingSize="s" hasBorder={true} hasShadow={false}>
                          <EuiBadge color="hollow">Episodic</EuiBadge>
                          <EuiSpacer size="xs" />
                          <EuiText size="xs">
                            <p>{item.memory.line}</p>
                          </EuiText>
                          <EuiText size="xs" color="subdued">
                            <p>
                              from {item.memory.tool} · {item.time}
                            </p>
                          </EuiText>
                        </EuiPanel>
                      ) : (
                        <EuiText size="xs" color="subdued">
                          <p>{item.time}</p>
                        </EuiText>
                      )}
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </div>
              ))}
            </div>
            {hiddenCount > 0 ? (
              <>
                <EuiSpacer size="s" />
                <EuiLink onClick={() => setShowEarlier(true)} data-test-subj="proto11ShowEarlier">
                  Show earlier
                </EuiLink>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </EuiPanel>
  );
};
