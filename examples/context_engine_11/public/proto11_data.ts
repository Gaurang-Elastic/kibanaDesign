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
  Proto11GoalId,
  Proto11Meta,
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
}

export const WEB_OPS_SOURCES: WebOpsSource[] = [
  {
    id: 'nginx-access',
    name: 'logs-nginx.access-default',
    kind: 'Index',
    summary: 'HTTP access logs from the public edge',
    keywords: ['nginx', 'access', 'http', 'traffic', 'latenc\\w*', 'checkout'],
  },
  {
    id: 'nginx-error',
    name: 'logs-nginx.error-default',
    kind: 'Index',
    summary: 'nginx error log lines',
    keywords: ['nginx', 'errors?', 'outages?'],
  },
  {
    id: 'cpu',
    name: 'metrics-system.cpu-default',
    kind: 'Index',
    summary: 'Host CPU metrics, every 10s',
    keywords: ['cpu', 'host\\w*', 'metrics?', 'saturat\\w*'],
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
  },
];

const sourceById = (id: Proto11SourceId) =>
  WEB_OPS_SOURCES.find((source) => source.id === id) as WebOpsSource;

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
    scheduleLabel: 'Runs daily',
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
    scheduleLabel: 'Runs weekly',
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
    scheduleLabel: 'Runs daily',
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
    scheduleLabel: 'Runs daily',
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
    scheduleLabel: 'Runs hourly',
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
  'web-ops-assistant',
  'Significant Events Judge',
  'loyalty-support-agent',
];
export const GENAI_TRACE_OPTIONS = ['traces-genai.otel-default'];

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
    rejected: source === 'nginx-error' || (source === 'cpu' && CPU_REJECTED.has(title)),
  }))
);

const PORTED_KIS: PortedKi[] = [...HAND_WRITTEN, ...fillerKis];

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
    fix: 'error.msg does not exist in logs-nginx.error-default. The field is error.message.',
  },
  cpu: {
    reason: 'ES|QL syntax is invalid',
    verifier: 'esql-valid-syntax',
    example: 'CPU by availability zone',
    error: "line 2:9: mismatched input 'BY' expecting {'(', ...}",
    query:
      'FROM metrics-system.cpu-default\n| STATS BY cloud.availability_zone AVG(system.cpu.total.norm.pct)',
    fix: 'The CPU queries put BY before the aggregation.',
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

export const sourceHasOutstandingRejections = (meta: Proto11Meta, sourceName: string) =>
  outstandingRejected(meta) > 0 &&
  failureGroupsFor(meta).some((group) => group.sourceName === sourceName);

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

const descriptionFor = (goal: GoalDef, sourceIds: Proto11SourceId[], agent?: string) => {
  const names = sourceIds.map(sourceDisplayName);
  const indexNames = sourceIds
    .filter((id) => sourceById(id).kind === 'Index')
    .map(sourceDisplayName);
  switch (goal.id) {
    case 'indices':
      return `Helps agents understand what ${joinList(
        indexNames.length ? indexNames : names
      )} contain and how to query them.`;
    case 'multi':
      return `Helps agents pick the right source among ${joinList(
        names
      )} and join them on shared fields.`;
    case 'docs':
      return `Helps agents answer from ${joinList(
        names
      )} with short facts distilled from each page.`;
    case 'entities':
      return `Helps agents describe the services found in ${joinList(
        names
      )}, with their traffic, errors and owners.`;
    case 'gaps':
    default:
      return `Helps agents answer the questions ${
        agent ?? 'your agent'
      } got wrong, using ${joinList(names)}.`;
  }
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
  sourceIds?: Proto11SourceId[];
  trace?: IndexTrace;
  intent?: string;
  /** Words from the description that triggered a second Learn from traces automation. */
  struggleWords?: string[];
}

/** A working AI index straight from a goal: sources chosen, automation running its first pass. */
export const createProto11Namespace = ({
  goalId,
  takenNames,
  sourceIds,
  trace,
  intent,
  struggleWords,
}: CreateFromGoalOptions): Namespace => {
  const goal = goalById(goalId);
  const chosen = sourceIds && sourceIds.length > 0 ? sourceIds : goal.defaultSources;
  const name = uniqueName(goal.baseName, takenNames);
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
    proto11: freshMeta(goalId, chosen, runTemplates, agent),
  };
};

/** The finished sample index: five sources, two completed automations, no rejections. */
export const createSampleNamespace = (): Namespace => {
  const name = SAMPLE_INDEX_NAME;
  const indexName = backingIndexName(name);
  const sourceIds = WEB_OPS_SOURCES.map((source) => source.id);
  const kis = PORTED_KIS.filter((ki) => ki.source !== 'traces');
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
    phase: 'complete',
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

/** One step of the simulated runs. Returns the same object when nothing changes. */
export const advanceProto11 = (namespace: Namespace): Namespace => {
  const meta = namespace.proto11;
  if (!meta || meta.sample) return namespace;
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
    const fixTick = next.fixTick + 1;
    const fixed = Math.min(
      plan.rejected.length,
      Math.round((plan.rejected.length * fixTick) / RERUN_TICKS)
    );
    next =
      fixTick >= RERUN_TICKS
        ? {
            ...next,
            fix: 'fixed',
            fixTick: 0,
            written: { ...next.written, fixed: plan.rejected.length },
          }
        : { ...next, fixTick, written: { ...next.written, fixed } };
  } else if (next.fix === 'fixed') {
    const fixTick = next.fixTick + 1;
    next = fixTick >= NOTE_TICKS ? { ...next, fix: 'done', fixTick: 0 } : { ...next, fixTick };
  }

  return next === meta ? namespace : withWritten(namespace, next);
};

export const startFullRun = (namespace: Namespace): Namespace => {
  const meta = namespace.proto11;
  if (!meta || meta.phase !== 'sampleReady') return namespace;
  const next: Proto11Meta = { ...meta, phase: 'fullRun', tick: 0 };
  return setRunStatus({ ...namespace, proto11: next }, next, 'running', false);
};

export const startRerun = (namespace: Namespace): Namespace => {
  const meta = namespace.proto11;
  if (!meta || meta.fix !== 'none') return namespace;
  return { ...namespace, proto11: { ...meta, fix: 'rerunning', fixTick: 0 } };
};

// ---------- describe what your agent does ----------

const STRUGGLE_WORDS = [
  'wrong',
  'fail\\w*',
  'struggl\\w*',
  'mistakes?',
  'hallucinat\\w*',
  'incorrect\\w*',
];
const QUERY_WORDS = ['fields?', 'quer(?:y|ies)', 'es\\|ql', 'mappings?', 'ind(?:ex|ices|exes)'];
const DOC_WORDS = ['runbooks?', 'polic(?:y|ies)', 'playbooks?', 'docs?', 'documents?'];
const ENTITY_WORDS = ['services?', 'customers?', 'entit(?:y|ies)', 'hosts?', 'profiles?'];

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

export interface Proto11Proposal {
  goal: Proto11GoalId;
  /** Words from the description that picked the goal. Empty when it is the default. */
  goalWords: string[];
  sourceIds: Proto11SourceId[];
  /** Words from the description that picked the sources. Empty when they are the goal defaults. */
  sourceWords: string[];
  struggleWords: string[];
}

/** Keyword match, honest about which words were matched. */
export const proposeFromDescription = (text: string): Proto11Proposal => {
  const struggleWords = matchedWords(text, STRUGGLE_WORDS);
  const queryWords = matchedWords(text, QUERY_WORDS);
  const docWords = matchedWords(text, DOC_WORDS);
  const entityWords = matchedWords(text, ENTITY_WORDS);

  const sourceMatches = WEB_OPS_SOURCES.flatMap((source) => {
    const word = source.keywords.map((keyword) => matchedWords(text, [keyword])[0]).find(Boolean);
    return word ? [{ id: source.id, word }] : [];
  });
  const sourceWords = sourceMatches
    .map((item) => item.word)
    .filter(
      (word, index, all) =>
        all.findIndex((other) => other.toLowerCase() === word.toLowerCase()) === index
    );

  let goal: Proto11GoalId = 'indices';
  let goalWords: string[] = [];
  if (queryWords.length > 0) {
    goal = 'indices';
    goalWords = queryWords;
  } else if (docWords.length > 0) {
    goal = 'docs';
    goalWords = docWords;
  } else if (entityWords.length > 0) {
    goal = 'entities';
    goalWords = entityWords;
  } else if (sourceMatches.length >= 2) {
    goal = 'multi';
    goalWords = sourceWords;
  } else if (struggleWords.length > 0) {
    goal = 'gaps';
    goalWords = struggleWords;
  }

  const def = goalById(goal);
  let sourceIds = sourceMatches.map((item) => item.id);
  let matchedSourceWords = sourceWords;
  if (sourceIds.length === 0) {
    sourceIds = def.defaultSources;
    matchedSourceWords = [];
  } else if (templateSources(def.template, sourceIds).length === 0) {
    sourceIds = [...sourceIds, ...def.defaultSources.filter((id) => !sourceIds.includes(id))];
  }

  return {
    goal,
    goalWords,
    sourceIds,
    sourceWords: matchedSourceWords,
    struggleWords: goal === 'gaps' ? [] : struggleWords,
  };
};

export const becauseMentions = (words: string[]) => `because it mentions ${joinList(words)}`;

export const sourceName = (id: Proto11SourceId) => sourceById(id).name;

export const EXAMPLE_DESCRIPTION =
  'My agent helps on-call engineers investigate checkout outages using our nginx logs, host CPU metrics and SRE runbooks. It often gets field names wrong and writes ES|QL that fails.';

// ---------- automation card copy ----------

export const proto11AddedLine = (automation: Automation, namespace: Namespace) => {
  if (namespace.proto11?.sample) return 'Added by Elastic AI Agent, completed on sample data';
  switch (automation.runStatus) {
    case 'firstPass':
      return 'Added by Elastic AI Agent, first pass running';
    case 'sampleReady':
      return 'Added by Elastic AI Agent, first pass ran on a sample just now';
    case 'running':
      return 'Added by Elastic AI Agent, running on all data';
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
