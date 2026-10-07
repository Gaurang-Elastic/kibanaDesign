/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import confluenceLogo from './assets/confluence.svg';
import {
  indicatorSourceLabel,
  slugify,
  statsFromIndicators,
  type KnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import {
  backingIndexName,
  workflowYamlFor,
  type Automation,
  type AutomationStep,
  type IndexTrace,
  type Namespace,
  type NamespaceSource,
} from './namespace_data';
import type {
  Proto11AddonRun,
  Proto11ChatTurn,
  Proto11ConnectGuide,
  Proto11FixChat,
  Proto11GoalId,
  Proto11Meta,
  Proto11SampleScenario,
  Proto11SourceId,
  Proto11TemplateId,
} from './proto11_types';

export const PROTO11_TICK_MS = 1400;
export const FIRST_PASS_TICKS = 10;
const FULL_RUN_TICKS = 5;
const RERUN_TICKS = 4;
const NOTE_TICKS = 4;
const SAMPLE_SHARE = 0.6;
const PROTO11_TIMESTAMP = '2026-10-02T17:40:00.000Z';

export const SAMPLE_INDEX_NAME = 'sample-web-ops';

// ---------- sources ----------

interface WebOpsSource {
  id: Proto11SourceId;
  name: string;
  kind: 'Index' | 'Connector';
  summary: string;
  /** Regex sources. The first one that matches is quoted back in "because" sentences. */
  keywords: string[];
  /** Index fields that still have no guide. Document connectors omit this. */
  fields?: number;
}

export const WEB_OPS_SOURCES: WebOpsSource[] = [
  {
    id: 'nginx-access',
    name: 'logs-nginx.access-default',
    kind: 'Index',
    summary: 'HTTP access logs from the public edge',
    keywords: ['nginx', 'access', 'http', 'traffic', 'latenc\\w*', 'checkout', '5xx', 'duration'],
    fields: 42,
  },
  {
    id: 'nginx-error',
    name: 'logs-nginx.error-default',
    kind: 'Index',
    summary: 'nginx error log lines',
    keywords: ['nginx', 'errors?', 'outages?'],
    fields: 18,
  },
  {
    id: 'cpu',
    name: 'metrics-system.cpu-default',
    kind: 'Index',
    summary: 'Host CPU metrics, every 10s',
    keywords: ['cpu', 'host\\w*', 'metrics?', 'saturat\\w*'],
    fields: 90,
  },
  {
    id: 'runbooks',
    name: 'SRE Runbooks',
    kind: 'Connector',
    summary: 'Team runbooks and on-call policies',
    keywords: ['runbooks?', 'docs?', 'documents?', 'on-call', 'oncall', 'polic\\w*', 'playbooks?'],
  },
  {
    id: 'k8s',
    name: 'logs-kubernetes.container-default',
    kind: 'Index',
    summary: 'Container stdout and stderr',
    keywords: ['kubernetes', 'k8s', 'containers?', 'pods?'],
    fields: 27,
  },
];

export const HIGHER_ED_SAMPLE_NAME = 'sample-higher-ed';
export const LARGE_SAMPLE_NAME = 'sample-large';

/** About 90 fields across the three indices. Values are invented. */
const HIGHER_ED_SOURCES: WebOpsSource[] = [
  {
    id: 'enrollment',
    name: 'enrollment-outcomes',
    kind: 'Index',
    summary: 'Cohort outcomes by programme, about 2,400 documents',
    keywords: ['enrol\\w*', 'graduat\\w*', 'retention', 'cohorts?', 'programmes?', 'outcomes?'],
    fields: 40,
  },
  {
    id: 'tuition',
    name: 'tuition-and-fees',
    kind: 'Index',
    summary: 'Tuition and mandatory fees by academic year, about 1,800 documents',
    keywords: ['tuition', 'fees?', 'costs?', 'prices?'],
    fields: 28,
  },
  {
    id: 'peers',
    name: 'peer-institutions',
    kind: 'Index',
    summary: 'Published rates and tuition for peer universities, about 2,800 documents',
    keywords: ['peers?', 'compar\\w*', 'institutions?', 'universit\\w*'],
    fields: 22,
  },
];

const sourceById = (id: Proto11SourceId) =>
  [...WEB_OPS_SOURCES, ...HIGHER_ED_SOURCES].find((source) => source.id === id) as WebOpsSource;

const RUNBOOKS_CONNECTOR_ID = 'sre-runbooks';
const TRACES_SOURCE_NAME = 'Agent traces';

export const toNamespaceSource = (source: WebOpsSource): NamespaceSource =>
  source.kind === 'Index'
    ? {
        id: `index-${source.name}`,
        name: source.name,
        subtitle: source.summary,
        typeLabel: 'Index',
        icon: 'database',
      }
    : {
        id: RUNBOOKS_CONNECTOR_ID,
        name: source.name,
        subtitle: 'Confluence connector',
        typeLabel: 'Connector',
        icon: confluenceLogo,
      };

const derivedFromUri = (source: Proto11SourceId | 'traces') => {
  if (source === 'traces') return 'traces://agent-traces';
  const found = sourceById(source);
  return found.kind === 'Index' ? `index://${found.name}` : `connector://${RUNBOOKS_CONNECTOR_ID}`;
};

// ---------- automation templates ----------

interface TemplateDef {
  title: string;
  description: string;
  scheduleLabel: string;
  steps: (reads: string[]) => AutomationStep[];
}

const joinList = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

export const TEMPLATES: Record<Proto11TemplateId, TemplateDef> = {
  overview: {
    title: 'Index overview',
    description: 'An overview, field guides and verified example queries for each index.',
    scheduleLabel: 'Scheduled to run every 5 minutes',
    steps: (reads) => [
      {
        name: 'read_mappings',
        explanation: `Reads the mapping and a sample of documents from ${joinList(reads)}.`,
      },
      {
        name: 'write_overviews',
        explanation: 'Writes an overview and field guides for each index.',
      },
      {
        name: 'verify_queries',
        explanation: 'Checks every ES|QL query before saving it. Failing queries are not saved.',
      },
    ],
  },
  xsource: {
    title: 'Cross-source map',
    description: 'Which source answers which kind of question, and the fields that join them.',
    scheduleLabel: 'Runs daily at 02:00',
    steps: (reads) => [
      {
        name: 'compare_fields',
        explanation: `Compares fields across ${joinList(
          reads
        )} to find join keys such as host.name.`,
      },
      {
        name: 'link_overviews',
        explanation: 'Links the overview Knowledge Indicators to each other with relates_to.',
      },
    ],
  },
  digest: {
    title: 'Document digest',
    description:
      'One Knowledge Indicator per runbook: when it applies, the steps, and who owns it.',
    scheduleLabel: 'Runs daily at 02:00',
    steps: (reads) => [
      { name: 'read_pages', explanation: `Reads pages from ${joinList(reads)}.` },
      {
        name: 'write_digests',
        explanation: 'Keeps Knowledge Indicators in sync when pages are edited.',
      },
    ],
  },
  profiles: {
    title: 'Entity profiles',
    description: 'A profile per service: traffic, error baseline, owning team, related hosts.',
    scheduleLabel: 'Runs daily at 02:00',
    steps: (reads) => [
      {
        name: 'find_services',
        explanation: `Finds services in service.name of ${joinList(reads)}.`,
      },
      {
        name: 'write_profiles',
        explanation: 'Writes one profile per service, top 12 by traffic.',
      },
    ],
  },
  gaps: {
    title: 'Learn from traces',
    description:
      'Finds questions your agent got wrong in its traces and writes Knowledge Indicators that answer them.',
    scheduleLabel: 'Runs when traces arrive',
    steps: (reads) => [
      { name: 'read_traces', explanation: `Reads recent traces from ${joinList(reads)}.` },
      {
        name: 'write_answers',
        explanation:
          'Writes a Knowledge Indicator for each recurring failure it can fix from your sources.',
      },
    ],
  },
};

// ---------- goals ----------

export interface GoalDef {
  id: Proto11GoalId;
  title: string;
  description: string;
  footer: string;
  icon: string;
  template: Proto11TemplateId;
  defaultSources: Proto11SourceId[];
  baseName: string;
  phrase: string;
}

const THREE_INDICES: Proto11SourceId[] = ['nginx-access', 'nginx-error', 'cpu'];

export const GOALS: GoalDef[] = [
  {
    id: 'indices',
    title: 'Understand my indices',
    description: 'What each index contains, what its fields mean, how to query it.',
    footer: 'Creates the Index overview automation.',
    icon: 'mapping',
    template: 'overview',
    defaultSources: THREE_INDICES,
    baseName: 'web-ops-indices',
    phrase: 'understanding your indices',
  },
  {
    id: 'multi',
    title: 'Use several sources well',
    description: 'Which source answers which question, and how they join.',
    footer: 'Creates the Cross-source map automation.',
    icon: 'layers',
    template: 'xsource',
    defaultSources: THREE_INDICES,
    baseName: 'web-ops-sources',
    phrase: 'using several sources well',
  },
  {
    id: 'docs',
    title: 'Reason over documents',
    description: 'Runbooks, policies and docs distilled into retrievable facts.',
    footer: 'Creates the Document digest automation.',
    icon: 'documents',
    template: 'digest',
    defaultSources: ['runbooks'],
    baseName: 'sre-runbooks',
    phrase: 'reasoning over documents',
  },
  {
    id: 'entities',
    title: 'Know key entities',
    description: 'Profiles of the hosts, services or customers it is asked about.',
    footer: 'Creates the Entity profiles automation.',
    icon: 'users',
    template: 'profiles',
    defaultSources: ['nginx-access'],
    baseName: 'service-profiles',
    phrase: 'knowing key entities',
  },
  {
    id: 'gaps',
    title: 'Fix where my agent struggled',
    description: 'Uses agent traces to find failed questions and answer them.',
    footer: 'Creates the Learn from traces automation.',
    icon: 'wrench',
    template: 'gaps',
    defaultSources: THREE_INDICES,
    baseName: 'web-ops-gaps',
    phrase: 'fixing where your agent struggled',
  },
];

export const goalById = (id: Proto11GoalId) => GOALS.find((goal) => goal.id === id) as GoalDef;

export const ELASTIC_AGENT_OPTIONS = [
  'Significant Events Judge',
  'web-ops-assistant',
  'loyalty-support-agent',
];
export const GENAI_TRACE_OPTIONS = ['traces-genai.otel-default'];

/** Agent Builder agent as listed in the composer's Agent picker, with its trace summary. */
export interface PickerAgent {
  name: string;
  /** Elastic-managed agents show the Elastic logo; custom agents show initials. */
  managed: boolean;
  failed: number;
  traces: number;
  traceSummary?: string;
}

const PICKER_AGENTS: PickerAgent[] = [
  {
    name: 'Significant Events Judge',
    managed: true,
    failed: 7,
    traces: 7,
    traceSummary: '7 failed in 7 days',
  },
  { name: 'web-ops-assistant', managed: false, failed: 4, traces: 4, traceSummary: '4 failed' },
  {
    name: 'Streams Investigator',
    managed: true,
    failed: 2,
    traces: 12,
    traceSummary: '12 questions, 2 failed',
  },
  { name: 'Elastic AI Agent', managed: true, failed: 0, traces: 0 },
  { name: 'Significant Events Discovery', managed: true, failed: 0, traces: 0 },
  { name: 'loyalty-support-agent', managed: false, failed: 0, traces: 0 },
];

const byName = (a: PickerAgent, b: PickerAgent) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Picker agents by failed questions, then total traces, then name; untraced agents split out. */
export const pickerAgents = (): { traced: PickerAgent[]; untraced: PickerAgent[] } => {
  const sorted = [...PICKER_AGENTS].sort(
    (a, b) => b.failed - a.failed || b.traces - a.traces || byName(a, b)
  );
  return {
    traced: sorted.filter((agent) => agent.traces > 0),
    untraced: sorted.filter((agent) => agent.traces === 0),
  };
};

export interface TraceQuestion {
  question: string;
  badge: string;
  /** Word quoted back in the proposal, for example "hosts". */
  topic: string;
  /** Failed runs. Undefined when the question succeeded but was slow. */
  failures?: number;
  sourceIds: Proto11SourceId[];
}

const TRACE_QUESTIONS: Record<string, TraceQuestion[]> = {
  'Significant Events Judge': [
    {
      question: 'Which hosts are saturated right now?',
      badge: 'failed 7 times',
      topic: 'hosts',
      failures: 7,
      sourceIds: ['cpu'],
    },
    {
      question: 'What broke after the last deploy?',
      badge: 'failed 4 times',
      topic: 'deploys',
      failures: 4,
      sourceIds: ['k8s', 'nginx-error'],
    },
    {
      question: 'Error rate for checkout-api',
      badge: 'slow, 6 steps',
      topic: 'checkout-api',
      sourceIds: ['nginx-access'],
    },
  ],
  'web-ops-assistant': [
    {
      question: 'Why is checkout-api returning 5xx?',
      badge: 'failed 5 times',
      topic: '5xx errors',
      failures: 5,
      sourceIds: ['nginx-access', 'nginx-error'],
    },
    {
      question: 'Which pods are crash looping?',
      badge: 'failed 3 times',
      topic: 'pods',
      failures: 3,
      sourceIds: ['k8s'],
    },
    {
      question: 'p95 latency for search-api',
      badge: 'slow, 5 steps',
      topic: 'latency',
      sourceIds: ['nginx-access'],
    },
  ],
  'Streams Investigator': [
    {
      question: 'Which streams changed their schema this week?',
      badge: 'failed 2 times',
      topic: 'stream schemas',
      failures: 2,
      sourceIds: ['k8s', 'nginx-error'],
    },
    {
      question: 'Error rate for checkout-api',
      badge: 'slow, 5 steps',
      topic: 'checkout-api',
      sourceIds: ['nginx-access'],
    },
  ],
  'traces-genai.otel-default': [
    {
      question: 'Who is on call for payments?',
      badge: 'failed 6 times',
      topic: 'on-call',
      failures: 6,
      sourceIds: ['runbooks'],
    },
    {
      question: 'Is CPU high on the checkout hosts?',
      badge: 'failed 2 times',
      topic: 'CPU',
      failures: 2,
      sourceIds: ['cpu'],
    },
    {
      question: 'Top paths by traffic today',
      badge: 'slow, 4 steps',
      topic: 'traffic',
      sourceIds: ['nginx-access'],
    },
  ],
};

export const traceQuestionsFor = (agent: string): TraceQuestion[] => TRACE_QUESTIONS[agent] ?? [];

// ---------- Knowledge Indicators (web-ops dataset) ----------

interface PortedKi {
  id: string;
  source: Proto11SourceId | 'traces';
  template: Proto11TemplateId;
  type: KnowledgeType;
  title: string;
  description: string;
  content: string;
  attributes: Record<string, unknown>;
  related: string[];
  /** Rejected by ES|QL verification on the first pass until Elastic AI Agent fixes the query. */
  rejected?: boolean;
}

const HAND_WRITTEN: PortedKi[] = [
  {
    id: 'ki-001',
    source: 'nginx-access',
    template: 'overview',
    type: 'index_metadata',
    title: 'logs-nginx.access-default index overview',
    description: 'HTTP access logs from the public nginx edge tier. One document per request.',
    content: [
      'Use this index to answer questions about traffic, latency and HTTP errors for public endpoints. Each document is one request.',
      '- http.response.status_code: numeric status. Use ranges, for example 500 to 599, for errors.',
      '- url.path: normalized path without query string. Prefer it over url.original for grouping.',
      '- event.duration: request latency in nanoseconds.',
      '- service.name: upstream service that handled the request.',
    ].join('\n'),
    attributes: {
      retention_days: 30,
      timestamp_field: '@timestamp',
      avg_docs_per_day: '1.6M',
      primary_entities: ['service.name', 'url.path'],
      tags: ['nginx', 'http', 'edge'],
      example_esql:
        'FROM logs-nginx.access-default\n| WHERE @timestamp > NOW() - 1 hour\n| STATS requests = COUNT(*) BY service.name\n| SORT requests DESC\n| LIMIT 10',
    },
    related: ['ki-002', 'ki-003', 'ki-010', 'ki-030', 'ki-040'],
  },
  {
    id: 'ki-002',
    source: 'nginx-access',
    template: 'overview',
    type: 'index_metadata',
    title: 'Querying HTTP 5xx error rates',
    description: 'How to compute error rates per service without double counting retries.',
    content:
      'Compute error rate as 5xx requests divided by all requests in the same bucket. Exclude user_agent.name: "HealthChecker". Health checks inflate totals by about 12%.',
    attributes: {
      metric: 'error_rate',
      unit: 'ratio',
      tags: ['errors', 'slo'],
      example_esql:
        'FROM logs-nginx.access-default\n| WHERE user_agent.name != "HealthChecker"\n| EVAL is_error = http.response.status_code >= 500\n| STATS error_rate = AVG(is_error::int) BY service.name, bucket = BUCKET(@timestamp, 5 minutes)',
    },
    related: ['ki-001', 'ki-020'],
  },
  {
    id: 'ki-003',
    source: 'nginx-access',
    template: 'overview',
    type: 'index_metadata',
    title: 'Field guide: url.path vs url.original',
    description: 'Which URL field to group by, and why.',
    content:
      'url.original includes query strings and has very high cardinality. Group by url.path; filter on url.original only when the user gives an exact URL.',
    attributes: {
      cardinality_url_path: '~1.2k',
      cardinality_url_original: '~3.4M',
      tags: ['fields'],
    },
    related: ['ki-001'],
  },
  {
    id: 'ki-010',
    source: 'cpu',
    template: 'overview',
    type: 'index_metadata',
    title: 'metrics-system.cpu-default index overview',
    description: 'Host CPU metrics sampled every 10s by Elastic Agent.',
    content:
      'Use for host saturation questions. system.cpu.total.norm.pct is normalized 0 to 1 across cores. Prefer it over system.cpu.total.pct. Join to web traffic via host.name.',
    attributes: {
      sample_interval: '10s',
      join_key: 'host.name',
      tags: ['metrics', 'hosts'],
      example_esql:
        'FROM metrics-system.cpu-default\n| STATS cpu = AVG(system.cpu.total.norm.pct) BY host.name\n| SORT cpu DESC\n| LIMIT 5',
    },
    related: ['ki-001'],
  },
  {
    id: 'ki-020',
    source: 'runbooks',
    template: 'digest',
    type: 'document',
    title: 'Runbook: elevated 5xx on checkout-api',
    description: 'Triage and mitigation steps when checkout-api error rate exceeds 2%.',
    content: [
      'When: checkout-api 5xx rate above 2% for 5 minutes.',
      '- Check upstream payments-gateway latency first. It caused 70% of past incidents.',
      '- If CPU on checkout hosts is above 0.85, scale the deployment to 6 replicas.',
      '- Page #payments-oncall if the error rate is still above 2% after 15 minutes.',
    ].join('\n'),
    attributes: {
      page_id: 'SRE-1142',
      last_edited: '2026-08-21',
      owner: 'payments-sre',
      tags: ['runbook', 'checkout'],
    },
    related: ['ki-002', 'ki-010', 'ki-040'],
  },
  {
    id: 'ki-030',
    source: 'nginx-error',
    template: 'overview',
    type: 'index_metadata',
    title: 'logs-nginx.error-default index overview',
    description: 'nginx error log lines: upstream timeouts, worker limits, TLS errors.',
    content:
      'One document per nginx error line. Use error.message for the text and log.level for severity. Correlate with access logs on host.name and time.',
    attributes: {
      severity_field: 'log.level',
      tags: ['nginx', 'errors'],
      example_esql:
        'FROM logs-nginx.error-default\n| STATS n = COUNT(*) BY log.level, error.message\n| SORT n DESC\n| LIMIT 10',
    },
    related: ['ki-001'],
    rejected: true,
  },
  {
    id: 'ki-040',
    source: 'nginx-access',
    template: 'profiles',
    type: 'unit_profile',
    title: 'Service profile: checkout-api',
    description: 'Traffic, error baseline and ownership for checkout-api.',
    content:
      'checkout-api handles about 18% of edge traffic. Normal 5xx rate is 0.3% to 0.6%; p95 latency is about 420 ms. Owned by payments-sre. Runs on hosts edge-checkout-01 to edge-checkout-06.',
    attributes: {
      service: 'checkout-api',
      owner: 'payments-sre',
      baseline_5xx: '0.3% to 0.6%',
      tags: ['service', 'checkout'],
      example_esql:
        'FROM logs-nginx.access-default\n| WHERE service.name == "checkout-api"\n| STATS p95 = PERCENTILE(event.duration, 95) BY bucket = BUCKET(@timestamp, 1 hour)',
    },
    related: ['ki-001', 'ki-020'],
  },
  {
    id: 'ki-050',
    source: 'traces',
    template: 'gaps',
    type: 'query_guide',
    title: 'Answering "which hosts are saturated?"',
    description: 'Your agent queried system.cpu.pct, which does not exist, 7 times last week.',
    content:
      'When asked about saturated or overloaded hosts, use system.cpu.total.norm.pct from metrics-system.cpu-default and treat values above 0.85 as saturated.',
    attributes: {
      failed_traces: 7,
      last_seen: 'yesterday',
      tags: ['gap', 'cpu'],
      example_esql:
        'FROM metrics-system.cpu-default\n| WHERE @timestamp > NOW() - 15 minutes\n| STATS cpu = AVG(system.cpu.total.norm.pct) BY host.name\n| WHERE cpu > 0.85',
    },
    related: ['ki-010'],
  },
  {
    id: 'ki-060',
    source: 'nginx-access',
    template: 'xsource',
    type: 'index_metadata',
    title: 'Joining web traffic to host CPU',
    description: 'logs-nginx.* and metrics-system.cpu-default join on host.name.',
    content:
      'To explain slow requests by host load, join on host.name and align time buckets. CPU is sampled every 10s, so use 1-minute buckets on both sides.',
    attributes: { join_key: 'host.name', bucket: '1m', tags: ['join'] },
    related: ['ki-001', 'ki-010'],
  },
];

const TYPE_FOR_TEMPLATE: Record<Proto11TemplateId, KnowledgeType> = {
  overview: 'index_metadata',
  digest: 'document',
  profiles: 'unit_profile',
  gaps: 'query_guide',
  xsource: 'index_metadata',
};

const CPU_REJECTED = new Set(['CPU by availability zone', 'CPU saturation thresholds']);

const FILLER: Array<{
  template: Proto11TemplateId;
  source: Proto11SourceId | 'traces';
  titles: string[];
}> = [
  {
    template: 'overview',
    source: 'nginx-access',
    titles: [
      'Field: http.request.method',
      'Field: client.geo.country_iso_code',
      'Field: event.duration (ns)',
      'Latency percentiles per endpoint',
      'Top paths by traffic',
      'Bot vs human traffic',
      'Field: http.response.body.bytes',
      'Field: source.ip',
      'Field: user_agent.name',
    ],
  },
  {
    template: 'overview',
    source: 'nginx-error',
    titles: [
      'Field guide: nginx error severities',
      'Upstream timeout patterns',
      'Worker connection limits',
      'TLS handshake failures',
      'Correlating errors with access logs',
    ],
  },
  {
    template: 'overview',
    source: 'cpu',
    titles: [
      'Field: system.cpu.cores',
      'Field: host.name',
      'CPU saturation thresholds',
      'Joining CPU to web traffic',
      'CPU by availability zone',
      'Field: system.cpu.total.norm.pct',
    ],
  },
  {
    template: 'overview',
    source: 'k8s',
    titles: [
      'logs-kubernetes.container-default index overview',
      'Field: kubernetes.pod.name',
      'Finding crash loops',
      'Field: kubernetes.namespace',
      'Field: container.image.name',
      'Restart counts per deployment',
    ],
  },
  {
    template: 'digest',
    source: 'runbooks',
    titles: [
      'Runbook: nginx worker exhaustion',
      'Runbook: certificate expiry',
      'Policy: on-call escalation',
      'Runbook: disk pressure on edge nodes',
      'Runbook: payments-gateway latency',
      'Runbook: rolling back a bad deploy',
      'Policy: incident severity levels',
      'Runbook: scaling checkout-api',
    ],
  },
  {
    template: 'profiles',
    source: 'nginx-access',
    titles: [
      'Service profile: payments-gateway',
      'Service profile: search-api',
      'Service profile: static-assets',
      'Service profile: auth-service',
    ],
  },
  {
    template: 'gaps',
    source: 'traces',
    titles: [
      'Answering "what broke after the last deploy?"',
      'Answering "error rate for one endpoint"',
    ],
  },
  {
    template: 'xsource',
    source: 'nginx-access',
    titles: ['Which source answers latency questions', 'Errors vs access logs: when to use which'],
  },
];

const sourceDisplayName = (source: Proto11SourceId | 'traces') =>
  source === 'traces' ? TRACES_SOURCE_NAME : sourceById(source).name;

const fillerKis: PortedKi[] = FILLER.flatMap(({ template, source, titles }) =>
  titles.map((title, index) => ({
    id: `ki-${template}-${source}-${index}`,
    source,
    template,
    type: TYPE_FOR_TEMPLATE[template],
    title,
    description: `Generated by the ${TEMPLATES[template].title} automation.`,
    content: `${title}. Written from ${sourceDisplayName(source)}.`,
    attributes: {},
    related: [],
    rejected:
      template === 'overview' &&
      (source === 'nginx-error' || (source === 'cpu' && CPU_REJECTED.has(title))),
  }))
);

const PORTED_KIS: PortedKi[] = [...HAND_WRITTEN, ...fillerKis];

// ---------- Knowledge Indicators (higher-ed sample) ----------

const HIGHER_ED_KIS: PortedKi[] = [
  {
    id: 'he-001',
    source: 'enrollment',
    template: 'overview',
    type: 'index_metadata',
    title: 'enrollment-outcomes index overview',
    description: 'Cohort outcomes by programme. One document per entry cohort, programme and year.',
    content: [
      'Use this index for retention and graduation questions. Each document is one entry cohort in one programme, measured at the end of an academic year.',
      '- cohort.entry_year: the year the cohort started. Graduation rates are reported against this year, not the year of measurement.',
      '- programme.name and programme.level: level is undergraduate or graduate.',
      '- outcome.grad_rate_4yr and outcome.grad_rate_6yr: ratios from 0 to 1. Multiply by 100 for a percentage.',
      '- outcome.retention_rate_y1: share of the cohort enrolled again in year two.',
    ].join('\n'),
    attributes: {
      doc_count: 2400,
      field_count: 30,
      timestamp_field: 'measured_at',
      primary_entities: ['programme.name', 'cohort.entry_year'],
      tags: ['enrollment', 'graduation', 'retention'],
      example_esql:
        'FROM enrollment-outcomes\n| WHERE programme.level == "undergraduate" AND cohort.entry_year == 2020\n| STATS grad_rate_4yr = AVG(outcome.grad_rate_4yr) BY programme.name\n| SORT grad_rate_4yr DESC',
    },
    related: ['he-003', 'he-004'],
  },
  {
    id: 'he-002',
    source: 'tuition',
    template: 'overview',
    type: 'index_metadata',
    title: 'tuition-and-fees index overview',
    description:
      'Published tuition and mandatory fees. One document per programme per academic year.',
    content: [
      'Use this index for tuition, fee and cost questions. Each document is one programme in one academic year.',
      '- academic_year: a keyword such as "2025-26". Sort on academic_year_start, not on the string.',
      '- tuition.annual_usd: published annual tuition before aid.',
      '- fees.mandatory_usd: required fees, kept separate from tuition.',
      '- fees.change_from_prior_pct: change against the prior academic year, already computed.',
    ].join('\n'),
    attributes: {
      doc_count: 1800,
      field_count: 26,
      timestamp_field: 'academic_year_start',
      primary_entities: ['programme.name', 'academic_year'],
      tags: ['tuition', 'fees'],
      example_esql:
        'FROM tuition-and-fees\n| WHERE academic_year == "2025-26"\n| STATS tuition = AVG(tuition.annual_usd), fees = AVG(fees.mandatory_usd) BY programme.level',
    },
    related: ['he-004', 'he-005'],
  },
  {
    id: 'he-003',
    source: 'peers',
    template: 'overview',
    type: 'index_metadata',
    title: 'peer-institutions index overview',
    description: 'Published figures for peer universities. One document per institution per year.',
    content: [
      'Use this index to compare with peer universities. Figures are the ones each institution publishes.',
      '- institution.unit_id: join on this. Institution names vary between sources.',
      '- institution.region and institution.size_band: filter on these to pick a fair peer set.',
      '- published.grad_rate_6yr: peers publish six-year rates only, so compare like with like.',
      '- published.tuition_usd: published annual tuition.',
    ].join('\n'),
    attributes: {
      doc_count: 2800,
      field_count: 34,
      timestamp_field: 'report_year',
      primary_entities: ['institution.unit_id', 'institution.name'],
      tags: ['peers', 'benchmark'],
      example_esql:
        'FROM peer-institutions\n| WHERE report_year == 2025 AND institution.region == "Northeast"\n| STATS grad_rate_6yr = AVG(published.grad_rate_6yr), tuition = AVG(published.tuition_usd) BY institution.size_band',
    },
    related: ['he-001', 'he-004'],
  },
  {
    id: 'he-004',
    source: 'peers',
    template: 'overview',
    type: 'query_guide',
    title: 'Answering "how do we compare with peers?"',
    description: 'Join our outcomes and tuition to peer figures on institution and year.',
    content:
      'Join on institution.unit_id and report year. Use six-year graduation rates on both sides, because peers do not publish four-year rates. Take our tuition from tuition-and-fees for the same academic year.',
    attributes: {
      join_keys: ['institution.unit_id', 'report_year'],
      tags: ['peers', 'join'],
      example_esql:
        'FROM peer-institutions\n| WHERE report_year == 2025\n| STATS peer_grad_6yr = AVG(published.grad_rate_6yr), peer_tuition = AVG(published.tuition_usd) BY institution.size_band\n| SORT peer_grad_6yr DESC',
    },
    related: ['he-001', 'he-002', 'he-003'],
  },
  {
    id: 'he-005',
    source: 'tuition',
    template: 'overview',
    type: 'query_guide',
    title: 'Answering "what changed in fees?"',
    description: 'Use the change field rather than diffing two years.',
    content:
      'Use fees.change_from_prior_pct, which is already computed against the prior academic year. Do not diff two years yourself: programmes are renamed between years, and a diff counts them twice.',
    attributes: {
      field: 'fees.change_from_prior_pct',
      tags: ['fees', 'change'],
      example_esql:
        'FROM tuition-and-fees\n| WHERE academic_year == "2025-26" AND fees.change_from_prior_pct != 0\n| KEEP programme.name, fees.mandatory_usd, fees.change_from_prior_pct\n| SORT fees.change_from_prior_pct DESC',
    },
    related: ['he-002'],
  },
];

export interface FailureGroup {
  source: Proto11SourceId;
  sourceName: string;
  count: number;
  reason: string;
  verifier: string;
  example: string;
  query: string;
  error: string;
  fix: string;
}

const FAILURES: Partial<
  Record<Proto11SourceId, Omit<FailureGroup, 'source' | 'sourceName' | 'count'>>
> = {
  'nginx-error': {
    reason: 'ES|QL query failed at runtime',
    verifier: 'esql-valid-runtime',
    example: 'Field guide: nginx error severities',
    error: 'Unknown column [error.msg], did you mean [error.message]?',
    query: 'FROM logs-nginx.error-default\n| STATS n = COUNT(*) BY error.msg',
    fix: 'error.msg should be error.message.',
  },
  cpu: {
    reason: 'ES|QL syntax is invalid',
    verifier: 'esql-valid-syntax',
    example: 'CPU by availability zone',
    error: "line 2:9: mismatched input 'BY' expecting {'(', ...}",
    query:
      'FROM metrics-system.cpu-default\n| STATS BY cloud.availability_zone AVG(system.cpu.total.norm.pct)',
    fix: 'BY before the aggregation.',
  },
};

// ---------- plans ----------

const templateSources = (
  template: Proto11TemplateId,
  sourceIds: Proto11SourceId[]
): Array<Proto11SourceId | 'traces'> => {
  const indices = sourceIds.filter((id) => sourceById(id).kind === 'Index');
  switch (template) {
    case 'overview':
      return indices;
    case 'xsource':
      return indices.length >= 2 ? indices : [];
    case 'digest':
      return sourceIds.filter((id) => id === 'runbooks');
    case 'profiles':
      return sourceIds.includes('nginx-access') ? ['nginx-access'] : [];
    case 'gaps':
    default:
      return ['traces'];
  }
};

const interleave = (groups: PortedKi[][]): PortedKi[] => {
  const out: PortedKi[] = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let i = 0; i < longest; i += 1) {
    groups.forEach((group) => {
      if (group[i]) out.push(group[i]);
    });
  }
  return out;
};

interface Plan {
  sample: PortedKi[];
  full: PortedKi[];
  rejected: PortedKi[];
}

const planFor = (meta: Pick<Proto11Meta, 'sourceIds' | 'runTemplates' | 'sample'>): Plan => {
  const sampleGroups: PortedKi[][] = [];
  const fullGroups: PortedKi[][] = [];
  const rejected: PortedKi[] = [];
  meta.runTemplates.forEach((template) => {
    templateSources(template, meta.sourceIds).forEach((source) => {
      const items = PORTED_KIS.filter((ki) => ki.template === template && ki.source === source);
      const ok = meta.sample ? items : items.filter((ki) => !ki.rejected);
      if (!meta.sample) rejected.push(...items.filter((ki) => ki.rejected));
      const sampleCount = Math.ceil(ok.length * SAMPLE_SHARE);
      sampleGroups.push(ok.slice(0, sampleCount));
      fullGroups.push(ok.slice(sampleCount));
    });
  });
  return { sample: interleave(sampleGroups), full: interleave(fullGroups), rejected };
};

const workflowUri = (template: Proto11TemplateId) =>
  `workflow://${slugify(TEMPLATES[template].title)}`;

const toIndicator = (ki: PortedKi, attributeTo?: Proto11TemplateId): KnowledgeIndicator => ({
  id: ki.id,
  '@timestamp': PROTO11_TIMESTAMP,
  type: ki.type,
  title: ki.title,
  description: ki.description,
  content: ki.content,
  attributes: ki.attributes,
  updated_at: PROTO11_TIMESTAMP,
  references: [
    { uri: derivedFromUri(ki.source), relation: 'derived_from' },
    ...ki.related.map((id) => ({ uri: `ki://${id}`, relation: 'relates_to' })),
  ],
  governance: {
    provenance: {
      created_by: {
        uri: workflowUri(attributeTo ?? ki.template),
        metadata: { ingestion_method: 'workflow' },
      },
    },
  },
});

const writtenItems = (meta: Proto11Meta) => {
  const plan = planFor(meta);
  return [
    ...plan.sample.slice(0, meta.written.sample),
    ...plan.full.slice(0, meta.written.full),
    ...plan.rejected.slice(0, meta.written.fixed),
  ];
};

/** Counts the first pass wrote from the sample. */
/** Rejected KIs still waiting for a fix. */
export const outstandingRejected = (meta: Proto11Meta) =>
  meta.phase === 'firstPass' || meta.fix === 'fixed' || meta.fix === 'done'
    ? 0
    : planFor(meta).rejected.length;

export const rejectedTotal = (meta: Proto11Meta) => planFor(meta).rejected.length;

export interface FirstPassDot {
  id: string;
  type: KnowledgeType;
  rejected: boolean;
  filled: boolean;
}

/** Hollow dots for the first-pass callout, one per indicator expected in the sample. */
export const firstPassDots = (
  meta: Proto11Meta
): { dots: FirstPassDot[]; written: number; rejected: number } => {
  const plan = planFor(meta);
  const complete = meta.phase !== 'firstPass';
  const written = complete ? plan.sample.length : meta.written.sample;
  const rejected = complete
    ? plan.rejected.length
    : Math.round((plan.rejected.length * meta.tick) / FIRST_PASS_TICKS);
  const dots: FirstPassDot[] = [
    ...plan.sample.map((item, index) => ({
      id: item.id,
      type: item.type,
      rejected: false,
      filled: index < written,
    })),
    ...plan.rejected.map((item, index) => ({
      id: `rejected-${item.id}`,
      type: item.type,
      rejected: true,
      filled: index < rejected,
    })),
  ];
  return { dots, written, rejected };
};

export const failureGroupsFor = (meta: Proto11Meta): FailureGroup[] => {
  const { rejected } = planFor(meta);
  const bySource = new Map<Proto11SourceId, number>();
  rejected.forEach((ki) => {
    if (ki.source === 'traces') return;
    bySource.set(ki.source, (bySource.get(ki.source) ?? 0) + 1);
  });
  return Array.from(bySource.entries()).flatMap(([source, count]) => {
    const failure = FAILURES[source];
    return failure ? [{ ...failure, source, sourceName: sourceById(source).name, count }] : [];
  });
};

const sourceMatchesGroup = (source: NamespaceSource, groupName: string) => {
  if (source.name === groupName || source.subtitle === groupName) return true;
  const needle = source.name
    .replace(/^FROM\s+/i, '')
    .trim()
    .toLowerCase();
  return (
    source.typeLabel === 'ES|QL' && needle.length >= 4 && groupName.toLowerCase().includes(needle)
  );
};

/** Saved Knowledge Indicators whose source row is this one. */
export const sourceKiCount = (namespace: Namespace, source: NamespaceSource): number => {
  const meta = namespace.proto11;
  if (!meta) return 0;
  const names = namespace.indicators.map(
    (indicator) => indicatorSourceGroup(indicator, namespace.sources, meta.agent).name
  );
  const exact = names.filter((name) => name === source.name || name === source.subtitle).length;
  if (exact > 0) return exact;
  const needle = source.name
    .replace(/^FROM\s+/i, '')
    .trim()
    .toLowerCase();
  if (source.typeLabel !== 'ES|QL' || needle.length < 4) return 0;
  const claimed = new Set(
    namespace.sources
      .filter((item) => item.id !== source.id && item.typeLabel !== 'ES|QL')
      .map((item) => item.name)
  );
  return names.filter((name) => name.toLowerCase().includes(needle) && !claimed.has(name)).length;
};

export const sourceHasOutstandingRejections = (
  namespace: Namespace,
  source: NamespaceSource
): boolean => {
  const meta = namespace.proto11;
  if (!meta) return false;
  return namespace.automations.some((automation) => {
    const scoped = rejectionMetaForAutomation(namespace, automation);
    if (!scoped || scoped.fix === 'rerunning' || scoped.fix === 'fixed' || scoped.fix === 'done') {
      return false;
    }
    return failureGroupsFor(scoped).some((group) => sourceMatchesGroup(source, group.sourceName));
  });
};

/** Agent statements shown in the first-pass callout, in order. */
export const reasoningLinesFor = (meta: Proto11Meta): string[] => {
  const lines: string[] = [];
  meta.runTemplates.forEach((template) => {
    const sources = templateSources(template, meta.sourceIds);
    const names = sources.map(sourceDisplayName);
    if (template === 'overview') {
      sources.forEach((source) => {
        const name = sourceDisplayName(source);
        lines.push(`Reading the mapping of ${name}`);
        if (source === 'nginx-access') {
          lines.push('Found 212 distinct url.path values, writing a field guide');
        } else if (source === 'nginx-error') {
          lines.push(`A query on ${name} failed verification, so it is held back`);
        } else if (source === 'cpu') {
          lines.push('Two CPU queries failed the syntax check, so they are held back');
        } else if (source === 'k8s') {
          lines.push('Found kubernetes.pod.name, writing a guide for finding crash loops');
        }
      });
      lines.push('Checking example queries against each index');
    } else if (template === 'xsource') {
      lines.push(`Comparing fields across ${joinList(names)}`);
      lines.push('Found host.name in every index');
      lines.push('Checking that host.name values match across sources');
      lines.push('Aligning time buckets, CPU is sampled every 10s');
      lines.push('Writing which source answers latency questions');
    } else if (template === 'digest') {
      lines.push(`Listing pages in ${joinList(names)}`);
      lines.push('Found 212 pages, starting with the most viewed');
      lines.push('Reading Runbook: elevated 5xx on checkout-api');
      lines.push('Pulling out when it applies, the steps and the owner');
      lines.push('Reading Policy: on-call escalation');
    } else if (template === 'profiles') {
      lines.push(`Finding services in service.name of ${joinList(names)}`);
      lines.push('Found 12 services, starting with the busiest');
      lines.push('Working out the error baseline for checkout-api');
      lines.push('Looking up the owning team for checkout-api');
      lines.push('Writing a profile for payments-gateway');
    } else {
      lines.push(`Reading recent traces from ${meta.agent ?? 'your agent'}`);
      lines.push('Found 41 questions with a failed tool call');
      lines.push('Grouping the failures by question');
      lines.push('system.cpu.pct was queried 7 times and does not exist');
      lines.push('Writing a query guide for saturated hosts');
    }
  });
  lines.push('Saving the verified Knowledge Indicators');
  return lines;
};

export const currentReasoningLine = (meta: Proto11Meta) => {
  const lines = reasoningLinesFor(meta);
  if (lines.length > FIRST_PASS_TICKS) {
    return lines[Math.floor((meta.tick * lines.length) / FIRST_PASS_TICKS)];
  }
  if (meta.tick < lines.length) return lines[meta.tick];
  return `Verified and saved ${meta.written.sample} Knowledge Indicators so far`;
};

// ---------- source groups for the Knowledge Indicators tab ----------

export interface SourceGroupKey {
  name: string;
  kind: string;
}

/** Which source a KI came from, for grouping and per-source counts. */
export const indicatorSourceGroup = (
  indicator: KnowledgeIndicator,
  sources: NamespaceSource[],
  agent?: string
): SourceGroupKey => {
  const uri =
    indicator.references.find((reference) => reference.relation === 'derived_from')?.uri ??
    indicator.references[0]?.uri ??
    '';
  const [scheme, rest = ''] = uri.split('://');
  if (scheme === 'index') return { name: rest, kind: 'Index' };
  if (scheme === 'connector') {
    const match = sources.find((source) => source.id === rest);
    return {
      name: match?.name ?? (rest === RUNBOOKS_CONNECTOR_ID ? 'SRE Runbooks' : rest),
      kind: 'Connector',
    };
  }
  if (scheme === 'traces') return { name: agent ?? TRACES_SOURCE_NAME, kind: 'Agent traces' };
  const label = indicatorSourceLabel(indicator);
  const match = sources.find(
    (source) => source.name.toLowerCase() === label.toLowerCase() || source.id === label
  );
  if (!match) return { name: label, kind: 'Source' };
  return {
    name: match.name,
    kind:
      match.typeLabel === 'Connector' || match.typeLabel === 'Managed' ? match.typeLabel : 'Index',
  };
};

// ---------- building namespaces ----------

const kindPhrase = (sourceIds: Proto11SourceId[]) => {
  const indices = sourceIds.filter((id) => sourceById(id).kind === 'Index').length;
  const connectors = sourceIds.length - indices;
  const indexPart = indices === 1 ? 'an index' : 'indices';
  if (indices > 0 && connectors > 0) return `${indexPart} and a document connector`;
  if (connectors > 0) return 'a document connector';
  return indexPart;
};

const templateReads = (template: Proto11TemplateId, sourceIds: Proto11SourceId[], agent?: string) =>
  template === 'gaps'
    ? [agent ? `${agent} traces` : TRACES_SOURCE_NAME]
    : templateSources(template, sourceIds).map(sourceDisplayName);

const buildAutomation = ({
  namespaceName,
  indexName,
  template,
  sourceIds,
  agent,
  derivation,
  runStatus,
}: {
  namespaceName: string;
  indexName: string;
  template: Proto11TemplateId;
  sourceIds: Proto11SourceId[];
  agent?: string;
  derivation: string;
  runStatus: Automation['runStatus'];
}): Automation => {
  const def = TEMPLATES[template];
  const reads = templateReads(template, sourceIds, agent);
  const steps = def.steps(reads);
  return {
    id: `${namespaceName}-${template}`,
    title: def.title,
    enabled: true,
    hasRun: false,
    triggerCount: 1,
    stepCount: steps.length,
    scheduleLabel: def.scheduleLabel,
    addedBy: 'Elastic AI Agent',
    lastRunAt: null,
    description: def.description,
    reads,
    producesCount: 0,
    steps,
    properties: [
      'Run this automation from the Workflows page.',
      'Idempotent. Safe to re-run; existing Knowledge Indicators are updated, not duplicated.',
      'A Knowledge Indicator whose ES|QL fails verification is not saved.',
    ],
    yaml: workflowYamlFor(def.title, indexName, reads),
    templateId: template,
    runStatus,
    derivation,
  };
};

export const uniqueName = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base;
  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

const SOURCE_TOPIC: Record<Proto11SourceId, string> = {
  'nginx-access': 'nginx',
  'nginx-error': 'nginx',
  cpu: 'host',
  k8s: 'container',
  runbooks: 'runbooks',
  enrollment: 'cohorts',
  tuition: 'tuition',
  peers: 'peer universities',
};

const topicsForIds = (sourceIds: Proto11SourceId[]): string[] => {
  const topics: string[] = [];
  sourceIds.forEach((id) => {
    const topic = SOURCE_TOPIC[id];
    if (topic && !topics.includes(topic)) topics.push(topic);
  });
  return topics;
};

const purposeSentence = (topics: string[], agent?: string) => {
  const line = topics.length > 0 ? `Answers ${joinList(topics)} questions` : 'Answers questions';
  return agent ? `${line} for ${agent}.` : `${line}.`;
};

const descriptionFor = (_goal: GoalDef, sourceIds: Proto11SourceId[], agent?: string) =>
  purposeSentence(topicsForIds(sourceIds), agent);

/** One purpose sentence. Stored text is kept when it does not name a source. */
export const overviewPurpose = (namespace: Namespace): string => {
  const intent = namespace.intent.trim();
  const listsSource = namespace.sources.some(
    (source) => source.name.length > 0 && intent.includes(source.name)
  );
  if (intent && !listsSource) {
    const sentence = intent.split(/(?<=\.)\s/)[0]?.trim() ?? intent;
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  }
  const topics: string[] = [];
  namespace.sources.forEach((source) => {
    const found = [...WEB_OPS_SOURCES, ...HIGHER_ED_SOURCES].find(
      (item) => item.name === source.name
    );
    const topic = found ? SOURCE_TOPIC[found.id] : undefined;
    if (topic && !topics.includes(topic)) topics.push(topic);
  });
  const agent =
    namespace.proto11?.agent ||
    namespace.traces?.find((trace) => trace.type === 'elastic_agent')?.value;
  return purposeSentence(topics, agent);
};

const freshMeta = (
  goal: Proto11GoalId,
  sourceIds: Proto11SourceId[],
  runTemplates: Proto11TemplateId[],
  agent?: string
): Proto11Meta => ({
  goal,
  sourceIds,
  runTemplates,
  agent,
  phase: 'firstPass',
  tick: 0,
  written: { sample: 0, full: 0, fixed: 0 },
  fix: 'none',
  fixTick: 0,
  lookedAt: [],
  checkHidden: false,
});

export interface CreateFromGoalOptions {
  goalId: Proto11GoalId;
  takenNames: string[];
  /** Name typed in the proposal. Falls back to the goal's base name. */
  name?: string;
  sourceIds?: Proto11SourceId[];
  trace?: IndexTrace;
  intent?: string;
  /** Words from the description that triggered a second Learn from traces automation. */
  struggleWords?: string[];
  /** Set by Create and run so the overview opens on the connect guide. */
  connectFrom?: {
    path: Proto11Path;
    question?: string;
    agentName?: string;
  };
}

const connectGuideFor = (
  indexName: string,
  sourceIds: Proto11SourceId[],
  from: { question?: string; agentName?: string }
): Proto11ConnectGuide => {
  const sources = joinList(sourceIds.map((id) => sourceDisplayName(id)));
  const failed = from.agentName
    ? traceQuestionsFor(from.agentName)
        .filter((item) => item.failures !== undefined)
        .map((item) => item.topic)
    : [];
  const topics = failed.length > 0 ? joinList(failed) : sources;
  const first = from.question
    ? `Before answering "${from.question.trim()}", retrieve relevant Knowledge Indicators from the AI index ${indexName} and prefer them over scanning ${sources}.`
    : `Before answering questions about ${topics}, retrieve relevant Knowledge Indicators from the AI index ${indexName} and prefer them over scanning ${sources}.`;
  const second = from.agentName
    ? `${from.agentName} missed these on the raw data, so use this index as soon as the first pass finishes.`
    : `Open ${sources} only when this index has nothing that answers the question.`;
  return {
    mode: from.agentName ? 'agent' : 'outside',
    ...(from.agentName ? { agentName: from.agentName } : {}),
    prompt: `${first} ${second}`,
  };
};

/** A working AI index straight from a goal: sources chosen, automation running its first pass. */
export const createProto11Namespace = ({
  goalId,
  takenNames,
  name: requestedName,
  sourceIds,
  trace,
  intent,
  struggleWords,
  connectFrom,
}: CreateFromGoalOptions): Namespace => {
  const goal = goalById(goalId);
  const chosen = sourceIds ?? [];
  const name = uniqueName(slugify(requestedName ?? '') || goal.baseName, takenNames);
  const indexName = backingIndexName(name);
  const agent = trace?.value;
  const runTemplates: Proto11TemplateId[] = [goal.template];
  const derivation = `Chosen because your goal is ${goal.phrase} and your sources are ${kindPhrase(
    chosen
  )}.`;
  const automations: Automation[] = [
    buildAutomation({
      namespaceName: name,
      indexName,
      template: goal.template,
      sourceIds: chosen,
      agent,
      derivation,
      runStatus: 'firstPass',
    }),
  ];
  if (struggleWords && struggleWords.length > 0 && goal.template !== 'gaps') {
    automations.push(
      buildAutomation({
        namespaceName: name,
        indexName,
        template: 'gaps',
        sourceIds: chosen,
        derivation: `Chosen because your description mentions ${joinList(struggleWords)}.`,
        runStatus: 'needsAgent',
      })
    );
  }
  return {
    name,
    displayName: name,
    intent: intent?.trim() || descriptionFor(goal, chosen, agent),
    owner: 'you',
    updated: 'just now',
    indexName,
    storageType: 'index',
    userCreated: true,
    sources: chosen.map((id) => toNamespaceSource(sourceById(id))),
    traces: trace ? [trace] : [],
    automations,
    indicators: [],
    knowledge: statsFromIndicators([]),
    tryQuestions: [],
    proto11: {
      ...freshMeta(goalId, chosen, runTemplates, agent),
      ...(connectFrom ? { connectGuide: connectGuideFor(name, chosen, connectFrom) } : {}),
    },
  };
};

/** Three indices, one completed Index overview automation, five KIs. Modelled on a real session. */
const createHigherEdSample = (): Namespace => {
  const name = HIGHER_ED_SAMPLE_NAME;
  const indexName = backingIndexName(name);
  const sourceIds = HIGHER_ED_SOURCES.map((source) => source.id);
  const indicators = HIGHER_ED_KIS.map((ki) => toIndicator(ki, 'overview'));
  const automations = [
    {
      ...buildAutomation({
        namespaceName: name,
        indexName,
        template: 'overview',
        sourceIds,
        derivation: 'Chosen for the sample because all three sources are indices.',
        runStatus: 'enabled' as const,
      }),
      hasRun: true,
      producesCount: indicators.length,
    },
  ];
  const meta: Proto11Meta = {
    ...freshMeta('indices', sourceIds, ['overview']),
    sample: true,
    scenario: 'higher-ed',
    phase: 'complete',
    connectedAgents: [{ name: 'enrollment-assistant', sample: true, lastRetrieval: '2 hours ago' }],
  };
  return {
    name,
    displayName: name,
    intent:
      'Sample higher education data: cohort outcomes, tuition and fees, and published figures for peer universities.',
    owner: 'you',
    updated: 'just now',
    indexName,
    storageType: 'index',
    userCreated: true,
    sources: sourceIds.map((id) => toNamespaceSource(sourceById(id))),
    traces: [],
    automations,
    indicators,
    knowledge: statsFromIndicators(indicators),
    tryQuestions: [],
    proto11: meta,
  };
};

export const sampleNameFor = (scenario: Proto11SampleScenario) => {
  if (scenario === 'higher-ed') return HIGHER_ED_SAMPLE_NAME;
  if (scenario === 'large') return LARGE_SAMPLE_NAME;
  return SAMPLE_INDEX_NAME;
};

export const sampleScenarioOf = (namespace: Namespace): Proto11SampleScenario | undefined =>
  namespace.proto11?.sample ? namespace.proto11.scenario ?? 'web-ops' : undefined;

/**
 * Extra web-ops Knowledge Indicators so the finished sample holds 48,
 * none of them from the Kubernetes source. That source stays attached
 * with an empty lineage, which is the gap the map draws.
 */
const WEB_OPS_EXTRA: PortedKi[] = [
  {
    id: 'ki-extra-1',
    source: 'nginx-access',
    template: 'overview',
    type: 'index_metadata',
    title: 'Field: http.response.status_code',
    description: 'Numeric HTTP status. Use a range for an error class.',
    content: 'http.response.status_code is a number. Use 500 to 599 for server errors.',
    attributes: { tags: ['nginx', 'http'] },
    related: ['ki-001'],
  },
  {
    id: 'ki-extra-2',
    source: 'nginx-access',
    template: 'overview',
    type: 'query_guide',
    title: 'Health checks inflate request totals',
    description: 'The HealthChecker user agent adds about 12% to request counts.',
    content: 'Exclude user_agent.name: "HealthChecker" before computing a rate.',
    attributes: { tags: ['nginx', 'health'] },
    related: ['ki-002'],
  },
  {
    id: 'ki-extra-3',
    source: 'cpu',
    template: 'overview',
    type: 'query_guide',
    title: 'Saturated host threshold',
    description: 'Hosts above 0.85 normalized CPU are treated as saturated.',
    content: 'system.cpu.total.norm.pct above 0.85 is the saturation line used in the runbooks.',
    attributes: { tags: ['cpu'] },
    related: ['ki-010'],
  },
  {
    id: 'ki-extra-4',
    source: 'nginx-error',
    template: 'overview',
    type: 'index_metadata',
    title: 'Field: error.message',
    description: 'The error text field. error.msg is not in this index.',
    content: 'Filter and group nginx errors on error.message. The field error.msg does not exist.',
    attributes: { tags: ['nginx', 'errors'] },
    related: ['ki-030'],
  },
  {
    id: 'ki-extra-5',
    source: 'runbooks',
    template: 'digest',
    type: 'document',
    title: 'Runbook: edge capacity',
    description: 'When to add edge capacity, and who approves it.',
    content:
      'Add edge capacity when checkout CPU stays above 0.85 for 10 minutes. payments-sre approves the change.',
    attributes: { tags: ['runbook', 'capacity'] },
    related: ['ki-020'],
  },
  {
    id: 'ki-extra-6',
    source: 'cpu',
    template: 'overview',
    type: 'query_guide',
    title: 'Answering "which hosts are hot right now?"',
    description: 'A 15 minute window on normalized CPU, grouped by host.',
    content:
      'Use system.cpu.total.norm.pct from metrics-system.cpu-default over the last 15 minutes. Group by host.name.',
    attributes: { tags: ['cpu', 'hosts'] },
    related: ['ki-010'],
  },
];

const LARGE_SOURCES: Array<{ name: string; subtitle: string }> = [
  { name: 'logs-checkout.access-default', subtitle: 'Checkout access logs' },
  { name: 'logs-checkout.error-default', subtitle: 'Checkout error logs' },
  { name: 'metrics-host.cpu-default', subtitle: 'Host CPU metrics' },
  { name: 'metrics-host.memory-default', subtitle: 'Host memory metrics' },
  { name: 'logs-auth.audit-default', subtitle: 'Authentication audit logs' },
  { name: 'metrics-service.latency-default', subtitle: 'Service latency metrics' },
  { name: 'logs-deploy.change-default', subtitle: 'Deployment change events' },
  { name: 'docs-sre-runbooks', subtitle: 'SRE runbooks' },
];

/** Seven smaller sources a click can open as a graph, and three larger ones. Sums to 2,400. */
const LARGE_COUNTS = [180, 180, 200, 200, 200, 480, 480, 480];

const LARGE_TYPES: KnowledgeType[] = ['index_metadata', 'document', 'unit_profile', 'query_guide'];

const LARGE_GOVERNANCE: KnowledgeIndicator['governance'] = {
  provenance: {
    created_by: {
      uri: 'workflow://index-overview',
      metadata: { ingestion_method: 'workflow' },
    },
  },
};

/** About 2,400 mock Knowledge Indicators across 8 sources, for the treemap demo. */
const createLargeSample = (): Namespace => {
  const name = LARGE_SAMPLE_NAME;
  const indexName = backingIndexName(name);
  const sources = LARGE_SOURCES.map((source, index) => ({
    id: `large-src-${index}`,
    name: source.name,
    subtitle: source.subtitle,
    typeLabel: index === LARGE_SOURCES.length - 1 ? 'Connector' : 'Index',
    icon: index === LARGE_SOURCES.length - 1 ? 'documents' : 'database',
  }));
  const indicators: KnowledgeIndicator[] = [];
  LARGE_COUNTS.forEach((count, sourceIndex) => {
    const source = sources[sourceIndex];
    const uri =
      source.typeLabel === 'Connector' ? `connector://${source.id}` : `index://${source.name}`;
    for (let item = 0; item < count; item += 1) {
      const id = `large-${sourceIndex}-${item}`;
      const related = item > 0 && item % 4 === 0 ? [`large-${sourceIndex}-${item - 1}`] : [];
      indicators.push({
        id,
        '@timestamp': PROTO11_TIMESTAMP,
        type: LARGE_TYPES[item % LARGE_TYPES.length],
        title: `${source.name} ${item + 1}`,
        description: `Mock Knowledge Indicator ${item + 1} from ${source.name}.`,
        content: `Written from ${source.name}.`,
        updated_at: PROTO11_TIMESTAMP,
        references: [
          { uri, relation: 'derived_from' },
          ...related.map((relatedId) => ({ uri: `ki://${relatedId}`, relation: 'relates_to' })),
        ],
        governance: LARGE_GOVERNANCE,
      });
    }
  });
  const reads = sources.map((source) => source.name);
  const automations = [
    {
      ...buildAutomation({
        namespaceName: name,
        indexName,
        template: 'overview',
        sourceIds: [],
        derivation: 'Chosen for the large sample so the map can show a treemap.',
        runStatus: 'enabled' as const,
      }),
      hasRun: true,
      lastRunAt: 'just now',
      producesCount: indicators.length,
      reads,
    },
  ];
  const meta: Proto11Meta = {
    ...freshMeta('indices', [], ['overview']),
    sample: true,
    scenario: 'large',
    phase: 'complete',
    connectedAgents: [
      { name: 'checkout-analyst', sample: true },
      { name: 'edge-oncall', sample: true },
      { name: 'sre-assistant', sample: true },
    ],
  };
  return {
    name,
    displayName: name,
    intent:
      'Large sample index with about 2,400 Knowledge Indicators across 8 sources, for the map treemap.',
    owner: 'you',
    updated: 'just now',
    indexName,
    storageType: 'index',
    userCreated: true,
    sources,
    traces: [],
    automations,
    indicators,
    knowledge: statsFromIndicators(indicators),
    tryQuestions: [],
    proto11: meta,
  };
};

/** The finished sample index for a scenario. Web-ops: five sources, two completed automations. */
export const createSampleNamespace = (scenario: Proto11SampleScenario = 'web-ops'): Namespace => {
  if (scenario === 'higher-ed') return createHigherEdSample();
  if (scenario === 'large') return createLargeSample();
  const name = SAMPLE_INDEX_NAME;
  const indexName = backingIndexName(name);
  const sourceIds = WEB_OPS_SOURCES.map((source) => source.id);
  const kis = [
    ...PORTED_KIS.filter((ki) => ki.source !== 'traces' && ki.source !== 'k8s'),
    ...WEB_OPS_EXTRA,
  ];
  const indicators = kis.map((ki) =>
    toIndicator(ki, ki.template === 'digest' ? 'digest' : 'overview')
  );
  const digestCount = kis.filter((ki) => ki.template === 'digest').length;
  const automations = (['overview', 'digest'] as Proto11TemplateId[]).map((template) => ({
    ...buildAutomation({
      namespaceName: name,
      indexName,
      template,
      sourceIds,
      derivation: 'Chosen for the sample so you can see indices and documents side by side.',
      runStatus: 'enabled' as const,
    }),
    hasRun: true,
    producesCount: template === 'digest' ? digestCount : kis.length - digestCount,
  }));
  const meta: Proto11Meta = {
    ...freshMeta('indices', sourceIds, ['overview', 'digest']),
    sample: true,
    scenario: 'web-ops',
    phase: 'complete',
    connectedAgents: [
      { name: 'web-ops-assistant', sample: true, lastRetrieval: '18 minutes ago' },
      { name: 'edge-oncall', sample: true },
    ],
  };
  return {
    name,
    displayName: name,
    intent:
      'Sample web operations data: nginx logs, host CPU metrics, Kubernetes container logs and SRE runbooks.',
    owner: 'you',
    updated: 'just now',
    indexName,
    storageType: 'index',
    userCreated: true,
    sources: sourceIds.map((id) => toNamespaceSource(sourceById(id))),
    traces: [],
    automations,
    indicators,
    knowledge: statsFromIndicators(indicators),
    tryQuestions: [],
    proto11: meta,
  };
};

const SIGNIFICANT_EVENTS_TRACE: IndexTrace = {
  value: 'Significant Events Judge',
  type: 'elastic_agent',
};

const CURATED_FROM_GOALS: ReadonlyArray<Omit<CreateFromGoalOptions, 'takenNames'>> = [
  {
    goalId: 'gaps',
    name: 'significant-events-judge-context',
    sourceIds: ['cpu', 'k8s', 'nginx-error', 'nginx-access'],
    trace: SIGNIFICANT_EVENTS_TRACE,
  },
  { goalId: 'docs', name: 'sre-runbooks', sourceIds: ['runbooks'] },
  { goalId: 'entities', name: 'service-profiles', sourceIds: ['nginx-access'] },
  {
    goalId: 'gaps',
    name: 'web-ops-gaps',
    sourceIds: ['nginx-access', 'nginx-error', 'cpu'],
    trace: SIGNIFICANT_EVENTS_TRACE,
  },
  {
    goalId: 'indices',
    name: 'web-ops-cpu',
    sourceIds: ['cpu'],
    intent: 'Field and query guidance for the host CPU metrics.',
  },
];

/** Runs the first pass to completion so the index opens at Run on all data. */
const toSampleReady = (namespace: Namespace): Namespace => {
  let current = namespace;
  for (let step = 0; step <= FIRST_PASS_TICKS && current.proto11?.phase === 'firstPass'; step++) {
    current = advanceProto11(current);
  }
  return current;
};

/** Fresh Existing user catalog, besides the managed elastic index. */
export const curatedNamespaces = (): Namespace[] => [
  createSampleNamespace('web-ops'),
  createSampleNamespace('higher-ed'),
  createSampleNamespace('large'),
  ...CURATED_FROM_GOALS.map((options) =>
    toSampleReady(createProto11Namespace({ ...options, takenNames: [] }))
  ),
];

// ---------- run engine ----------

const withWritten = (namespace: Namespace, meta: Proto11Meta): Namespace => {
  const items = writtenItems(meta);
  const indicators = items.map((ki) => toIndicator(ki));
  const automations = namespace.automations.map((automation) => {
    if (!automation.templateId || !meta.runTemplates.includes(automation.templateId)) {
      return automation;
    }
    const producesCount = items.filter((ki) => ki.template === automation.templateId).length;
    return producesCount === automation.producesCount
      ? automation
      : { ...automation, producesCount };
  });
  return {
    ...namespace,
    proto11: meta,
    indicators,
    knowledge: statsFromIndicators(indicators),
    automations,
  };
};

const setRunStatus = (
  namespace: Namespace,
  meta: Proto11Meta,
  runStatus: Automation['runStatus'],
  ran: boolean
): Namespace => ({
  ...namespace,
  updated: 'just now',
  automations: namespace.automations.map((automation) =>
    automation.templateId && meta.runTemplates.includes(automation.templateId)
      ? {
          ...automation,
          runStatus,
          ...(ran ? { hasRun: true, lastRunAt: 'just now' } : {}),
        }
      : automation
  ),
  ...(ran
    ? {
        lastSuccessfulRun: {
          name: TEMPLATES[meta.runTemplates[0]].title,
          when: 'just now',
        },
      }
    : {}),
});

const fixChatOf = (meta: Proto11Meta): Proto11FixChat =>
  meta.fixChat ?? { card: 'confirm', turns: [] };

const withTurns = (
  meta: Proto11Meta,
  turns: Proto11ChatTurn[],
  card?: Proto11FixChat['card']
): Proto11Meta => {
  const chat = fixChatOf(meta);
  return { ...meta, fixChat: { card: card ?? chat.card, turns: [...chat.turns, ...turns] } };
};

/** Sources the automation actually read. An add-on uses its own list, never the first run's. */
const sourceIdsForAutomation = (
  namespace: Namespace,
  automation: Automation
): Proto11SourceId[] => {
  const meta = namespace.proto11;
  if (!meta || !automation.templateId) return [];
  const stored =
    meta.addon?.automationId === automation.id
      ? meta.addon.sourceIds
      : meta.runTemplates.includes(automation.templateId)
      ? meta.sourceIds
      : [];
  return stored.length > 0 ? stored : inferredSourceIds(namespace);
};

const planForAutomation = (namespace: Namespace, automation: Automation): Plan => {
  const meta = namespace.proto11;
  if (!meta || !automation.templateId) return { sample: [], full: [], rejected: [] };
  return planFor({
    sourceIds: sourceIdsForAutomation(namespace, automation),
    runTemplates: [automation.templateId],
    sample: false,
  });
};

/** Adds this automation's fixed rejections without rewriting the rest of the index. */
const applyRerunProgress = (
  namespace: Namespace,
  meta: Proto11Meta,
  automation: Automation,
  fixedCount: number
): Namespace => {
  const incoming = planForAutomation(namespace, automation)
    .rejected.slice(0, fixedCount)
    .map((ki) => toIndicator(ki));
  const incomingIds = new Set(incoming.map((item) => item.id));
  const indicators = [
    ...namespace.indicators.filter((item) => !incomingIds.has(item.id)),
    ...incoming,
  ];
  const base = meta.fixProducesBase ?? automation.producesCount;
  return {
    ...namespace,
    indicators,
    knowledge: statsFromIndicators(indicators),
    automations: namespace.automations.map((item) =>
      item.id === automation.id ? { ...item, producesCount: base + incoming.length } : item
    ),
    proto11: meta,
  };
};

const statusAfterRerun = (meta: Proto11Meta): Automation['runStatus'] => {
  if (meta.phase === 'sampleReady') return 'sampleReady';
  return meta.phase === 'fullRun' ? 'running' : 'enabled';
};

/** Grows the added automation's sample without touching the index's own run. */
const advanceAddon = (namespace: Namespace): Namespace => {
  const meta = namespace.proto11;
  const addon = meta?.addon;
  if (!meta || !addon || addon.phase !== 'firstPass') return namespace;
  const plan = planFor({
    sourceIds: addon.sourceIds,
    runTemplates: [addon.template],
    sample: false,
  });
  const tick = addon.tick + 1;
  const done = plan.sample.length === 0 || tick >= FIRST_PASS_TICKS;
  const written = done
    ? plan.sample.length
    : Math.min(plan.sample.length, Math.round((plan.sample.length * tick) / FIRST_PASS_TICKS));
  const nextAddon: Proto11AddonRun = {
    ...addon,
    tick: done ? 0 : tick,
    written,
    phase: done ? 'sampleReady' : 'firstPass',
  };
  const incoming = plan.sample.slice(0, written).map((ki) => toIndicator(ki));
  const incomingIds = new Set(incoming.map((indicator) => indicator.id));
  const indicators = [
    ...namespace.indicators.filter((indicator) => !incomingIds.has(indicator.id)),
    ...incoming,
  ];
  return {
    ...namespace,
    updated: 'just now',
    indicators,
    knowledge: statsFromIndicators(indicators),
    automations: namespace.automations.map((automation) =>
      automation.id === addon.automationId
        ? {
            ...automation,
            producesCount: incoming.length,
            runStatus: done ? 'sampleReady' : 'firstPass',
            ...(done ? { hasRun: true, lastRunAt: 'just now' } : {}),
          }
        : automation
    ),
    proto11: { ...meta, addon: nextAddon },
  };
};

/** Writes the sample a finished add-on pass missed when its source list was empty. */
export const repairEmptyAddon = (namespace: Namespace): Namespace => {
  const meta = namespace.proto11;
  const addon = meta?.addon;
  if (!meta || meta.sample || !addon || addon.phase !== 'sampleReady' || addon.written > 0) {
    return namespace;
  }
  const ids = addon.sourceIds.length > 0 ? addon.sourceIds : inferredSourceIds(namespace);
  if (ids.length === 0) return namespace;
  const plan = planFor({ sourceIds: ids, runTemplates: [addon.template], sample: false });
  if (plan.sample.length === 0) return namespace;
  const incoming = plan.sample.map((ki) => toIndicator(ki));
  const incomingIds = new Set(incoming.map((indicator) => indicator.id));
  const indicators = [
    ...namespace.indicators.filter((indicator) => !incomingIds.has(indicator.id)),
    ...incoming,
  ];
  return {
    ...namespace,
    indicators,
    knowledge: statsFromIndicators(indicators),
    automations: namespace.automations.map((automation) => {
      if (automation.id !== addon.automationId) return automation;
      const reads =
        automation.reads.length > 0
          ? automation.reads
          : namespace.sources.map((source) => source.name);
      return { ...automation, reads, producesCount: incoming.length };
    }),
    proto11: {
      ...meta,
      addon: { ...addon, sourceIds: ids, written: incoming.length },
    },
  };
};

/** One step of the simulated runs. Returns the same object when nothing changes. */
export const advanceProto11 = (namespace: Namespace): Namespace => {
  const repaired = repairEmptyAddon(namespace);
  if (repaired !== namespace) return repaired;
  const meta = namespace.proto11;
  if (!meta) return namespace;
  if (meta.addon?.phase === 'firstPass') return advanceAddon(namespace);
  if (meta.sample) return namespace;
  let next = meta;
  const plan = planFor(meta);

  if (meta.phase === 'firstPass') {
    const tick = meta.tick + 1;
    const sample = Math.min(
      plan.sample.length,
      Math.round((plan.sample.length * tick) / FIRST_PASS_TICKS)
    );
    next = { ...next, tick, written: { ...next.written, sample } };
    if (tick >= FIRST_PASS_TICKS) {
      next = {
        ...next,
        phase: 'sampleReady',
        tick: 0,
        written: { ...next.written, sample: plan.sample.length },
      };
      return setRunStatus(withWritten(namespace, next), next, 'sampleReady', true);
    }
  } else if (meta.phase === 'fullRun') {
    const tick = meta.tick + 1;
    const full = Math.min(plan.full.length, Math.round((plan.full.length * tick) / FULL_RUN_TICKS));
    next = { ...next, tick, written: { ...next.written, full } };
    if (tick >= FULL_RUN_TICKS) {
      next = {
        ...next,
        phase: 'complete',
        tick: 0,
        written: { ...next.written, full: plan.full.length },
      };
      return setRunStatus(withWritten(namespace, next), next, 'enabled', true);
    }
  }

  if (next.fix === 'rerunning') {
    const automation = namespace.automations.find((item) => item.id === next.fixAutomationId);
    if (!automation?.templateId) {
      return { ...namespace, proto11: { ...next, fix: 'none', fixTick: 0 } };
    }
    const rejected = planForAutomation(namespace, automation).rejected;
    const fixTick = next.fixTick + 1;
    const fixed = Math.min(rejected.length, Math.round((rejected.length * fixTick) / RERUN_TICKS));
    if (fixTick >= RERUN_TICKS) {
      const finished: Proto11Meta = {
        ...next,
        fix: 'fixed',
        fixTick: 0,
        written: { ...next.written, fixed: rejected.length },
      };
      const noted = withTurns(finished, [
        {
          role: 'agent',
          text: `Done. ${rejected.length} Knowledge Indicators ready, 0 rejected.`,
        },
      ]);
      const written = applyRerunProgress(namespace, noted, automation, rejected.length);
      return {
        ...written,
        updated: 'just now',
        automations: written.automations.map((item) =>
          item.id === automation.id
            ? {
                ...item,
                runStatus: statusAfterRerun(noted),
                hasRun: true,
                lastRunAt: 'just now',
              }
            : item
        ),
      };
    }
    return applyRerunProgress(
      namespace,
      { ...next, fixTick, written: { ...next.written, fixed } },
      automation,
      fixed
    );
  }
  if (next.fix === 'fixed') {
    const fixTick = next.fixTick + 1;
    const updated =
      fixTick >= NOTE_TICKS ? { ...next, fix: 'done', fixTick: 0 } : { ...next, fixTick };
    return { ...namespace, proto11: updated };
  }

  return next === meta ? namespace : withWritten(namespace, next);
};

export const startFullRun = (namespace: Namespace): Namespace => {
  const meta = namespace.proto11;
  if (!meta || meta.phase !== 'sampleReady') return namespace;
  const next: Proto11Meta = { ...meta, phase: 'fullRun', tick: 0 };
  return setRunStatus({ ...namespace, proto11: next }, next, 'running', false);
};

const producesBaseFor = (namespace: Namespace, automation: Automation): number => {
  if (automation.producesCount > 0) return automation.producesCount;
  if (!automation.hasRun || !automation.templateId) return 0;
  const uri = workflowUri(automation.templateId);
  const written = namespace.indicators.filter(
    (indicator) => indicator.governance.provenance.created_by.uri === uri
  ).length;
  if (written > 0) return written;
  return planForAutomation(namespace, automation).sample.length;
};

/** Chat stays with the automation that opened it. A different card starts a fresh one. */
const chatForAutomation = (meta: Proto11Meta, automationId: string): Proto11Meta =>
  meta.fix === 'none' && meta.fixAutomationId !== automationId
    ? { ...meta, fixChat: { card: 'confirm', turns: [] }, fixAutomationId: automationId }
    : meta;

export const startRerun = (namespace: Namespace, automationId: string): Namespace => {
  const meta = namespace.proto11;
  const automation = namespace.automations.find((item) => item.id === automationId);
  if (!meta || !automation?.templateId || meta.fix !== 'none') return namespace;
  if (planForAutomation(namespace, automation).rejected.length === 0) return namespace;
  const next: Proto11Meta = {
    ...withTurns(chatForAutomation(meta, automationId), [], 'rerun'),
    fix: 'rerunning',
    fixTick: 0,
    fixAutomationId: automationId,
    fixProducesBase: producesBaseFor(namespace, automation),
    written: { ...meta.written, fixed: 0 },
  };
  return {
    ...namespace,
    automations: namespace.automations.map((item) =>
      item.id === automationId ? { ...item, runStatus: 'running' } : item
    ),
    proto11: next,
  };
};

export const declineRerun = (namespace: Namespace, automationId: string): Namespace => {
  const meta = namespace.proto11;
  if (!meta || meta.fix !== 'none') return namespace;
  return {
    ...namespace,
    proto11: {
      ...withTurns(
        chatForAutomation(meta, automationId),
        [
          {
            role: 'agent',
            text: 'The automation is already fixed; the next scheduled run will pick them up.',
          },
        ],
        'declined'
      ),
      fixAutomationId: automationId,
    },
  };
};

const RERUN_REPLY = /^(?:yes|run it|yes,? run it)[.!]*$/i;

const fixFallbackReply = (namespace: Namespace, automationId: string) => {
  const meta = namespace.proto11;
  const automation = namespace.automations.find((item) => item.id === automationId);
  if (!meta || !automation) return 'Nothing is waiting to re-run.';
  if (meta.fixAutomationId === automationId && meta.fix === 'rerunning') {
    return 'Still re-running. I will post here when it finishes.';
  }
  if (meta.fixAutomationId === automationId && meta.fix !== 'none') {
    return 'Nothing is waiting to re-run.';
  }
  const total = planForAutomation(namespace, automation).rejected.length;
  return `Reply yes to re-run the ${total} rejected Knowledge ${
    total === 1 ? 'Indicator' : 'Indicators'
  }.`;
};

/** A message typed in the fix panel. "yes" or "run it" confirms the re-run. */
export const sendFixMessage = (
  namespace: Namespace,
  message: string,
  automationId: string
): Namespace => {
  const meta = namespace.proto11;
  const text = message.trim();
  if (!meta || !text) return namespace;
  if (meta.fix !== 'none' && meta.fixAutomationId !== automationId) return namespace;
  const scoped = chatForAutomation(meta, automationId);
  const asked = { ...namespace, proto11: withTurns(scoped, [{ role: 'user', text }]) };
  if (scoped.fix === 'none' && RERUN_REPLY.test(text)) return startRerun(asked, automationId);
  return {
    ...namespace,
    proto11: withTurns(scoped, [
      { role: 'user', text },
      { role: 'agent', text: fixFallbackReply(namespace, automationId) },
    ]),
  };
};

// ---------- landing: three ways in ----------

const matchedWords = (text: string, patterns: string[]) => {
  const found: string[] = [];
  patterns.forEach((pattern) => {
    const regex = new RegExp(`(?:^|[^\\w|])(${pattern})(?![\\w|])`, 'gi');
    let match = regex.exec(text);
    while (match) {
      const word = match[1];
      if (!found.some((item) => item.toLowerCase() === word.toLowerCase())) found.push(word);
      match = regex.exec(text);
    }
  });
  return found;
};

export type Proto11Path = 'agent' | 'data' | 'question';

/** What Elastic AI Agent would set up. Every because line names evidence from the mock. */
export interface Proto11Proposal {
  path: Proto11Path;
  goal: Proto11GoalId;
  name: string;
  automationBecause: string;
  sourceIds: Proto11SourceId[];
  sourcesBecause: string;
  /** Sources the question path matched, shown with a found badge. */
  foundIds: Proto11SourceId[];
  /** Sources inferred from the attached agent's traces. Shown with a from-traces badge. */
  traceSourceIds?: Proto11SourceId[];
  trace?: IndexTrace;
  /** The question that produced this proposal, when the path started from one. */
  question?: string;
}

/** Plain-text proposal, attached when asking Elastic AI Agent to adjust it. */
export const proposalSummary = (proposal: Proto11Proposal, name: string): string => {
  const template = TEMPLATES[goalById(proposal.goal).template];
  const sources = proposal.sourceIds.map((id) => sourceById(id).name);
  return [
    `Proposed setup for the AI index ${name}.`,
    `Automation: ${template.title}. ${template.description} Chosen ${proposal.automationBecause}.`,
    `Sources: ${joinList(sources)}. Chosen ${proposal.sourcesBecause}.`,
    ...(proposal.trace ? [`Agent traces: ${proposal.trace.value}.`] : []),
  ].join('\n');
};

const uniqueIds = (ids: Proto11SourceId[]) => ids.filter((id, index) => ids.indexOf(id) === index);

export const proposeFromAgent = (
  agent: string,
  traceType: IndexTrace['type'],
  takenNames: string[]
): Proto11Proposal => {
  const questions = traceQuestionsFor(agent);
  const top = questions
    .filter((question) => question.failures !== undefined)
    .sort((a, b) => (b.failures ?? 0) - (a.failures ?? 0))[0];
  const sourceIds = uniqueIds(questions.flatMap((question) => question.sourceIds));
  return {
    path: 'agent',
    goal: 'gaps',
    name: uniqueName(`${slugify(agent)}-context`, takenNames),
    automationBecause: top
      ? `because your agent asked about ${top.topic} ${top.failures} times and failed`
      : `because ${agent} has no traces yet, so it starts once tracing is connected`,
    sourceIds,
    sourcesBecause:
      questions.length > 0 && sourceIds.length > 0
        ? `because its questions name ${joinList(
            questions.map((question) => question.topic)
          )}, which live in ${joinList(sourceIds.map(sourceDisplayName))}`
        : 'because there are no traces to read yet',
    foundIds: [],
    trace: { value: agent, type: traceType },
  };
};

export const proposeFromData = (
  sourceIds: Proto11SourceId[],
  takenNames: string[]
): Proto11Proposal => {
  const indices = sourceIds.filter((id) => sourceById(id).kind === 'Index');
  const goal: Proto11GoalId = indices.length > 0 ? 'indices' : 'docs';
  let automationBecause: string;
  if (indices.length === 0) {
    automationBecause =
      sourceIds.length === 1
        ? 'because the source you picked is a document connector'
        : 'because the sources you picked are document connectors';
  } else if (indices.length < sourceIds.length) {
    automationBecause =
      indices.length === 1
        ? `because 1 of the ${sourceIds.length} sources you picked is an index`
        : `because ${indices.length} of the ${sourceIds.length} sources you picked are indices`;
  } else {
    automationBecause =
      indices.length === 1
        ? 'because the source you picked is an index'
        : 'because the sources you picked are indices';
  }
  return {
    path: 'data',
    goal,
    name: uniqueName(goalById(goal).baseName, takenNames),
    automationBecause,
    sourceIds,
    sourcesBecause: sourceIds.length === 1 ? 'because you picked it' : 'because you picked them',
    foundIds: [],
  };
};

export interface ComposerInput {
  text: string;
  agent?: { name: string; traceType: IndexTrace['type'] };
  sourceIds: Proto11SourceId[];
  takenNames: string[];
}

const tracedSourceIds = (agent: NonNullable<ComposerInput['agent']>) =>
  uniqueIds(traceQuestionsFor(agent.name).flatMap((question) => question.sourceIds));

const NAME_HINTS: Array<[RegExp, string]> = [
  [/saturat/i, 'saturation'],
  [/checkout/i, 'checkout'],
  [/payment/i, 'payments'],
  [/deploy/i, 'deploys'],
  [/duration|latenc/i, 'latency'],
  [/5xx|error/i, 'errors'],
  [/runbook/i, 'runbooks'],
  [/host/i, 'hosts'],
];

const nameFromQuestion = (text: string) => {
  const hint = NAME_HINTS.find(([pattern]) => pattern.test(text));
  return `web-ops-${hint ? hint[1] : 'questions'}`;
};

const quoted = (words: string[]) => joinList(words.map((word) => `"${word}"`));

/** Template for free text, from the same source-keyword match the question path used. */
const keywordTemplate = (
  text: string,
  takenNames: string[]
): { goal: Proto11GoalId; because: string; name: string; foundIds: Proto11SourceId[] } => {
  const name = uniqueName(nameFromQuestion(text), takenNames);
  const matches = WEB_OPS_SOURCES.map((source) => ({
    id: source.id,
    words: matchedWords(text, source.keywords),
  })).filter((match) => match.words.length > 0);
  if (matches.length === 0) {
    return {
      goal: 'indices',
      name,
      foundIds: [],
      because:
        'because the question does not name a source, so it starts with an overview of your indices',
    };
  }
  const foundIds = matches.map((match) => match.id);
  const words = matches
    .flatMap((match) => match.words)
    .filter(
      (word, index, all) =>
        all.findIndex((other) => other.toLowerCase() === word.toLowerCase()) === index
    );
  const hasIndex = foundIds.some((id) => sourceById(id).kind === 'Index');
  return {
    goal: hasIndex ? 'indices' : 'docs',
    name,
    foundIds,
    because: `because the question names ${quoted(words)}, which live in ${joinList(
      foundIds.map(sourceDisplayName)
    )}`,
  };
};

/**
 * The text picks the template. A chip maps to one template; other text uses the keyword match.
 * An attached agent adds its traces as evidence and infers sources. It does not change the template.
 * Learn from traces is never proposed here.
 */
export const proposeFromComposer = ({
  text,
  agent,
  sourceIds,
  takenNames,
}: ComposerInput): Proto11Proposal => {
  const trimmed = text.trim();
  const problem = problemFor(trimmed);
  const keyword = keywordTemplate(trimmed, takenNames);
  const goal = problem?.goal ?? keyword.goal;
  const traced = agent ? tracedSourceIds(agent) : [];
  const ids = uniqueIds([...traced, ...sourceIds]);
  const questions = agent ? traceQuestionsFor(agent.name) : [];
  let sourcesBecause: string;
  if (traced.length > 0 && sourceIds.length > 0) {
    sourcesBecause = `because you attached ${joinList(
      sourceIds.map(sourceDisplayName)
    )}, and its questions name ${joinList(questions.map((question) => question.topic))}`;
  } else if (traced.length > 0) {
    sourcesBecause = `because its questions name ${joinList(
      questions.map((question) => question.topic)
    )}, which live in ${joinList(traced.map(sourceDisplayName))}`;
  } else if (sourceIds.length === 1) {
    sourcesBecause = 'because you picked it';
  } else if (sourceIds.length > 1) {
    sourcesBecause = 'because you picked them';
  } else {
    sourcesBecause = 'because there are no traces to read yet';
  }
  const automationBecause = problem
    ? ids.length
      ? `because you said ${problem.said}, and ${gapsLine(ids)}`
      : `because you said ${problem.said}`
    : keyword.because;
  return {
    path: 'question',
    goal,
    name: problem ? uniqueName(problem.baseName, takenNames) : keyword.name,
    automationBecause,
    sourceIds: ids,
    sourcesBecause,
    foundIds: keyword.foundIds.filter((id) => ids.includes(id)),
    ...(trimmed ? { question: trimmed } : {}),
    ...(agent
      ? {
          traceSourceIds: traced,
          trace: { value: agent.name, type: agent.traceType },
        }
      : {}),
  };
};

const catalogSources = [...WEB_OPS_SOURCES, ...HIGHER_ED_SOURCES];

const sourceIdsOf = (namespace: Namespace): Proto11SourceId[] => {
  const fromNames = catalogSources
    .filter((source) => namespace.sources.some((item) => item.name === source.name))
    .map((source) => source.id);
  return uniqueIds([...(namespace.proto11?.sourceIds ?? []), ...fromNames]);
};

/** Catalog sources named by an ES|QL query when the index has no catalog source id. */
const inferredSourceIds = (namespace: Namespace): Proto11SourceId[] => {
  const named = catalogSources
    .filter((source) => namespace.sources.some((item) => item.name === source.name))
    .map((source) => source.id);
  if (named.length > 0) return uniqueIds(named);
  const needles = namespace.sources
    .map((source) =>
      source.name
        .replace(/^FROM\s+/i, '')
        .trim()
        .toLowerCase()
    )
    .filter((needle) => needle.length >= 4);
  return uniqueIds(
    catalogSources
      .filter((source) => needles.some((needle) => source.name.toLowerCase().includes(needle)))
      .map((source) => source.id)
  );
};

/** Source badges for an automation card. Falls back to the sources on the index. */
export const displayedReads = (namespace: Namespace, automation: Automation): string[] => {
  if (automation.reads.length > 0) return automation.reads;
  return namespace.sources.map((source) => source.name);
};

/** Knowledge Indicators this automation wrote. */
export const displayedProduces = (namespace: Namespace, automation: Automation): number => {
  if (automation.producesCount > 0 || !automation.hasRun || !automation.templateId) {
    return automation.producesCount;
  }
  const uri = workflowUri(automation.templateId);
  const written = namespace.indicators.filter(
    (indicator) => indicator.governance.provenance.created_by.uri === uri
  ).length;
  if (written > 0) return written;
  const ids = inferredSourceIds(namespace);
  if (ids.length === 0) return 0;
  return planFor({
    sourceIds: ids,
    runTemplates: [automation.templateId],
    sample: Boolean(namespace.proto11?.sample),
  }).sample.length;
};

/** Short name for a source in a because line. ES|QL queries drop the leading FROM. */
const sourceReadName = (source: NamespaceSource): string => {
  const from = /^FROM\s+(.+)$/i.exec(source.name.trim());
  return from ? from[1] : source.name;
};

/**
 * Two or more indices map across sources. A document connector digests pages.
 * An index or an ES|QL query gets a field guide.
 */
const goalForIndex = (namespace: Namespace): Proto11GoalId => {
  const sources = namespace.sources;
  const indexCount = sources.filter((source) => source.typeLabel === 'Index').length;
  const connectorOnly =
    sources.length > 0 &&
    sources.every((source) => source.typeLabel === 'Connector' || source.typeLabel === 'Managed');
  if (indexCount >= 2) return 'multi';
  if (connectorOnly) return 'docs';
  return 'indices';
};

const descriptionAsk = (intent: string, goal: Proto11GoalId): string => {
  const text = intent.toLowerCase();
  if (/\bfields?\b/.test(text) && /\bquer/.test(text)) return 'field and query guidance';
  if (/\bdigest\b|\beach page\b|\beach document\b/.test(text)) return 'a digest of each document';
  if (/\bwhich source\b|\bmap of\b/.test(text))
    return 'a map of which source answers which question';
  if (goal === 'docs') return 'a digest of each document';
  if (goal === 'multi') return 'a map of which source answers which question';
  return 'field and query guidance';
};

/** Proposal for an existing index. The template follows its description and sources. */
export const proposeFromIndex = (namespace: Namespace): Proto11Proposal => {
  const sourceIds = sourceIdsOf(namespace);
  const goal = goalForIndex(namespace);
  const names = namespace.sources.map(sourceReadName);
  const reads = names.length > 0 ? joinList(names) : 'nothing yet';
  return {
    path: 'data',
    goal,
    name: namespace.name,
    automationBecause: `because this index reads ${reads} and the description asks for ${descriptionAsk(
      namespace.intent,
      goal
    )}.`,
    sourceIds,
    sourcesBecause: 'Uses the sources on this index',
    foundIds: [],
  };
};

/**
 * Second suggestion under an index proposal. Absent when the index has no traces,
 * or none of those traces record a failed question.
 */
export const tracesSuggestionFor = (namespace: Namespace): string | undefined => {
  for (const trace of namespace.traces ?? []) {
    const agent = PICKER_AGENTS.find((item) => item.name === trace.value);
    const failed =
      agent?.failed ??
      traceQuestionsFor(trace.value).reduce((sum, question) => sum + (question.failures ?? 0), 0);
    if (failed > 0) {
      const noun = failed === 1 ? 'question' : 'questions';
      return `Also suggested: Learn from traces, because ${trace.value} failed ${failed} ${noun} last week`;
    }
  }
  return undefined;
};

const agentNamesOf = (namespace: Namespace): string[] => {
  const names = [
    ...(namespace.proto11?.connectedAgents ?? []).map((agent) => agent.name),
    ...(namespace.proto11?.agent ? [namespace.proto11.agent] : []),
    ...(namespace.traces ?? []).map((trace) => trace.value),
  ];
  return names.filter((name, index) => names.indexOf(name) === index);
};

/** An existing AI index a proposal can extend instead of creating another. */
export interface ReuseMatch {
  name: string;
  /** Proposal sources this index already contains. */
  coveredIds: Proto11SourceId[];
  /** The attached agent, when this index already uses it. */
  agent?: string;
  because: string;
}

const reuseBecause = (coveredNames: string[], agent?: string): string => {
  const covers = coveredNames.length > 0 ? `already covers ${joinList(coveredNames)}` : '';
  const used = agent ? `is used by ${agent}` : '';
  if (covers && used) return `${covers} and ${used}`;
  return covers || used;
};

const reuseOf = (namespace: Namespace, proposal: Proto11Proposal): ReuseMatch => {
  const coveredIds = proposal.sourceIds.filter((id) => sourceIdsOf(namespace).includes(id));
  const agent = proposal.trace?.value;
  const usesAgent = Boolean(agent && agentNamesOf(namespace).includes(agent));
  return {
    name: namespace.name,
    coveredIds,
    ...(usesAgent && agent ? { agent } : {}),
    because:
      reuseBecause(
        coveredIds.map((id) => sourceDisplayName(id)),
        usesAgent ? agent : undefined
      ) || `you chose to add this to ${namespace.name}`,
  };
};

/** The existing index a proposal should extend, or the named index when the overview targets itself. */
export const findReuseTarget = (
  proposal: Proto11Proposal,
  namespaces: Namespace[],
  forcedName?: string
): ReuseMatch | undefined => {
  if (forcedName) {
    const forced = namespaces.find((namespace) => namespace.name === forcedName);
    return forced ? reuseOf(forced, proposal) : undefined;
  }
  const ranked = namespaces
    .filter((namespace) => !namespace.managed)
    .map((namespace) => ({
      match: reuseOf(namespace, proposal),
      size: sourceIdsOf(namespace).length,
    }))
    .filter((item) => item.match.coveredIds.length > 0 || item.match.agent);
  ranked.sort((a, b) => {
    const score = (match: ReuseMatch) => match.coveredIds.length * 10 + (match.agent ? 5 : 0);
    const diff = score(b.match) - score(a.match);
    if (diff !== 0) return diff;
    if (a.size !== b.size) return a.size - b.size;
    return a.match.name.localeCompare(b.match.name);
  });
  return ranked[0]?.match;
};

const TEMPLATE_DERIVATION: Record<Proto11TemplateId, string> = {
  overview: 'Chosen because the sources are indices and need a field guide.',
  xsource: 'Chosen because several sources need a map of which one answers which question.',
  digest: 'Chosen because the sources are documents and need a digest of each page.',
  profiles: 'Chosen because the sources name services that need a profile.',
  gaps: 'Chosen because this index has traces, so it can answer the questions the agent got wrong.',
};

const derivationMatchesTemplate = (template: Proto11TemplateId, text: string): boolean => {
  const line = text.toLowerCase();
  switch (template) {
    case 'overview':
      return /overview|indic|searching|field guide|fields with no guide|an index/.test(line);
    case 'xsource':
      return /several|cross-source|join|which source|sources well/.test(line);
    case 'digest':
      return /document|digest|runbook|connector/.test(line);
    case 'profiles':
      return /profile|service|entit/.test(line);
    case 'gaps':
      return /trace|struggled|got wrong|failed/.test(line);
  }
};

/** The Chosen-because line for an automation card. A stored line is kept only when it belongs to this template. */
export const displayedDerivation = (template: Proto11TemplateId, stored?: string): string => {
  if (stored && derivationMatchesTemplate(template, stored)) return stored;
  return TEMPLATE_DERIVATION[template];
};

/**
 * Rejections, fix state, and chat for this automation only.
 * An add-on never reads the first automation's plan.
 */
export const rejectionMetaForAutomation = (
  namespace: Namespace,
  automation: Automation
): Proto11Meta | undefined => {
  const meta = namespace.proto11;
  const template = automation.templateId;
  if (!meta || !template || !automation.hasRun) return undefined;
  const addon = meta.addon?.automationId === automation.id ? meta.addon : undefined;
  if (addon?.phase === 'firstPass') return undefined;
  const inPrimaryRun = meta.runTemplates.includes(template) && !addon;
  if (inPrimaryRun && meta.phase === 'firstPass') return undefined;
  const ownsFix = meta.fixAutomationId === automation.id;
  return {
    ...meta,
    sourceIds: sourceIdsForAutomation(namespace, automation),
    runTemplates: [template],
    phase: inPrimaryRun ? meta.phase : 'sampleReady',
    sample: inPrimaryRun ? meta.sample : false,
    fix: ownsFix ? meta.fix : 'none',
    fixChat: ownsFix ? meta.fixChat : undefined,
    written: ownsFix ? meta.written : { sample: 0, full: 0, fixed: 0 },
  };
};

/** Starts the existing automation's first pass again. Does not add a second copy. */
export const rerunAutomation = (namespace: Namespace, template: Proto11TemplateId): Namespace => {
  const meta = namespace.proto11;
  const automation = namespace.automations.find((item) => item.templateId === template);
  if (!meta || !automation) return namespace;
  const reset = (item: Automation): Automation =>
    item.templateId === template
      ? { ...item, runStatus: 'firstPass', hasRun: false, producesCount: 0, lastRunAt: null }
      : item;
  if (!meta.runTemplates.includes(template)) {
    return {
      ...namespace,
      updated: 'just now',
      automations: namespace.automations.map(reset),
      proto11: {
        ...meta,
        addon: {
          template,
          sourceIds:
            sourceIdsOf(namespace).length > 0
              ? sourceIdsOf(namespace)
              : inferredSourceIds(namespace),
          automationId: automation.id,
          tick: 0,
          written: 0,
          phase: 'firstPass',
        },
      },
    };
  }
  const nextMeta: Proto11Meta = {
    ...meta,
    phase: 'firstPass',
    tick: 0,
    written: { sample: 0, full: 0, fixed: 0 },
    fix: 'none',
    fixTick: 0,
  };
  const restarted = withWritten(
    { ...namespace, automations: namespace.automations.map(reset) },
    nextMeta
  );
  return {
    ...restarted,
    updated: 'just now',
    automations: restarted.automations.map(reset),
  };
};

/** Adds the proposal's new sources and automation, and starts that automation's sample pass. */
export const addProposalToNamespace = (
  namespace: Namespace,
  proposal: Proto11Proposal
): Namespace => {
  const template = goalById(proposal.goal).template;
  if (namespace.automations.some((automation) => automation.templateId === template)) {
    return rerunAutomation(namespace, template);
  }
  const runIds = proposal.sourceIds.length > 0 ? proposal.sourceIds : inferredSourceIds(namespace);
  const existingIds = sourceIdsOf(namespace);
  const newIds = proposal.sourceIds.filter((id) => !existingIds.includes(id));
  const meta: Proto11Meta = namespace.proto11
    ? { ...namespace.proto11, sourceIds: uniqueIds([...existingIds, ...proposal.sourceIds]) }
    : {
        ...freshMeta(proposal.goal, uniqueIds([...existingIds, ...proposal.sourceIds]), []),
        phase: 'complete',
      };
  let automationId = `${namespace.name}-${template}`;
  let suffix = 2;
  while (namespace.automations.some((automation) => automation.id === automationId)) {
    automationId = `${namespace.name}-${template}-${suffix}`;
    suffix += 1;
  }
  const built = buildAutomation({
    namespaceName: namespace.name,
    indexName: namespace.indexName,
    template,
    sourceIds: runIds,
    agent: proposal.trace?.value ?? meta.agent,
    derivation: `Chosen ${proposal.automationBecause}.`,
    runStatus: 'firstPass',
  });
  const actualNames = namespace.sources.map((source) => source.name);
  const reads = proposal.sourceIds.length > 0 && built.reads.length > 0 ? built.reads : actualNames;
  const steps = TEMPLATES[template].steps(reads);
  const automation = {
    ...built,
    id: automationId,
    reads,
    steps,
    stepCount: steps.length,
    yaml: workflowYamlFor(TEMPLATES[template].title, namespace.indexName, reads),
  };
  const knownNames = new Set(namespace.sources.map((source) => source.name));
  const traces =
    proposal.trace && (namespace.traces?.length ?? 0) === 0 ? [proposal.trace] : namespace.traces;
  return {
    ...namespace,
    updated: 'just now',
    sources: [
      ...namespace.sources,
      ...newIds
        .map((id) => toNamespaceSource(sourceById(id)))
        .filter((source) => !knownNames.has(source.name)),
    ],
    traces,
    automations: [...namespace.automations, automation],
    proto11: {
      ...meta,
      addon: {
        template,
        sourceIds: runIds,
        automationId,
        tick: 0,
        written: 0,
        phase: 'firstPass',
      },
    },
  };
};

export const namespaceSourceFor = (id: Proto11SourceId): NamespaceSource =>
  toNamespaceSource(sourceById(id));

// ---------- sample panel on the landing ----------

/** With and without Context token figures behind a comparison headline and its bars. */
export interface TokenComparison {
  withContext: { detail: string; tokens: number };
  withoutContext: { detail: string; tokens: number; calls: number };
}

export interface SampleDemo extends TokenComparison {
  question: string;
  kiIds: string[];
}

export const SAMPLE_DEMOS: SampleDemo[] = [
  {
    question: 'Why is checkout-api returning 5xx?',
    kiIds: ['ki-020', 'ki-002', 'ki-040'],
    withContext: { detail: '1 retrieval, about 3,400 tokens', tokens: 3400 },
    withoutContext: {
      detail: '5 calls across 3 sources, about 11,200 tokens',
      tokens: 11200,
      calls: 5,
    },
  },
  {
    question: 'Which runbook covers certificate expiry?',
    kiIds: ['ki-digest-runbooks-1', 'ki-digest-runbooks-2', 'ki-digest-runbooks-6'],
    withContext: { detail: '1 retrieval, about 1,900 tokens', tokens: 1900 },
    withoutContext: {
      detail: '4 calls across 2 sources, about 6,100 tokens',
      tokens: 6100,
      calls: 4,
    },
  },
  {
    question: 'Top paths by traffic today',
    kiIds: ['ki-overview-nginx-access-4', 'ki-003', 'ki-001'],
    withContext: { detail: '1 retrieval, about 2,400 tokens', tokens: 2400 },
    withoutContext: {
      detail: '4 calls on 1 index, about 7,300 tokens',
      tokens: 7300,
      calls: 4,
    },
  },
];

const CALL_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Headline for a comparison, computed from the same figures as its ratio bar. */
export const comparisonHeadline = ({ withContext, withoutContext }: TokenComparison): string => {
  const saved = Math.round((1 - withContext.tokens / withoutContext.tokens) * 100);
  const calls = CALL_WORDS[withoutContext.calls] ?? String(withoutContext.calls);
  return `About ${saved}% fewer tokens, one call instead of ${calls}.`;
};

export const EXAMPLE_QUESTIONS = [
  'Which hosts are saturated?',
  'What does event.duration mean in nginx logs?',
  'Who owns the payments runbook?',
];

/** Generic problems. The same three chips on the landing, the create page, and the compact bar. */
export const PROBLEM_CHIPS: ReadonlyArray<{
  sentence: string;
  said: string;
  baseName: string;
  goal: Proto11GoalId;
}> = [
  {
    sentence: 'My agent spends too long searching the data',
    said: 'the agent spends too long searching',
    baseName: 'web-ops-search',
    goal: 'indices',
  },
  {
    sentence: 'My agent has to reason over complex documents',
    said: 'the agent has to reason over complex documents',
    baseName: 'web-ops-documents',
    goal: 'docs',
  },
  {
    sentence: 'My agent needs several data sources it does not understand',
    said: 'the agent needs several data sources it does not understand',
    baseName: 'web-ops-sources',
    goal: 'multi',
  },
];

const problemFor = (text: string) =>
  PROBLEM_CHIPS.find((chip) => chip.sentence.toLowerCase() === text.trim().toLowerCase());

const sourceGap = (id: Proto11SourceId): string => {
  const source = sourceById(id);
  if (source.kind === 'Index' && source.fields) {
    return `${source.name} has ${source.fields} fields with no guide yet`;
  }
  if (source.kind === 'Index') return `${source.name} has no field guide yet`;
  return `${source.name} has no digest yet`;
};

const gapsLine = (ids: Proto11SourceId[]) => joinList(ids.map(sourceGap));

export const SAMPLE_COUNTS = {
  sources: WEB_OPS_SOURCES.length,
  automations: 2,
  indicators:
    PORTED_KIS.filter((ki) => ki.source !== 'traces' && ki.source !== 'k8s').length +
    WEB_OPS_EXTRA.length,
} as const;

export const sampleIndicator = (
  id: string
): { indicator: KnowledgeIndicator; sourceName: string } | undefined => {
  const ki = PORTED_KIS.find((item) => item.id === id);
  return ki ? { indicator: toIndicator(ki), sourceName: sourceDisplayName(ki.source) } : undefined;
};

// ---------- connected agents and test a question ----------

/** Mock Agent Builder agents that can be connected to an AI index. */
export const AGENT_BUILDER_AGENTS = [...ELASTIC_AGENT_OPTIONS, 'institutional-research-agent'];

interface TestFigures {
  tokens: number;
  seconds: number;
}

interface TestScenario {
  question: string;
  kiIds: string[];
  withContext: TestFigures;
  withoutContext: TestFigures & { steps: string[] };
}

export interface TestQuestionResult {
  indicators: KnowledgeIndicator[];
  withContext: TestFigures;
  withoutContext: TestFigures & { steps: string[] };
}

const SIX_STEPS = [
  'List indices',
  'Read the mapping of 3 indices',
  'Sample documents',
  'Write a query',
  'Retry after a field error',
  'Answer',
];

/** Latency for higher-ed is the one observed in the real session. Tokens are estimates. */
const HIGHER_ED_FIGURES = {
  withContext: { tokens: 2100, seconds: 15 },
  withoutContext: { steps: SIX_STEPS, tokens: 7800, seconds: 44 },
};

const TEST_SCENARIOS: Record<Proto11SampleScenario, TestScenario[]> = {
  large: [],
  'web-ops': [
    {
      question: 'Which hosts are saturated?',
      kiIds: ['ki-overview-cpu-2', 'ki-010', 'ki-060'],
      withContext: { tokens: 3800, seconds: 9 },
      withoutContext: { steps: SIX_STEPS, tokens: 9400, seconds: 31 },
    },
    {
      question: 'What does event.duration mean in nginx logs?',
      kiIds: ['ki-overview-nginx-access-2', 'ki-001', 'ki-overview-nginx-access-3'],
      withContext: { tokens: 2100, seconds: 7 },
      withoutContext: {
        steps: ['List indices', 'Read the mapping of 2 indices', 'Sample documents', 'Answer'],
        tokens: 6700,
        seconds: 22,
      },
    },
    {
      question: 'Who owns the payments runbook?',
      kiIds: ['ki-digest-runbooks-4', 'ki-020', 'ki-040'],
      withContext: { tokens: 2600, seconds: 8 },
      withoutContext: {
        steps: [
          'List indices and connectors',
          'Search SRE Runbooks',
          'Read 3 pages',
          'Check the on-call policy',
          'Answer',
        ],
        tokens: 8200,
        seconds: 27,
      },
    },
  ],
  'higher-ed': [
    {
      question: 'What is the four-year graduation rate?',
      kiIds: ['he-001', 'he-004'],
      ...HIGHER_ED_FIGURES,
    },
    {
      question: 'How does tuition compare with peer universities?',
      kiIds: ['he-004', 'he-002', 'he-003'],
      ...HIGHER_ED_FIGURES,
    },
    {
      question: 'Which fees changed this year?',
      kiIds: ['he-005', 'he-002'],
      ...HIGHER_ED_FIGURES,
    },
  ],
};

const testScenariosFor = (namespace: Namespace) =>
  TEST_SCENARIOS[sampleScenarioOf(namespace) ?? 'web-ops'];

const normalizeQuestion = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[?.!\s]+$/, '');

const STOP_WORDS = new Set([
  'what',
  'which',
  'does',
  'with',
  'this',
  'that',
  'from',
  'have',
  'there',
  'their',
  'about',
  'when',
  'where',
  'into',
  'year',
  'mean',
  'show',
  'tell',
  'many',
  'much',
  'your',
]);

const keywordMatches = (indicators: KnowledgeIndicator[], question: string) => {
  const stems = (question.toLowerCase().match(/[a-z0-9_.-]+/g) ?? [])
    .map((word) => word.replace(/[.-]+$/, ''))
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .map((word) => word.slice(0, Math.max(4, word.length - 3)));
  if (stems.length === 0) return [];
  return indicators
    .map((indicator, index) => {
      const text = `${indicator.title} ${indicator.description} ${indicator.content}`.toLowerCase();
      return { indicator, index, score: stems.filter((stem) => text.includes(stem)).length };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((match) => match.indicator);
};

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

const estimatedFigures = (namespace: Namespace, hits: number) => {
  const indices = Math.max(
    1,
    namespace.sources.filter((source) => source.typeLabel === 'Index').length
  );
  const retrieved = Math.max(1, hits);
  return {
    withContext: { tokens: roundTo(1200 + 800 * retrieved, 100), seconds: 4 + 3 * retrieved },
    withoutContext: {
      steps: [
        'List indices',
        `Read the mapping of ${indices === 1 ? '1 index' : `${indices} indices`}`,
        'Sample documents',
        'Write a query',
        'Answer',
      ],
      tokens: roundTo(2400 + 1700 * indices, 100),
      seconds: 12 + 7 * indices,
    },
  };
};

/** Example questions for an AI index, from its sample scenario. */
export const testQuestionExamples = (namespace: Namespace): string[] =>
  testScenariosFor(namespace).map((scenario) => scenario.question);

/** Scripted dry run: which KIs answer the question, and what the agent would do without them. */
export const runTestQuestion = (namespace: Namespace, question: string): TestQuestionResult => {
  const scripted = testScenariosFor(namespace).find(
    (scenario) => normalizeQuestion(scenario.question) === normalizeQuestion(question)
  );
  if (scripted) {
    const found = scripted.kiIds.flatMap((id) => {
      const indicator = namespace.indicators.find((item) => item.id === id);
      return indicator ? [indicator] : [];
    });
    if (found.length === scripted.kiIds.length) {
      return {
        indicators: found,
        withContext: scripted.withContext,
        withoutContext: scripted.withoutContext,
      };
    }
    if (found.length > 0) {
      return { indicators: found, ...estimatedFigures(namespace, found.length) };
    }
  }
  const indicators = keywordMatches(namespace.indicators, question);
  return { indicators, ...estimatedFigures(namespace, indicators.length) };
};

// ---------- automation card copy ----------

export const proto11AddedLine = (automation: Automation, namespace: Namespace) => {
  if (namespace.proto11?.sample) return 'Added by Elastic AI Agent, completed on sample data';
  switch (automation.runStatus) {
    case 'firstPass':
      return 'Added by Elastic AI Agent, first pass running';
    case 'sampleReady':
      return 'Added by Elastic AI Agent, first pass ran on a sample just now';
    case 'running':
      return namespace.proto11?.fix === 'rerunning'
        ? 'Added by Elastic AI Agent, re-running rejected Knowledge Indicators'
        : 'Added by Elastic AI Agent, running on all data';
    case 'needsAgent':
      return (namespace.traces?.length ?? 0) > 0
        ? 'Added by Elastic AI Agent, agent attached'
        : 'Added by Elastic AI Agent, waiting for an agent';
    default:
      return 'Added by Elastic AI Agent, last run just now';
  }
};

export const proto11StatusPill = (
  automation: Automation,
  namespace: Namespace
): { label: string; color: 'primary' | 'success' | 'hollow' | 'default' | 'warning' } => {
  if (!automation.enabled) return { label: 'Disabled', color: 'hollow' };
  switch (automation.runStatus) {
    case 'firstPass':
      return { label: 'Running first pass', color: 'primary' };
    case 'sampleReady':
      return { label: 'Ran on a sample', color: 'default' };
    case 'running':
      return { label: 'Running', color: 'primary' };
    case 'needsAgent':
      return (namespace.traces?.length ?? 0) > 0
        ? { label: 'Enabled', color: 'success' }
        : { label: 'Needs an agent', color: 'warning' };
    default:
      return { label: 'Enabled', color: 'success' };
  }
};
