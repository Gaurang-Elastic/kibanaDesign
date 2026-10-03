/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  SIGNAL_TYPE_META,
  occurrencesForSignalIds,
  type ImprovementChange,
  type IndexSignal,
} from './improvement_signals';
import type { Namespace } from './namespace_data';

export interface ImprovementCase {
  id: string;
  timestamp: string;
  tool: string;
  source: string;
}

export interface OverviewImprovement {
  id: string;
  title: string;
  description: string;
  casesCount: number;
  lastSeen: string;
  proposedFix: string;
  findingDetail: string;
  firstSeen: string;
  lastSeenDetail: string;
  confidence: string;
  cases: ImprovementCase[];
  changes: ImprovementChange[];
  signalIds: string[];
}

export type TraceSpanKind = 'agent' | 'llm' | 'tool' | 'retrieval';

export interface TraceSpan {
  id: string;
  name: string;
  kind: TraceSpanKind;
  depth: number;
  startPct: number;
  widthPct: number;
  duration: string;
  error?: boolean;
  meta?: string;
}

export interface SignalTrace {
  id: string;
  status: 'ok' | 'error';
  agent: string;
  model: string;
  taskType: string;
  timestamp: string;
  duration: string;
  userRequest: string;
  finalResponse: string;
  spans: TraceSpan[];
}

const cases = (source: string, ids: [string, string, string]): ImprovementCase[] => [
  { id: ids[0], timestamp: '21:16:35', tool: 'execute_esql', source },
  { id: ids[1], timestamp: '21:19:19', tool: 'execute_esql', source },
  { id: ids[2], timestamp: '09:24:02', tool: 'search', source },
];

const editsAutomation = (name: string): ImprovementChange => ({
  operation: 'edits',
  objectType: 'automation',
  name,
  destructive: false,
});

const createsAutomation = (name: string): ImprovementChange => ({
  operation: 'creates',
  objectType: 'automation',
  name,
  destructive: false,
});

const producesKnowledge = (count: number): ImprovementChange => ({
  operation: 'creates',
  objectType: 'knowledge',
  name: '',
  count,
  destructive: false,
});

const ELASTIC_SIGNALS: IndexSignal[] = [
  {
    id: 'elastic-slo-column',
    type: 'esql_error',
    label: SIGNAL_TYPE_META.esql_error.label,
    whatHappened: 'Unknown column `slo.id`',
    occurrences: 8,
    lastSeen: 'today',
    traceId: 'trc-elastic-slo',
    analyzed: true,
  },
  {
    id: 'elastic-alert-column',
    type: 'esql_error',
    label: SIGNAL_TYPE_META.esql_error.label,
    whatHappened: 'Unknown column `alert.rule_id`',
    occurrences: 5,
    lastSeen: 'today',
    traceId: 'trc-elastic-alert',
    analyzed: true,
  },
  {
    id: 'elastic-dash-syntax',
    type: 'esql_error',
    label: SIGNAL_TYPE_META.esql_error.label,
    whatHappened: 'Verification_exception: invalid ES|QL syntax near `|`',
    occurrences: 3,
    lastSeen: '2 days ago',
    traceId: 'trc-elastic-dash',
    analyzed: true,
  },
  {
    id: 'elastic-slo-empty',
    type: 'esql_zero_results',
    label: SIGNAL_TYPE_META.esql_zero_results.label,
    whatHappened: 'ES|QL returned 0 rows for the SLO burn query',
    occurrences: 12,
    lastSeen: 'yesterday',
    traceId: 'trc-elastic-slo',
    analyzed: true,
  },
  {
    id: 'elastic-alert-empty',
    type: 'esql_zero_results',
    label: SIGNAL_TYPE_META.esql_zero_results.label,
    whatHappened: 'No matching docs for the alert routing lookup',
    occurrences: 7,
    lastSeen: 'today',
    traceId: 'trc-elastic-alert',
    analyzed: true,
  },
  {
    id: 'elastic-slo-owner',
    type: 'coverage_gap',
    label: SIGNAL_TYPE_META.coverage_gap.label,
    whatHappened: 'Agent re-read index mappings after retrieval missed the SLO owner',
    occurrences: 11,
    lastSeen: 'yesterday',
    traceId: 'trc-elastic-owner',
    analyzed: true,
  },
  {
    id: 'elastic-ack-gap',
    type: 'coverage_gap',
    label: SIGNAL_TYPE_META.coverage_gap.label,
    whatHappened: 'Agent listed indices again to find an acknowledge policy',
    occurrences: 4,
    lastSeen: '2 days ago',
    traceId: 'trc-elastic-ack',
    analyzed: false,
  },
];

const SUPPORT_SIGNALS: IndexSignal[] = [
  {
    id: 'support-case-id',
    type: 'esql_error',
    label: SIGNAL_TYPE_META.esql_error.label,
    whatHappened: 'Unknown column `case_id`',
    occurrences: 4,
    lastSeen: 'today',
    traceId: 'trc-support-refund',
    analyzed: true,
  },
  {
    id: 'support-priority',
    type: 'esql_error',
    label: SIGNAL_TYPE_META.esql_error.label,
    whatHappened: 'Unknown column `priority_code`',
    occurrences: 7,
    lastSeen: '2 days ago',
    traceId: 'trc-support-macro',
    analyzed: true,
  },
  {
    id: 'support-sla',
    type: 'esql_zero_results',
    label: SIGNAL_TYPE_META.esql_zero_results.label,
    whatHappened: 'ES|QL returned 0 rows for the SLA lookup',
    occurrences: 12,
    lastSeen: 'yesterday',
    traceId: 'trc-support-sla',
    analyzed: true,
  },
  {
    id: 'support-escalation',
    type: 'esql_zero_results',
    label: SIGNAL_TYPE_META.esql_zero_results.label,
    whatHappened: 'No matching docs for the escalation matrix query',
    occurrences: 15,
    lastSeen: 'today',
    traceId: 'trc-support-esc',
    analyzed: true,
  },
  {
    id: 'support-refund-gap',
    type: 'coverage_gap',
    label: SIGNAL_TYPE_META.coverage_gap.label,
    whatHappened: 'Agent re-read index mappings after retrieval missed the refund policy',
    occurrences: 14,
    lastSeen: 'today',
    traceId: 'trc-support-refund',
    analyzed: true,
  },
];

const withCasesFromSignals = (
  item: Omit<OverviewImprovement, 'casesCount'>,
  signals: IndexSignal[]
): OverviewImprovement => ({
  ...item,
  casesCount: occurrencesForSignalIds(signals, item.signalIds),
});

const ELASTIC_IMPROVEMENTS: OverviewImprovement[] = [
  withCasesFromSignals(
    {
      id: 'elastic-slo-burn',
      title: 'SLO burn questions miss knowledge',
      description:
        'SLO burn questions fell back to scanning Dashboards. No Knowledge Indicators cover burn windows by slo.id.',
      lastSeen: 'yesterday',
      proposedFix:
        'Broaden the Dashboards automation to extract SLO burn playbooks keyed on slo.id.',
      findingDetail: 'SLO burn questions scanned Dashboards instead of retrieving a playbook.',
      firstSeen: 'Jul 28, 14:02',
      lastSeenDetail: 'Yesterday, 16:41',
      confidence: 'High',
      cases: cases('Dashboards', ['e1', 'e2', 'e3']),
      changes: [editsAutomation('Extract product surface facts')],
      signalIds: ['elastic-slo-empty', 'elastic-slo-owner'],
    },
    ELASTIC_SIGNALS
  ),
  withCasesFromSignals(
    {
      id: 'elastic-alert-routing',
      title: 'Alert routing lookups skip knowledge',
      description:
        'Alert routing questions always query Alerts directly. Routing preferences keyed on rule id would answer them from knowledge.',
      lastSeen: 'today',
      proposedFix:
        'Broaden the Alerts automation to extract routing preferences keyed on rule id.',
      findingDetail: 'Alert routing questions queried Alerts directly.',
      firstSeen: 'Jul 29, 10:18',
      lastSeenDetail: 'Today, 11:07',
      confidence: 'High',
      cases: cases('Alerts', ['e4', 'e5', 'e6']),
      changes: [editsAutomation('Alert routing preferences')],
      signalIds: ['elastic-alert-column', 'elastic-alert-empty'],
    },
    ELASTIC_SIGNALS
  ),
  withCasesFromSignals(
    {
      id: 'elastic-slo-owner-auto',
      title: 'SLO owner questions fall back to raw scan',
      description:
        'Who-owns-this-SLO questions scan SLOs every round instead of a distilled fact.',
      lastSeen: 'today',
      proposedFix: 'Add an automation on SLOs extracting owner and burn-window facts.',
      findingDetail: 'SLO owner questions scanned SLOs.',
      firstSeen: 'Jul 31, 21:16',
      lastSeenDetail: 'Today, 09:24',
      confidence: 'Medium',
      cases: cases('SLOs', ['e7', 'e8', 'e9']),
      changes: [createsAutomation('Extract from SLOs'), producesKnowledge(3)],
      signalIds: ['elastic-slo-column'],
    },
    ELASTIC_SIGNALS
  ),
];

const SUPPORT_IMPROVEMENTS: OverviewImprovement[] = [
  withCasesFromSignals(
    {
      id: 'support-refund-bypass',
      title: 'Agent bypasses knowledge for refund questions',
      description:
        'For refund questions, your agent queried raw Zendesk instead of retrieving knowledge.',
      lastSeen: 'today',
      proposedFix:
        'Broaden the Zendesk automation to extract refund-path FAQs, so these questions answer from knowledge.',
      findingDetail: 'The agent queried Zendesk directly instead of retrieving a knowledge item.',
      firstSeen: 'Jul 31, 21:16',
      lastSeenDetail: 'Today, 09:24',
      confidence: 'High',
      cases: cases('Zendesk', ['s1', 's2', 's3']),
      changes: [editsAutomation('Zendesk')],
      signalIds: ['support-case-id', 'support-refund-gap'],
    },
    SUPPORT_SIGNALS
  ),
  withCasesFromSignals(
    {
      id: 'support-sla-gap',
      title: 'SLA questions miss knowledge',
      description:
        'SLA questions fell back to scanning Zendesk. No Knowledge Indicators cover SLA windows by priority.',
      lastSeen: 'yesterday',
      proposedFix: 'Add an automation on Zendesk extracting SLA window policies by priority.',
      findingDetail: 'SLA questions fell back to scanning Zendesk.',
      firstSeen: 'Jul 28, 14:02',
      lastSeenDetail: 'Yesterday, 16:41',
      confidence: 'High',
      cases: cases('Zendesk', ['s4', 's5', 's6']),
      changes: [createsAutomation('Extract from Zendesk'), producesKnowledge(3)],
      signalIds: ['support-sla'],
    },
    SUPPORT_SIGNALS
  ),
  withCasesFromSignals(
    {
      id: 'support-escalation-gap',
      title: 'Escalation matrix lookups skip knowledge',
      description:
        'Escalation questions always open Confluence directly. A playbook would answer them from knowledge.',
      lastSeen: 'today',
      proposedFix: 'Extract the escalation playbook from Confluence.',
      findingDetail: 'Escalation questions always opened Confluence directly.',
      firstSeen: 'Jul 29, 10:18',
      lastSeenDetail: 'Today, 11:07',
      confidence: 'Medium',
      cases: cases('Confluence', ['s7', 's8', 's9']),
      changes: [createsAutomation('Extract escalation playbook from Confluence')],
      signalIds: ['support-escalation'],
    },
    SUPPORT_SIGNALS
  ),
];

const retrievalSpans = (
  prefix: string,
  annotation: string,
  agentMeta: string
): TraceSpan[] => [
  {
    id: `${prefix}-run`,
    name: 'agent.run',
    kind: 'agent',
    depth: 0,
    startPct: 0,
    widthPct: 100,
    duration: '3.1s',
    meta: agentMeta,
  },
  {
    id: `${prefix}-retrieval`,
    name: 'retrieval.search',
    kind: 'retrieval',
    depth: 1,
    startPct: 8,
    widthPct: 28,
    duration: '0.86s',
    meta: annotation,
  },
  {
    id: `${prefix}-llm`,
    name: 'llm.generate',
    kind: 'llm',
    depth: 1,
    startPct: 40,
    widthPct: 52,
    duration: '1.6s',
    meta: 'gpt-4.1',
  },
];

export const SIGNAL_TRACES: SignalTrace[] = [
  {
    id: 'trc-elastic-slo',
    status: 'ok',
    agent: 'elastic-slo-agent',
    model: 'gpt-4.1',
    taskType: 'SLO burn',
    timestamp: 'Today 14:12',
    duration: '3.1s',
    userRequest: 'Which dashboard should I open for an SLO breach?',
    finalResponse: 'I found dashboards but could not attach an SLO owner or burn window.',
    spans: retrievalSpans(
      'slo',
      'Needed SLO owner was not in the results',
      'elastic-slo-agent'
    ),
  },
  {
    id: 'trc-elastic-alert',
    status: 'error',
    agent: 'elastic-alert-agent',
    model: 'gpt-4.1',
    taskType: 'Alert routing',
    timestamp: 'Today 13:48',
    duration: '2.4s',
    userRequest: 'Where should this alert page?',
    finalResponse: 'The routing lookup failed. I could not find a destination.',
    spans: retrievalSpans(
      'alert',
      'Needed alert routing preference was not in the results',
      'elastic-alert-agent'
    ),
  },
  {
    id: 'trc-elastic-owner',
    status: 'ok',
    agent: 'elastic-slo-agent',
    model: 'gpt-4.1',
    taskType: 'SLO ownership',
    timestamp: 'Yesterday 16:41',
    duration: '4.0s',
    userRequest: 'Who owns the checkout SLO?',
    finalResponse: 'I re-read the mappings and still could not find an owner.',
    spans: retrievalSpans(
      'owner',
      'Needed SLO owner was not in the results',
      'elastic-slo-agent'
    ),
  },
  {
    id: 'trc-elastic-ack',
    status: 'ok',
    agent: 'elastic-alert-agent',
    model: 'gpt-4.1-mini',
    taskType: 'Acknowledge policy',
    timestamp: '2 days ago 11:20',
    duration: '2.8s',
    userRequest: 'Do I acknowledge an alert before investigating?',
    finalResponse: 'I listed indices again and did not find an acknowledge policy.',
    spans: retrievalSpans(
      'ack',
      'Needed acknowledge policy was not in the results',
      'elastic-alert-agent'
    ),
  },
  {
    id: 'trc-elastic-dash',
    status: 'error',
    agent: 'elastic-slo-agent',
    model: 'gpt-4.1-mini',
    taskType: 'Dashboard lookup',
    timestamp: '2 days ago 09:04',
    duration: '1.9s',
    userRequest: 'List dashboards tagged slo-burn.',
    finalResponse: 'The ES|QL query failed near a pipe.',
    spans: [
      {
        id: 'dash-run',
        name: 'agent.run',
        kind: 'agent',
        depth: 0,
        startPct: 0,
        widthPct: 100,
        duration: '1.9s',
        error: true,
        meta: 'elastic-slo-agent',
      },
      {
        id: 'dash-esql',
        name: 'tool.execute_esql',
        kind: 'tool',
        depth: 1,
        startPct: 12,
        widthPct: 40,
        duration: '0.74s',
        error: true,
        meta: 'Verification_exception near `|`',
      },
      {
        id: 'dash-llm',
        name: 'llm.generate',
        kind: 'llm',
        depth: 1,
        startPct: 58,
        widthPct: 34,
        duration: '0.62s',
        meta: 'gpt-4.1-mini',
      },
    ],
  },
  {
    id: 'trc-support-refund',
    status: 'ok',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    taskType: 'Billing / refunds',
    timestamp: 'Today 14:12',
    duration: '3.1s',
    userRequest: 'How do I refund an order that is 12 days old?',
    finalResponse:
      'Refunds are only issued inside the 30-day window. I could not find the next step after that.',
    spans: retrievalSpans(
      'refund',
      'Needed refund policy was not in the results',
      'support-triage-agent'
    ),
  },
  {
    id: 'trc-support-sla',
    status: 'ok',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    taskType: 'SLA',
    timestamp: 'Yesterday 16:41',
    duration: '2.9s',
    userRequest: 'What is the SLA window for a P1 ticket?',
    finalResponse: 'The SLA lookup returned no rows.',
    spans: retrievalSpans(
      'sla',
      'Needed SLA window policy was not in the results',
      'support-triage-agent'
    ),
  },
  {
    id: 'trc-support-esc',
    status: 'ok',
    agent: 'support-triage-agent',
    model: 'gpt-4.1',
    taskType: 'Escalation',
    timestamp: 'Today 11:07',
    duration: '3.4s',
    userRequest: 'How do I escalate a severity-1 ticket?',
    finalResponse: 'I opened Confluence and still could not find the escalation matrix.',
    spans: retrievalSpans(
      'esc',
      'Needed escalation playbook was not in the results',
      'support-triage-agent'
    ),
  },
  {
    id: 'trc-support-macro',
    status: 'error',
    agent: 'support-triage-agent',
    model: 'gpt-4.1-mini',
    taskType: 'Macros',
    timestamp: '2 days ago 18:02',
    duration: '1.9s',
    userRequest: 'Which macro handles a password reset?',
    finalResponse: 'The ticket query failed on an unknown column.',
    spans: [
      {
        id: 'macro-run',
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
        id: 'macro-esql',
        name: 'tool.execute_esql',
        kind: 'tool',
        depth: 1,
        startPct: 12,
        widthPct: 40,
        duration: '0.74s',
        error: true,
        meta: 'Unknown column `priority_code`',
      },
      {
        id: 'macro-llm',
        name: 'llm.generate',
        kind: 'llm',
        depth: 1,
        startPct: 58,
        widthPct: 34,
        duration: '0.62s',
        meta: 'gpt-4.1-mini',
      },
    ],
  },
];

export const namespaceTraceCount = (namespace: Namespace) => namespace.traceCount ?? 0;

export const namespaceStartsUnanalysed = (namespace: Namespace) =>
  Boolean(namespace.userCreated);

export const signalsForNamespace = (namespace: Namespace): IndexSignal[] => {
  if (namespace.name === 'elastic') return ELASTIC_SIGNALS;
  if (namespace.name === 'support-triage') return SUPPORT_SIGNALS;
  return [];
};

export const improvementsForNamespace = (namespace: Namespace): OverviewImprovement[] => {
  if (namespace.name === 'elastic') return ELASTIC_IMPROVEMENTS;
  if (namespace.name === 'support-triage') return SUPPORT_IMPROVEMENTS;
  return [];
};

export const traceForId = (traceId: string): SignalTrace =>
  SIGNAL_TRACES.find((trace) => trace.id === traceId) ?? SIGNAL_TRACES[0];

export const lastSeenRank = (value: string) => {
  if (/just now|today/i.test(value)) return 0;
  if (/yesterday/i.test(value)) return 1;
  const days = value.match(/(\d+)\s+days?\s+ago/i);
  if (days) return Number(days[1]);
  return 10;
};

export const formatAppliedAgo = (appliedAt: number) => {
  const seconds = Math.max(0, Math.round((Date.now() - appliedAt) / 1000));
  if (seconds < 8) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes === 1) return 'a minute ago';
  return `${minutes} minutes ago`;
};

export const initialOpenImprovementCount = (
  namespace: Namespace,
  opts: { coldStart?: boolean; healthy?: boolean; analysed?: boolean } = {}
) => {
  if (opts.coldStart || namespaceTraceCount(namespace) === 0) return 0;
  if (opts.healthy) return 0;
  const analysed = opts.analysed ?? !namespaceStartsUnanalysed(namespace);
  if (!analysed) return 0;
  return improvementsForNamespace(namespace).length;
};
