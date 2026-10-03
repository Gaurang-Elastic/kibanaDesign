/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { elasticIndicators, type KnowledgeIndicator } from './knowledge_indicators';

export const MONITORING_AGENTS = [
  {
    id: 'support-triage-agent',
    label: 'support-triage-agent',
    aiIndexName: 'Elastic AI Index',
  },
  { id: 'kb-answer-agent', label: 'kb-answer-agent', aiIndexName: null },
  { id: 'escalation-router', label: 'escalation-router', aiIndexName: null },
] as const;

export const MONITORING_TIME_RANGES = [{ id: '7d', label: 'Last 7 days' }] as const;

export const MOCK_OTLP_ENDPOINT = 'https://otlp.example.elastic.local:443';
export const MOCK_MONITORING_API_KEY = 'am_proto_not-a-real-key_demo-only';
export const MOCK_MONITORING_API_KEY_MASKED = 'am_proto_••••••••••••••••';

export type MonitoringFrameworkId =
  | 'claudeCode'
  | 'claudeSdk'
  | 'langchain'
  | 'vercel'
  | 'openai'
  | 'otlp';

export interface MonitoringFramework {
  id: MonitoringFrameworkId;
  label: string;
  note: string;
  installLabel: string;
  install: string;
  wireLanguage: string;
  wire: string;
}

export const MONITORING_FRAMEWORKS: MonitoringFramework[] = [
  {
    id: 'claudeCode',
    label: 'Claude Code',
    note: 'Captures prompts, tool calls, and completion status from the Claude Code session.',
    installLabel: 'One-line install',
    install: 'claude mcp add elastic-agent-monitoring',
    wireLanguage: 'bash',
    wire: `export ELASTIC_OTLP_ENDPOINT="${MOCK_OTLP_ENDPOINT}"
export ELASTIC_API_KEY="<api-key>"
claude mcp add elastic-agent-monitoring --env ELASTIC_OTLP_ENDPOINT --env ELASTIC_API_KEY`,
  },
  {
    id: 'claudeSdk',
    label: 'Claude Agent SDK',
    note: 'Wraps the SDK client so every tool loop and model call is exported as a GenAI span.',
    installLabel: 'One-line install',
    install: 'npm install @elastic/agent-monitoring',
    wireLanguage: 'typescript',
    wire: `import { ElasticAgentMonitor } from '@elastic/agent-monitoring';

const monitor = new ElasticAgentMonitor({
  endpoint: process.env.ELASTIC_OTLP_ENDPOINT,
  apiKey: process.env.ELASTIC_API_KEY,
});
monitor.wrapClaudeAgent(agent);`,
  },
  {
    id: 'langchain',
    label: 'LangChain / LangGraph',
    note: 'A callback handler records chains, tools, and token usage on each graph step.',
    installLabel: 'One-line install',
    install: 'pip install elastic-agent-monitoring',
    wireLanguage: 'python',
    wire: `from elastic_agent_monitoring import ElasticCallbackHandler

handler = ElasticCallbackHandler(
    endpoint=os.environ["ELASTIC_OTLP_ENDPOINT"],
    api_key=os.environ["ELASTIC_API_KEY"],
)
agent.invoke(prompt, config={"callbacks": [handler]})`,
  },
  {
    id: 'vercel',
    label: 'Vercel AI SDK',
    note: 'Telemetry middleware records streamText calls, tool invocations, and TTFT.',
    installLabel: 'One-line install',
    install: 'npm install @elastic/agent-monitoring',
    wireLanguage: 'typescript',
    wire: `import { elasticTelemetry } from '@elastic/agent-monitoring/vercel';

const result = streamText({
  model,
  prompt,
  experimental_telemetry: elasticTelemetry(),
});`,
  },
  {
    id: 'openai',
    label: 'OpenAI / Agents SDK',
    note: 'Traces Runner steps, function tools, and model generations over OTLP.',
    installLabel: 'One-line install',
    install: 'pip install elastic-agent-monitoring',
    wireLanguage: 'python',
    wire: `from agents import Runner
from elastic_agent_monitoring import ElasticTracingProcessor

Runner.run_sync(
    agent,
    input=user_msg,
    tracing_processors=[ElasticTracingProcessor()],
)`,
  },
  {
    id: 'otlp',
    label: 'Any agent (OTLP)',
    note: 'Any OpenTelemetry SDK can export GenAI spans to this endpoint. No language SDK required.',
    installLabel: 'One-line install',
    install: 'export OTEL_EXPORTER_OTLP_ENDPOINT="' + MOCK_OTLP_ENDPOINT + '"',
    wireLanguage: 'bash',
    wire: `export OTEL_EXPORTER_OTLP_ENDPOINT="${MOCK_OTLP_ENDPOINT}"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey <api-key>"
export OTEL_SERVICE_NAME="support-triage-agent"`,
  },
];

export interface MetricTile {
  id: string;
  label: string;
  value: string;
  secondary: string;
  delta?: string;
  /** True when the change is desirable, independent of sign. */
  deltaGood?: boolean;
}

export const FLEET_METRIC_TILES: MetricTile[] = [
  {
    id: 'traces',
    label: 'Traces',
    value: '1,284',
    secondary: '183 per day',
    delta: '+12% vs prior 7d',
    deltaGood: true,
  },
  {
    id: 'tokens-cost',
    label: 'Tokens and cost',
    value: '4.8M',
    secondary: '$186.40',
    delta: '+8%',
    deltaGood: false,
  },
  {
    id: 'latency',
    label: 'p50 latency TTLT',
    value: '2.4s',
    secondary: 'p95 8.1s',
    delta: '+410ms',
    deltaGood: false,
  },
  {
    id: 'fallback',
    label: 'Fallback to raw',
    value: '18%',
    secondary: 'of retrievals · P1 KI utilization',
  },
];

export interface DataStreamRow {
  id: string;
  name: string;
  docs: string;
  size: string;
  opens: 'traces' | 'discover';
}

export const GENERATED_DATA_STREAMS: DataStreamRow[] = [
  {
    id: 'traces',
    name: 'traces-agent.support-triage-agent-default',
    docs: '1,284 docs',
    size: '48 MB',
    opens: 'traces',
  },
  {
    id: 'metrics',
    name: 'metrics-agent.support-triage-agent-default',
    docs: '9,412 docs',
    size: '12 MB',
    opens: 'discover',
  },
  {
    id: 'logs',
    name: 'logs-agent.support-triage-agent-default',
    docs: '3,088 docs',
    size: '6.4 MB',
    opens: 'discover',
  },
  {
    id: 'judge-relevance',
    name: 'metrics-judge.answer_relevance-default',
    docs: '1,284 docs',
    size: '2.1 MB',
    opens: 'discover',
  },
  {
    id: 'judge-completion',
    name: 'metrics-judge.task_completion-default',
    docs: '1,284 docs',
    size: '1.8 MB',
    opens: 'discover',
  },
];

export interface DashboardCard {
  id: string;
  title: string;
  description: string;
  panels: number;
}

export const GENERATED_DASHBOARDS: DashboardCard[] = [
  {
    id: 'overview',
    title: 'Agent overview',
    description: 'Trace volume, success rate, and judge scores for the selected agent.',
    panels: 8,
  },
  {
    id: 'cost',
    title: 'Token and cost explorer',
    description: 'Token in/out and estimated cost by model, user, and task type.',
    panels: 6,
  },
  {
    id: 'latency',
    title: 'Latency and TTFT',
    description: 'Time to first token and time to last token, with p50 and p95.',
    panels: 6,
  },
  {
    id: 'quality',
    title: 'Response quality',
    description: 'Answer relevance and task completion distributions from the judges.',
    panels: 5,
  },
];

export interface BarRow {
  id: string;
  label: string;
  primary: string;
  secondary?: string;
  pct: number;
}

export const TOKEN_BARS: Record<string, BarRow[]> = {
  model: [
    { id: 'gpt-4.1', label: 'gpt-4.1', primary: '2.6M tokens', secondary: '$124.10', pct: 78 },
    { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', primary: '1.5M tokens', secondary: '$42.20', pct: 45 },
    { id: 'embed-small', label: 'text-embedding-3-small', primary: '0.7M tokens', secondary: '$20.10', pct: 22 },
  ],
  agent: [
    { id: 'support', label: 'support-triage-agent', primary: '3.4M tokens', secondary: '$141.00', pct: 86 },
    { id: 'kb', label: 'kb-answer-agent', primary: '0.9M tokens', secondary: '$31.20', pct: 28 },
    { id: 'esc', label: 'escalation-router', primary: '0.5M tokens', secondary: '$14.20', pct: 16 },
  ],
  user: [
    { id: 'maya', label: 'maya@acme', primary: '1.1M tokens', secondary: '$48.60', pct: 52 },
    { id: 'jon', label: 'jon@acme', primary: '0.8M tokens', secondary: '$33.10', pct: 38 },
    { id: 'queue', label: 'support-queue bot', primary: '2.9M tokens', secondary: '$104.70', pct: 90 },
  ],
  task: [
    { id: 'billing', label: 'Billing / refunds', primary: '1.6M tokens', secondary: '$71.40', pct: 62 },
    { id: 'howto', label: 'How-to / runbooks', primary: '1.4M tokens', secondary: '$54.10', pct: 54 },
    { id: 'status', label: 'Ticket status', primary: '1.1M tokens', secondary: '$38.90', pct: 42 },
    { id: 'other', label: 'Other (inferred)', primary: '0.7M tokens', secondary: '$22.00', pct: 22 },
  ],
};

export const LATENCY_BARS: Record<string, BarRow[]> = {
  agent: [
    { id: 'support', label: 'support-triage-agent', primary: 'TTLT 2.6s', secondary: 'TTFT 420ms', pct: 70 },
    { id: 'kb', label: 'kb-answer-agent', primary: 'TTLT 1.8s', secondary: 'TTFT 310ms', pct: 48 },
    { id: 'esc', label: 'escalation-router', primary: 'TTLT 3.9s', secondary: 'TTFT 510ms', pct: 92 },
  ],
  model: [
    { id: 'gpt-4.1', label: 'gpt-4.1', primary: 'TTLT 2.9s', secondary: 'TTFT 480ms', pct: 76 },
    { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', primary: 'TTLT 1.6s', secondary: 'TTFT 280ms', pct: 42 },
  ],
  task: [
    { id: 'billing', label: 'Billing / refunds', primary: 'TTLT 4.8s', secondary: 'TTFT 610ms', pct: 94 },
    { id: 'howto', label: 'How-to / runbooks', primary: 'TTLT 2.1s', secondary: 'TTFT 360ms', pct: 52 },
    { id: 'status', label: 'Ticket status', primary: 'TTLT 1.4s', secondary: 'TTFT 240ms', pct: 34 },
  ],
};

export interface JudgeCard {
  id: string;
  name: string;
  metric: string;
  score: string;
  averagedOver: string;
  model: string;
  buckets: BarRow[];
  yaml: string;
}

export const PREBUILT_JUDGES: JudgeCard[] = [
  {
    id: 'answer-relevance',
    name: 'Answer relevance',
    metric: 'Relevance',
    score: '3.8 / 5',
    averagedOver: 'Averaged over 1,284 judged traces in the last 7 days.',
    model: 'gpt-4.1-mini',
    buckets: [
      { id: 'good', label: 'Good (4 to 5)', primary: '730', pct: 57 },
      { id: 'mixed', label: 'Mixed (3)', primary: '287', pct: 22 },
      { id: 'poor', label: 'Poor (1 to 2)', primary: '267', pct: 21 },
    ],
    yaml: `name: answer-relevance
enabled: true
type: llm-as-a-judge
trigger: trace.completed
model: gpt-4.1-mini
temperature: 0.1
input:
  user_request: "{{trace.user_request}}"
  final_response: "{{trace.final_response}}"
  retrieved_docs: "{{trace.retrieval.docs}}"
prompt: |
  Score how relevant the final response is to the user request
  from 1 (not relevant) to 5 (fully relevant). Cite missing facts.
output_index: metrics-judge.answer_relevance-default
`,
  },
  {
    id: 'task-completion',
    name: 'Task completion',
    metric: 'Completion',
    score: '71%',
    averagedOver: 'Pass/fail over 1,284 judged traces in the last 7 days.',
    model: 'gpt-4.1-mini',
    buckets: [
      { id: 'pass', label: 'Complete', primary: '912', pct: 71 },
      { id: 'fail', label: 'Incomplete', primary: '372', pct: 29 },
    ],
    yaml: `name: task-completion
enabled: true
type: llm-as-a-judge
trigger: trace.completed
model: gpt-4.1-mini
temperature: 0.0
input:
  user_request: "{{trace.user_request}}"
  final_response: "{{trace.final_response}}"
  tools_used: "{{trace.tools}}"
prompt: |
  Did the agent complete the user's requested task? Reply pass or fail.
  Fail if a required step is missing (refund amount, owner, SLA).
output_index: metrics-judge.task_completion-default
`,
  },
];

const kiTypeLabel = (type: KnowledgeIndicator['type']) =>
  type === 'FAQ' ? 'FAQ' : `${type.charAt(0)}${type.slice(1).toLowerCase()}`;

export interface KiUsageRow {
  id: string;
  title: string;
  type: string;
  indexName: string;
  retrievals: number;
  used: number;
}

const ELASTIC_INDEX_LABEL = 'Elastic AI Index';

const elasticUsageRanked: KiUsageRow[] = [...elasticIndicators]
  .map((ki) => {
    const retrievals = ki.evidenceCount ?? 0;
    return {
      id: ki.id,
      title: ki.title,
      type: kiTypeLabel(ki.type),
      indexName: ELASTIC_INDEX_LABEL,
      retrievals,
      used: Math.round(retrievals * 0.62),
    };
  })
  .sort((a, b) => b.retrievals - a.retrievals);

export const KI_USAGE_TOP: KiUsageRow[] = elasticUsageRanked.slice(0, 5);

export const KI_USAGE_NEVER: KiUsageRow[] = [...elasticUsageRanked]
  .sort((a, b) => a.retrievals - b.retrievals)
  .slice(0, 2)
  .map((row) => ({ ...row, retrievals: 0, used: 0 }));

export const KI_USAGE_STATS = {
  fallbackToRaw: '18%',
  usedVsReturned: '62%',
  retrievalErrors: '3.1%',
  neverSurfacedLabel: `${KI_USAGE_NEVER.length} of ${elasticIndicators.length}`,
};

export type SpanKind = 'agent' | 'llm' | 'tool' | 'retrieval';

export interface TraceSpan {
  id: string;
  name: string;
  kind: SpanKind;
  depth: number;
  startPct: number;
  widthPct: number;
  duration: string;
  error?: boolean;
  meta: string;
}

export interface MonitoringTrace {
  id: string;
  status: 'ok' | 'error';
  taskType: string;
  timestamp: string;
  userRequest: string;
  finalResponse: string;
  agent: string;
  model: string;
  team: string;
  duration: string;
  tokens: string;
  cost: string;
  relevance: number;
  completion: 'pass' | 'fail';
  story: 'refund' | 'error' | 'slow' | 'expensive' | 'ok';
  spans: TraceSpan[];
}

const refundSpans: TraceSpan[] = [
  {
    id: 's1',
    name: 'agent.run',
    kind: 'agent',
    depth: 0,
    startPct: 0,
    widthPct: 100,
    duration: '3.1s',
    meta: 'support-triage-agent',
  },
  {
    id: 's2',
    name: 'retrieval.search',
    kind: 'retrieval',
    depth: 1,
    startPct: 8,
    widthPct: 28,
    duration: '0.86s',
    meta: 'Needed refund policy was not in the results (top hit: SLA window FAQ)',
  },
  {
    id: 's3',
    name: 'llm.generate',
    kind: 'llm',
    depth: 1,
    startPct: 40,
    widthPct: 52,
    duration: '1.6s',
    meta: 'gpt-4.1 · 1,840 in to 220 out',
  },
];

const errorSpans: TraceSpan[] = [
  {
    id: 'e1',
    name: 'agent.run',
    kind: 'agent',
    depth: 0,
    startPct: 0,
    widthPct: 100,
    duration: '1.9s',
    error: true,
    meta: 'support-triage-agent',
  },
  {
    id: 'e2',
    name: 'tool.zendesk.lookup_ticket',
    kind: 'tool',
    depth: 1,
    startPct: 12,
    widthPct: 40,
    duration: '0.74s',
    error: true,
    meta: '429 Too Many Requests · no fallback',
  },
  {
    id: 'e3',
    name: 'llm.generate',
    kind: 'llm',
    depth: 1,
    startPct: 58,
    widthPct: 34,
    duration: '0.62s',
    meta: 'gpt-4.1-mini · 620 in to 80 out',
  },
];

const slowSpans: TraceSpan[] = [
  {
    id: 'l1',
    name: 'agent.run',
    kind: 'agent',
    depth: 0,
    startPct: 0,
    widthPct: 100,
    duration: '8.4s',
    meta: 'support-triage-agent',
  },
  {
    id: 'l2',
    name: 'retrieval.search attempt 1',
    kind: 'retrieval',
    depth: 1,
    startPct: 4,
    widthPct: 22,
    duration: '0.91s',
    meta: 'confidence 0.41',
  },
  {
    id: 'l3',
    name: 'retrieval.search attempt 2',
    kind: 'retrieval',
    depth: 1,
    startPct: 28,
    widthPct: 24,
    duration: '0.98s',
    meta: 'confidence 0.47',
  },
  {
    id: 'l4',
    name: 'retrieval.search attempt 3',
    kind: 'retrieval',
    depth: 1,
    startPct: 54,
    widthPct: 22,
    duration: '1.02s',
    meta: 'confidence 0.49 · still missing refund policy',
  },
  {
    id: 'l5',
    name: 'llm.generate',
    kind: 'llm',
    depth: 1,
    startPct: 78,
    widthPct: 20,
    duration: '1.4s',
    meta: 'gpt-4.1 · 2,100 in to 190 out',
  },
];

const expensiveSpans: TraceSpan[] = [
  {
    id: 'c1',
    name: 'agent.run',
    kind: 'agent',
    depth: 0,
    startPct: 0,
    widthPct: 100,
    duration: '4.2s',
    meta: 'support-triage-agent',
  },
  {
    id: 'c2',
    name: 'llm.generate (full history)',
    kind: 'llm',
    depth: 1,
    startPct: 10,
    widthPct: 82,
    duration: '3.4s',
    meta: 'gpt-4.1 · 28,400 in to 310 out · re-sent full history',
  },
];

const okSpans: TraceSpan[] = [
  {
    id: 'o1',
    name: 'agent.run',
    kind: 'agent',
    depth: 0,
    startPct: 0,
    widthPct: 100,
    duration: '1.6s',
    meta: 'support-triage-agent',
  },
  {
    id: 'o2',
    name: 'retrieval.search',
    kind: 'retrieval',
    depth: 1,
    startPct: 8,
    widthPct: 30,
    duration: '0.42s',
    meta: 'hit: SLA window FAQ',
  },
  {
    id: 'o3',
    name: 'llm.generate',
    kind: 'llm',
    depth: 1,
    startPct: 42,
    widthPct: 50,
    duration: '0.88s',
    meta: 'gpt-4.1-mini · 940 in to 160 out',
  },
];

export const MONITORING_TRACES: MonitoringTrace[] = [
  {
    id: 'trc-8f2a91c0',
    status: 'ok',
    taskType: 'Billing / refunds',
    timestamp: 'Today 14:12',
    userRequest: 'How do I refund an order that is 12 days old?',
    finalResponse:
      'Refunds are only issued inside the 30-day SLA window. I could not find the next step after that.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    team: 'Support',
    duration: '3.1s',
    tokens: '2,060',
    cost: '$0.19',
    relevance: 3,
    completion: 'fail',
    story: 'refund',
    spans: refundSpans,
  },
  {
    id: 'trc-1b77e204',
    status: 'error',
    taskType: 'Ticket status',
    timestamp: 'Today 13:48',
    userRequest: 'What is the status of ticket 18442?',
    finalResponse: 'The ticket lookup tool failed (429). I cannot check status right now.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1-mini',
    team: 'Support',
    duration: '1.9s',
    tokens: '700',
    cost: '$0.04',
    relevance: 2,
    completion: 'fail',
    story: 'error',
    spans: errorSpans,
  },
  {
    id: 'trc-55c0aa18',
    status: 'ok',
    taskType: 'Billing / refunds',
    timestamp: 'Today 12:03',
    userRequest: 'Can I get store credit if the refund window passed?',
    finalResponse: 'I searched three times but did not find a store-credit policy.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    team: 'Support',
    duration: '8.4s',
    tokens: '2,290',
    cost: '$0.22',
    relevance: 2,
    completion: 'fail',
    story: 'slow',
    spans: slowSpans,
  },
  {
    id: 'trc-90de33ab',
    status: 'ok',
    taskType: 'How-to / runbooks',
    timestamp: 'Yesterday 18:41',
    userRequest: 'Walk me through regenerating an expired API key, including what we said last week.',
    finalResponse: 'Revoke the old key, issue a new one, and notify the customer.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    team: 'Support',
    duration: '4.2s',
    tokens: '28,710',
    cost: '$4.10',
    relevance: 4,
    completion: 'pass',
    story: 'expensive',
    spans: expensiveSpans,
  },
  {
    id: 'trc-c11e02f6',
    status: 'ok',
    taskType: 'How-to / runbooks',
    timestamp: 'Yesterday 11:20',
    userRequest: 'How do I escalate a severity-1 ticket?',
    finalResponse: 'Escalate to the owning queue within 15 minutes and attach the account ID.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1-mini',
    team: 'Support',
    duration: '1.6s',
    tokens: '1,100',
    cost: '$0.06',
    relevance: 5,
    completion: 'pass',
    story: 'ok',
    spans: okSpans,
  },
  {
    id: 'trc-aa0192b3',
    status: 'ok',
    taskType: 'Ticket status',
    timestamp: 'Yesterday 09:04',
    userRequest: 'Is ticket 19001 still in the priority queue?',
    finalResponse: 'Yes. Priority queues take precedence over backlog.',
    agent: 'kb-answer-agent',
    model: 'gpt-4.1-mini',
    team: 'Support',
    duration: '1.2s',
    tokens: '860',
    cost: '$0.05',
    relevance: 4,
    completion: 'pass',
    story: 'ok',
    spans: okSpans,
  },
  {
    id: 'trc-bb20cd44',
    status: 'ok',
    taskType: 'Billing / refunds',
    timestamp: '2 days ago 16:15',
    userRequest: 'What is the refund SLA?',
    finalResponse: 'Do not issue refunds outside the 30-day SLA window without manager approval.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    team: 'Support',
    duration: '2.0s',
    tokens: '1,240',
    cost: '$0.11',
    relevance: 5,
    completion: 'pass',
    story: 'ok',
    spans: okSpans,
  },
  {
    id: 'trc-cc33de55',
    status: 'error',
    taskType: 'Ticket status',
    timestamp: '2 days ago 10:02',
    userRequest: 'Pull the latest note on ticket 17701.',
    finalResponse: 'Lookup timed out. No fallback was configured.',
    agent: 'support-triage-agent',
    model: 'gpt-4.1-mini',
    team: 'Support',
    duration: '2.4s',
    tokens: '540',
    cost: '$0.03',
    relevance: 1,
    completion: 'fail',
    story: 'error',
    spans: errorSpans,
  },
  {
    id: 'trc-dd44ef66',
    status: 'ok',
    taskType: 'How-to / runbooks',
    timestamp: '3 days ago 15:33',
    userRequest: 'Where is the runbook for expired API keys?',
    finalResponse: 'Regenerate an expired API key: revoke the old key, issue a new one, notify the customer.',
    agent: 'kb-answer-agent',
    model: 'gpt-4.1-mini',
    team: 'Docs',
    duration: '1.5s',
    tokens: '990',
    cost: '$0.05',
    relevance: 5,
    completion: 'pass',
    story: 'ok',
    spans: okSpans,
  },
  {
    id: 'trc-ee55fa77',
    status: 'ok',
    taskType: 'Other (inferred)',
    timestamp: '3 days ago 08:11',
    userRequest: 'Who owns billing disputes after 48 hours?',
    finalResponse: 'Hand off unresolved billing disputes to finance with the account ID attached.',
    agent: 'escalation-router',
    model: 'gpt-4.1',
    team: 'Support',
    duration: '2.2s',
    tokens: '1,480',
    cost: '$0.13',
    relevance: 4,
    completion: 'pass',
    story: 'ok',
    spans: okSpans,
  },
];

export const TRACE_LIST_TOTAL = 1284;

export const DASHBOARD_SERIES: Record<string, number[]> = {
  overview: [40, 48, 44, 62, 70, 66, 78],
  cost: [22, 28, 31, 30, 38, 42, 47],
  latency: [18, 20, 19, 28, 34, 32, 41],
  quality: [72, 74, 73, 70, 68, 69, 71],
};

export const TRACE_ANALYSIS_GREETING =
  'I have the last 7 days of traces for this agent, plus token, latency, and both judge scores. Ask what is failing, slow, or expensive.';

export const TRACE_ANALYSIS_QUESTIONS = [
  {
    label: 'Why are billing tasks marked incomplete?',
    answer:
      '372 of 1,284 traces fail task completion (29%). 188 of those are billing/refunds. The agent states the 30-day window but never tells the user to issue store credit. Retrieval on trc-8f2a91c0 returned an SLA FAQ, not the refund playbook, so the judge fails the missing next step. I can draft a POLICY Knowledge Indicator for the store-credit path if you want.',
  },
  {
    label: 'What is driving the p95 latency regression?',
    answer:
      'p95 TTLT is 8.1s, up 2.6s vs the prior 7 days. The slow traces (example trc-55c0aa18, 8.4s) run three retrieval attempts with confidence 0.41, 0.47, then 0.49. The needed refund policy is still missing, so retries add ~900ms each and never resolve. I can draft a PLAYBOOK Knowledge Indicator so retrieval can hit a distilled step instead of looping.',
  },
  {
    label: 'Which task types cost most, and why?',
    answer:
      'Billing/refunds is $71.40 of $186.40 (inferred from the opening prompt). The outlier is trc-90de33ab at $4.10: the model call re-sent 28,400 input tokens of full conversation history instead of a summary (median is $0.15). I can draft a FACT Knowledge Indicator that summarizes the thread so the next turn stays small.',
  },
];

export const TRACE_ANALYSIS_FALLBACK =
  'I would trace and cluster the failing spans for that question, then rank root causes by judge fail rate. This prototype only has canned answers for the three suggested questions.';
