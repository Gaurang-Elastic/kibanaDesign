/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useState } from 'react';
import {
  EuiBadge,
  EuiBasicTable,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCallOut,
  EuiCode,
  EuiCodeBlock,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiHealth,
  EuiLink,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiStat,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTextArea,
  EuiTitle,
} from '@elastic/eui';
import type { EuiBasicTableColumn } from '@elastic/eui';
import type { CoreStart } from '@kbn/core/public';
import { AI_AGENT_ICON, type ContextAgentSeed } from './ai_agent';
import {
  setMonitoringTracesConnected,
  tracesConnected$,
} from './agent_monitoring_state';
import {
  DASHBOARD_SERIES,
  FLEET_METRIC_TILES,
  GENERATED_DASHBOARDS,
  GENERATED_DATA_STREAMS,
  KI_USAGE_NEVER,
  KI_USAGE_STATS,
  KI_USAGE_TOP,
  LATENCY_BARS,
  MOCK_MONITORING_API_KEY,
  MOCK_MONITORING_API_KEY_MASKED,
  MOCK_OTLP_ENDPOINT,
  MONITORING_AGENTS,
  MONITORING_FRAMEWORKS,
  MONITORING_TIME_RANGES,
  MONITORING_TRACES,
  PREBUILT_JUDGES,
  TOKEN_BARS,
  TRACE_ANALYSIS_FALLBACK,
  TRACE_ANALYSIS_GREETING,
  TRACE_ANALYSIS_QUESTIONS,
  TRACE_LIST_TOTAL,
  type BarRow,
  type KiUsageRow,
  type MonitoringFrameworkId,
  type MonitoringTrace,
  type SpanKind,
} from './agent_monitoring_data';

type InnerTab = 'overview' | 'integration';
type DrillView = 'main' | 'traces' | 'trace' | 'dashboard';
type TokenDim = 'model' | 'agent' | 'user' | 'task';
type LatencyDim = 'agent' | 'model' | 'task';

const TOKEN_DIMS: Array<{ id: TokenDim; label: string }> = [
  { id: 'model', label: 'By model' },
  { id: 'agent', label: 'By agent' },
  { id: 'user', label: 'By user' },
  { id: 'task', label: 'By task type' },
];

const LATENCY_DIMS: Array<{ id: LatencyDim; label: string }> = [
  { id: 'agent', label: 'By agent' },
  { id: 'model', label: 'By model' },
  { id: 'task', label: 'By task type' },
];

const TASK_TYPE_NOTE =
  'Task type is inferred from the opening user prompt by a classifier span.';

const copyText = async (value: string, onOk: (text: string) => void, onFail: () => void) => {
  try {
    await navigator.clipboard.writeText(value);
    onOk('Copied.');
  } catch {
    onFail();
  }
};

const BarRows = ({ rows }: { rows: BarRow[] }) => (
  <div className="contextEnginePrototype__amBarList">
    {rows.map((row) => (
      <div key={row.id} className="contextEnginePrototype__amBarRow">
        <EuiText size="xs">
          <strong>{row.label}</strong>
        </EuiText>
        <div className="contextEnginePrototype__amBarTrack" aria-hidden={true}>
          <div
            className="contextEnginePrototype__amBarFill"
            style={{ width: `${row.pct}%` }}
          />
        </div>
        <EuiText size="xs" color="subdued">
          {row.primary}
          {row.secondary ? ` · ${row.secondary}` : ''}
        </EuiText>
      </div>
    ))}
  </div>
);

const SparkArea = ({ values }: { values: number[] }) => {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - (value / max) * 92;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="contextEnginePrototype__amSpark"
      aria-hidden={true}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
};

const spanKindLabel = (kind: SpanKind) => {
  if (kind === 'llm') return 'LLM';
  if (kind === 'retrieval') return 'retrieval';
  return kind;
};

export const AgentMonitoringSurface = ({
  coreStart,
  onBuildContextEngine,
  onAnalyzeWithAgent,
}: {
  coreStart: CoreStart;
  onBuildContextEngine: () => void;
  onAnalyzeWithAgent: (seed: ContextAgentSeed) => void;
}) => {
  const [tracesConnected, setTracesConnected] = useState(tracesConnected$.value);
  const [agentId, setAgentId] = useState<string>(MONITORING_AGENTS[0].id);
  const [timeRange, setTimeRange] = useState('7d');
  const [frameworkId, setFrameworkId] = useState<MonitoringFrameworkId>('claudeCode');
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [innerTab, setInnerTab] = useState<InnerTab>(
    tracesConnected$.value ? 'overview' : 'integration'
  );
  const [drill, setDrill] = useState<DrillView>('main');
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [tokenDim, setTokenDim] = useState<TokenDim>('model');
  const [latencyDim, setLatencyDim] = useState<LatencyDim>('agent');
  const [judgeFlyoutOpen, setJudgeFlyoutOpen] = useState(false);
  const [selectedJudgeId, setSelectedJudgeId] = useState(PREBUILT_JUDGES[0].id);
  const [judgeYamlById, setJudgeYamlById] = useState<Record<string, string>>(() =>
    Object.fromEntries(PREBUILT_JUDGES.map((judge) => [judge.id, judge.yaml]))
  );
  const [savedYamlById, setSavedYamlById] = useState<Record<string, string>>(() =>
    Object.fromEntries(PREBUILT_JUDGES.map((judge) => [judge.id, judge.yaml]))
  );

  const agentMeta = MONITORING_AGENTS.find((item) => item.id === agentId);
  const agentLabel = agentMeta?.label ?? agentId;
  const agentHasAiIndex = Boolean(agentMeta?.aiIndexName);
  const framework =
    MONITORING_FRAMEWORKS.find((item) => item.id === frameworkId) ?? MONITORING_FRAMEWORKS[0];
  const selectedTrace =
    MONITORING_TRACES.find((item) => item.id === selectedTraceId) ?? MONITORING_TRACES[0];
  const selectedDashboard =
    GENERATED_DASHBOARDS.find((item) => item.id === selectedDashboardId) ??
    GENERATED_DASHBOARDS[0];
  const selectedJudge =
    PREBUILT_JUDGES.find((item) => item.id === selectedJudgeId) ?? PREBUILT_JUDGES[0];
  const judgeYaml = judgeYamlById[selectedJudge.id] ?? selectedJudge.yaml;
  const judgeDirty = judgeYaml !== (savedYamlById[selectedJudge.id] ?? selectedJudge.yaml);

  useEffect(() => {
    const sub = tracesConnected$.subscribe((connected) => {
      setTracesConnected(connected);
      if (!connected) {
        setDrill('main');
        setInnerTab('integration');
        setJudgeFlyoutOpen(false);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const toast = (text: string) => {
    coreStart.notifications.toasts.addSuccess(text);
  };

  const copy = (value: string, ok: string) => {
    void copyText(
      value,
      () => toast(ok),
      () => coreStart.notifications.toasts.addWarning('Could not copy.')
    );
  };

  const openJudgeFlyout = (judgeId: string) => {
    setSelectedJudgeId(judgeId);
    setJudgeFlyoutOpen(true);
  };

  const headlineTiles = FLEET_METRIC_TILES.map((tile) => {
    if (tile.id === 'fallback' && !agentHasAiIndex) {
      return {
        ...tile,
        value: 'No data',
        secondary: 'Not retrieving from an AI index',
        delta: undefined,
      };
    }
    return tile;
  });

  const kiUsageColumns: Array<EuiBasicTableColumn<KiUsageRow>> = [
    {
      field: 'title',
      name: 'Knowledge Indicator',
      render: (title: string, row: KiUsageRow) => (
        <EuiLink
          onClick={() => toast(`Would open "${title}" in ${row.indexName}.`)}
        >
          {title}
        </EuiLink>
      ),
    },
    { field: 'type', name: 'Type', width: '110px' },
    { field: 'indexName', name: 'AI index' },
    { field: 'retrievals', name: 'Retrievals', width: '110px' },
    { field: 'used', name: 'Used', width: '90px' },
  ];

  const goOverview = () => {
    setDrill('main');
    setInnerTab('overview');
    setSelectedTraceId(null);
    setSelectedDashboardId(null);
  };

  const ingestPanel = (
    <EuiPanel hasBorder paddingSize="m">
      <EuiText size="xs" color="subdued">
        <strong>Ingest endpoint</strong>
      </EuiText>
      <EuiSpacer size="s" />
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem>
          <EuiCode className="contextEnginePrototype__mono">{MOCK_OTLP_ENDPOINT}</EuiCode>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            iconType="copyClipboard"
            onClick={() => copy(MOCK_OTLP_ENDPOINT, 'OTLP endpoint copied.')}
          >
            Copy
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <EuiText size="xs" color="subdued">
        <strong>API key</strong>
      </EuiText>
      <EuiSpacer size="s" />
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem>
          <EuiCode className="contextEnginePrototype__mono">
            {apiKeyRevealed ? MOCK_MONITORING_API_KEY : MOCK_MONITORING_API_KEY_MASKED}
          </EuiCode>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonIcon
            iconType={apiKeyRevealed ? 'eyeClosed' : 'eye'}
            aria-label={apiKeyRevealed ? 'Hide API key' : 'Reveal API key'}
            onClick={() => setApiKeyRevealed((current) => !current)}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty
            size="s"
            iconType="copyClipboard"
            onClick={() => copy(MOCK_MONITORING_API_KEY, 'API key copied.')}
          >
            Copy
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );

  const installSnippets = (
    <>
      <EuiButtonGroup
        legend="Agent framework"
        type="single"
        options={MONITORING_FRAMEWORKS.map((item) => ({
          id: item.id,
          label: item.label,
        }))}
        idSelected={frameworkId}
        onChange={(id) => setFrameworkId(id as MonitoringFrameworkId)}
      />
      <EuiSpacer size="m" />
      <EuiText size="xs" color="subdued">
        {framework.note}
      </EuiText>
      <EuiSpacer size="m" />
      <EuiText size="xs">
        <strong>{framework.installLabel}</strong>
      </EuiText>
      <EuiSpacer size="xs" />
      <EuiCodeBlock language="bash" isCopyable paddingSize="m">
        {framework.install}
      </EuiCodeBlock>
      <EuiSpacer size="m" />
      <EuiText size="xs">
        <strong>Wire it up</strong>
        {` · ${framework.wireLanguage}`}
      </EuiText>
      <EuiSpacer size="xs" />
      <EuiCodeBlock language={framework.wireLanguage} isCopyable paddingSize="m">
        {framework.wire}
      </EuiCodeBlock>
      <EuiSpacer size="m" />
      {ingestPanel}
    </>
  );

  const simulateTracesButton = (
    <EuiButton
      fill
      onClick={() => {
        setMonitoringTracesConnected(true);
        setDrill('main');
        setInnerTab('overview');
        toast('Traces are flowing. Data streams and dashboards were generated automatically.');
      }}
      data-test-subj="contextEngineSimulateTraces"
    >
      Simulate incoming traces
    </EuiButton>
  );

  const integrationBody = (
    <>
      {tracesConnected ? (
        <>
          <EuiTitle size="s">
            <h2>Integration</h2>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            Traces are flowing from {agentLabel}. Use these snippets to connect another agent or
            framework.
          </EuiText>
        </>
      ) : (
        <EuiCallOut
          className="contextEnginePrototype__amEmptyCallout"
          title="No agents are sending traces yet"
          color="primary"
          iconType="info"
        >
          Complete the integration below and traces appear within a few minutes.
        </EuiCallOut>
      )}
      <EuiSpacer size="m" />
      {installSnippets}
      <EuiSpacer size="m" />
      {simulateTracesButton}
    </>
  );

  const selectorRow = (
    <EuiFlexGroup alignItems="center" gutterSize="m" wrap>
      <EuiFlexItem grow={false}>
        <EuiSelect
          compressed
          options={MONITORING_AGENTS.map((item) => ({ value: item.id, text: item.label }))}
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
          aria-label="Agent"
        />
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiSelect
          compressed
          options={MONITORING_TIME_RANGES.map((item) => ({ value: item.id, text: item.label }))}
          value={timeRange}
          onChange={(event) => setTimeRange(event.target.value)}
          aria-label="Time range"
        />
      </EuiFlexItem>
      {tracesConnected && drill === 'main' && innerTab === 'overview' ? (
        <EuiFlexItem grow={false}>
          <EuiButton
            size="s"
            color="text"
            iconType={AI_AGENT_ICON}
            onClick={() =>
              onAnalyzeWithAgent({
                kind: 'trace-analysis',
                contextChip: `Agent monitoring · ${agentLabel}`,
                userMessage: 'Analyze the recent traces for this agent.',
                greeting: TRACE_ANALYSIS_GREETING,
                suggestedQuestions: TRACE_ANALYSIS_QUESTIONS,
                fallbackAnswer: TRACE_ANALYSIS_FALLBACK,
              })
            }
          >
            Analyze with agent
          </EuiButton>
        </EuiFlexItem>
      ) : null}
    </EuiFlexGroup>
  );

  const overviewConnected = (
    <>
      <EuiHealth color="success">
        Traces flowing · {agentLabel} · Last 7 days
      </EuiHealth>
      <EuiSpacer size="m" />
      <EuiFlexGrid columns={4} gutterSize="m">
        {headlineTiles.map((tile) => (
          <EuiFlexItem key={tile.id}>
            <EuiPanel hasBorder paddingSize="m">
              <EuiStat title={tile.value} description={tile.label} titleSize="s" />
              <EuiText size="xs" color="subdued">
                {tile.secondary}
              </EuiText>
              {tile.delta ? (
                <EuiText
                  size="xs"
                  color={tile.deltaGood === false ? 'danger' : 'success'}
                >
                  {tile.delta}
                </EuiText>
              ) : null}
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGrid>

      <EuiSpacer size="l" />
      <EuiPanel hasBorder paddingSize="l">
        <EuiTitle size="xs">
          <h3>Knowledge Indicator usage</h3>
        </EuiTitle>
        {agentHasAiIndex ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              How often this agent retrieved Knowledge Indicators versus falling back to raw data.
            </EuiText>
            <EuiSpacer size="m" />
            <EuiFlexGroup gutterSize="none" responsive={false} wrap>
              <EuiFlexItem>
                <EuiStat
                  title={KI_USAGE_STATS.fallbackToRaw}
                  description="Fallback to raw"
                  titleSize="s"
                  textAlign="left"
                />
                <EuiText size="xs" color="subdued">
                  Retrievals that still scanned raw data
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiStat
                  title={KI_USAGE_STATS.usedVsReturned}
                  description="Used vs returned"
                  titleSize="s"
                  textAlign="left"
                />
                <EuiText size="xs" color="subdued">
                  Returned KIs the agent cited
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiStat
                  title={KI_USAGE_STATS.retrievalErrors}
                  description="Retrieval errors"
                  titleSize="s"
                  textAlign="left"
                />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiStat
                  title={KI_USAGE_STATS.neverSurfacedLabel}
                  description="KIs never surfaced"
                  titleSize="s"
                  textAlign="left"
                />
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="m" />
            <EuiText size="xs">
              <strong>Top retrieved</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiBasicTable
              items={KI_USAGE_TOP}
              columns={kiUsageColumns}
              tableCaption="Top five Knowledge Indicators by retrieval count"
            />
            <EuiSpacer size="m" />
            <EuiText size="xs">
              <strong>Never retrieved</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiBasicTable
              items={KI_USAGE_NEVER}
              columns={kiUsageColumns}
              tableCaption="Knowledge Indicators never retrieved"
            />
          </>
        ) : (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s">
              This agent is not retrieving from an AI index yet.
            </EuiText>
            <EuiSpacer size="m" />
            <EuiButton size="s" color="text" onClick={onBuildContextEngine}>
              Build my context engine
            </EuiButton>
          </>
        )}
      </EuiPanel>

      <EuiSpacer size="l" />
      <EuiPanel hasBorder paddingSize="l">
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
          <EuiFlexItem>
            <EuiTitle size="xs">
              <h3>Generated from your traces</h3>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">Auto-generated</EuiBadge>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          Traces are normalized into OpenTelemetry GenAI conventions, then rolled up into data
          streams and dashboards.
        </EuiText>
        <EuiSpacer size="m" />
        <EuiFlexGroup gutterSize="l">
          <EuiFlexItem>
            <EuiText size="xs">
              <strong>Data streams</strong>
            </EuiText>
            <EuiSpacer size="s" />
            {GENERATED_DATA_STREAMS.map((stream) => (
              <button
                key={stream.id}
                type="button"
                className="contextEnginePrototype__amStreamRow"
                onClick={() => {
                  if (stream.opens === 'traces') {
                    setDrill('traces');
                    return;
                  }
                  toast('Would open in Discover.');
                }}
              >
                <EuiCode>{stream.name}</EuiCode>
                <EuiText size="xs" color="subdued">
                  {stream.docs} · {stream.size}
                </EuiText>
              </button>
            ))}
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiText size="xs">
              <strong>Dashboards</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiFlexGrid columns={2} gutterSize="s">
              {GENERATED_DASHBOARDS.map((card) => (
                <EuiFlexItem key={card.id}>
                  <EuiPanel
                    hasBorder
                    paddingSize="s"
                    className="contextEnginePrototype__amDashCard"
                    onClick={() => {
                      setSelectedDashboardId(card.id);
                      setDrill('dashboard');
                    }}
                  >
                    <EuiText size="s">
                      <strong>{card.title}</strong>
                    </EuiText>
                    <EuiText size="xs" color="subdued">
                      {card.description}
                    </EuiText>
                    <EuiText size="xs" color="subdued">
                      {card.panels} panels
                    </EuiText>
                  </EuiPanel>
                </EuiFlexItem>
              ))}
            </EuiFlexGrid>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>

      <EuiSpacer size="l" />
      <EuiPanel hasBorder paddingSize="l">
        <EuiTitle size="xs">
          <h3>Token usage and cost</h3>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiTabs size="s">
          {TOKEN_DIMS.map((dim) => (
            <EuiTab
              key={dim.id}
              isSelected={tokenDim === dim.id}
              onClick={() => setTokenDim(dim.id)}
            >
              {dim.label}
            </EuiTab>
          ))}
        </EuiTabs>
        <EuiSpacer size="m" />
        {tokenDim === 'task' ? (
          <>
            <EuiText size="xs" color="subdued">
              {TASK_TYPE_NOTE}
            </EuiText>
            <EuiSpacer size="s" />
          </>
        ) : null}
        <BarRows rows={TOKEN_BARS[tokenDim]} />
      </EuiPanel>

      <EuiSpacer size="l" />
      <EuiPanel hasBorder paddingSize="l">
        <EuiTitle size="xs">
          <h3>Latency</h3>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiTabs size="s">
          {LATENCY_DIMS.map((dim) => (
            <EuiTab
              key={dim.id}
              isSelected={latencyDim === dim.id}
              onClick={() => setLatencyDim(dim.id)}
            >
              {dim.label}
            </EuiTab>
          ))}
        </EuiTabs>
        <EuiSpacer size="m" />
        {latencyDim === 'task' ? (
          <>
            <EuiText size="xs" color="subdued">
              {TASK_TYPE_NOTE}
            </EuiText>
            <EuiSpacer size="s" />
          </>
        ) : null}
        <BarRows rows={LATENCY_BARS[latencyDim]} />
      </EuiPanel>

      <EuiSpacer size="l" />
      <EuiPanel hasBorder paddingSize="l">
        <EuiTitle size="xs">
          <h3>Judgements</h3>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="xs" color="subdued">
          Pre-built judges run as workflows, clone and edit the prompt.
        </EuiText>
        <EuiSpacer size="m" />
        <EuiFlexGroup gutterSize="m">
          {PREBUILT_JUDGES.map((judge) => (
            <EuiFlexItem key={judge.id}>
              <EuiPanel hasBorder paddingSize="m">
                <EuiText size="xs" color="subdued">
                  LLM-as-a-judge
                </EuiText>
                <EuiTitle size="s">
                  <h4>{judge.score}</h4>
                </EuiTitle>
                <EuiText size="s">
                  <strong>{judge.name}</strong>
                </EuiText>
                <EuiText size="xs" color="subdued">
                  {judge.averagedOver}
                </EuiText>
                <EuiSpacer size="s" />
                <BarRows rows={judge.buckets} />
                <EuiSpacer size="s" />
                <EuiText size="xs" color="subdued">
                  Judge model: {judge.model}
                </EuiText>
                <EuiSpacer size="s" />
                <EuiFlexGroup gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      flush="left"
                      onClick={() => openJudgeFlyout(judge.id)}
                    >
                      Edit judge
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      onClick={() => {
                        toast(`Would clone ${judge.name}.`);
                        openJudgeFlyout(judge.id);
                      }}
                    >
                      Clone
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiPanel>

      <EuiSpacer size="l" />
      <EuiPanel hasBorder paddingSize="l" color="subdued">
        <EuiTitle size="xs">
          <h3>Turn these traces into a context engine</h3>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiText size="s" color="subdued">
          These traces already show where agents lack grounding. Those failure modes become
          Knowledge Indicators an AI index can retrieve, so the next turn answers from knowledge
          instead of scanning raw data.
        </EuiText>
        <EuiSpacer size="m" />
        <EuiButton fill onClick={onBuildContextEngine}>
          Build my context engine
        </EuiButton>
      </EuiPanel>
    </>
  );

  const traceList = (
    <>
      <EuiButtonEmpty iconType="arrowLeft" flush="left" onClick={goOverview}>
        Back to overview
      </EuiButtonEmpty>
      <EuiSpacer size="s" />
      <EuiCode>traces-agent.{agentLabel}-default</EuiCode>
      <EuiText size="s" color="subdued">
        {agentLabel} · Last 7 days · Showing 10 of {TRACE_LIST_TOTAL.toLocaleString()}
      </EuiText>
      <EuiSpacer size="m" />
      <div className="contextEnginePrototype__amTraceTable" role="table">
        <div className="contextEnginePrototype__amTraceHead" role="row">
          <span>Trace</span>
          <span>Agent · Model</span>
          <span>Duration</span>
          <span>Cost</span>
          <span>Quality</span>
        </div>
        {MONITORING_TRACES.map((trace) => (
          <button
            key={trace.id}
            type="button"
            className="contextEnginePrototype__amTraceRow"
            onClick={() => {
              setSelectedTraceId(trace.id);
              setDrill('trace');
            }}
          >
            <span>
              <EuiHealth color={trace.status === 'error' ? 'danger' : 'success'}>
                <EuiCode>{trace.id}</EuiCode>
              </EuiHealth>
              <EuiBadge color="hollow">{trace.taskType}</EuiBadge>
              <EuiText size="xs" color="subdued">
                {trace.timestamp} · {trace.userRequest.slice(0, 64)}
                {trace.userRequest.length > 64 ? '...' : ''}
              </EuiText>
            </span>
            <span>
              <EuiText size="xs">
                {trace.agent}
                <br />
                {trace.model}
              </EuiText>
            </span>
            <span>
              <EuiText size="xs">
                {trace.duration}
                <br />
                {trace.tokens} tok
              </EuiText>
            </span>
            <span>
              <EuiText size="xs">{trace.cost}</EuiText>
            </span>
            <span>
              <EuiBadge color={trace.relevance >= 4 ? 'success' : 'warning'}>
                rel {trace.relevance}/5
              </EuiBadge>{' '}
              <EuiBadge color={trace.completion === 'pass' ? 'success' : 'danger'}>
                {trace.completion}
              </EuiBadge>
            </span>
          </button>
        ))}
      </div>
    </>
  );

  const traceDetail = (trace: MonitoringTrace) => (
    <>
      <EuiButtonEmpty iconType="arrowLeft" flush="left" onClick={() => setDrill('traces')}>
        Back to trace list
      </EuiButtonEmpty>
      <EuiSpacer size="s" />
      <EuiFlexGroup alignItems="center" gutterSize="s" wrap responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiHealth color={trace.status === 'error' ? 'danger' : 'success'}>
            <EuiCode>{trace.id}</EuiCode>
          </EuiHealth>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{trace.taskType}</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s" color="subdued">
        {trace.agent} · {trace.model} · {trace.team} · {trace.timestamp}
      </EuiText>
      <EuiSpacer size="m" />
      <EuiFlexGrid columns={4} gutterSize="m">
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="s">
            <EuiStat title={trace.duration} description="Duration" titleSize="s" />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="s">
            <EuiStat title={trace.tokens} description="Tokens" titleSize="s" />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="s">
            <EuiStat title={trace.cost} description="Cost" titleSize="s" />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="s">
            <EuiStat
              title={`${trace.relevance}/5`}
              description={`Judges · ${trace.completion}`}
              titleSize="s"
            />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGrid>
      <EuiSpacer size="m" />
      <EuiFlexGroup gutterSize="m">
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs" color="subdued">
              <strong>User request</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="s">{trace.userRequest}</EuiText>
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs" color="subdued">
              <strong>Final response</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="s">{trace.finalResponse}</EuiText>
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <EuiPanel hasBorder paddingSize="m">
        <EuiTitle size="xs">
          <h3>Span waterfall</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        {trace.spans.map((span) => (
          <div
            key={span.id}
            className="contextEnginePrototype__amSpan"
            style={{ paddingLeft: span.depth * 16 }}
          >
            <div className="contextEnginePrototype__amSpanMeta">
              <EuiBadge color={span.error ? 'danger' : 'hollow'}>
                {spanKindLabel(span.kind)}
              </EuiBadge>
              <EuiText size="s">
                <strong>{span.name}</strong>
                {span.error ? ' · error' : ''}
              </EuiText>
              <EuiText size="xs" color="subdued">
                {span.meta}
              </EuiText>
            </div>
            <div className="contextEnginePrototype__amSpanTrack">
              <div
                className={`contextEnginePrototype__amSpanBar contextEnginePrototype__amSpanBar--${
                  span.error ? 'error' : span.kind
                }`}
                style={{ left: `${span.startPct}%`, width: `${span.widthPct}%` }}
              />
            </div>
            <EuiText size="xs" className="contextEnginePrototype__amSpanDur">
              {span.duration}
            </EuiText>
          </div>
        ))}
      </EuiPanel>
    </>
  );

  const dashboardDetail = (
    <>
      <EuiButtonEmpty iconType="arrowLeft" flush="left" onClick={goOverview}>
        Back to overview
      </EuiButtonEmpty>
      <EuiSpacer size="s" />
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="s">
            <h2>{selectedDashboard.title}</h2>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">Auto-generated</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s" color="subdued">
        {selectedDashboard.description} · {agentLabel} · Last 7 days
      </EuiText>
      <EuiSpacer size="m" />
      <EuiFlexGrid columns={4} gutterSize="m">
        {FLEET_METRIC_TILES.slice(0, 4).map((tile) => (
          <EuiFlexItem key={tile.id}>
            <EuiPanel hasBorder paddingSize="s">
              <EuiStat title={tile.value} description={tile.label} titleSize="s" />
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGrid>
      <EuiSpacer size="m" />
      <EuiFlexGrid columns={2} gutterSize="m">
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs">
              <strong>Trend · last 7 days</strong>
            </EuiText>
            <SparkArea values={DASHBOARD_SERIES[selectedDashboard.id] ?? DASHBOARD_SERIES.overview} />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs">
              <strong>Breakdown</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <BarRows
              rows={
                selectedDashboard.id === 'latency'
                  ? LATENCY_BARS.task
                  : selectedDashboard.id === 'quality'
                    ? PREBUILT_JUDGES[0].buckets
                    : TOKEN_BARS.task
              }
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs">
              <strong>Volume</strong>
            </EuiText>
            <SparkArea values={[30, 36, 34, 50, 58, 54, 66]} />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs">
              <strong>By model</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <BarRows rows={TOKEN_BARS.model} />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGrid>
    </>
  );

  const judgesFlyout = judgeFlyoutOpen ? (
    <EuiFlyout
      ownFocus
      size="l"
      onClose={() => setJudgeFlyoutOpen(false)}
      aria-labelledby="context-engine-judge-flyout-title"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id="context-engine-judge-flyout-title">Judges</h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <EuiFlexGroup alignItems="flexStart" gutterSize="l">
          <EuiFlexItem grow={false} className="contextEnginePrototype__amJudgeList">
            {PREBUILT_JUDGES.map((judge) => (
              <EuiPanel
                key={judge.id}
                hasBorder
                paddingSize="s"
                color={selectedJudgeId === judge.id ? 'subdued' : 'plain'}
                className="contextEnginePrototype__amJudgeCard"
                onClick={() => setSelectedJudgeId(judge.id)}
              >
                <EuiText size="s">
                  <strong>{judge.name}</strong>
                </EuiText>
                <EuiText size="xs" color="subdued">
                  {judge.metric} · {judge.score}
                </EuiText>
              </EuiPanel>
            ))}
            <EuiButtonEmpty
              size="s"
              iconType="plus"
              onClick={() => toast('Would create a new judge from a clone.')}
            >
              + New judge
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiCallOut
              size="s"
              className="contextEnginePrototype__amEmptyCallout"
              title="Two judges run on every completed trace. Clone either one to build a variant."
            >
              Pre-built judges run as workflows on trace.completed.
            </EuiCallOut>
            <EuiSpacer size="m" />
            <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
              <EuiFlexItem>
                <EuiTitle size="xs">
                  <h3>{selectedJudge.name}</h3>
                </EuiTitle>
                <EuiText size="xs" color={judgeDirty ? 'warning' : 'success'}>
                  {judgeDirty ? 'Unsaved changes' : 'Saved'}
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiFlexGroup gutterSize="s" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      onClick={() => toast(`Would clone ${selectedJudge.name}.`)}
                    >
                      Clone
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton
                      size="s"
                      fill
                      disabled={!judgeDirty}
                      onClick={() => {
                        setSavedYamlById((current) => ({
                          ...current,
                          [selectedJudge.id]: judgeYaml,
                        }));
                        toast('Judge workflow saved.');
                      }}
                    >
                      Save
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiTextArea
              fullWidth
              rows={18}
              value={judgeYaml}
              onChange={(event) =>
                setJudgeYamlById((current) => ({
                  ...current,
                  [selectedJudge.id]: event.target.value,
                }))
              }
              aria-label={`${selectedJudge.name} workflow YAML`}
              className="contextEnginePrototype__mono"
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => setJudgeFlyoutOpen(false)}>Close</EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlyoutFooter>
    </EuiFlyout>
  ) : null;

  let body: React.ReactNode = integrationBody;
  if (tracesConnected) {
    if (drill === 'traces') body = traceList;
    else if (drill === 'trace') body = traceDetail(selectedTrace);
    else if (drill === 'dashboard') body = dashboardDetail;
    else if (innerTab === 'integration') body = integrationBody;
    else body = overviewConnected;
  }

  return (
    <div data-test-subj="contextEngineAgentMonitoring">
      {tracesConnected ? (
        <>
          {selectorRow}
          <EuiSpacer size="m" />
        </>
      ) : null}
      {tracesConnected && drill === 'main' ? (
        <>
          <EuiButtonGroup
            className="contextEnginePrototype__viewSwitch"
            legend="Agent monitoring views"
            type="single"
            buttonSize="compressed"
            options={[
              { id: 'overview', label: 'Overview' },
              { id: 'integration', label: 'Integration' },
            ]}
            idSelected={innerTab}
            onChange={(id) => setInnerTab(id as InnerTab)}
          />
          <EuiSpacer size="m" />
        </>
      ) : null}
      {body}
      {judgesFlyout}
    </div>
  );
};
