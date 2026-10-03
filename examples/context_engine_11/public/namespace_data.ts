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
  statsFromIndicators,
  supportIndicators,
  type KnowledgeIndicator,
  type KnowledgeStats,
} from './knowledge_indicators';

export type { KnowledgeIndicator, KnowledgeStats } from './knowledge_indicators';
export { statsFromIndicators } from './knowledge_indicators';

/** Always `'index'` in the UI. Search-team #16065. */
export type NamespaceStorageType = 'index' | 'dataStream';
export type IndexState = 'needsSetup' | 'ready';
export type IndexOwner = 'you' | 'elastic';

export interface NamespaceSource {
  id: string;
  name: string;
  subtitle: string;
  typeLabel: string;
  icon: string;
}

export type IndexTraceType = 'elastic_agent' | 'index' | 'esql';

/** Independent of sources. Written on the AI index via the general update endpoint. */
export interface IndexTrace {
  value: string;
  type: IndexTraceType;
}

export interface AutomationStep {
  name: string;
  explanation: string;
  children?: AutomationStep[];
}

export interface Automation {
  id: string;
  title: string;
  enabled: boolean;
  hasRun: boolean;
  triggerCount: number;
  stepCount: number;
  scheduleLabel: string;
  addedBy: string;
  lastRunAt: string | null;
  description: string;
  reads: string[];
  producesCount: number;
  steps: AutomationStep[];
  properties: string[];
  yaml: string;
}

export const automationMetaLine = (automation: Automation) => {
  const triggers = automation.triggerCount === 1 ? '1 trigger' : `${automation.triggerCount} triggers`;
  const steps = automation.stepCount === 1 ? '1 step' : `${automation.stepCount} steps`;
  return `${triggers} · ${steps}`;
};

export const automationAddedLine = (automation: Automation) =>
  automation.lastRunAt
    ? `Added by ${automation.addedBy} · Last run ${automation.lastRunAt}`
    : `Added by ${automation.addedBy} · Never run`;

export interface TryQuestionExample {
  question: string;
  hit: boolean;
  answer?: string;
  indicatorId?: string;
}

export interface Namespace {
  name: string;
  displayName: string;
  intent: string;
  owner: IndexOwner;
  updated: string;
  indexName: string;
  /** Always `'index'` in the UI. Search-team #16065. */
  storageType: NamespaceStorageType;
  managed?: boolean;
  userCreated?: boolean;
  /** Agents can store and recall memories in this index. Default on when the memory flag is shown. */
  memoryEnabled?: boolean;
  sources: NamespaceSource[];
  /** Not a source. Optional traces linked to this index. M3 stores at most one. */
  traces?: IndexTrace[];
  automations: Automation[];
  indicators: KnowledgeIndicator[];
  knowledge: KnowledgeStats;
  lastSuccessfulRun?: {
    name: string;
    when: string;
  };
  tryQuestions: TryQuestionExample[];
  /** Agent traces against this index. 0 or omitted is a cold start. */
  traceCount?: number;
  /**
   * Retrieval / feedback-loop stats for the Overview row.
   * Omit when traces have not been measured. Do not use 0 as a stand-in.
   */
  overviewRetrieval?: {
    hitRatePct: number;
    tokensSavedPct: number;
    medianLatencyMs: number;
    tracesAnalyzed: number;
    openImprovements: number;
  };
}

/** Always an index in the UI. Search-team #16065. */
export const backingIndexName = (name: string) => `ai-index-idx-${name}`;

export const indexState = (namespace: Namespace): IndexState => {
  const hasRun = namespace.automations.some((automation) => automation.hasRun);
  return namespace.automations.length > 0 && hasRun ? 'ready' : 'needsSetup';
};

export const indexCountLabel = (count: number) =>
  count === 1 ? '1 AI index' : `${count} AI indices`;

const supportAutomationYaml = `version: '1'
name: Extract refund and SLA policies
enabled: true
triggers:
  - type: scheduled
    with:
      every: 1h
steps:
  - name: query_tickets
    type: elasticsearch.esql.query
    with:
      query: >
        FROM zendesk-tickets*
        | WHERE status IN ("solved", "closed")
        | KEEP ticket.id, subject, tags, resolution_notes
  - name: query_policies
    type: elasticsearch.esql.query
    with:
      query: >
        FROM confluence-policies*
        | WHERE space == "support"
        | KEEP page.id, title, body
  - name: write_indicators
    type: console
    with:
      destination: ai-index-idx-support-triage
`;

const elasticProductYaml = `version: '1'
name: Extract product surface facts
enabled: true
triggers:
  - type: scheduled
    with:
      every: 1h
steps:
  - name: read_dashboards
    type: kibana.dashboards.list
  - name: write_indicators
    type: console
    with:
      destination: ai-index-idx-elastic
`;

const elasticAlertYaml = `version: '1'
name: Alert routing preferences
enabled: true
triggers:
  - type: scheduled
    with:
      every: 30m
steps:
  - name: read_alerts
    type: kibana.alerts.list
  - name: write_indicators
    type: console
    with:
      destination: ai-index-idx-elastic
`;

export const supportTriageNamespace: Namespace = {
  name: 'support-triage',
  displayName: 'support-triage',
  intent:
    'Answer questions about our refund and SLA policies from support tickets and internal docs.',
  owner: 'you',
  updated: '6 hours ago',
  indexName: 'ai-index-idx-support-triage',
  storageType: 'index',
  sources: [
    {
      id: 'zendesk',
      name: 'Zendesk',
      subtitle: 'Support tickets, last 90 days',
      typeLabel: 'Connector',
      icon: 'plugs',
    },
    {
      id: 'confluence',
      name: 'Confluence',
      subtitle: 'Support policy space',
      typeLabel: 'Connector',
      icon: 'documents',
    },
  ],
  automations: [
    {
      id: 'support-extract',
      title: 'Extract refund and SLA policies',
      enabled: true,
      hasRun: true,
      triggerCount: 1,
      stepCount: 3,
      scheduleLabel: 'Runs every hour',
      addedBy: 'you',
      lastRunAt: '6 hours ago',
      description: 'Extracts refund and SLA policies from support tickets and internal docs.',
      reads: ['Zendesk', 'Confluence'],
      producesCount: 8,
      steps: [
        {
          name: 'query_tickets',
          explanation:
            'Retrieves solved and closed Zendesk tickets, keeping id, subject, tags, and resolution notes.',
        },
        {
          name: 'query_policies',
          explanation:
            'Reads Confluence pages in the support space, keeping page id, title, and body.',
        },
        {
          name: 'write_indicators',
          explanation:
            'Writes or updates Knowledge Indicators into the support-triage AI index, keyed on ticket or page id so repeated runs update rather than duplicate.',
        },
      ],
      properties: [
        'Run this automation from the Workflows page.',
        'Idempotent. Safe to re-run; existing Knowledge Indicators are updated, not duplicated.',
        'A single ticket or page failure is skipped without aborting the whole run.',
      ],
      yaml: supportAutomationYaml,
    },
  ],
  indicators: supportIndicators,
  knowledge: statsFromIndicators(supportIndicators),
  lastSuccessfulRun: {
    name: 'Extract refund and SLA policies',
    when: '6 hours ago',
  },
  traceCount: 41,
  traces: [{ value: 'Significant Events Judge', type: 'elastic_agent' }],
  tryQuestions: [
    {
      question: 'What is the refund window?',
      hit: true,
      answer: 'The standard refund window is 30 calendar days from purchase.',
      indicatorId: 'support-refund-window-fact',
    },
    {
      question: 'How do we handle SLA breaches?',
      hit: true,
      answer:
        'Page the on-call lead if a P1 ticket has 15 minutes left. Leave a public update, then file the miss reason after a breach.',
      indicatorId: 'support-sla-playbook',
    },
    {
      question: "What's our competitor pricing?",
      hit: false,
    },
  ],
};

export const incidentRunbooksNamespace: Namespace = {
  name: 'incident-runbooks',
  displayName: 'incident-runbooks',
  intent: 'Answer on-call questions from PagerDuty incidents and Slack #incidents.',
  owner: 'you',
  updated: '3 days ago',
  indexName: 'ai-index-idx-incident-runbooks',
  storageType: 'index',
  sources: [
    {
      id: 'esql-kibana_sample_data_logs',
      name: 'FROM kibana_sample_data_logs',
      subtitle: 'FROM kibana_sample_data_logs',
      typeLabel: 'ES|QL',
      icon: 'visVega',
    },
    {
      id: 'gtest',
      name: 'gtest',
      subtitle: 'Google Drive',
      typeLabel: 'Connector',
      icon: 'logoGoogleG',
    },
  ],
  automations: [],
  indicators: [],
  knowledge: statsFromIndicators([]),
  tryQuestions: [],
};

export const elasticNamespace: Namespace = {
  name: 'elastic',
  displayName: 'Elastic AI index',
  intent: 'Help agents answer questions about Elastic product surfaces, alerts, and SLOs.',
  owner: 'elastic',
  updated: '2 hours ago',
  indexName: 'ai-index-idx-elastic',
  storageType: 'index',
  managed: true,
  sources: [
    {
      id: 'dashboards',
      name: 'Dashboards',
      subtitle: 'Saved Kibana dashboards',
      typeLabel: 'Managed',
      icon: 'dashboardApp',
    },
    {
      id: 'alerts',
      name: 'Alerts',
      subtitle: 'Rule-based alerts',
      typeLabel: 'Managed',
      icon: 'bell',
    },
    {
      id: 'slos',
      name: 'SLOs',
      subtitle: 'Service level objectives',
      typeLabel: 'Managed',
      icon: 'visGauge',
    },
  ],
  automations: [
    {
      id: 'elastic-product',
      title: 'Extract product surface facts',
      enabled: true,
      hasRun: true,
      triggerCount: 1,
      stepCount: 2,
      scheduleLabel: 'Runs every hour',
      addedBy: 'Elastic',
      lastRunAt: '2 hours ago',
      description: 'Extracts product surface facts from saved Kibana dashboards.',
      reads: ['Dashboards'],
      producesCount: 12,
      steps: [
        {
          name: 'read_dashboards',
          explanation: 'Lists saved Kibana dashboards and their underlying queries.',
        },
        {
          name: 'write_indicators',
          explanation:
            'Writes or updates product surface facts into the Elastic AI index, keyed on dashboard id so repeated runs update rather than duplicate.',
        },
      ],
      properties: [
        'Run this automation from the Workflows page.',
        'Idempotent. Safe to re-run; existing Knowledge Indicators are updated, not duplicated.',
        'A single dashboard failure is skipped without aborting the whole run.',
      ],
      yaml: elasticProductYaml,
    },
    {
      id: 'elastic-alerts',
      title: 'Alert routing preferences',
      enabled: true,
      hasRun: true,
      triggerCount: 1,
      stepCount: 2,
      scheduleLabel: 'Runs every 30 minutes',
      addedBy: 'Elastic',
      lastRunAt: '2 hours ago',
      description: 'Keeps alert routing preferences current from alert rules.',
      reads: ['Alerts'],
      producesCount: 8,
      steps: [
        {
          name: 'read_alerts',
          explanation: 'Lists alert rules and linked dashboards.',
        },
        {
          name: 'write_indicators',
          explanation:
            'Writes or updates routing preferences into the Elastic AI index, keyed on rule id so repeated runs update rather than duplicate.',
        },
      ],
      properties: [
        'Run this automation from the Workflows page.',
        'Idempotent. Safe to re-run; existing Knowledge Indicators are updated, not duplicated.',
        'A single rule failure is skipped without aborting the whole run.',
      ],
      yaml: elasticAlertYaml,
    },
  ],
  indicators: elasticIndicators,
  knowledge: statsFromIndicators(elasticIndicators),
  lastSuccessfulRun: {
    name: 'Alert routing preferences',
    when: '2 hours ago',
  },
  traceCount: 86,
  overviewRetrieval: {
    hitRatePct: 96,
    tokensSavedPct: 51,
    medianLatencyMs: 140,
    tracesAnalyzed: 1102,
    openImprovements: 6,
  },
  tryQuestions: [
    {
      question: 'Which dashboard should I open for an SLO breach?',
      hit: true,
      answer:
        'Open the SLO burn dashboard. It lists burn rate, linked alerts, and the service owner.',
      indicatorId: 'elastic-which-dashboard-faq',
    },
    {
      question: 'Do I acknowledge an alert before investigating?',
      hit: true,
      answer: 'Yes. Acknowledge first so the page loop stops, then open the linked dashboard.',
      indicatorId: 'elastic-ack-faq',
    },
    {
      question: "What's the weather in Dublin?",
      hit: false,
    },
  ],
};

const USER_NAMESPACES_STORAGE_KEY = 'contextEngineExample11.userNamespaces';

const isStoredNamespace = (value: unknown): value is Namespace => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Namespace;
  return (
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    Array.isArray(item.sources) &&
    Array.isArray(item.automations) &&
    Array.isArray(item.indicators)
  );
};

export const loadUserNamespaces = (): Namespace[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(USER_NAMESPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredNamespace).map((item) => ({
      ...item,
      userCreated: true,
      displayName: item.displayName || item.name,
    }));
  } catch {
    return [];
  }
};

export const persistUserNamespaces = (namespaces: Namespace[]) => {
  if (typeof window === 'undefined') return;
  try {
    const userCreated = namespaces.filter((item) => item.userCreated && !item.managed);
    window.localStorage.setItem(USER_NAMESPACES_STORAGE_KEY, JSON.stringify(userCreated));
  } catch {
    // Quota or private mode. Catalog still works in memory for this mount.
  }
};

/** Three catalog scenarios: Needs setup, Ready with a small KI set, Ready and mature. */
export const seedNamespaces = (): Namespace[] => [
  {
    ...elasticNamespace,
    sources: [...elasticNamespace.sources],
    automations: [...elasticNamespace.automations],
    indicators: [...elasticNamespace.indicators],
    tryQuestions: [...elasticNamespace.tryQuestions],
  },
  { ...incidentRunbooksNamespace, sources: [...incidentRunbooksNamespace.sources] },
  {
    ...supportTriageNamespace,
    sources: [...supportTriageNamespace.sources],
    traces: [...(supportTriageNamespace.traces ?? [])],
    automations: [...supportTriageNamespace.automations],
    indicators: [...supportTriageNamespace.indicators],
    tryQuestions: [...supportTriageNamespace.tryQuestions],
  },
];

/** Seed catalog plus any indexes created in this browser. Survives remounts and refresh. */
export const initialNamespaces = (): Namespace[] => {
  const seed = seedNamespaces();
  const seedNames = new Set(seed.map((item) => item.name));
  const extras = loadUserNamespaces().filter((item) => !seedNames.has(item.name));
  return [...extras, ...seed];
};

export const workflowYamlFor = (title: string, destination: string, sourceNames: string[]) =>
  `version: '1'
name: ${title}
enabled: true
triggers:
  - type: scheduled
    with:
      every: 1h
steps:
  - name: read_sources
    type: console
    with:
      sources: ${JSON.stringify(sourceNames)}
  - name: write_indicators
    type: console
    with:
      destination: ${destination}
`;

export const gmailSyncYaml = (title: string, destination: string, connectorId: string) =>
  `version: '1'
name: ${title}
enabled: true
triggers:
  - type: scheduled
    with:
      every: 1h
steps:
  - name: list_messages
    type: gmail.list_messages
    with:
      connector: ${connectorId}
  - name: sync_messages
    type: foreach
    foreach: '{{list_messages.ids}}'
    steps:
      - name: get_message
        type: gmail.get_message
      - name: upsert_ki
        type: context.upsert_ki
        with:
          destination: ${destination}
          key: '{{get_message.id}}'
`;
