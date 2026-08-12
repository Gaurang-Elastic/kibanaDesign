/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  elasticIndicators,
  indicatorsForNamespace,
  nightshiftIndicators,
  salesIndicators,
  statsFromIndicators,
  supportIndicators,
  type KnowledgeIndicator,
} from './knowledge_indicators';

export type { KnowledgeIndicator } from './knowledge_indicators';

export interface NamespaceSource {
  name: string;
  subtitle: string;
  typeLabel: string;
  icon: string;
}

export interface Automation {
  id: string;
  title: string;
  type: string;
  ownership: string;
  tags: string[];
  description: string;
  evidence?: string;
}

export interface KnowledgeStats {
  playbooks: number;
  policies: number;
  faqs: number;
  glossaries: number;
  facts: number;
}

export interface IssueSubPattern {
  title: string;
  traces: number;
  examples: string;
}

export interface MonitoringIssue {
  id: string;
  title: string;
  severity: 'high' | 'medium';
  traces: number;
  description: string;
  fixPath: string;
  rootCause: string;
  detectionSignal: string;
  subPatterns: IssueSubPattern[];
  suggestedFix: string;
  suggestedFixDetail: string;
}

export type NamespaceStorageType = 'index' | 'dataStream';

export type NamespaceIntentType = 'describe' | 'traces' | 'upload';

/** Catalog lifecycle: created → configured → connected (connectors pattern). */
export type NamespaceLifecycleStatus = 'needsSetup' | 'settingUp' | 'ready';

export type CatalogLifecycleBadge =
  | { kind: 'needsSetup' }
  | { kind: 'settingUp' }
  | { kind: 'issues'; count: number }
  | { kind: 'ready' };

export interface NamespaceIntent {
  type: NamespaceIntentType;
  value: string;
}

export interface Namespace {
  name: string;
  sources: string[];
  sourceDetails: NamespaceSource[];
  integration: string;
  updated: string;
  description: string;
  indexName: string;
  storageType: NamespaceStorageType;
  /**
   * Mock/catalog lifecycle. Precedence for the card badge:
   * Needs setup > Setting up > issues > Ready.
   */
  lifecycleStatus: NamespaceLifecycleStatus;
  /** Built-in / system-managed namespace (not user-created). */
  managed?: boolean;
  /** Created via the Create AI index wizard in this session/proto. */
  userCreated?: boolean;
  /** Proto create-flow intent (describe, traces summary, or upload inference). */
  intent?: NamespaceIntent;
  automations: Automation[];
  suggestedAutomations: Automation[];
  knowledge: KnowledgeStats;
  indicators: KnowledgeIndicator[];
  monitoring: {
    connected: boolean;
    traceId?: string;
    traceLabel?: string;
    traceCount?: number;
    issuesSummary?: string;
    issues: MonitoringIssue[];
    /**
     * When false on a user-created index, Monitoring shows the connected-but-awaiting-analysis
     * state instead of issues + efficiency. Prebuilt indexes ignore this.
     */
    analysisReady?: boolean;
    /** Payoff metrics vs no-context baseline (shown when traces are connected). */
    efficiency?: {
      retrievalHitRate: number;
      tokensSavedPct: number;
      medianLatencyMs: number;
    };
  };
}

export const storageTypeLabel = (storageType: NamespaceStorageType) =>
  storageType === 'dataStream' ? 'ds' : 'idx';

export const namespaceIssueCount = (namespace: Namespace) => namespace.monitoring.issues.length;

export const namespaceIsHealthy = (namespace: Namespace) => namespaceIssueCount(namespace) === 0;

/** Resolve the single catalog badge from lifecycle + health precedence. */
export const resolveCatalogLifecycle = (namespace: Namespace): CatalogLifecycleBadge => {
  if (namespace.lifecycleStatus === 'needsSetup') {
    return { kind: 'needsSetup' };
  }
  if (namespace.lifecycleStatus === 'settingUp') {
    return { kind: 'settingUp' };
  }
  const issueCount = namespaceIssueCount(namespace);
  if (issueCount > 0) {
    return { kind: 'issues', count: issueCount };
  }
  return { kind: 'ready' };
};

const supportIssues: MonitoringIssue[] = [
  {
    id: 'disambiguation',
    title: 'KI names the entity but omits its disambiguating criterion',
    severity: 'high',
    traces: 13,
    description:
      'The KI captures an entity→attribute fact (e.g. "X is a Y") but never states the specific fact that separates the correct entity from a near-twin. Agents retrieve the right topic, then answer with the wrong sibling.',
    fixPath: "Add criterion-bound KI (rephrase existing entity's fact)",
    rootCause:
      'Extraction stops at the primary entity fact and never emits the distinguishing attribute that would resolve same-class confusion.',
    detectionSignal:
      "Failing trace where a retrieved KI shares the topic of the gold doc, but the agent's answer is a same-class entity (different university, athlete, album, etc.).",
    subPatterns: [
      {
        title: 'Two-institution confusion',
        traces: 3,
        examples: 'universities / colleges / chancellorships',
      },
      {
        title: 'Two-person same-field confusion',
        traces: 4,
        examples: 'athletes, scientists, authors, footballers',
      },
      {
        title: 'Two-work / two-place confusion',
        traces: 6,
        examples: 'towns, albums, book series, tracks',
      },
    ],
    suggestedFix:
      "Emit an additional 'criterion-bound' KI that joins the entity to its distinctive attributes, and front-load the answerable fact in the title so retrieval ranks it ahead of near-twins.",
    suggestedFixDetail:
      'prompt-level: bind entity to distinguishing attributes; front-load answer in title',
  },
  {
    id: 'numeric-facts',
    title: 'Numeric attributes (dates, percentages, amounts) are never extracted as facts',
    severity: 'high',
    traces: 4,
    description:
      'Extraction prefers narrative facts and skips measurable attributes, so agents invent or omit numbers when answering.',
    fixPath: 'Add numeric-fact extractor for dates, percentages, and amounts',
    rootCause: 'The fact schema treats numbers as optional metadata rather than first-class KIs.',
    detectionSignal: 'Gold answers contain a concrete number that never appears in retrieved KIs.',
    subPatterns: [
      { title: 'Date / SLA confusion', traces: 2, examples: 'response windows, renewal dates' },
      { title: 'Amount / threshold misses', traces: 2, examples: 'refund caps, severity cutoffs' },
    ],
    suggestedFix:
      'Add an extraction pass that emits numeric facts with units and binding criteria, then index them with answer-forward titles.',
    suggestedFixDetail: 'schema: require numeric attributes as typed facts with units',
  },
  {
    id: 'verbatim-titles',
    title: 'Long verbatim titles are summarized or dropped at extraction',
    severity: 'medium',
    traces: 3,
    description:
      'Titles that agents need to quote are shortened during extraction, so retrieval matches loosely and citations fail.',
    fixPath: 'Preserve verbatim titles as dedicated KI fields',
    rootCause: 'Title compaction removes distinctive phrases needed for exact retrieval.',
    detectionSignal: 'Agent paraphrases a title that exists verbatim in the source corpus.',
    subPatterns: [
      { title: 'Policy title truncation', traces: 2, examples: 'macro names, playbook titles' },
      { title: 'Article headline loss', traces: 1, examples: 'KB article titles' },
    ],
    suggestedFix:
      'Store a verbatim_title field alongside a short retrieval title, and prefer the verbatim form when evidence is cited.',
    suggestedFixDetail: 'index both short_title and verbatim_title; cite verbatim on answer',
  },
];

/** Managed Elastic index shown alone on first-run. Id stays "Elastic"; UI label is Elastic AI Index. */
export const managedElasticNamespace: Namespace = {
    name: 'Elastic',
    sources: ['Dashboards', 'Alerts', 'SLOs', 'Visualisations'],
    sourceDetails: [
      {
        name: 'Dashboards',
        subtitle: 'Saved Kibana dashboards',
        typeLabel: 'Elastic feature',
        icon: 'dashboardApp',
      },
      {
        name: 'Alerts',
        subtitle: 'Rule-based alerts & connectors',
        typeLabel: 'Elastic feature',
        icon: 'bell',
      },
      {
        name: 'SLOs',
        subtitle: 'Service level objectives',
        typeLabel: 'Elastic feature',
        icon: 'visGauge',
      },
      {
        name: 'Visualisations',
        subtitle: 'Lens, TSVB & saved visualisations',
        typeLabel: 'Elastic feature',
        icon: 'visualizeApp',
      },
    ],
    integration: 'Elastic (built-in)',
    updated: 'managed by Elastic',
    description:
      'Drawn from 4 sources (Dashboards, Visualisations, Alerts, SLOs). Covers Elastic product surfaces, operational health signals, and the policies your agents ask about most, and is kept fresh by automations as the underlying data changes.',
    indexName: '.context-idx-elastic',
    storageType: 'index',
    lifecycleStatus: 'ready',
    managed: true,
    automations: [
      {
        id: 'elastic-descriptor',
        title: 'elastic features index descriptor',
        type: 'INDEX DESCRIPTOR',
        ownership: 'MANAGED BY ELASTIC',
        tags: ['Dashboards', 'Index Metadata'],
        description:
          'Field-level schema summary across Elastic feature sources for retrieval routing.',
        evidence: '28 fields · refreshes hourly · key fields: dashboard_id, alert_rule, slo_id',
      },
      {
        id: 'elastic-slo-facts',
        title: 'SLO breach resolution patterns',
        type: 'FACT',
        ownership: 'MANAGED BY ELASTIC',
        tags: ['SLOs', 'Bottom-Up'],
        description:
          'Common remediation steps when SLOs burn through error budget, grounded in linked alerts and dashboards.',
        evidence: 'Evidence: 9 docs',
      },
      {
        id: 'elastic-alert-routing',
        title: 'Alert routing preferences',
        type: 'FACT',
        ownership: 'MANAGED BY ELASTIC',
        tags: ['Alerts', 'Bottom-Up'],
        description:
          'How alert severity maps to responders and which dashboards agents should open first.',
        evidence: 'Evidence: 6 docs',
      },
    ],
    suggestedAutomations: [
      {
        id: 'elastic-viz-extract',
        title: 'Extract Knowledge Indicators from Visualisations',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Visualisations', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of chart intent, metrics, and filter patterns from saved visualisations.',
      },
    ],
    indicators: elasticIndicators,
    knowledge: statsFromIndicators(elasticIndicators),
    monitoring: {
      connected: true,
      traceId: 'traces-apm.agent-elastic-context.default',
      traceLabel: 'Elastic · 1,102 traces',
      traceCount: 1102,
      issuesSummary: 'No KI-addressable issues detected',
      issues: [],
      efficiency: {
        retrievalHitRate: 96,
        tokensSavedPct: 51,
        medianLatencyMs: 140,
      },
    },
};

/**
 * Pre-existing AI indexes in this environment. Proto/demo: surfaced after the
 * user's first create via hasCreatedIndex, not because create caused them.
 */
export const demoEnvironmentNamespaces: Namespace[] = [
  {
    name: 'Nightshift',
    sources: ['Root logs', 'Error signals'],
    sourceDetails: [
      {
        name: 'Root logs Stream',
        subtitle: 'Live · root application log signals',
        typeLabel: 'Stream signal',
        icon: 'visBarVertical',
      },
      {
        name: 'Service error signals',
        subtitle: 'Live · error-rate and exception signals',
        typeLabel: 'Stream signal',
        icon: 'warning',
      },
    ],
    integration: 'LangGraph',
    updated: '2 hours ago',
    description:
      'Drawn from 2 sources (Root logs Stream, Service error signals). Covers overnight incident patterns, recurring exceptions, and the resolution paths on-call agents rely on, and is kept fresh by automations as the underlying data changes.',
    indexName: '.context-ds-nightshift',
    storageType: 'dataStream',
    lifecycleStatus: 'ready',
    automations: [
      {
        id: 'nightshift-extract-root',
        title: 'Extract Knowledge Indicators from Root logs Stream',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Root logs Stream', 'Bottom-Up'],
        description:
          'Bottom-up extraction of entities, facts and resolution patterns from Root logs Stream.',
        evidence: 'Evidence: 11 docs · refreshes hourly',
      },
      {
        id: 'nightshift-extract-errors',
        title: 'Extract Knowledge Indicators from Service error signals',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Service error signals', 'Bottom-Up'],
        description:
          'Clusters of overnight exceptions with the playbook that usually clears them before morning standup.',
        evidence: 'Evidence: 8 docs',
      },
      {
        id: 'nightshift-consolidator',
        title: 'KI consolidator automation',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Root logs Stream', 'Service error signals', 'Bottom-Up'],
        description:
          'Merges near-duplicate overnight facts and keeps a single canonical KI per exception signature.',
        evidence: 'Evidence: 5 docs',
      },
    ],
    suggestedAutomations: [
      {
        id: 'nightshift-extract',
        title: 'Extract Knowledge Indicators from Root logs Stream',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Root logs Stream', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of entities, facts and resolution patterns from Root logs Stream.',
      },
      {
        id: 'nightshift-schema',
        title: 'Index metadata & schema descriptor',
        type: 'INDEX DESCRIPTOR',
        ownership: 'NEW',
        tags: ['Service error signals', 'Index Metadata', 'new'],
        description: 'Field-level schema summary across all sources for retrieval routing.',
      },
    ],
    indicators: nightshiftIndicators,
    // Catalog KI count for demo (matches earlier proto copy); indicators remain illustrative.
    knowledge: {
      playbooks: 3,
      policies: 2,
      faqs: 3,
      glossaries: 1,
      facts: 2,
    },
    monitoring: {
      connected: true,
      traceId: 'traces-otel-langgraph.nightshift-default',
      traceLabel: 'Nightshift · 486 traces',
      traceCount: 486,
      issuesSummary: '12 of 14 failing traces are KI-addressable',
      issues: supportIssues.slice(0, 2).map((issue) => ({
        ...issue,
        id: `nightshift-${issue.id}`,
        traces: Math.max(2, Math.floor(issue.traces / 2)),
      })),
      efficiency: {
        retrievalHitRate: 92,
        tokensSavedPct: 43,
        medianLatencyMs: 180,
      },
    },
  },
  {
    name: 'Support ticket triage agent',
    sources: ['Zendesk', 'Confluence'],
    sourceDetails: [
      {
        name: 'Zendesk tickets',
        subtitle: 'Connectors',
        typeLabel: 'Connectors',
        icon: 'plugs',
      },
      {
        name: 'Confluence space',
        subtitle: 'Index',
        typeLabel: 'Index',
        icon: 'documents',
      },
    ],
    integration: 'LangChain',
    updated: '3 days ago',
    description:
      'Drawn from 2 sources (Zendesk tickets, Confluence space). Covers the entities, policies and resolution patterns your agents ask about most, and is kept fresh by automations as the underlying data changes.',
    indexName: '.context-support-triage-v1',
    storageType: 'index',
    lifecycleStatus: 'ready',
    automations: [
      {
        id: 'zendesk-descriptor',
        title: 'zendesk-tickets index descriptor',
        type: 'INDEX DESCRIPTOR',
        ownership: 'MANAGED BY ELASTIC',
        tags: ['Zendesk tickets', 'Index Metadata'],
        description:
          'Field-level schema summary across Zendesk ticket fields for retrieval routing.',
        evidence: '14 fields · refreshes hourly · key fields: priority, product, assignee',
      },
      {
        id: 'resolution-patterns',
        title: 'Common resolution patterns',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Zendesk tickets', 'Bottom-Up'],
        description:
          'Password reset issues resolve fastest when linked to the account-recovery macro and the identity verification playbook.',
        evidence: 'Evidence: 3 docs',
      },
      {
        id: 'escalation-triggers',
        title: 'Escalation triggers',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Zendesk tickets', 'Bottom-Up'],
        description:
          'Tickets mentioning "data loss" or "security incident" should be escalated within 15 minutes to the on-call security queue.',
        evidence: 'Evidence: 5 docs',
      },
      {
        id: 'response-tone',
        title: 'Response tone examples',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Confluence space', 'Bottom-Up'],
        description:
          'Preferred response styles for frustrated customers: acknowledge impact first, then outline the next concrete step.',
        evidence: 'Evidence: 2 docs',
      },
    ],
    suggestedAutomations: [
      {
        id: 'zendesk-extract',
        title: 'Extract Knowledge Indicators from Zendesk tickets',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Zendesk tickets', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of entities, facts and resolution patterns from Zendesk tickets.',
      },
      {
        id: 'confluence-extract',
        title: 'Extract Knowledge Indicators from Confluence space',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Confluence space', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of policies, macros and troubleshooting guides from Confluence.',
      },
      {
        id: 'support-schema',
        title: 'Index metadata & schema descriptor',
        type: 'INDEX DESCRIPTOR',
        ownership: 'NEW',
        tags: ['Zendesk tickets', 'Index Metadata', 'new'],
        description: 'Field-level schema summary across all sources for retrieval routing.',
      },
      {
        id: 'support-macros',
        title: 'Index account-recovery macros',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Confluence space', 'Bottom-Up', 'new'],
        description:
          'Pull macro titles and trigger phrases into answer-forward Knowledge Indicators.',
      },
    ],
    indicators: supportIndicators,
    knowledge: {
      playbooks: 2,
      policies: 3,
      faqs: 2,
      glossaries: 1,
      facts: 2,
    },
    monitoring: {
      connected: true,
      traceId: 'traces-apm.agent-support-ticket-triage-agent.default',
      traceLabel: 'Support ticket triage agent · 842 traces',
      traceCount: 842,
      issuesSummary: 'No KI-addressable issues detected',
      issues: [],
      efficiency: {
        retrievalHitRate: 94,
        tokensSavedPct: 47,
        medianLatencyMs: 165,
      },
    },
  },
  {
    name: 'Sales outreach agent',
    sources: ['Salesforce', 'Gmail'],
    sourceDetails: [
      {
        name: 'Salesforce',
        subtitle: 'CRM opportunities & accounts',
        typeLabel: 'Connectors',
        icon: 'tableDensityExpanded',
      },
      {
        name: 'Gmail',
        subtitle: 'Outbound sequences & replies',
        typeLabel: 'Connectors',
        icon: 'email',
      },
    ],
    integration: 'Claude Agent SDK',
    updated: '1 week ago',
    description:
      'Drawn from 2 sources (Salesforce, Gmail). Covers account context, outreach sequencing, and the objection patterns that close deals, and is kept fresh by automations as the underlying data changes.',
    indexName: '.context-idx-sales-outreach',
    storageType: 'index',
    lifecycleStatus: 'ready',
    automations: [
      {
        id: 'salesforce-descriptor',
        title: 'salesforce opportunities descriptor',
        type: 'INDEX DESCRIPTOR',
        ownership: 'MANAGED BY ELASTIC',
        tags: ['Salesforce', 'Index Metadata'],
        description: 'Field-level schema summary for opportunity and account objects.',
        evidence: '19 fields · refreshes hourly · key fields: stage, amount, owner',
      },
      {
        id: 'objection-patterns',
        title: 'Common objection patterns',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Gmail', 'Bottom-Up'],
        description:
          'Pricing and timing objections resolve best when the reply leads with a customer proof point before the discount path.',
        evidence: 'Evidence: 7 docs',
      },
      {
        id: 'sequence-tone',
        title: 'Outreach sequence tone',
        type: 'FACT',
        ownership: 'ADDED BY YOU',
        tags: ['Gmail', 'Bottom-Up'],
        description:
          'First-touch emails that reference a recent product launch outperform generic templates by a wide margin.',
        evidence: 'Evidence: 4 docs',
      },
    ],
    suggestedAutomations: [
      {
        id: 'sales-extract',
        title: 'Extract Knowledge Indicators from Salesforce',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Salesforce', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of account facts, closed-won patterns and stakeholder maps from Salesforce.',
      },
      {
        id: 'gmail-extract',
        title: 'Extract Knowledge Indicators from Gmail',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Gmail', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of reply patterns and objection handling from outbound sequences.',
      },
    ],
    indicators: salesIndicators,
    knowledge: {
      playbooks: 2,
      policies: 2,
      faqs: 3,
      glossaries: 1,
      facts: 2,
    },
    monitoring: {
      connected: false,
      issues: [],
    },
  },
  {
    name: 'runbook-draft',
    sources: ['Confluence space'],
    sourceDetails: [
      {
        name: 'Confluence space',
        subtitle: 'Internal runbooks · draft space',
        typeLabel: 'Connector',
        icon: 'documents',
      },
    ],
    integration: '',
    updated: 'yesterday',
    description:
      'Started from Confluence runbooks. Sources are attached, but no automations are enabled yet.',
    indexName: '.context-idx-runbook-draft',
    storageType: 'index',
    lifecycleStatus: 'needsSetup',
    userCreated: true,
    automations: [],
    suggestedAutomations: [
      {
        id: 'runbook-extract',
        title: 'Extract Knowledge Indicators from Confluence space',
        type: 'FACT',
        ownership: 'NEW',
        tags: ['Confluence space', 'Bottom-Up', 'new'],
        description:
          'Bottom-up extraction of runbook steps, escalation paths, and ownership from Confluence.',
      },
    ],
    indicators: [],
    knowledge: {
      playbooks: 0,
      policies: 0,
      faqs: 0,
      glossaries: 0,
      facts: 0,
    },
    monitoring: {
      connected: false,
      analysisReady: false,
      issues: [],
    },
  },
];

export const initialNamespaces: Namespace[] = [
  managedElasticNamespace,
  ...demoEnvironmentNamespaces,
];

export const MANAGED_ELASTIC_DISPLAY_NAME = 'Elastic AI Index';
export const MANAGED_ELASTIC_ENABLED_KI_COUNT = 14;

export const knowledgeTotal = (knowledge: KnowledgeStats) =>
  knowledge.playbooks +
  knowledge.policies +
  knowledge.faqs +
  knowledge.glossaries +
  knowledge.facts;

/** Generates an automated namespace description from its sources, KIs, and automations. */
export const buildChatDescription = (namespace: Namespace): string => {
  const sourceList = namespace.sources.join(', ') || 'no sources yet';
  const sourceCount = namespace.sources.length;
  const kiTotal = knowledgeTotal(namespace.knowledge);
  const kiBreakdown = [
    namespace.knowledge.playbooks > 0 ? `${namespace.knowledge.playbooks} playbooks` : null,
    namespace.knowledge.policies > 0 ? `${namespace.knowledge.policies} policies` : null,
    namespace.knowledge.faqs > 0 ? `${namespace.knowledge.faqs} FAQs` : null,
    namespace.knowledge.glossaries > 0 ? `${namespace.knowledge.glossaries} glossaries` : null,
    namespace.knowledge.facts > 0 ? `${namespace.knowledge.facts} facts` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const automationTitles = namespace.automations.slice(0, 3).map(({ title }) => title);
  const automationLine =
    automationTitles.length > 0
      ? ` Active automations include ${automationTitles.join('; ')}${
          namespace.automations.length > 3 ? `, and ${namespace.automations.length - 3} more` : ''
        }.`
      : ' Automations can be added to extract and refresh Knowledge Indicators as sources change.';

  const monitoringLine = namespace.monitoring.connected
    ? ` Agent traces are connected (${
        namespace.monitoring.traceCount?.toLocaleString() || 0
      } traces) so failures can be turned into KI improvements.`
    : ' Connect agent traces later to refine this description from real agent activity.';

  return `${namespace.name} is a context namespace for ${
    namespace.integration
  }, drawn from ${sourceCount} source${
    sourceCount === 1 ? '' : 's'
  }: ${sourceList}. It grounds agents on the entities, policies, and resolution patterns that matter most for this use case.${
    kiTotal > 0
      ? ` The index currently holds ${kiTotal} Knowledge Indicators (${kiBreakdown}).`
      : ' Knowledge Indicators will appear here once extraction automations run.'
  }${automationLine}${monitoringLine}`;
};

export const buildNamespaceFromWizard = (
  name: string,
  sourceNames: string[],
  sourceDetails: NamespaceSource[],
  storageType: NamespaceStorageType = 'index',
  integration = ''
): Namespace => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const prefix = storageType === 'dataStream' ? '.context-ds' : '.context-idx';
  const indexName = `${prefix}-${slug}`;

  const indicators = indicatorsForNamespace(name, sourceNames);

  return {
    name,
    sources: sourceNames,
    sourceDetails,
    integration,
    updated: 'just now',
    description: `Drawn from ${sourceNames.length} source${sourceNames.length === 1 ? '' : 's'} (${
      sourceNames.join(', ') || 'none yet'
    }). Covers the entities, policies and resolution patterns your agents ask about most, and is kept fresh by automations as the underlying data changes.`,
    indexName,
    storageType,
    lifecycleStatus: 'needsSetup',
    managed: false,
    userCreated: true,
    automations: [],
    // One proposed automation per source; nothing runs until the user approves.
    suggestedAutomations: sourceNames.map((sourceName, index) => {
      let description = `So your agent can answer questions from ${sourceName} without scanning it.`;
      if (/bigquery/i.test(sourceName)) {
        description =
          'So your agent can answer revenue and account questions without querying raw tables.';
      } else if (/google drive|drive/i.test(sourceName)) {
        description = 'So your agent can cite playbooks and docs without opening files.';
      } else if (/zendesk/i.test(sourceName)) {
        description = 'So your agent can answer from past tickets and SLAs.';
      } else if (/slack/i.test(sourceName)) {
        description =
          'So your agent can answer from recent support threads without scrolling chat history.';
      } else if (/confluence/i.test(sourceName)) {
        description =
          'So your agent can follow runbooks and escalation paths without opening Confluence.';
      }
      return {
        id: `new-extract-${index}`,
        title: `Extract Knowledge Indicators from ${sourceName}`,
        type: 'FACT' as const,
        ownership: 'NEW' as const,
        tags: [sourceName, 'Bottom-Up', 'new'],
        description,
      };
    }),
    indicators,
    knowledge: statsFromIndicators(indicators),
    monitoring: {
      connected: false,
      analysisReady: false,
      issues: [],
    },
  };
};
