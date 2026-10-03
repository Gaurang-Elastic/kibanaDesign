/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import salesforceLogo from './assets/salesforce.svg';
import {
  EuiAccordion,
  EuiBadge,
  EuiBasicTable,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCallOut,
  EuiCheckbox,
  EuiCode,
  EuiCodeBlock,
  EuiContextMenu,
  EuiDescriptionList,
  EuiDescriptionListDescription,
  EuiDescriptionListTitle,
  EuiEmptyPrompt,
  EuiFieldSearch,
  EuiFieldText,
  EuiFilePicker,
  EuiFlexGroup,
  EuiFlexGrid,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiFormRow,
  EuiHealth,
  EuiHorizontalRule,
  EuiIcon,
  EuiImage,
  EuiLink,
  EuiLoadingSpinner,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiNotificationBadge,
  EuiPageTemplate,
  EuiPanel,
  EuiPopover,
  EuiRadio,
  EuiSelect,
  EuiSpacer,
  EuiStat,
  EuiSwitch,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTextArea,
  EuiTitle,
  EuiToolTip,
} from '@elastic/eui';
import type { EuiBasicTableColumn } from '@elastic/eui';
import type { AppMountParameters, CoreStart } from '@kbn/core/public';
import { CodeEditor } from '@kbn/code-editor';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';
import {
  AppHeader,
  type AppHeaderBack,
  type AppHeaderBadge,
  type AppHeaderMenu,
  type AppHeaderMetadataItems,
  type AppHeaderTab,
} from '@kbn/app-header';

import './app.scss';
import {
  AI_AGENT_ICON,
  ELASTIC_AI_AGENT_ID,
  openContextAgentChat,
  type AppPluginStartDependencies,
  type ContextAgentSeed,
} from './ai_agent';
import { AgentMockOverlay } from './agent_mock_overlay';
import { AgentMonitoringSurface } from './agent_monitoring';
import {
  SetupStep3,
  SetupWaitPanel,
  TryQuestionPanel,
  type GenerateWaitPhase,
  type SetupStep3View,
} from './setup_step3';
import { AutomationTweakInput } from './automation_tweak_input';
import {
  operationalTagsFor,
  typeBadgeColor,
  valueBlockFor,
} from './knowledge_indicators';
import { currentUser$ } from './current_user';
import { AGENT_MONITORING_ENABLED, demoFlags$, setDemoHasInference } from './demo_flags';
import {
  MANAGED_ELASTIC_DISPLAY_NAME,
  MANAGED_ELASTIC_ENABLED_KI_COUNT,
  buildChatDescription,
  buildNamespaceFromWizard,
  demoEnvironmentNamespaces,
  knowledgeTotal,
  managedElasticNamespace,
  resolveCatalogLifecycle,
  type Automation,
  type CatalogLifecycleBadge,
  type KnowledgeIndicator,
  type MonitoringIssue,
  type Namespace,
  type NamespaceSource,
  type NamespaceStorageType,
} from './namespace_data';
import { MONITORING_TRACES } from './agent_monitoring_data';
import {
  AGENT_CHANGE_OBJECT_LABELS,
  AGENT_CHANGE_OPS,
  DEFAULT_AGENT_CHANGE_PERMISSIONS,
  SIGNAL_TYPE_META,
  formatSignalSourceLine,
  improvementChangeLabel,
  namespaceStartsUnanalysed,
  signalCountsByType,
  signalDistinctByType,
  signalsByIds,
  signalsForNamespace,
  sourceNamedInFix,
  totalSignalOccurrences,
  withImprovementActions,
  type AgentChangeObject,
  type AgentChangePermissions,
  type ImprovementChange,
  type IndexSignal,
  type SignalInternalType,
} from './improvement_signals';

type Screen =
  | 'index'
  | 'create'
  | 'namespace'
  | 'workflow'
  | 'issue'
  | 'agent'
  | 'agentBuilderManage';
type SourceCategory = 'esql' | 'connectors' | 'signals' | 'traces' | 'features';
type StorageType = NamespaceStorageType;
type HealthFilter = 'all' | 'healthy' | 'issues' | 'needsSetup';
type KiVersionFilter = 'all' | 'current' | 'hasNewer';
type AgentHarness =
  | 'agentBuilder'
  | 'claudeCode'
  | 'claudeSdk'
  | 'langchain'
  | 'cowork'
  | 'mcp';
type NamespaceDetailTab = 'overview' | 'automations' | 'knowledge' | 'improvements';
type ImprovementStatus = 'open' | 'applied' | 'dismissed';
type AppliedOutcome = 'measuring' | 'improved' | 'unchanged';
type ImprovementGroup = 'open' | 'applied' | 'dismissed';
interface ImprovementCase {
  id: string;
  timestamp: string;
  tool: string;
  source: string;
}
interface OverviewImprovement {
  id: string;
  title: string;
  description: string;
  casesCount: number;
  lastSeen: string;
  proposedFix: string;
  tweakPlaceholder: string;
  /** When true, applied copy says automation created; otherwise updated + rerun. */
  createsAutomation: boolean;
  findingDetail: string;
  firstSeen: string;
  lastSeenDetail: string;
  confidence: string;
  traceSource: string;
  cases: ImprovementCase[];
  changes?: ImprovementChange[];
  signalIds?: string[];
}

const ImprovementChangeChips = ({ changes }: { changes?: ImprovementChange[] }) => (
  <EuiFlexGroup
    gutterSize="xs"
    wrap
    responsive={false}
    className="contextEnginePrototype__improvementChanges"
  >
    {(changes ?? []).map((change, index) => (
      <EuiFlexItem grow={false} key={`${change.operation}-${change.objectType}-${index}`}>
        <span
          className={`contextEnginePrototype__improvementChangeChip${
            change.destructive ? ' contextEnginePrototype__improvementChangeChip--destructive' : ''
          }`}
        >
          {improvementChangeLabel(change)}
        </span>
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);

type CreatePanel = 'index' | 'sources';
type IntentMode = 'describe' | 'upload';

/**
 * Feature flag: Upload agent artifacts intent path.
 * Keep the upload UI/code; hide the card while false.
 */
const INTENT_UPLOAD_ARTIFACTS_ENABLED = false;

/**
 * M3 scope: Agent traces as a source come back in a later milestone.
 * Keep traces data and UI; hide the tab and traces-driven suggestion.
 */
const M3_AGENT_TRACES_ENABLED = false;

/**
 * M3 scope: hide "Best matches for your intent" connector suggestions.
 * Keep matchIntentToSources and the strip; gate rendering.
 */
const M3_INTENT_SOURCE_SUGGESTIONS_ENABLED = false;

/**
 * M3 scope: Name and intent stays plain text. Keep Generate description code.
 */
const M3_GENERATE_DESCRIPTION_ENABLED = false;

/**
 * Demo empty states on the Sources step.
 * Connectors start with none connected; ES|QL starts with no views until ingest mock.
 * Agent traces list is populated by default (set true to demo the empty tab).
 */
const MOCK_START_WITH_EMPTY_CONNECTORS = true;
const MOCK_START_WITH_EMPTY_ESQL = true;
const MOCK_START_WITH_EMPTY_AGENT_TRACES = false;
const CONNECTOR_LIST_PAGE_SIZE = 5;

/** Mock inference shown after any artifact upload (proto). */
const MOCK_INFERRED_INTENT =
  'Help a support agent answer runbook, escalation and SLA questions; it frequently needs refund policy details and per-service ownership.';

/** Doc/ticket connectors → reference data (index) for the time-based question. */
const REFERENCE_CONNECTOR_IDS = new Set([
  'confluence',
  'zendesk',
  'google-drive',
  'sharepoint',
  'salesforce',
  'slack',
]);

interface IntentSourceMatch {
  sourceId: string;
  name: string;
  why: string;
  /** Keyword hit count; higher sorts first among suggestions. */
  strength: number;
}

/** Mock keyword → connector matches for the Sources intent strip. */
const INTENT_SOURCE_MATCH_RULES: Array<{
  sourceId: string;
  name: string;
  keywords: string[];
  why: (hits: string[]) => string;
}> = [
  {
    sourceId: 'confluence',
    name: 'Confluence',
    keywords: ['runbook', 'escalation', 'wiki', 'confluence', 'ownership'],
    why: (hits) =>
      `Runbooks and escalation docs usually live here; matches '${hits.join(', ')}' in your intent.`,
  },
  {
    sourceId: 'zendesk',
    name: 'Zendesk',
    keywords: ['ticket', 'sla', 'refund', 'zendesk', 'support', 'case'],
    why: () => "Your agent's trace questions are mostly about tickets and SLAs.",
  },
];

const matchIntentToSources = (intent: string): IntentSourceMatch[] => {
  const lower = intent.toLowerCase();
  if (!lower.trim()) return [];
  return INTENT_SOURCE_MATCH_RULES.flatMap((rule) => {
    const hits = rule.keywords.filter((keyword) => lower.includes(keyword));
    if (hits.length === 0) return [];
    return [
      {
        sourceId: rule.sourceId,
        name: rule.name,
        why: rule.why(hits),
        strength: hits.length,
      },
    ];
  }).sort((a, b) => b.strength - a.strength);
};

/**
 * Mock: new-user has managed Elastic AI Index already Ready (no setup on Get started).
 * TODO(existing-customer): hero strip "Not enabled · Enable it in your agent ›" when false.
 */
const CONTEXT_ON_BY_DEFAULT = true;

const MANAGED_SETUP_SOURCES: Array<{
  id: string;
  label: string;
  description: string;
  sourceName: string;
  typeLabel: string;
  icon: string;
}> = [
  {
    id: 'dashboards',
    label: 'Enable Dashboards',
    description: 'Saved Kibana dashboards',
    sourceName: 'Dashboards',
    typeLabel: 'Elastic feature',
    icon: 'dashboardApp',
  },
  {
    id: 'visualisations',
    label: 'Enable Visualisations',
    description: 'Lens, TSVB and saved visualisations',
    sourceName: 'Visualisations',
    typeLabel: 'Elastic feature',
    icon: 'visualizeApp',
  },
  {
    id: 'alerts',
    label: 'Enable Alerts',
    description: 'Rule-based alerts',
    sourceName: 'Alerts',
    typeLabel: 'Elastic feature',
    icon: 'bell',
  },
  {
    id: 'slos',
    label: 'Enable SLOs',
    description: 'Service level objectives',
    sourceName: 'SLOs',
    typeLabel: 'Elastic feature',
    icon: 'visGauge',
  },
];

type SetupPhase =
  | 'configure'
  | 'suggesting'
  | 'selectStrategies'
  | 'generating'
  | 'preview'
  | 'testError'
  | 'generateError'
  | 'running'
  | 'review'
  | 'error'
  | 'success';

const SAMPLE_SETUP_KI_COUNT = 9;
const GENERATE_WAIT_MS = 2500;
const TEST_RUN_WAIT_MS = 2000;

interface SetupSampleKi {
  key: string;
  type: string;
  content: string;
  from: string;
  question?: string;
  title?: string;
}

type ReviewTryResult =
  | {
      kind: 'hit';
      answer: string;
      hitKey: string;
      hitType: string;
      hitFrom: string;
      hitTitle: string;
    }
  | {
      kind: 'miss';
    };

const KI_TYPE_TOOLTIPS: Record<string, string> = {
  Playbook: 'Step-by-step procedure extracted from your data',
  Policy: 'A rule or constraint agents must respect',
  FAQ: 'A recurring question with its answer',
  Fact: 'A single verifiable statement',
  Glossary: 'A term and its meaning',
};

const formatSourceList = (sourceNames: string[]) => {
  if (sourceNames.length === 0) return 'your sources';
  if (sourceNames.length === 1) return sourceNames[0];
  if (sourceNames.length === 2) return `${sourceNames[0]} and ${sourceNames[1]}`;
  return `${sourceNames.slice(0, -1).join(', ')} and ${sourceNames[sourceNames.length - 1]}`;
};

/** Mock sample KI content keyed by this index's real sources. */
const sampleKiForSource = (sourceName: string, index: number): SetupSampleKi => {
  if (/bigquery/i.test(sourceName)) {
    return {
      key: `sample-${index}-bigquery`,
      type: 'Fact',
      content: 'Q2 EMEA revenue grew 18%; top three accounts drive 42% of it.',
      from: sourceName,
    };
  }
  if (/google drive|drive/i.test(sourceName)) {
    return {
      key: `sample-${index}-drive`,
      type: 'Fact',
      content: "The 'Enterprise renewal playbook' doc defines a 90-day renewal checklist.",
      from: sourceName,
    };
  }
  if (/slack/i.test(sourceName)) {
    return {
      key: `sample-${index}-slack`,
      type: 'FAQ',
      content: 'Most-asked this month: how to regenerate an expired API key (14 threads).',
      from: 'Slack #support',
    };
  }
  if (/confluence/i.test(sourceName)) {
    return {
      key: `sample-${index}-confluence`,
      type: 'Playbook',
      content: 'Postgres failover runbook: 6 steps, owned by SRE-DB.',
      from: sourceName,
    };
  }
  if (/zendesk/i.test(sourceName)) {
    return {
      key: `sample-${index}-zendesk`,
      type: 'FAQ',
      content: 'Top refund path: verify order, check SLA window, then issue store credit.',
      from: sourceName,
    };
  }
  return {
    key: `sample-${index}-${sourceName}`,
    type: 'Fact',
    content: `Key entities and patterns extracted from ${sourceName}.`,
    from: sourceName,
  };
};

const pickSampleSource = (namespace: Namespace, index: number) =>
  namespace.sources[index % Math.max(1, namespace.sources.length)] || 'your sources';

/** Sample KIs grouped by type for the test-run result (not the full-run total). */
const buildSetupSampleKis = (namespace: Namespace): SetupSampleKi[] => {
  const drive = namespace.sources.find((name) => /google drive|drive/i.test(name));
  const slack = namespace.sources.find((name) => /slack/i.test(name));
  const confluence = namespace.sources.find((name) => /confluence/i.test(name));
  const zendesk = namespace.sources.find((name) => /zendesk/i.test(name));
  const first = pickSampleSource(namespace, 0);
  const second = pickSampleSource(namespace, 1);
  return [
    {
      key: 'sample-faq-0',
      type: 'FAQ',
      content: slack
        ? 'Most-asked this month: how to regenerate an expired API key (14 threads).'
        : `Most-asked from ${first}: how to regenerate an expired API key.`,
      from: slack ? 'Slack #support' : first,
      question: 'How do I regenerate an expired API key?',
    },
    {
      key: 'sample-faq-1',
      type: 'FAQ',
      content: zendesk
        ? 'Top refund path: verify order, check SLA window, then issue store credit.'
        : `When is a ticket considered solved? Status Solved and no reopen within 48 hours (${second}).`,
      from: zendesk || second,
      question: 'When is a ticket considered solved?',
    },
    {
      key: 'sample-fact-0',
      type: 'Fact',
      content: drive
        ? "The 'Enterprise renewal playbook' doc defines a 90-day renewal checklist."
        : `Key entities and patterns extracted from ${first}.`,
      from: drive || first,
      question: 'What is in the 90-day renewal checklist?',
    },
    {
      key: 'sample-fact-1',
      type: 'Fact',
      content: 'Average first-response time on priority-2 tickets is 2.4 hours.',
      from: slack ? 'Slack #support' : second,
      question: 'What is the average first-response time for priority-2 tickets?',
    },
    {
      key: 'sample-fact-2',
      type: 'Fact',
      content: 'Enterprise renewals cluster in the last 90 days of the contract.',
      from: drive || first,
      question: 'When do enterprise renewals cluster?',
    },
    {
      key: 'sample-fact-3',
      type: 'Fact',
      content: 'Store credit is the default refund method for digital goods.',
      from: zendesk || second,
      question: 'What is the default refund method for digital goods?',
    },
    {
      key: 'sample-playbook-0',
      type: 'Playbook',
      content: confluence
        ? 'Postgres failover runbook: 6 steps, owned by SRE-DB.'
        : drive
          ? 'Enterprise renewal playbook: 90-day checklist, owned by the account team.'
          : `Runbook extracted from ${first}: verify, escalate, then close.`,
      from: confluence || drive || first,
      question: confluence
        ? 'What are the steps in the Postgres failover runbook?'
        : 'What are the steps in the renewal playbook?',
    },
    {
      key: 'sample-playbook-1',
      type: 'Playbook',
      content: 'Escalate severity-1 tickets to the owning queue within 15 minutes.',
      from: slack || zendesk || second,
      question: 'How quickly should severity-1 tickets be escalated?',
    },
    {
      key: 'sample-playbook-2',
      type: 'Playbook',
      content: 'Regenerate an expired API key: revoke the old key, issue a new one, notify the customer.',
      from: slack || first,
      question: 'What is the playbook for regenerating an expired API key?',
    },
  ].slice(0, SAMPLE_SETUP_KI_COUNT);
};

const isUsableIntentSentence = (intentValue?: string) => {
  const intent = intentValue?.trim() ?? '';
  if (intent.length < 12) return false;
  if (!/\s/.test(intent)) return false;
  if (/^(test|asdf|foo|bar|hello|hi)\b/i.test(intent)) return false;
  return true;
};

const mockFullSetupKiCount = (namespace: Namespace) =>
  Math.max(24, namespace.sources.length * 8);

/** Merged unique KI total: keep test-run extras, add full-run remainder, never double-count. */
const mergedSetupKiCount = (namespace: Namespace, testKiCount: number) => {
  const fullTotal = mockFullSetupKiCount(namespace);
  const additionalFromFull = Math.max(0, fullTotal - SAMPLE_SETUP_KI_COUNT);
  return testKiCount + additionalFromFull;
};

interface ExtractionStrategy {
  id: string;
  title: string;
  description: string;
  instruction: string;
}

const strategyForSource = (sourceName: string, index: number): ExtractionStrategy => {
  if (/bigquery|revenue|analytics/i.test(sourceName)) {
    return {
      id: `strategy-${index}-revenue`,
      title: 'Revenue and account facts',
      description:
        'Pull account revenue figures and the fields agents ask about, without querying raw tables.',
      instruction: '',
    };
  }
  if (/drive|google|sharepoint|confluence|wiki|doc/i.test(sourceName)) {
    return {
      id: `strategy-${index}-docs`,
      title: 'Playbooks and internal docs',
      description: 'Extract playbooks, ownership, and how-to steps from connected files.',
      instruction: '',
    };
  }
  if (/zendesk|ticket|slack/i.test(sourceName)) {
    return {
      id: `strategy-${index}-tickets`,
      title: 'Ticket patterns and SLAs',
      description: 'Capture common resolutions, SLA windows, and escalation paths from support data.',
      instruction: '',
    };
  }
  return {
    id: `strategy-${index}-source`,
    title: `Knowledge from ${sourceName}`,
    description: `Extract the facts and policies agents need from ${sourceName}.`,
    instruction: '',
  };
};

const FALLBACK_STRATEGIES: ExtractionStrategy[] = [
  {
    id: 'strategy-tickets',
    title: 'Ticket patterns and SLAs',
    description: 'Capture common resolutions, SLA windows, and escalation paths from support data.',
    instruction: '',
  },
  {
    id: 'strategy-docs',
    title: 'Playbooks and internal docs',
    description: 'Extract playbooks, ownership, and how-to steps from connected files.',
    instruction: '',
  },
  {
    id: 'strategy-entities',
    title: 'Entities and glossary terms',
    description: 'Capture canonical names, aliases, and disambiguators your agent mixes up.',
    instruction: '',
  },
];

/** Backend returns exactly three strategy cards. */
const buildMockStrategies = (namespace: Namespace): ExtractionStrategy[] => {
  const fromSources = namespace.sources.map((sourceName, index) =>
    strategyForSource(sourceName, index)
  );
  const unique: ExtractionStrategy[] = [];
  for (const strategy of [...fromSources, ...FALLBACK_STRATEGIES]) {
    if (unique.some((item) => item.title === strategy.title)) continue;
    unique.push(strategy);
    if (unique.length === 3) break;
  }
  return unique.slice(0, 3);
};

const buildAutomationFromStrategies = (
  _strategies: ExtractionStrategy[],
  _selectedIds: string[],
  namespace: Namespace
): Automation => {
  const sourcePhrase =
    namespace.sources.length === 0
      ? ''
      : namespace.sources.length === 1
        ? ` from ${namespace.sources[0]}`
        : namespace.sources.length === 2
          ? ` from ${namespace.sources[0]} and ${namespace.sources[1]}`
          : '';
  const title = `Extract Knowledge Indicators${sourcePhrase}`;
  return {
    id: 'generated-workflow-1',
    title,
    type: 'FACT',
    ownership: 'ADDED BY YOU',
    tags: [...namespace.sources, 'Bottom-Up'],
    description:
      'So your agent can answer from this knowledge without scanning the raw data.',
  };
};

const knowledgeFromKiCount = (kiCount: number) => ({
  playbooks: Math.max(1, Math.floor(kiCount / 5)),
  policies: Math.max(1, Math.floor(kiCount / 5)),
  faqs: Math.max(1, Math.floor(kiCount / 4)),
  glossaries: 1,
  facts: Math.max(2, kiCount - Math.floor(kiCount / 5) * 2 - Math.floor(kiCount / 4) - 1),
});

const SETUP_KI_SENTENCES: Record<KnowledgeIndicator['type'], string[]> = {
  PLAYBOOK: [
    'Verify the order, check the SLA window, then issue store credit.',
    'Escalate severity-1 tickets to the owning queue within 15 minutes.',
    'Regenerate an expired API key: revoke the old key, issue a new one, notify the customer.',
    'Hand off unresolved billing disputes to finance with the account ID attached.',
  ],
  POLICY: [
    'Do not issue refunds outside the 30-day SLA window without manager approval.',
    'PII from tickets must not be pasted into external tools.',
    'Always cite the source ticket or doc when answering an SLA question.',
    'Priority queues take precedence over backlog when capacity is constrained.',
  ],
  FAQ: [
    'Top refund path: verify order, check SLA window, then issue store credit.',
    'Most-asked this month: how to regenerate an expired API key.',
    'How do I find account revenue? Use the revenue view by account, not raw tables.',
    'When is a ticket considered solved? Status Solved and no reopen within 48 hours.',
    'Can agents override SLA? Only with a documented exception code.',
    'Where is the escalation matrix? In the support playbook for the product line.',
  ],
  GLOSSARY: [
    'SLA window: the contractual response or resolve period for a ticket priority.',
  ],
  FACT: [
    'Q2 EMEA revenue grew 18%; top three accounts drive 42% of it.',
    'Average first-response time on priority-2 tickets is 2.4 hours.',
    'Enterprise renewals cluster in the last 90 days of the contract.',
    'Store credit is the default refund method for digital goods.',
    'Zendesk macros cover 60% of first replies in the support queue.',
    'Churn risk rises when three or more open severity-1 tickets share an account.',
    'The finance dataset excludes sandbox and internal test accounts.',
    'Weekend ticket volume is about 35% of weekday volume.',
    'Top three product lines account for most SLA breaches this quarter.',
  ],
};

/** Mock full KI list for setup review / ready states (counts match knowledgeFromKiCount). */
const buildSetupIndicators = (namespace: Namespace, kiCount: number): KnowledgeIndicator[] => {
  const counts = knowledgeFromKiCount(kiCount);
  const sources = namespace.sources.length > 0 ? namespace.sources : ['your sources'];
  const plan: Array<{ type: KnowledgeIndicator['type']; count: number }> = [
    { type: 'PLAYBOOK', count: counts.playbooks },
    { type: 'POLICY', count: counts.policies },
    { type: 'FAQ', count: counts.faqs },
    { type: 'GLOSSARY', count: counts.glossaries },
    { type: 'FACT', count: counts.facts },
  ];
  const indicators: KnowledgeIndicator[] = [];
  let cursor = 0;
  plan.forEach(({ type, count }) => {
    const sentences = SETUP_KI_SENTENCES[type];
    for (let index = 0; index < count; index += 1) {
      const source = sources[cursor % sources.length];
      const automation =
        namespace.automations.find((item) => item.tags.includes(source)) ||
        namespace.automations[cursor % Math.max(1, namespace.automations.length)];
      const extractedBy =
        automation?.title || `Extract Knowledge Indicators from ${source}`;
      const content = sentences[index % sentences.length];
      const slug = `${namespace.name}-${type.toLowerCase()}-${index}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      indicators.push({
        id: `setup-ki-${slug}`,
        title: content.length > 72 ? `${content.slice(0, 69)}...` : content,
        category: source,
        type,
        tags: [source, type.toLowerCase(), 'setup'],
        description: content,
        value: content,
        extractedBy,
        usedBy: namespace.name,
        currentVersion: 1,
        versions: [
          {
            version: 1,
            summary: 'Initial extraction',
            source: 'Extraction automation',
            when: 'just now',
          },
        ],
        confidence: 88 + (index % 8),
        evidenceCount: 3 + (index % 6),
      });
      cursor += 1;
    }
  });
  return indicators;
};

const indicatorContentSentence = (indicator: KnowledgeIndicator) => {
  if (typeof indicator.value === 'string' && indicator.value.trim()) {
    return indicator.value.split('\n')[0];
  }
  if (Array.isArray(indicator.value) && indicator.value[0]) {
    return indicator.value[0];
  }
  return indicator.description || indicator.title;
};

/** Benefit clause for the review meta line; junk intent falls back to sources. */
const setupBenefitClause = (intentValue: string | undefined, sourceNames: string[]) => {
  const sourcesLabel = formatSourceList(sourceNames);
  if (!isUsableIntentSentence(intentValue)) {
    return `They help your agent answer questions from ${sourcesLabel} without scanning them.`;
  }
  const intent = intentValue!.trim();
  let topic: string;
  if (/runbook|escalation|ownership/i.test(intent)) {
    topic = 'runbook, escalation and ownership questions';
  } else if (/ticket|sla|refund|support/i.test(intent)) {
    topic = 'ticket, SLA and refund questions';
  } else {
    topic = intent.length > 72 ? `${intent.slice(0, 69)}...` : intent;
  }
  return `They help your agent answer ${topic} without scanning ${sourcesLabel}.`;
};

/** Benefit-first proposal copy for setup step 2 cards. */
const proposalBenefitDescription = (sourceName: string) => {
  if (/bigquery/i.test(sourceName)) {
    return 'So your agent can answer revenue and account questions without querying raw tables.';
  }
  if (/google drive|drive/i.test(sourceName)) {
    return 'So your agent can cite playbooks and docs without opening files.';
  }
  if (/zendesk/i.test(sourceName)) {
    return 'So your agent can answer from past tickets and SLAs.';
  }
  if (/slack/i.test(sourceName)) {
    return 'So your agent can answer from recent support threads without scrolling chat history.';
  }
  if (/confluence/i.test(sourceName)) {
    return 'So your agent can follow runbooks and escalation paths without opening Confluence.';
  }
  return `So your agent can answer questions from ${sourceName} without scanning it.`;
};

const proposalEditPlaceholder = (sourceName: string) => {
  if (/bigquery/i.test(sourceName)) return 'Only the finance dataset...';
  if (/google drive|drive/i.test(sourceName)) return 'Skip meeting notes...';
  if (/zendesk/i.test(sourceName)) return 'Only solved tickets from the last year...';
  if (/slack/i.test(sourceName)) return 'Only #support and #incidents...';
  if (/confluence/i.test(sourceName)) return 'Only the SRE space, skip meeting notes...';
  return 'Describe a change before approving...';
};

const proposalSourceName = (automation: Automation, sources: string[]) =>
  automation.tags.find((tag) => sources.includes(tag)) ||
  automation.title.replace(/^Extract Knowledge Indicators from\s+/i, '') ||
  sources[0] ||
  'your source';

const SETUP_TRY_STOPWORDS = new Set([
  'the',
  'this',
  'that',
  'from',
  'what',
  'how',
  'when',
  'where',
  'should',
  'about',
  'know',
  'for',
  'and',
  'with',
  'are',
  'was',
  'does',
  'did',
  'can',
  'you',
  'your',
  'our',
  'into',
  'something',
]);

const answerSetupTryQuestion = (
  question: string,
  samples: SetupSampleKi[]
): ReviewTryResult => {
  const trimmed = question.trim().toLowerCase();
  const byQuestion = samples.find(
    (sample) => sample.question && sample.question.trim().toLowerCase() === trimmed
  );
  const words = trimmed
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !SETUP_TRY_STOPWORDS.has(word));
  const byKeywords =
    byQuestion ??
    (words.length === 0
      ? undefined
      : samples.find((sample) => {
          const haystack = `${sample.title ?? ''} ${sample.content} ${sample.type} ${
            sample.from
          } ${sample.question ?? ''}`.toLowerCase();
          return words.some((word) => haystack.includes(word));
        }));
  if (byKeywords) {
    return {
      kind: 'hit',
      answer: byKeywords.content,
      hitKey: byKeywords.key,
      hitType: byKeywords.type,
      hitFrom: byKeywords.from,
      hitTitle: byKeywords.title ?? byKeywords.content,
    };
  }
  return { kind: 'miss' };
};

const formatKiTypeLabel = (type: string) =>
  type === 'FAQ' ? 'FAQ' : `${type.charAt(0)}${type.slice(1).toLowerCase()}`;

const trySamplesFromIndicators = (indicators: KnowledgeIndicator[]): SetupSampleKi[] =>
  indicators.map((indicator) => ({
    key: indicator.id,
    type: formatKiTypeLabel(indicator.type),
    content: indicator.description,
    from:
      indicator.extractedBy ||
      indicator.versions[indicator.versions.length - 1]?.source ||
      'this index',
    title: indicator.title,
  }));

interface AgentStep {
  title: string;
  language: string;
  code: string;
}

interface AgentHarnessPackage {
  id: AgentHarness;
  label: string;
  steps: AgentStep[];
}

interface Source {
  id: string;
  name: string;
  description: string;
  category: SourceCategory;
  typeLabel: string;
  icon: string;
  /** Agent-traces only: stream id shown in code style on the secondary line. */
  streamName?: string;
  questionCount?: string;
  lastActive?: string;
}

/** Proto 4: Signals and Elastic Features stay hidden; agent traces are a Sources tab. */
const ALL_SOURCE_CATEGORIES: Array<{
  id: SourceCategory;
  label: string;
  icon: string;
  createLabel: string;
}> = [
  { id: 'connectors', label: 'Connectors', icon: 'plugs', createLabel: 'Add a source' },
  {
    id: 'esql',
    label: 'ES|QL views',
    icon: 'editorCodeBlock',
    createLabel: 'Add a source',
  },
  {
    id: 'traces',
    label: 'Agent traces',
    icon: 'apmTrace',
    createLabel: 'Add a source',
  },
];

const sourceCategories = ALL_SOURCE_CATEGORIES.filter(
  (category) => category.id !== 'traces' || M3_AGENT_TRACES_ENABLED
);

const availableSources: Source[] = [
  {
    id: 'bigquery',
    name: 'BigQuery revenue view',
    description: 'ES|QL · FROM bigquery-export-* | STATS revenue BY account',
    category: 'esql',
    typeLabel: 'ES|QL view',
    icon: 'editorCodeBlock',
  },
  {
    id: 'product-analytics',
    name: 'Product analytics view',
    description: 'ES|QL · FROM analytics-events | WHERE event_type == "activation"',
    category: 'esql',
    typeLabel: 'ES|QL view',
    icon: 'editorCodeBlock',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: '3 shared drives connected',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: 'logoGoogleG',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '#support, #sales +4 channels',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: 'logoSlack',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '12 repos · issues & PRs',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: 'logoGithub',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    description: 'Engineering wiki · runbooks space',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: 'documents',
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    description: 'Support tickets · last 90 days',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: 'plugs',
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    description: 'Sites and document libraries',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: 'logoWindows',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Accounts, opportunities, cases',
    category: 'connectors',
    typeLabel: 'Connector',
    icon: salesforceLogo,
  },
  {
    id: 'root-logs',
    name: 'Root logs Stream',
    description: 'Live · root application log signals',
    category: 'signals',
    typeLabel: 'Stream signal',
    icon: 'visBarVertical',
  },
  {
    id: 'traces-apm.agent-support.default',
    name: 'Support triage agent',
    description: '1,204 questions · last active 2 hours ago',
    category: 'traces',
    typeLabel: 'Agent traces',
    icon: 'apmTrace',
    streamName: 'traces-apm.agent-support.default',
    questionCount: '1,204',
    lastActive: '2 hours ago',
  },
  {
    id: 'traces-apm.agent-sales.default',
    name: 'Sales outreach agent',
    description: '642 questions · last active yesterday',
    category: 'traces',
    typeLabel: 'Agent traces',
    icon: 'apmTrace',
    streamName: 'traces-apm.agent-sales.default',
    questionCount: '642',
    lastActive: 'yesterday',
  },
  {
    id: 'traces-otel-langgraph.docs_qa-default',
    name: 'Docs Q&A agent',
    description: '318 questions · last active 3 days ago',
    category: 'traces',
    typeLabel: 'Agent traces',
    icon: 'apmTrace',
    streamName: 'traces-otel-langgraph.docs_qa-default',
    questionCount: '318',
    lastActive: '3 days ago',
  },
  {
    id: 'dashboards',
    name: 'Dashboards',
    description: 'Saved Kibana dashboards',
    category: 'features',
    typeLabel: 'Elastic feature',
    icon: 'dashboardApp',
  },
  {
    id: 'visualisations',
    name: 'Visualisations',
    description: 'Lens, TSVB & saved visualisations',
    category: 'features',
    typeLabel: 'Elastic feature',
    icon: 'visualizeApp',
  },
  {
    id: 'alerts',
    name: 'Alerts',
    description: 'Rule-based alerts & connectors',
    category: 'features',
    typeLabel: 'Elastic feature',
    icon: 'bell',
  },
  {
    id: 'slos',
    name: 'SLOs',
    description: 'Service level objectives',
    category: 'features',
    typeLabel: 'Elastic feature',
    icon: 'visGauge',
  },
];

type WorkflowProfile = 'support' | 'logs' | 'revenue' | 'drive' | 'docs' | 'slack';

const workflowProfileForSource = (sourceName: string): WorkflowProfile => {
  const name = sourceName.toLowerCase();
  if (
    name.includes('support') ||
    name.includes('zendesk') ||
    name.includes('case') ||
    name.includes('ticket')
  ) {
    return 'support';
  }
  if (name.includes('bigquery') || name.includes('revenue') || name.includes('analytics')) {
    return 'revenue';
  }
  if (name.includes('drive') || name.includes('google')) {
    return 'drive';
  }
  if (name.includes('confluence') || name.includes('wiki') || name.includes('sharepoint')) {
    return 'docs';
  }
  if (name.includes('slack')) {
    return 'slack';
  }
  return 'logs';
};

const buildSupportWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  # One row per ticket. STATS collapses ticket fields for extraction.
  - name: query_tickets
    type: elasticsearch.esql.query
    with:
      query: >
        FROM zendesk-tickets*
        | WHERE status IN ("solved", "closed")
        | STATS
            subject     = TOP(ticket.subject, 1),
            priority    = TOP(ticket.priority, 1),
            sla_breach  = TOP(sla.breach, 1),
            resolution  = TOP(ticket.resolution_notes, 1),
            tags        = VALUES(ticket.tags)
          BY ticket.id
        | KEEP ticket.id, subject, priority, sla_breach, resolution, tags

  - name: loop_tickets
    type: foreach
    foreach: '{{ steps.query_tickets.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: zendesk_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from the Zendesk ticket (source: ${sourceName})
            and upsert it into this context namespace, keyed on ticket.id so
            re-runs update in place.`;

const buildRevenueWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  # Revenue by account from the BigQuery export view.
  - name: query_revenue
    type: elasticsearch.esql.query
    with:
      query: >
        FROM bigquery-export-*
        | STATS
            revenue     = SUM(revenue),
            deals       = COUNT(*),
            region      = TOP(region, 1)
          BY account
        | KEEP account, revenue, deals, region
        | SORT revenue DESC
        | LIMIT 200

  - name: loop_accounts
    type: foreach
    foreach: '{{ steps.query_revenue.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: revenue_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from this account revenue row (source: ${sourceName})
            and upsert it into this context namespace, keyed on account so
            re-runs update in place.`;

const buildDriveWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  # Shared-drive docs and playbooks.
  - name: query_drive_files
    type: elasticsearch.esql.query
    with:
      query: >
        FROM google-drive-*
        | WHERE file.mime_type IN ("application/vnd.google-apps.document", "text/plain")
        | KEEP file.id, file.name, file.path, file.modified_at, file.body_excerpt
        | SORT file.modified_at DESC
        | LIMIT 100

  - name: loop_files
    type: foreach
    foreach: '{{ steps.query_drive_files.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: drive_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from this Drive file (source: ${sourceName})
            and upsert it into this context namespace, keyed on file.id so
            re-runs update in place. Skip meeting notes.`;

const buildDocsWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  - name: query_wiki_pages
    type: elasticsearch.esql.query
    with:
      query: >
        FROM confluence-pages*
        | WHERE space.key IS NOT NULL
        | KEEP page.id, page.title, space.key, page.body_excerpt
        | LIMIT 100

  - name: loop_pages
    type: foreach
    foreach: '{{ steps.query_wiki_pages.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: confluence_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from this wiki page (source: ${sourceName})
            and upsert it into this context namespace, keyed on page.id.`;

const buildSlackWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  - name: query_channels
    type: elasticsearch.esql.query
    with:
      query: >
        FROM slack-messages*
        | WHERE channel.name IN ("support", "incidents", "sales")
        | STATS
            topics = TOP(message.text, 3),
            authors = VALUES(user.name)
          BY channel.name, thread.ts
        | LIMIT 100

  - name: loop_threads
    type: foreach
    foreach: '{{ steps.query_channels.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: slack_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from this Slack thread (source: ${sourceName})
            and upsert it into this context namespace.`;

const buildLogsWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  # One row per exception signature from root log signals.
  - name: query_root_logs
    type: elasticsearch.esql.query
    with:
      query: >
        FROM logs-app-prod*
        | WHERE log.level IN ("error", "fatal") OR exception.type IS NOT NULL
        | STATS
            exception   = TOP(exception.type, 1),
            message     = TOP(message, 1),
            service     = TOP(service.name, 1),
            host        = TOP(host.name, 1),
            occurrences = COUNT(*)
          BY exception.fingerprint
        | KEEP exception.fingerprint, exception, message, service, host, occurrences
        | SORT occurrences DESC
        | LIMIT 50

  - name: loop_log_clusters
    type: foreach
    foreach: '{{ steps.query_root_logs.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: root_logs_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from this root log / exception cluster
            (source: ${sourceName}) and upsert it into this context namespace,
            keyed on exception.fingerprint so re-runs update in place.`;

const buildWorkflowYaml = (sourceName: string, workflowName?: string) => {
  const name = workflowName || `Extract Knowledge Indicators from ${sourceName}`;
  // Prefer the automation title when picking a profile so a mis-tagged source
  // (e.g. defaulting to Root logs) still opens the matching YAML.
  const profile = workflowProfileForSource(`${sourceName} ${name}`);
  switch (profile) {
    case 'support':
      return buildSupportWorkflowYaml(sourceName, name);
    case 'revenue':
      return buildRevenueWorkflowYaml(sourceName, name);
    case 'drive':
      return buildDriveWorkflowYaml(sourceName, name);
    case 'docs':
      return buildDocsWorkflowYaml(sourceName, name);
    case 'slack':
      return buildSlackWorkflowYaml(sourceName, name);
    default:
      return buildLogsWorkflowYaml(sourceName, name);
  }
};

const esqlFromIdent = (sourceName: string) =>
  /[^A-Za-z0-9_*]/.test(sourceName) ? `"${sourceName.replace(/"/g, '')}"` : sourceName;

/** Scaffold YAML for a new automation: one FROM stub per selected source. */
const buildNewWorkflowYaml = (workflowName: string, sourceNames: string[]) => {
  const sources = sourceNames.length > 0 ? sourceNames : ['logs-*'];
  const queryBlock = sources
    .map((source, index) => {
      const fromLine = `        FROM ${esqlFromIdent(source)}\n        | LIMIT 10`;
      return index === 0 ? fromLine : `\n${fromLine}`;
    })
    .join('');
  return `version: 1
name: ${workflowName}
enabled: true
steps:
  - name: query_sources
    type: elasticsearch.esql.query
    with:
      query: |
${queryBlock}
  - name: foreach_hits
    type: foreach
    foreach:
      items: '{{ steps.query_sources.hits }}'
  - name: extract_ki
    type: ai.agent
    agentId: ki_extract_agent
    timeout: 180s
`;
};

const knowledgeIndicatorCountLabel = (count: number) =>
  `${count} Knowledge Indicator${count === 1 ? '' : 's'}`;

const mockAutomationLastRun = (automationId: string) => {
  const labels = ['2 hours ago', 'yesterday', '3 days ago', 'this morning'];
  let hash = 0;
  for (let index = 0; index < automationId.length; index += 1) {
    hash += automationId.charCodeAt(index);
  }
  return labels[hash % labels.length];
};

const mockAutomationFailureRate = (automationId: string) => {
  let hash = 0;
  for (let index = 0; index < automationId.length; index += 1) {
    hash += automationId.charCodeAt(index);
  }
  const tenths = 11 + (hash % 28);
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
};

const sampleTestRunIndicators = (sourceName: string) => {
  if (workflowProfileForSource(sourceName) === 'support') {
    return [
      {
        title: 'Password reset macro linkage',
        type: 'FACT',
        summary: 'Password resets resolve fastest when the account-recovery macro is applied first.',
      },
      {
        title: 'Escalation after 3 failed auth attempts',
        type: 'POLICY',
        summary: 'Escalate to identity when authentication fails three times in one case thread.',
      },
      {
        title: 'KB: Stack version mismatch',
        type: 'FAQ',
        summary: 'Link the version-mismatch KB article when product.version differs from cluster.',
      },
    ];
  }
  return [
    {
      title: 'NullPointerException in checkout-service',
      type: 'FACT',
      summary:
        'Overnight spikes of NullPointerException in checkout-service clear after redeploying cart-cache.',
    },
    {
      title: 'Disk pressure on host logs-prod-07',
      type: 'PLAYBOOK',
      summary: 'When host.disk.used_pct > 90 on logs-prod-07, rotate and compress root log shards.',
    },
    {
      title: 'TimeoutException · payment-gateway',
      type: 'FACT',
      summary:
        'Recurring TimeoutException against payment-gateway correlates with 02:00 batch settlement.',
    },
  ];
};

const DEMO_API_KEY = 'eks_ctx_8f3a2c91b7e04d6a9c1f5e82';
const DEMO_MCP_HOST = 'context.deployment.elastic.cloud';

const buildAgentPackages = (
  namespaceName: string,
  indexName: string,
  mcpUrl: string
): AgentHarnessPackage[] => [
  {
    id: 'claudeCode',
    label: 'Claude Code',
    steps: [
      {
        title: 'Install',
        language: 'bash',
        code: `npm install -g @elastic/context-claude-code
# or: claude mcp add elastic-context`,
      },
      {
        title: 'Configure',
        language: 'json',
        code: `{
  "mcpServers": {
    "elastic-context": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "ApiKey <YOUR_API_KEY>"
      },
      "env": {
        "CONTEXT_NAMESPACE": "${indexName}",
        "CONTEXT_NAMESPACE_NAME": "${namespaceName}"
      }
    }
  }
}`,
      },
      {
        title: 'Validate',
        language: 'bash',
        code: `claude mcp list
# expect: elastic-context · connected · ${indexName}`,
      },
    ],
  },
  {
    id: 'claudeSdk',
    label: 'Claude Agent SDK',
    steps: [
      {
        title: 'Install',
        language: 'bash',
        code: `npm install @anthropic-ai/claude-agent-sdk @elastic/context-mcp`,
      },
      {
        title: 'Configure',
        language: 'javascript',
        code: `import { query } from "@anthropic-ai/claude-agent-sdk";

const result = await query({
  prompt: userMessage,
  options: {
    mcpServers: {
      elasticContext: {
        type: "http",
        url: "${mcpUrl}",
        headers: { Authorization: "ApiKey " + process.env.ELASTIC_CONTEXT_API_KEY },
        args: ["--index", "${indexName}"],
      },
    },
  },
});`,
      },
      {
        title: 'Validate',
        language: 'bash',
        code: `node -e "require('@elastic/context-mcp').test('${indexName}')"
# or: npx elastic-context test --index ${indexName}`,
      },
    ],
  },
  {
    id: 'langchain',
    label: 'LangChain',
    steps: [
      {
        title: 'Install',
        language: 'bash',
        code: `pip install elastic-context-langchain`,
      },
      {
        title: 'Configure',
        language: 'python',
        code: `from elastic_context import ContextClient
from langchain.agents import create_agent

client = ContextClient(
    mcp_url="${mcpUrl}",
    api_key="<YOUR_API_KEY>",
    namespace="${indexName}",
)

agent = create_agent(
    tools=[client.as_tool()],
    instructions="Ground answers in ${namespaceName} context.",
)`,
      },
      {
        title: 'Validate',
        language: 'bash',
        code: `python -m elastic_context.test --namespace ${indexName}`,
      },
    ],
  },
  {
    id: 'cowork',
    label: 'Cowork',
    steps: [
      {
        title: 'Install',
        language: 'bash',
        code: `cowork plugins install elastic-context
# requires Cowork CLI ≥ 1.4`,
      },
      {
        title: 'Configure',
        language: 'yaml',
        code: `# .cowork/context.yaml
mcp:
  server: ${mcpUrl}
  api_key_env: ELASTIC_CONTEXT_API_KEY
namespace: ${indexName}
display_name: ${namespaceName}`,
      },
      {
        title: 'Validate',
        language: 'bash',
        code: `cowork context test --namespace ${indexName}`,
      },
    ],
  },
  {
    id: 'mcp',
    label: 'Other (MCP)',
    steps: [
      {
        title: 'Install',
        language: 'bash',
        code: `# Any MCP-compatible client
pip install mcp
# or: npm install @modelcontextprotocol/sdk`,
      },
      {
        title: 'Configure',
        language: 'json',
        code: `{
  "mcpServers": {
    "elastic-context": {
      "transport": "streamable-http",
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "ApiKey <YOUR_API_KEY>"
      },
      "params": {
        "namespace": "${indexName}"
      }
    }
  }
}`,
      },
      {
        title: 'Validate',
        language: 'bash',
        code: `npx @modelcontextprotocol/inspector ${mcpUrl}
# Tools should include get_context for ${indexName}`,
      },
    ],
  },
  {
    id: 'agentBuilder',
    label: 'Elastic Agent Builder',
    steps: [],
  },
];

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Live input sanitizer: lowercase, spaces/specials → hyphens (Elasticsearch-friendly). */
const sanitizeNamespaceInput = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-');

const validateNamespaceName = (name: string): string | undefined => {
  if (!name || name === '-') {
    return 'Enter an AI index name.';
  }
  if (name.startsWith('-')) {
    return 'Name must start with a lowercase letter or number.';
  }
  const normalized = slugify(name);
  if (!normalized) {
    return 'Enter an AI index name.';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return 'Use lowercase letters, numbers, and hyphens only (no spaces or special characters).';
  }
  if (normalized.length > 200) {
    return 'Name is too long for an Elasticsearch index.';
  }
  return undefined;
};

const CONTEXT_APP_HREF = '/app/contextEngineExample8';

const contextIndexHref = (name: string) =>
  `${CONTEXT_APP_HREF}?open=${encodeURIComponent(name)}`;

const headerBack = (href: string, label: string, onGo: () => void): AppHeaderBack => ({
  href,
  label,
  onClick: (event) => {
    event.preventDefault();
    onGo();
  },
});

const headerMeta = (label: string): AppHeaderMetadataItems => [
  { type: 'text', label },
];

const FullWidthAppHeader = (props: React.ComponentProps<typeof AppHeader>) => (
  <EuiPageTemplate.Section
    grow={false}
    restrictWidth={false}
    paddingSize="none"
    className="contextEnginePrototype__headerSection"
  >
    <AppHeader {...props} />
  </EuiPageTemplate.Section>
);

/** Deep link open query: `/app/contextEngineExample8?open=Elastic`. */
const readOpenIndexDeepLink = (search: string): string | null => {
  try {
    return new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('open');
  } catch {
    return null;
  }
};

/**
 * Proto demo flag for user-created indices only (hasMonitoringData).
 * false: Overview shows traces-connected placeholder; hides suggestions.
 * true: Overview shows stats strip + Improvements (when tracesAnalysed > 0).
 */
const MOCK_USER_CREATED_MONITORING_ANALYSIS_READY = false;

/** Catalog badges hide trace-derived issues while Agent monitoring is gated off. */
const surfaceCatalogLifecycle = (namespace: Namespace): CatalogLifecycleBadge => {
  const lifecycle = resolveCatalogLifecycle(namespace);
  if (!AGENT_MONITORING_ENABLED && lifecycle.kind === 'issues') {
    return { kind: 'ready' };
  }
  return lifecycle;
};

const improvementCases = (
  source: string,
  ids: [string, string, string]
): ImprovementCase[] => [
  { id: ids[0], timestamp: '21:16:35', tool: 'execute_esql', source },
  { id: ids[1], timestamp: '21:19:19', tool: 'execute_esql', source },
  { id: ids[2], timestamp: '09:24:02', tool: 'search', source },
];

/**
 * Six mock improvements keyed to this index's own sources (never a foreign index's
 * tables). Grouped as Open / Applied / Dismissed after analysis.
 */
const improvementsForNamespace = (namespace: Namespace): OverviewImprovement[] => {
  const sources = namespace.sources.length > 0 ? namespace.sources : ['your sources'];
  const primary = sources[0];
  const secondary = sources[1] || sources[0];
  const prefix = namespace.name;

  if (/root logs|error signals|nightshift/i.test(`${namespace.name} ${sources.join(' ')}`)) {
    return [
      {
        id: `${prefix}-exception-bypass`,
        title: 'Agent bypasses knowledge for exception questions',
        description: `For exception fingerprint questions, your agent queried raw ${primary} instead of retrieving knowledge.`,
        casesCount: 6,
        lastSeen: 'today',
        proposedFix: `Broaden the ${primary} automation to extract per-service exception summaries, so these questions answer from knowledge.`,
        tweakPlaceholder: 'Adjust the fix, e.g. only production hosts...',
        createsAutomation: false,
        findingDetail: `The agent queried ${primary} directly instead of retrieving a knowledge item.`,
        firstSeen: 'Jul 31, 21:16',
        lastSeenDetail: 'Today, 09:24',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['n1', 'n2', 'n3']),
      },
      {
        id: `${prefix}-disk-gap`,
        title: 'Disk pressure questions miss knowledge',
        description: `Host disk questions fell back to scanning ${secondary}; no Knowledge Indicators cover disk pressure playbooks.`,
        casesCount: 11,
        lastSeen: 'yesterday',
        proposedFix: `Add an automation on ${secondary} extracting disk-pressure playbooks per host class.`,
        tweakPlaceholder: 'Adjust the fix, e.g. only hosts above 90%...',
        createsAutomation: true,
        findingDetail: `Disk pressure questions fell back to scanning ${secondary}.`,
        firstSeen: 'Jul 28, 14:02',
        lastSeenDetail: 'Yesterday, 16:41',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['n4', 'n5', 'n6']),
      },
      {
        id: `${prefix}-service-error-gap`,
        title: 'Service error lookups skip knowledge',
        description: `Service error questions always query ${secondary} directly; a small error-signal glossary would answer them from knowledge.`,
        casesCount: 18,
        lastSeen: 'today',
        proposedFix: `Extract an error-signal glossary (service, fingerprint, owner) from ${secondary}.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: false,
        findingDetail: `Service error questions always queried ${secondary} directly.`,
        firstSeen: 'Jul 29, 10:18',
        lastSeenDetail: 'Today, 11:07',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['n7', 'n8', 'n9']),
      },
      {
        id: `${prefix}-log-level-gap`,
        title: 'Log-level filter questions miss playbooks',
        description: `Agents scan ${primary} for fatal/error filters instead of a distilled playbook.`,
        casesCount: 9,
        lastSeen: '2 days ago',
        proposedFix: `Distil log-level triage playbooks from ${primary} keyed on exception.fingerprint.`,
        tweakPlaceholder: 'Adjust the fix, e.g. fatal only...',
        createsAutomation: true,
        findingDetail: `Log-level filter questions scanned ${primary}.`,
        firstSeen: 'Jul 30, 08:11',
        lastSeenDetail: '2 days ago, 18:02',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['n10', 'n11', 'n12']),
      },
      {
        id: `${prefix}-npe-cluster`,
        title: 'NullPointerException clusters not distilled',
        description: `Recurring NPE clusters in ${primary} are re-queried every night instead of a Fact KI.`,
        casesCount: 14,
        lastSeen: 'today',
        proposedFix: `Extract nightly NPE cluster facts from ${primary} keyed on fingerprint.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: false,
        findingDetail: `NPE clusters were re-queried from ${primary}.`,
        firstSeen: 'Jul 27, 22:40',
        lastSeenDetail: 'Today, 07:15',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['n13', 'n14', 'n15']),
      },
      {
        id: `${prefix}-timeout-gap`,
        title: 'TimeoutException patterns fall back to raw scan',
        description: `Timeout questions against ${secondary} skip knowledge and re-scan every round.`,
        casesCount: 7,
        lastSeen: 'yesterday',
        proposedFix: `Add TimeoutException pattern facts from ${secondary} with owning service tags.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: true,
        findingDetail: `TimeoutException questions scanned ${secondary}.`,
        firstSeen: 'Jul 26, 12:03',
        lastSeenDetail: 'Yesterday, 19:22',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['n16', 'n17', 'n18']),
      },
    ];
  }

  if (/zendesk|confluence|support/i.test(`${namespace.name} ${sources.join(' ')}`)) {
    return [
      {
        id: `${prefix}-refund-bypass`,
        title: 'Agent bypasses knowledge for refund questions',
        description: `For refund questions, your agent queried raw ${primary} instead of retrieving knowledge.`,
        casesCount: 6,
        lastSeen: 'today',
        proposedFix: `Broaden the ${primary} automation to extract refund-path FAQs, so these questions answer from knowledge.`,
        tweakPlaceholder: 'Adjust the fix, e.g. only last 90 days...',
        createsAutomation: false,
        findingDetail: `The agent queried ${primary} directly instead of retrieving a knowledge item.`,
        firstSeen: 'Jul 31, 21:16',
        lastSeenDetail: 'Today, 09:24',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['s1', 's2', 's3']),
      },
      {
        id: `${prefix}-sla-gap`,
        title: 'SLA questions miss knowledge',
        description: `SLA questions fell back to scanning ${primary}; no Knowledge Indicators cover SLA windows by priority.`,
        casesCount: 19,
        lastSeen: 'yesterday',
        proposedFix: `Add an automation on ${primary} extracting SLA window policies by priority.`,
        tweakPlaceholder: 'Adjust the fix, e.g. P1/P2 only...',
        createsAutomation: true,
        findingDetail: `SLA questions fell back to scanning ${primary}.`,
        firstSeen: 'Jul 28, 14:02',
        lastSeenDetail: 'Yesterday, 16:41',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['s4', 's5', 's6']),
      },
      {
        id: `${prefix}-escalation-gap`,
        title: 'Escalation matrix lookups skip knowledge',
        description: `Escalation questions always open ${secondary} directly; a playbook KI would answer them from knowledge.`,
        casesCount: 29,
        lastSeen: 'today',
        proposedFix: `Extract the escalation matrix playbook from ${secondary}.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: false,
        findingDetail: `Escalation questions always opened ${secondary} directly.`,
        firstSeen: 'Jul 29, 10:18',
        lastSeenDetail: 'Today, 11:07',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['s7', 's8', 's9']),
      },
      {
        id: `${prefix}-macro-gap`,
        title: 'Macro linkage questions re-scan tickets',
        description: `Agents re-scan ${primary} for password-reset macros instead of a Fact KI.`,
        casesCount: 12,
        lastSeen: '2 days ago',
        proposedFix: `Distil macro-linkage facts from ${primary} for the top recovery paths.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: true,
        findingDetail: `Macro linkage questions scanned ${primary}.`,
        firstSeen: 'Jul 30, 08:11',
        lastSeenDetail: '2 days ago, 18:02',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['s10', 's11', 's12']),
      },
      {
        id: `${prefix}-runbook-gap`,
        title: 'Runbook ownership questions miss glossary',
        description: `Who-owns-this-runbook questions open ${secondary} instead of a glossary KI.`,
        casesCount: 8,
        lastSeen: 'today',
        proposedFix: `Extract a runbook ownership glossary from ${secondary}.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: false,
        findingDetail: `Ownership questions opened ${secondary}.`,
        firstSeen: 'Jul 27, 22:40',
        lastSeenDetail: 'Today, 07:15',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['s13', 's14', 's15']),
      },
      {
        id: `${prefix}-priority-gap`,
        title: 'Priority queue routing falls back to raw scan',
        description: `Priority routing questions scan ${primary} every round instead of a Policy KI.`,
        casesCount: 10,
        lastSeen: 'yesterday',
        proposedFix: `Add priority-queue routing policies from ${primary}.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: true,
        findingDetail: `Priority routing scanned ${primary}.`,
        firstSeen: 'Jul 26, 12:03',
        lastSeenDetail: 'Yesterday, 19:22',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['s16', 's17', 's18']),
      },
    ].slice(0, 5);
  }

  // Generic / managed Elastic / other indices: grounded on their listed sources.
  const genericImprovements: OverviewImprovement[] = [
    {
      id: `${prefix}-bypass-1`,
      title: `Agent bypasses knowledge for ${primary} questions`,
      description: `For common questions, your agent queried raw ${primary} instead of retrieving knowledge.`,
      casesCount: 6,
      lastSeen: 'today',
      proposedFix: `Broaden the ${primary} automation so these questions answer from knowledge.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: false,
      findingDetail: `The agent queried ${primary} directly.`,
      firstSeen: 'Jul 31, 21:16',
      lastSeenDetail: 'Today, 09:24',
      confidence: 'High',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(primary, ['g1', 'g2', 'g3']),
    },
    {
      id: `${prefix}-gap-2`,
      title: `${secondary} questions miss knowledge`,
      description: `Questions fell back to scanning ${secondary}; no Knowledge Indicators cover the recurring ask.`,
      casesCount: 19,
      lastSeen: 'yesterday',
      proposedFix: `Add an automation on ${secondary} extracting the missing facts.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: true,
      findingDetail: `Questions fell back to scanning ${secondary}.`,
      firstSeen: 'Jul 28, 14:02',
      lastSeenDetail: 'Yesterday, 16:41',
      confidence: 'High',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(secondary, ['g4', 'g5', 'g6']),
    },
    {
      id: `${prefix}-gap-3`,
      title: `Lookups on ${primary} skip knowledge`,
      description: `Agents always query ${primary} directly; a small glossary would answer from knowledge.`,
      casesCount: 29,
      lastSeen: 'today',
      proposedFix: `Extract a glossary from ${primary}.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: false,
      findingDetail: `Lookups always queried ${primary}.`,
      firstSeen: 'Jul 29, 10:18',
      lastSeenDetail: 'Today, 11:07',
      confidence: 'Medium',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(primary, ['g7', 'g8', 'g9']),
    },
    {
      id: `${prefix}-gap-4`,
      title: `Freshness gaps on ${secondary}`,
      description: `Stale answers when ${secondary} changes faster than the automation refresh.`,
      casesCount: 9,
      lastSeen: '2 days ago',
      proposedFix: `Increase refresh cadence on the ${secondary} automation.`,
      tweakPlaceholder: 'Adjust the fix, e.g. hourly...',
      createsAutomation: false,
      findingDetail: `Stale retrievals against ${secondary}.`,
      firstSeen: 'Jul 30, 08:11',
      lastSeenDetail: '2 days ago, 18:02',
      confidence: 'Medium',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(secondary, ['g10', 'g11', 'g12']),
    },
    {
      id: `${prefix}-gap-5`,
      title: `Entity resolution misses on ${primary}`,
      description: `Near-twin entity names in ${primary} cause repeated raw scans.`,
      casesCount: 14,
      lastSeen: 'today',
      proposedFix: `Extract disambiguator facts from ${primary}.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: true,
      findingDetail: `Entity resolution scanned ${primary}.`,
      firstSeen: 'Jul 27, 22:40',
      lastSeenDetail: 'Today, 07:15',
      confidence: 'High',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(primary, ['g13', 'g14', 'g15']),
    },
    {
      id: `${prefix}-gap-6`,
      title: `Policy questions fall back to ${secondary}`,
      description: `Policy questions open ${secondary} instead of a Policy KI.`,
      casesCount: 7,
      lastSeen: 'yesterday',
      proposedFix: `Distil policy KIs from ${secondary}.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: true,
      findingDetail: `Policy questions opened ${secondary}.`,
      firstSeen: 'Jul 26, 12:03',
      lastSeenDetail: 'Yesterday, 19:22',
      confidence: 'Medium',
      traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['g16', 'g17', 'g18']),
      },
    ];
  if (namespace.managed || namespace.name === 'Elastic') {
    return genericImprovements.slice(0, 4);
  }
  if (/sales-outreach/i.test(namespace.name)) {
    return genericImprovements.slice(0, 3);
  }
  return genericImprovements;
};

const HOW_IT_WORKS_STORAGE_KEY = 'context.index.howItWorks.dismissed';

const looksLikeRelativeTime = (value: string) =>
  /just now|yesterday|today|\bago\b|\bmin(?:ute)?s?\b|\bhours?\b|\bdays?\b|\bweeks?\b|\bmonths?\b|\byears?\b/i.test(
    value
  );

const lastSeenRank = (value: string) => {
  if (/just now|today/i.test(value)) return 0;
  if (/yesterday/i.test(value)) return 1;
  const days = value.match(/(\d+)\s+days?\s+ago/i);
  if (days) return Number(days[1]);
  return 10;
};

const formatAppliedAgo = (appliedAt: number) => {
  const seconds = Math.max(0, Math.round((Date.now() - appliedAt) / 1000));
  if (seconds < 8) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes === 1) return 'a minute ago';
  return `${minutes} minutes ago`;
};

const LANDING_HERO_HINT_STORAGE_KEY = 'context.landingHero.hint.dismissed';
const SETUP_READY_STORAGE_PREFIX = 'context.index.setupReady.';

interface StoredSetupReadyBanner {
  kiCount: number;
  dismissed: boolean;
  managed: boolean;
}

const readStoredSetupReadyBanner = (namespaceName: string): StoredSetupReadyBanner | null => {
  try {
    const raw = window.localStorage.getItem(`${SETUP_READY_STORAGE_PREFIX}${namespaceName}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSetupReadyBanner;
    if (typeof parsed?.kiCount !== 'number' || typeof parsed?.dismissed !== 'boolean') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeStoredSetupReadyBanner = (
  namespaceName: string,
  value: StoredSetupReadyBanner
) => {
  try {
    window.localStorage.setItem(
      `${SETUP_READY_STORAGE_PREFIX}${namespaceName}`,
      JSON.stringify(value)
    );
  } catch {
    // Ignore storage failures in proto/demo.
  }
};

const RELATIONSHIP_SKIP_TAGS = new Set([
  'new',
  'Bottom-Up',
  'Index Metadata',
  'UPDATE',
  'Streams',
  'Eager-load',
  'Cron + webhook',
  'Consolidation',
  'Dedupe',
  'Gaps',
  'Monitoring',
  'system',
  'macros',
  'entities',
  'inventory',
]);

const automationSourceNames = (automation: Automation, namespace: Namespace) => {
  const fromTags = automation.tags.filter(
    (tag) => !RELATIONSHIP_SKIP_TAGS.has(tag) && !RELATIONSHIP_SKIP_TAGS.has(tag.toLowerCase())
  );
  const known = new Set(namespace.sourceDetails.map((source) => source.name));
  const matched = fromTags.filter((tag) => known.has(tag));
  if (matched.length > 0) return matched;
  return fromTags.length > 0 ? fromTags : namespace.sourceDetails.map((source) => source.name);
};

const indicatorSourceNames = (indicator: KnowledgeIndicator, namespace: Namespace) => {
  const known = namespace.sourceDetails.map((source) => source.name);
  if (indicator.category === 'All streams' || indicator.category === 'All sources') {
    return known;
  }
  const fromTags = indicator.tags.filter((tag) => known.includes(tag));
  if (known.includes(indicator.category)) {
    return [indicator.category, ...fromTags.filter((tag) => tag !== indicator.category)];
  }
  if (fromTags.length > 0) return fromTags;
  return indicator.category ? [indicator.category] : [];
};

const indicatorMatchesAutomation = (
  indicator: KnowledgeIndicator,
  automation: Automation
) => {
  if (indicator.extractedBy && indicator.extractedBy === automation.title) return true;
  const sourceTags = automation.tags.filter((tag) => !RELATIONSHIP_SKIP_TAGS.has(tag));
  return sourceTags.some(
    (tag) =>
      indicator.category === tag ||
      indicator.tags.includes(tag) ||
      Boolean(indicator.extractedBy && indicator.extractedBy.includes(tag))
  );
};

const indicatorsForAutomation = (
  automation: Automation,
  indicators: KnowledgeIndicator[]
) => indicators.filter((indicator) => indicatorMatchesAutomation(indicator, automation));

const automationTitleForIndicator = (
  indicator: KnowledgeIndicator,
  automations: Automation[]
) => {
  const exact = automations.find((automation) => automation.title === indicator.extractedBy);
  if (exact) return exact.title;
  const fuzzy = automations.find((automation) =>
    indicatorMatchesAutomation(indicator, automation)
  );
  return fuzzy?.title || indicator.extractedBy || 'Extraction automation';
};

function ContextEngineApp({
  coreStart,
  plugins,
  history,
}: {
  coreStart: CoreStart;
  plugins: AppPluginStartDependencies;
  history: AppMountParameters['history'];
}) {
  const openIndexFromUrl =
    readOpenIndexDeepLink(history.location.search) ??
    readOpenIndexDeepLink(window.location.search);
  const openManagedElastic =
    openIndexFromUrl?.toLowerCase() === 'elastic' ||
    openIndexFromUrl === managedElasticNamespace.name;

  const [screen, setScreen] = useState<Screen>(() =>
    openManagedElastic ? 'namespace' : 'index'
  );
  const [activeCategory, setActiveCategory] = useState<SourceCategory>('connectors');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [namespaceName, setNamespaceName] = useState('');
  const [storageType, setStorageType] = useState<StorageType>('index');
  /** False until the user picks a data-nature radio inside Advanced. */
  const [dataNatureTouched, setDataNatureTouched] = useState(false);
  /** Sources step Advanced accordion (time-based / storage). */
  const [sourcesAdvancedOpen, setSourcesAdvancedOpen] = useState(false);
  const [createPanel, setCreatePanel] = useState<CreatePanel>('index');
  /** Legacy mode for feature-flagged upload path only. */
  const [intentMode, setIntentMode] = useState<IntentMode | null>(null);
  const [intentDescription, setIntentDescription] = useState('');
  const [intentUploadFileName, setIntentUploadFileName] = useState<string | null>(null);
  const [intentInferred, setIntentInferred] = useState('');
  const [intentUploadPickerKey, setIntentUploadPickerKey] = useState(0);
  const [intentSuggestPhase, setIntentSuggestPhase] = useState<'hidden' | 'thinking' | 'resolved'>(
    'hidden'
  );
  /** Demo: connectors tab starts empty until the user connects via the flyout. */
  const [connectedConnectorIds, setConnectedConnectorIds] = useState<string[]>(() =>
    MOCK_START_WITH_EMPTY_CONNECTORS ? [] : availableSources.filter((s) => s.category === 'connectors').map((s) => s.id)
  );
  /** Demo: ES|QL tab empty until mock ingest unlocks views. */
  const [esqlDataReady, setEsqlDataReady] = useState(!MOCK_START_WITH_EMPTY_ESQL);
  /** Skip the empty-state gate; show the ES|QL editor on the tab. Keep false to restore the gate. */
  const [esqlEditorRevealed, setEsqlEditorRevealed] = useState(true);
  const [esqlDraftQuery, setEsqlDraftQuery] = useState('FROM logs-*\n| LIMIT 10');
  const [esqlPreviousOpen, setEsqlPreviousOpen] = useState(false);
  /** Demo: agent traces tab empty when this mock flag is on. */
  const [agentTracesAvailable] = useState(!MOCK_START_WITH_EMPTY_AGENT_TRACES);
  const [showConnectorFlyout, setShowConnectorFlyout] = useState(false);
  const [pulsingSourceId, setPulsingSourceId] = useState<string | null>(null);
  const [reviewTryQuestion, setReviewTryQuestion] = useState('');
  const [reviewTryResult, setReviewTryResult] = useState<ReviewTryResult | null>(null);
  /** Mock Context Engine master toggle on Agent Builder overview. */
  const [agentBuilderContextOn, setAgentBuilderContextOn] = useState(true);
  /** Fresh-user catalog: managed Elastic only until the first create. */
  const [hasCreatedIndex, setHasCreatedIndex] = useState(() => openManagedElastic);
  const [namespaces, setNamespaces] = useState<Namespace[]>(() => [
    {
      ...managedElasticNamespace,
      lifecycleStatus: CONTEXT_ON_BY_DEFAULT ? 'ready' : 'needsSetup',
    },
  ]);
  const [activeNamespace, setActiveNamespace] = useState<Namespace | null>(() =>
    openManagedElastic
      ? {
          ...managedElasticNamespace,
          lifecycleStatus: CONTEXT_ON_BY_DEFAULT ? 'ready' : 'needsSetup',
        }
      : null
  );
  const [activeIssue, setActiveIssue] = useState<MonitoringIssue | null>(null);
  const [activeIndicatorId, setActiveIndicatorId] = useState<string | null>(null);
  const [selectedKiVersion, setSelectedKiVersion] = useState<number | null>(null);
  const [addedAutomations, setAddedAutomations] = useState<string[]>([]);
  const [workflowYaml, setWorkflowYaml] = useState(() => buildWorkflowYaml('Root logs Stream'));
  const [workflowSourceName, setWorkflowSourceName] = useState('Root logs Stream');
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [workflowDirty, setWorkflowDirty] = useState(false);
  /** When set, workflow Back uses this label and returns to namespace setup/proposals. */
  const [workflowBackLabel, setWorkflowBackLabel] = useState<string | null>(null);
  /** Originating AI index for the workflow editor; back must return here, not landing. */
  const [workflowOriginName, setWorkflowOriginName] = useState<string | null>(null);
  const [workflowOriginTab, setWorkflowOriginTab] = useState<NamespaceDetailTab | null>(null);
  const [workflowNotice, setWorkflowNotice] = useState<{
    type: 'success' | 'warning' | 'danger';
    text: string;
  } | null>(null);
  const [showTestRunModal, setShowTestRunModal] = useState(false);
  const [workflowEditorHeight, setWorkflowEditorHeight] = useState(640);
  const workflowEditorRef = useRef<HTMLDivElement | null>(null);
  const strategyRegenNoticeRef = useRef<string | null>(null);
  const [agentHarness, setAgentHarness] = useState<AgentHarness>('claudeCode');
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [agentNotice, setAgentNotice] = useState<{
    type: 'success' | 'warning' | 'danger';
    text: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  /**
   * Mock store shared with Agent Builder > Context: which indices are enabled
   * for Elastic AI Agent. Managed indices are always treated as connected.
   */
  const [agentBuilderEnabledByIndex, setAgentBuilderEnabledByIndex] = useState<
    Record<string, boolean>
  >({});
  const isIndexConnectedInAgentBuilder = (namespace: Namespace) =>
    Boolean(namespace.managed) || Boolean(agentBuilderEnabledByIndex[namespace.name]);
  const [highlightedAgentBuilderRow, setHighlightedAgentBuilderRow] = useState<string | null>(
    null
  );
  const [agentBuilderManageNotice, setAgentBuilderManageNotice] = useState<{
    type: 'success' | 'warning' | 'danger';
    text: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  /**
   * Mock admin flag for guided setup Variant A.
   * Toggled via Demo controls inside the account/admin menu.
   */
  const [isAdmin, setIsAdmin] = useState(currentUser$.value.isAdmin);
  const [hasInference, setHasInference] = useState(demoFlags$.value.hasInference);
  const [setupPhaseByIndex, setSetupPhaseByIndex] = useState<Record<string, SetupPhase>>({});
  const [managedSetupToggles, setManagedSetupToggles] = useState<Record<string, boolean>>({
    dashboards: false,
    visualisations: false,
    alerts: false,
    slos: false,
  });
  const [setupSuccessKiCount, setSetupSuccessKiCount] = useState(0);
  const [activeSetupRun, setActiveSetupRun] = useState<FirstRunScale | null>(null);
  const [strategiesByIndex, setStrategiesByIndex] = useState<Record<string, ExtractionStrategy[]>>(
    {}
  );
  const [selectedStrategyIdsByIndex, setSelectedStrategyIdsByIndex] = useState<
    Record<string, string[]>
  >({});
  const [setupErrorKind, setSetupErrorKind] = useState<
    'generating' | 'full' | 'test' | null
  >(null);
  /** Elapsed seconds while generating an automation (indeterminate wait). */
  const [generateElapsedSeconds, setGenerateElapsedSeconds] = useState(0);
  const [generateWaitPhase, setGenerateWaitPhase] = useState<GenerateWaitPhase>('generate');
  const [strategyInstructionOpenId, setStrategyInstructionOpenId] = useState<string | null>(
    null
  );
  const [reviewSampleOverride, setReviewSampleOverride] = useState<SetupSampleKi[] | null>(null);
  const [proposalConfirmations, setProposalConfirmations] = useState<Record<string, string>>({});
  const [proposalEditorOpenId, setProposalEditorOpenId] = useState<string | null>(null);
  /** Automations tab: Add automation dropdown + create-workflow pre-step. */
  const [addAutomationMenuOpen, setAddAutomationMenuOpen] = useState(false);
  const [createWorkflowModalOpen, setCreateWorkflowModalOpen] = useState(false);
  const [createWorkflowName, setCreateWorkflowName] = useState('');
  const [createWorkflowSourceIds, setCreateWorkflowSourceIds] = useState<string[]>([]);
  const [workflowDraftPending, setWorkflowDraftPending] = useState<{
    name: string;
    sourceNames: string[];
  } | null>(null);
  /** One open tweak editor at a time on the Automations tab. */
  const [automationTweakSuccess, setAutomationTweakSuccess] = useState<Record<string, string>>(
    {}
  );
  const [automationMenuOpenId, setAutomationMenuOpenId] = useState<string | null>(null);
  const [disabledAutomationIds, setDisabledAutomationIds] = useState<Record<string, boolean>>(
    {}
  );
  /** Dismissible strip after a run completes (lands on Ready overview; no intermediate page). */
  const [setupReadyBanner, setSetupReadyBanner] = useState<{
    namespaceName: string;
    kiCount: number;
    managed: boolean;
  } | null>(null);
  /** In-tab KI type filter (Knowledge Indicators tab); separate from the browser screen filter. */
  const [kiTabTypeFilter, setKiTabTypeFilter] = useState<KnowledgeIndicator['type'] | null>(null);
  const setupTimerRef = useRef<number | null>(null);
  const automationTweakSuccessTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    const userSub = currentUser$.subscribe((user) => setIsAdmin(user.isAdmin));
    const flagsSub = demoFlags$.subscribe((flags) => {
      setHasInference(flags.hasInference);
    });
    return () => {
      userSub.unsubscribe();
      flagsSub.unsubscribe();
    };
  }, []);

  const [isDefiningDescription, setIsDefiningDescription] = useState(false);
  const [namespaceQuery, setNamespaceQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [contextAreaTab, setContextAreaTab] = useState<'indices' | 'monitoring'>('indices');
  const [focusMonitoring, setFocusMonitoring] = useState(false);
  const [namespaceDetailTab, setNamespaceDetailTab] =
    useState<NamespaceDetailTab>('overview');
  const [improvementStatusById, setImprovementStatusById] = useState<
    Record<string, ImprovementStatus>
  >({});
  const [improvementFixById, setImprovementFixById] = useState<Record<string, string>>({});
  const [improvementPendingById, setImprovementPendingById] = useState<
    Record<string, 'applied' | 'dismissed'>
  >({});
  const [improvementDepartingIds, setImprovementDepartingIds] = useState<string[]>([]);
  const [improvementAppliedAtById, setImprovementAppliedAtById] = useState<Record<string, number>>(
    {}
  );
  const [improvementDismissedAtById, setImprovementDismissedAtById] = useState<
    Record<string, number>
  >({});
  const [improvementOutcomeById, setImprovementOutcomeById] = useState<
    Record<string, AppliedOutcome>
  >({});
  const [appliedGroupOpen, setAppliedGroupOpen] = useState(false);
  const [dismissedGroupOpen, setDismissedGroupOpen] = useState(false);
  const [improvementsAnalysedByIndex, setImprovementsAnalysedByIndex] = useState<
    Record<string, boolean>
  >({});
  const [analysingIndexName, setAnalysingIndexName] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<
    | { mode: 'all' }
    | { mode: 'type'; type: SignalInternalType }
    | { mode: 'ids'; ids: string[] }
  >({ mode: 'all' });
  const [highlightedSignalIds, setHighlightedSignalIds] = useState<string[]>([]);
  const [highlightedImprovementId, setHighlightedImprovementId] = useState<string | null>(null);
  const [selectedSignalTraceId, setSelectedSignalTraceId] = useState<string | null>(null);
  const [reviewAllOpen, setReviewAllOpen] = useState(false);
  const [reviewSelectedIds, setReviewSelectedIds] = useState<string[]>([]);
  const [configureFlyoutOpen, setConfigureFlyoutOpen] = useState(false);
  const [improvementSchedule, setImprovementSchedule] = useState<'daily' | 'weekly' | 'manual'>(
    'daily'
  );
  const [signalWindow, setSignalWindow] = useState<'7d' | '30d' | 'lastN'>('7d');
  const [signalWindowN, setSignalWindowN] = useState('50');
  const [agentMayChange, setAgentMayChange] = useState<AgentChangePermissions>(
    DEFAULT_AGENT_CHANGE_PERMISSIONS
  );
  const [runNowNotice, setRunNowNotice] = useState<string | null>(null);
  const [agentSidebarSeed, setAgentSidebarSeed] = useState<ContextAgentSeed | null>(null);
  /** KI detail flyout on the Knowledge Indicators tab (replaces the old browser page). */
  const [kiFlyoutIndicatorId, setKiFlyoutIndicatorId] = useState<string | null>(null);
  const [evidenceImprovementId, setEvidenceImprovementId] = useState<string | null>(null);
  const [kiTypeFilter, setKiTypeFilter] = useState<KnowledgeIndicator['type'] | null>(null);
  const [kiSearchQuery, setKiSearchQuery] = useState('');
  const [kiSourceFilter, setKiSourceFilter] = useState('all');
  const [kiVersionFilter, setKiVersionFilter] = useState<KiVersionFilter>('all');
  const [kiAutomationFilter, setKiAutomationFilter] = useState<string | null>(null);
  const [howItWorksDismissed, setHowItWorksDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(HOW_IT_WORKS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [howItWorksVisible, setHowItWorksVisible] = useState(() => {
    try {
      return window.localStorage.getItem(HOW_IT_WORKS_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [landingHeroHintDismissed, setLandingHeroHintDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(LANDING_HERO_HINT_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const dismissHowItWorks = () => {
    try {
      window.localStorage.setItem(HOW_IT_WORKS_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failures in proto/demo.
    }
    setHowItWorksDismissed(true);
    setHowItWorksVisible(false);
  };

  const dismissLandingHeroHint = () => {
    try {
      window.localStorage.setItem(LANDING_HERO_HINT_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failures in proto/demo.
    }
    setLandingHeroHintDismissed(true);
  };

  // Local tab state only: writing ?tab= into the URL makes Kibana's app router
  // treat it as a navigation and show "Unable to load page".
  const selectNamespaceDetailTab = (tab: NamespaceDetailTab) => {
    if (tab !== 'knowledge') {
      setKiTabTypeFilter(null);
    }
    setNamespaceDetailTab(tab);
  };

  useEffect(() => {
    if (screen !== 'namespace' || !activeNamespace) return undefined;
    if (activeNamespace.managed) return undefined;
    if (activeNamespace.lifecycleStatus === 'ready') return undefined;
    const phase = setupPhaseByIndex[activeNamespace.name] ?? 'configure';
    const inSetupLifecycle =
      activeNamespace.lifecycleStatus === 'needsSetup' ||
      activeNamespace.lifecycleStatus === 'settingUp';
    if (!inSetupLifecycle && phase !== 'suggesting') {
      return undefined;
    }
    if (phase === 'configure' && hasInference) {
      setSetupPhaseByIndex((current) => ({ ...current, [activeNamespace.name]: 'suggesting' }));
      return undefined;
    }
    if (phase !== 'suggesting') return undefined;
    if ((strategiesByIndex[activeNamespace.name] ?? []).length > 0) return undefined;
    const ns = activeNamespace;
    const timer = window.setTimeout(() => {
      const strategies = buildMockStrategies(ns);
      setStrategiesByIndex((current) => ({ ...current, [ns.name]: strategies }));
      setSelectedStrategyIdsByIndex((current) => ({
        ...current,
        [ns.name]: strategies[0] ? [strategies[0].id] : [],
      }));
      setSetupPhaseByIndex((current) => ({ ...current, [ns.name]: 'selectStrategies' }));
      if (strategyRegenNoticeRef.current === ns.name) {
        coreStart.notifications.toasts.addSuccess(
          'Strategies updated from your latest sources and intent.'
        );
        strategyRegenNoticeRef.current = null;
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [screen, activeNamespace?.name, hasInference, setupPhaseByIndex, strategiesByIndex]);

  useEffect(() => {
    if (!activeNamespace) return undefined;
    const phase = setupPhaseByIndex[activeNamespace.name];
    if (phase !== 'generating' && phase !== 'running') return undefined;
    setGenerateElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setGenerateElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeNamespace, setupPhaseByIndex]);

  useEffect(() => {
    if (!activeNamespace || activeNamespace.lifecycleStatus !== 'ready') return;
    const stored = readStoredSetupReadyBanner(activeNamespace.name);
    if (stored && !stored.dismissed) {
      setSetupReadyBanner({
        namespaceName: activeNamespace.name,
        kiCount: stored.kiCount,
        managed: stored.managed,
      });
    }
  }, [activeNamespace?.name, activeNamespace?.lifecycleStatus]);

  useEffect(() => {
    if (screen !== 'workflow') return undefined;
    const node = workflowEditorRef.current;
    const scrollParent = document.getElementById('app-main-scroll');

    if (scrollParent) {
      scrollParent.scrollTop = 0;
    }

    const updateHeight = () => {
      const footer = document.querySelector(
        '.contextEnginePrototype__workflowFooter'
      ) as HTMLElement | null;
      const bottomGap = (footer?.offsetHeight ?? 40) + 4;

      if (!node) {
        setWorkflowEditorHeight(Math.max(280, window.innerHeight - 220));
        return;
      }

      if (scrollParent) {
        const nodeTop = node.getBoundingClientRect().top;
        const scrollTop = scrollParent.getBoundingClientRect().top;
        const offsetInScroll = nodeTop - scrollTop + scrollParent.scrollTop;
        setWorkflowEditorHeight(
          Math.max(280, Math.floor(scrollParent.clientHeight - offsetInScroll - bottomGap))
        );
        return;
      }

      const top = node.getBoundingClientRect().top;
      setWorkflowEditorHeight(Math.max(280, Math.floor(window.innerHeight - top - bottomGap)));
    };

    updateHeight();
    const frame = window.requestAnimationFrame(() => {
      updateHeight();
      window.requestAnimationFrame(updateHeight);
    });
    window.addEventListener('resize', updateHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateHeight);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'namespace' || !focusMonitoring) return;
    selectNamespaceDetailTab('overview');
    setFocusMonitoring(false);
    window.requestAnimationFrame(() => {
      document
        .getElementById('context-engine-8-overview-monitoring')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [screen, focusMonitoring, activeNamespace?.name]);

  useEffect(() => {
    if (screen !== 'agentBuilderManage' || !highlightedAgentBuilderRow) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById('context-engine-8-agent-builder-highlight')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [screen, highlightedAgentBuilderRow]);

  const selectedSources = useMemo(
    () => availableSources.filter(({ id }) => selectedSourceIds.includes(id)),
    [selectedSourceIds]
  );
  const namespaceSlug = slugify(namespaceName) || 'index';
  const namespaceNameError = validateNamespaceName(namespaceName);
  const nameComplete = Boolean(namespaceName) && !namespaceNameError;
  /**
   * Single intent signal from the Name step (description or upload inference).
   * Agent traces are Sources, not part of intent.
   */
  const intentSignal = useMemo(() => {
    if (INTENT_UPLOAD_ARTIFACTS_ENABLED && intentMode === 'upload') {
      return intentInferred.trim();
    }
    return intentDescription.trim();
  }, [intentMode, intentDescription, intentInferred]);

  const intentComplete = (() => {
    if (INTENT_UPLOAD_ARTIFACTS_ENABLED && intentMode === 'upload') {
      return Boolean(intentUploadFileName) && Boolean(intentInferred.trim());
    }
    return Boolean(intentDescription.trim());
  })();
  const sourcesComplete = selectedSourceIds.length > 0;

  const intentSourceMatches = useMemo(
    () => matchIntentToSources(intentSignal),
    [intentSignal]
  );
  const intentMatchById = useMemo(() => {
    const map = new Map<string, IntentSourceMatch>();
    intentSourceMatches.forEach((match) => map.set(match.sourceId, match));
    return map;
  }, [intentSourceMatches]);

  /** Connectors / ES|QL / agent-traces lists respect demo empty states, then intent-suggest sort. */
  const visibleSources = useMemo(() => {
    let filtered = availableSources.filter(({ category }) => category === activeCategory);
    if (activeCategory === 'esql' && !esqlDataReady) {
      filtered = [];
    }
    if (activeCategory === 'traces' && !agentTracesAvailable) {
      filtered = [];
    }
    if (
      !M3_INTENT_SOURCE_SUGGESTIONS_ENABLED ||
      activeCategory !== 'connectors' ||
      intentSuggestPhase !== 'resolved'
    ) {
      return filtered;
    }
    const strengthById = new Map(
      intentSourceMatches.map((match, index) => [
        match.sourceId,
        { strength: match.strength, index },
      ])
    );
    return [...filtered].sort((a, b) => {
      const aMatch = strengthById.get(a.id);
      const bMatch = strengthById.get(b.id);
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      if (aMatch && bMatch) {
        if (bMatch.strength !== aMatch.strength) return bMatch.strength - aMatch.strength;
        return aMatch.index - bMatch.index;
      }
      return 0;
    });
  }, [
    activeCategory,
    intentSuggestPhase,
    intentSourceMatches,
    esqlDataReady,
    agentTracesAvailable,
  ]);

  const connectorCatalog = useMemo(
    () => availableSources.filter((source) => source.category === 'connectors'),
    []
  );
  const orderedConnectorCatalog = useMemo(() => {
    const selected = connectorCatalog.filter((source) => selectedSourceIds.includes(source.id));
    const rest = connectorCatalog.filter((source) => !selectedSourceIds.includes(source.id));
    return [...selected, ...rest];
  }, [connectorCatalog, selectedSourceIds]);

  /** Smart preselect for time-based question from current source mix (Advanced only). */
  const dataNatureSuggestion = useMemo((): 'index' | 'dataStream' | 'mixed' | null => {
    if (selectedSources.length === 0) return null;
    const allReference = selectedSources.every(
      (source) => source.category === 'connectors' && REFERENCE_CONNECTOR_IDS.has(source.id)
    );
    const allEsql = selectedSources.every((source) => source.category === 'esql');
    if (allReference) return 'index';
    if (allEsql) return 'dataStream';
    return 'mixed';
  }, [selectedSources]);

  useEffect(() => {
    if (!sourcesAdvancedOpen || dataNatureTouched) return;
    if (dataNatureSuggestion === 'index' || dataNatureSuggestion === 'dataStream') {
      setStorageType(dataNatureSuggestion);
    }
  }, [sourcesAdvancedOpen, dataNatureTouched, dataNatureSuggestion]);

  useEffect(() => {
    if (M3_AGENT_TRACES_ENABLED) return;
    setActiveCategory((current) => (current === 'traces' ? 'connectors' : current));
    setSelectedSourceIds((ids) =>
      ids.filter(
        (id) => availableSources.find((source) => source.id === id)?.category !== 'traces'
      )
    );
  }, []);

  useEffect(() => {
    if (screen !== 'create' || createPanel !== 'sources') {
      return;
    }
    if (!M3_INTENT_SOURCE_SUGGESTIONS_ENABLED || !intentSignal) {
      setIntentSuggestPhase('hidden');
      return;
    }
    setIntentSuggestPhase('thinking');
    const timer = window.setTimeout(() => {
      setIntentSuggestPhase('resolved');
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [screen, createPanel, intentSignal]);

  useEffect(() => {
    return () => {
      Object.values(automationTweakSuccessTimers.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
      automationTweakSuccessTimers.current = {};
    };
  }, []);

  const focusSuggestedSource = (sourceId: string) => {
    setActiveCategory('connectors');
    window.setTimeout(() => {
      document
        .getElementById(`context-engine-8-source-${sourceId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPulsingSourceId(sourceId);
      window.setTimeout(() => {
        setPulsingSourceId((current) => (current === sourceId ? null : current));
      }, 1100);
    }, 60);
  };
  const catalogDisplayName = (namespace: Namespace) =>
    namespace.managed ? MANAGED_ELASTIC_DISPLAY_NAME : namespace.name;

  const filteredNamespaces = useMemo(() => {
    const query = namespaceQuery.trim().toLowerCase();
    const catalogHealthFilter =
      !AGENT_MONITORING_ENABLED && healthFilter === 'issues' ? 'all' : healthFilter;
    return namespaces.filter((namespace) => {
      const lifecycle = surfaceCatalogLifecycle(namespace);
      if (catalogHealthFilter === 'needsSetup' && lifecycle.kind !== 'needsSetup') return false;
      if (catalogHealthFilter === 'healthy' && lifecycle.kind !== 'ready') return false;
      if (catalogHealthFilter === 'issues' && lifecycle.kind !== 'issues') return false;
      if (!query) return true;
      const haystack = [
        namespace.name,
        catalogDisplayName(namespace),
        namespace.integration,
        namespace.description,
        namespace.indexName,
        ...namespace.sources,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [namespaces, namespaceQuery, healthFilter]);

  const goToContextArea = (tab: 'indices' | 'monitoring') => {
    setContextAreaTab(AGENT_MONITORING_ENABLED ? tab : 'indices');
    setScreen('index');
    setActiveNamespace(null);
    setActiveIssue(null);
    setActiveIndicatorId(null);
    setSelectedKiVersion(null);
    setAddedAutomations([]);
    setKiTabTypeFilter(null);
    setKiAutomationFilter(null);
    selectNamespaceDetailTab('overview');
  };

  const goToIndex = () => goToContextArea('indices');

  const startWizard = () => {
    setContextAreaTab('indices');
    setSelectedSourceIds([]);
    setNamespaceName('');
    setStorageType('index');
    setDataNatureTouched(false);
    setSourcesAdvancedOpen(false);
    setActiveCategory('connectors');
    setCreatePanel('index');
    setIntentMode(null);
    setIntentDescription('');
    setIntentUploadFileName(null);
    setIntentInferred('');
    setIntentUploadPickerKey((key) => key + 1);
    setConnectedConnectorIds(
      MOCK_START_WITH_EMPTY_CONNECTORS
        ? []
        : availableSources.filter((s) => s.category === 'connectors').map((s) => s.id)
    );
    setEsqlDataReady(!MOCK_START_WITH_EMPTY_ESQL);
    setEsqlEditorRevealed(true);
    setEsqlDraftQuery('FROM logs-*\n| LIMIT 10');
    setEsqlPreviousOpen(false);
    setShowConnectorFlyout(false);
    setScreen('create');
  };

  const editSourcesFromNamespace = () => {
    if (!activeNamespace) return;
    const matchedIds = availableSources
      .filter((source) =>
        activeNamespace.sourceDetails.some((detail) => detail.name === source.name)
      )
      .map((source) => source.id);
    setSelectedSourceIds(matchedIds);
    setNamespaceName(activeNamespace.name);
    setStorageType(activeNamespace.storageType);
    setDataNatureTouched(true);
    setActiveCategory('connectors');
    setCreatePanel('sources');
    const savedIntent = activeNamespace.intent;
    setIntentMode(
      savedIntent?.type === 'upload' && INTENT_UPLOAD_ARTIFACTS_ENABLED
        ? 'upload'
        : savedIntent?.type === 'describe' || savedIntent?.type === 'traces'
          ? 'describe'
          : null
    );
    const savedValue = savedIntent?.value ?? '';
    const descriptionOnly = savedValue
      .replace(/\s*Questions from [^:]+: \d+ questions, last active [^.]+\.\s*/g, ' ')
      .trim();
    setIntentDescription(
      savedIntent?.type === 'upload' ? '' : descriptionOnly || savedValue
    );
    if (INTENT_UPLOAD_ARTIFACTS_ENABLED && savedIntent?.type === 'upload') {
      setIntentUploadFileName('uploaded-artifact.md');
      setIntentInferred(savedValue);
    } else {
      setIntentUploadFileName(null);
      setIntentInferred('');
    }
    setConnectedConnectorIds((current) => {
      const fromNamespace = availableSources
        .filter(
          (source) =>
            source.category === 'connectors' &&
            activeNamespace.sourceDetails.some((detail) => detail.name === source.name)
        )
        .map((source) => source.id);
      return Array.from(new Set([...current, ...fromNamespace]));
    });
    if (
      activeNamespace.sourceDetails.some((detail) =>
        availableSources.some((s) => s.category === 'esql' && s.name === detail.name)
      )
    ) {
      setEsqlDataReady(true);
    }
    setScreen('create');
  };

  const selectDataNature = (next: StorageType) => {
    setDataNatureTouched(true);
    setStorageType(next);
  };

  const toggleSource = (id: string) => {
    const source = availableSources.find((item) => item.id === id);
    setSelectedSourceIds((current) =>
      current.includes(id) ? current.filter((sourceId) => sourceId !== id) : [...current, id]
    );
    if (source?.category === 'connectors' && !selectedSourceIds.includes(id)) {
      setConnectedConnectorIds((current) =>
        current.includes(id) ? current : [...current, id]
      );
    }
  };

  const createNamespace = () => {
    const normalizedName = slugify(namespaceName);
    if (
      validateNamespaceName(normalizedName) ||
      !intentComplete ||
      selectedSources.length === 0
    ) {
      return;
    }

    // One intent signal; type records the primary path used.
    const intentType: IntentMode =
      INTENT_UPLOAD_ARTIFACTS_ENABLED && intentMode === 'upload' ? 'upload' : 'describe';
    const intent = {
      type: intentType,
      value: intentSignal,
    };

    const sourceDetails: NamespaceSource[] = selectedSources.map((source) => ({
      name: source.name,
      subtitle: source.description,
      typeLabel: source.typeLabel,
      icon: source.icon,
    }));
    const existing = namespaces.find((namespace) => namespace.name === normalizedName);
    const storagePrefix = storageType === 'dataStream' ? '.context-ds' : '.context-idx';
    const built = existing
      ? {
          ...existing,
          sources: selectedSources.map(({ name }) => name),
          sourceDetails,
          storageType,
          indexName: `${storagePrefix}-${normalizedName}`,
          intent,
        }
      : {
          ...buildNamespaceFromWizard(
            normalizedName,
            selectedSources.map(({ name }) => name),
            sourceDetails,
            storageType
          ),
          intent,
        };
    // Fresh create: Needs setup checklist; nothing runs until the user approves + runs.
    const namespace: Namespace = existing
      ? built
      : {
          ...built,
          lifecycleStatus: 'needsSetup',
          indicators: [],
          knowledge: {
            playbooks: 0,
            policies: 0,
            faqs: 0,
            glossaries: 0,
            facts: 0,
          },
        };

    setNamespaces((current) => {
      const managed =
        current.find((item) => item.managed) ?? { ...managedElasticNamespace };
      if (existing) {
        return current.map((item) => (item.name === normalizedName ? namespace : item));
      }
      // Proto/demo: first create reveals pre-existing env indices + the new card.
      if (!hasCreatedIndex) {
        return [managed, namespace, ...demoEnvironmentNamespaces];
      }
      return [...current, namespace];
    });
    setHasCreatedIndex(true);
    setSetupPhase(namespace.name, hasInference ? 'suggesting' : 'configure');
    setSetupSuccessKiCount(0);
    setActiveSetupRun(null);
    setSetupErrorKind(null);
    setGenerateElapsedSeconds(0);
    setStrategyInstructionOpenId(null);
    setStrategiesByIndex((current) => ({ ...current, [namespace.name]: [] }));
    setSelectedStrategyIdsByIndex((current) => ({ ...current, [namespace.name]: [] }));
    setAddedAutomations([]);
    setActiveIssue(null);
    setSetupReadyBanner(null);
    setKiTabTypeFilter(null);
    setReviewSampleOverride(null);
    openNamespace(namespace, { focusSetup: true });
    if (existing) {
      strategyRegenNoticeRef.current = namespace.name;
    } else {
      coreStart.notifications.toasts.addSuccess('AI index created');
    }
  };

  const openNamespace = (
    namespace: Namespace,
    options?: {
      focusMonitoring?: boolean;
      focusSetup?: boolean;
    }
  ) => {
    setActiveNamespace(namespace);
    setAddedAutomations([]);
    setActiveIssue(null);
    setActiveIndicatorId(null);
    setSelectedKiVersion(null);
    setKiTypeFilter(null);
    setIsDefiningDescription(false);
    setImprovementStatusById({});
    setImprovementFixById({});
    setImprovementPendingById({});
    setImprovementDepartingIds([]);
    setImprovementAppliedAtById({});
    setImprovementDismissedAtById({});
    setImprovementOutcomeById({});
    setAppliedGroupOpen(false);
    setDismissedGroupOpen(false);
    setEvidenceImprovementId(null);
    setSignalFilter({ mode: 'all' });
    setHighlightedSignalIds([]);
    setHighlightedImprovementId(null);
    setSelectedSignalTraceId(null);
    setKiAutomationFilter(null);
    setKiTabTypeFilter(null);
    setReviewTryQuestion('');
    setReviewTryResult(null);
    if (options?.focusSetup) {
      selectNamespaceDetailTab('overview');
      setFocusMonitoring(false);
    } else if (options?.focusMonitoring) {
      selectNamespaceDetailTab('overview');
      setFocusMonitoring(true);
    } else {
      selectNamespaceDetailTab('overview');
      setFocusMonitoring(false);
    }
    setScreen('namespace');
  };

  /** Open Agent Builder new chat with the Elastic AI Agent. */
  const openInChat = (_namespace?: Namespace) => {
    coreStart.application.navigateToApp('agent_builder', {
      path: `/agents/${ELASTIC_AI_AGENT_ID}/conversations/new`,
    });
  };

  const openAgentBuilderManage = (highlightAgentId = 'support-triage') => {
    setHighlightedAgentBuilderRow(highlightAgentId);
    setAgentBuilderManageNotice(null);
    setScreen('agentBuilderManage');
  };

  const openKnowledgeTabFilteredByAutomation = (automationTitle: string) => {
    setKiAutomationFilter(automationTitle);
    selectNamespaceDetailTab('knowledge');
  };

  const openKiDetailFlyout = (indicator: KnowledgeIndicator) => {
    setKiFlyoutIndicatorId(indicator.id);
    setActiveIndicatorId(indicator.id);
    setSelectedKiVersion(indicator.currentVersion);
  };

  const closeKiDetailFlyout = () => {
    setKiFlyoutIndicatorId(null);
  };

  const openAgentSidebar = (seed: ContextAgentSeed) => {
    setAgentSidebarSeed(seed);
    openContextAgentChat(plugins.agentBuilder, seed, () => setAgentSidebarSeed(null));
  };

  const updateNamespaceIndicator = (updatedIndicator: KnowledgeIndicator) => {
    if (!activeNamespace) return;
    const updated: Namespace = {
      ...activeNamespace,
      indicators: activeNamespace.indicators.map((item) =>
        item.id === updatedIndicator.id ? updatedIndicator : item
      ),
    };
    setActiveNamespace(updated);
    setNamespaces((current) =>
      current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
    );
  };

  const editKnowledgeIndicator = (indicator: KnowledgeIndicator) => {
    const nextVersion = indicator.currentVersion + 1;
    updateNamespaceIndicator({
      ...indicator,
      currentVersion: nextVersion,
      versions: [
        {
          version: nextVersion,
          summary: 'Manual edit',
          source: 'Edited in UI',
          when: 'just now',
        },
        ...indicator.versions,
      ],
    });
    setSelectedKiVersion(nextVersion);
  };

  const setKnowledgeIndicatorCurrentVersion = (indicator: KnowledgeIndicator, version: number) => {
    if (indicator.currentVersion === version) {
      setSelectedKiVersion(version);
      return;
    }
    updateNamespaceIndicator({
      ...indicator,
      currentVersion: version,
    });
    setSelectedKiVersion(version);
  };

  const resolveWorkflowSource = (automation?: Automation) => {
    const taggedSource = automation?.tags.find(
      (tag) => !['new', 'Bottom-Up', 'Index Metadata', 'UPDATE'].includes(tag)
    );
    if (taggedSource) return taggedSource;
    const fromTitle = automation?.title?.replace(
      /^Extract Knowledge Indicators from\s+/i,
      ''
    );
    if (fromTitle && fromTitle !== automation?.title) return fromTitle;
    return (
      activeNamespace?.sources[0] ||
      activeNamespace?.sourceDetails[0]?.name ||
      'Root logs Stream'
    );
  };

  const openWorkflow = (
    automation?: Automation | string,
    options?: {
      backLabel?: string;
      sourceNames?: string[];
      createDraft?: boolean;
    }
  ) => {
    const automationObj = typeof automation === 'string' ? undefined : automation;
    const automationTitle = typeof automation === 'string' ? automation : automation?.title;
    const sourceName =
      options?.sourceNames?.[0] || resolveWorkflowSource(automationObj);
    const yaml =
      options?.createDraft && options.sourceNames
        ? buildNewWorkflowYaml(automationTitle || 'New workflow', options.sourceNames)
        : buildWorkflowYaml(sourceName, automationTitle);
    setWorkflowSourceName(sourceName);
    setWorkflowYaml(yaml);
    setWorkflowEnabled(!/^enabled:\s*false\s*$/m.test(yaml));
    setWorkflowDirty(Boolean(options?.createDraft));
    setWorkflowNotice(null);
    setWorkflowBackLabel(options?.backLabel ?? null);
    setWorkflowOriginName(activeNamespace?.name ?? null);
    setWorkflowOriginTab(namespaceDetailTab);
    setWorkflowDraftPending(
      options?.createDraft
        ? {
            name: automationTitle || 'New workflow',
            sourceNames: options.sourceNames || [sourceName],
          }
        : null
    );
    setShowTestRunModal(false);
    setScreen('workflow');
  };

  const setWorkflowEnabledInYaml = (enabled: boolean) => {
    setWorkflowEnabled(enabled);
    setWorkflowDirty(true);
    setWorkflowYaml((current) =>
      /^enabled:\s*(true|false)\s*$/m.test(current)
        ? current.replace(/^enabled:\s*(true|false)\s*$/m, `enabled: ${enabled}`)
        : `enabled: ${enabled}\n${current}`
    );
  };

  const validateWorkflowYaml = (yaml: string): { ok: boolean; message: string } => {
    if (!yaml.trim()) {
      return { ok: false, message: 'Workflow YAML is empty.' };
    }
    const countChar = (char: string) => yaml.split(char).length - 1;
    if (countChar('{') !== countChar('}') || countChar('[') !== countChar(']')) {
      return { ok: false, message: 'Invalid YAML: unmatched brackets.' };
    }
    if (!/^version:\s*['"]?\d+/m.test(yaml)) {
      return { ok: false, message: 'Missing version field.' };
    }
    if (!/^name:\s*.+/m.test(yaml)) {
      return { ok: false, message: 'Missing workflow name.' };
    }
    if (!/^steps:\s*$/m.test(yaml)) {
      return { ok: false, message: 'Missing steps section.' };
    }
    if (!/type:\s*elasticsearch\.esql\.query/.test(yaml)) {
      return { ok: false, message: 'Expected a Query step (elasticsearch.esql.query).' };
    }
    if (!/type:\s*foreach/.test(yaml)) {
      return { ok: false, message: 'Expected a Foreach loop step.' };
    }
    if (!/type:\s*ai\.agent/.test(yaml)) {
      return { ok: false, message: 'Expected an AI agent step.' };
    }
    return { ok: true, message: 'Workflow is valid. Query, Foreach, and AI agent steps look good.' };
  };

  const connectTraces = () => {
    if (!activeNamespace) return;
    const isUserCreated = Boolean(activeNamespace.userCreated);
    const analysisReady =
      !isUserCreated ||
      MOCK_USER_CREATED_MONITORING_ANALYSIS_READY ||
      activeNamespace.monitoring.analysisReady === true;
    const traceId = `traces-apm.agent-${slugify(activeNamespace.name)}.default`;
    const traceCount = analysisReady ? 0 : 128;
    const updated: Namespace = {
      ...activeNamespace,
      monitoring: {
        ...activeNamespace.monitoring,
        connected: true,
        analysisReady,
        traceId,
        traceLabel: `${activeNamespace.name} · ${traceCount.toLocaleString()} traces`,
        traceCount,
        issuesSummary: analysisReady ? 'No failing traces yet' : undefined,
        issues: analysisReady ? activeNamespace.monitoring.issues : [],
        efficiency: analysisReady
          ? activeNamespace.monitoring.efficiency || {
              retrievalHitRate: 0,
              tokensSavedPct: 0,
              medianLatencyMs: 0,
            }
          : undefined,
      },
    };
    setActiveNamespace(updated);
    setNamespaces((current) =>
      current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
    );
  };

  const addSuggestedAutomation = (automation: Automation) => {
    if (!activeNamespace) return;
    if (activeNamespace.automations.some(({ id }) => id === automation.id)) return;
    setAddedAutomations((current) =>
      current.includes(automation.id) ? current : [...current, automation.id]
    );
    const updated: Namespace = {
      ...activeNamespace,
      automations: [...activeNamespace.automations, { ...automation, ownership: 'ADDED BY YOU' }],
      suggestedAutomations: activeNamespace.suggestedAutomations.filter(
        ({ id }) => id !== automation.id
      ),
    };
    setActiveNamespace(updated);
    setNamespaces((current) =>
      current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
    );
  };

  const addDraftAutomation = (automation: Automation) => {
    if (!activeNamespace) return;
    if (
      activeNamespace.automations.some(({ id }) => id === automation.id) ||
      activeNamespace.suggestedAutomations.some(({ id }) => id === automation.id)
    ) {
      return;
    }
    const updated: Namespace = {
      ...activeNamespace,
      suggestedAutomations: [...activeNamespace.suggestedAutomations, automation],
    };
    setActiveNamespace(updated);
    setNamespaces((current) =>
      current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
    );
  };

  const approveAllSuggestedAutomations = () => {
    if (!activeNamespace) return;
    const pending = activeNamespace.suggestedAutomations;
    if (pending.length === 0) return;
    setAddedAutomations((current) => [
      ...current,
      ...pending.map(({ id }) => id).filter((id) => !current.includes(id)),
    ]);
    const updated: Namespace = {
      ...activeNamespace,
      automations: [
        ...activeNamespace.automations,
        ...pending.map((automation) => ({ ...automation, ownership: 'ADDED BY YOU' as const })),
      ],
      suggestedAutomations: [],
    };
    setActiveNamespace(updated);
    setNamespaces((current) =>
      current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
    );
  };

  const patchNamespace = (name: string, patch: Partial<Namespace>) => {
    setNamespaces((current) =>
      current.map((item) => (item.name === name ? { ...item, ...patch } : item))
    );
    setActiveNamespace((current) =>
      current && current.name === name ? { ...current, ...patch } : current
    );
  };

  const setSetupPhase = (name: string, phase: SetupPhase) => {
    setSetupPhaseByIndex((current) => ({ ...current, [name]: phase }));
  };

  const clearSetupTimer = () => {
    if (setupTimerRef.current) {
      window.clearTimeout(setupTimerRef.current);
      setupTimerRef.current = null;
    }
  };

  const finalizeSetupReady = (namespace: Namespace, kiCount: number) => {
    clearSetupTimer();
    const knowledge = knowledgeFromKiCount(kiCount);
    const indicators = buildSetupIndicators(namespace, kiCount);
    setSetupSuccessKiCount(kiCount);
    setActiveSetupRun(null);
    setSetupPhase(namespace.name, 'success');
    patchNamespace(namespace.name, {
      lifecycleStatus: 'ready',
      knowledge,
      indicators,
      monitoring: {
        connected: false,
        analysisReady: false,
        issues: [],
        traceCount: 0,
      },
    });
    setSetupReadyBanner({
      namespaceName: namespace.name,
      kiCount,
      managed: Boolean(namespace.managed),
    });
    writeStoredSetupReadyBanner(namespace.name, {
      kiCount,
      dismissed: false,
      managed: Boolean(namespace.managed),
    });
    selectNamespaceDetailTab('overview');
    setupTimerRef.current = null;
  };

  const beginSetupRun = (namespace: Namespace, readyPatch: Partial<Namespace>, kiCount: number) => {
    clearSetupTimer();
    setActiveSetupRun('full');
    setSetupPhase(namespace.name, 'running');
    patchNamespace(namespace.name, {
      lifecycleStatus: 'settingUp',
      ...readyPatch,
    });
    setSetupSuccessKiCount(0);
    setupTimerRef.current = window.setTimeout(() => {
      setSetupSuccessKiCount(kiCount);
      finalizeSetupReady(namespace, kiCount);
    }, 2800);
  };

  const startSuggestStrategies = (namespace: Namespace) => {
    if (!hasInference) return;
    clearSetupTimer();
    setSetupErrorKind(null);
    setStrategyInstructionOpenId(null);
    setStrategiesByIndex((current) => ({ ...current, [namespace.name]: [] }));
    setSetupPhase(namespace.name, 'suggesting');
  };

  const finishGeneratedAutomation = (namespace: Namespace, asTestError: boolean) => {
    const strategies =
      strategiesByIndex[namespace.name] ?? buildMockStrategies(namespace);
    const selectedIds =
      selectedStrategyIdsByIndex[namespace.name] ??
      (strategies[0] ? [strategies[0].id] : []);
    const automation = buildAutomationFromStrategies(strategies, selectedIds, namespace);
    const withoutGenerated = namespace.automations.filter((item) => item.id !== automation.id);
    patchNamespace(namespace.name, {
      automations: [...withoutGenerated, automation],
      suggestedAutomations: [],
      lifecycleStatus: 'settingUp',
    });
    if (asTestError) {
      setSetupErrorKind('test');
      setSetupPhase(namespace.name, 'testError');
      return;
    }
    const kiCount = SAMPLE_SETUP_KI_COUNT;
    setSetupSuccessKiCount(kiCount);
    setActiveSetupRun('test');
    patchNamespace(namespace.name, {
      indicators: buildSetupIndicators(namespace, kiCount),
      knowledge: knowledgeFromKiCount(kiCount),
    });
    setSetupPhase(namespace.name, 'preview');
  };

  const startGenerateWorkflow = (namespace: Namespace) => {
    clearSetupTimer();
    setSetupErrorKind(null);
    setGenerateElapsedSeconds(0);
    setGenerateWaitPhase('generate');
    setReviewTryQuestion('');
    setReviewTryResult(null);
    setReviewSampleOverride(null);
    setSetupPhase(namespace.name, 'generating');
    patchNamespace(namespace.name, { lifecycleStatus: 'settingUp' });
    setupTimerRef.current = window.setTimeout(() => {
      setGenerateWaitPhase('test');
      setupTimerRef.current = window.setTimeout(() => {
        finishGeneratedAutomation(namespace, demoFlags$.value.forceSetupError);
        setupTimerRef.current = null;
      }, TEST_RUN_WAIT_MS);
    }, GENERATE_WAIT_MS);
  };

  const startTestRunAgain = (namespace: Namespace) => {
    clearSetupTimer();
    setSetupErrorKind(null);
    setGenerateElapsedSeconds(0);
    setGenerateWaitPhase('test');
    setSetupPhase(namespace.name, 'generating');
    patchNamespace(namespace.name, { lifecycleStatus: 'settingUp' });
    setupTimerRef.current = window.setTimeout(() => {
      finishGeneratedAutomation(namespace, demoFlags$.value.forceSetupError);
      setupTimerRef.current = null;
    }, TEST_RUN_WAIT_MS);
  };

  const continueFirstRunToFull = (namespace: Namespace) => {
    clearSetupTimer();
    setActiveSetupRun('full');
    setGenerateElapsedSeconds(0);
    setSetupPhase(namespace.name, 'running');
    patchNamespace(namespace.name, { lifecycleStatus: 'settingUp' });
    const testCount = setupSuccessKiCount || SAMPLE_SETUP_KI_COUNT;
    if (demoFlags$.value.forceSetupError) {
      setupTimerRef.current = window.setTimeout(() => {
        setSetupErrorKind('full');
        setSetupPhase(namespace.name, 'error');
        setupTimerRef.current = null;
      }, 1800);
      return;
    }
    setupTimerRef.current = window.setTimeout(() => {
      const kiCount = mergedSetupKiCount(namespace, testCount);
      setSetupSuccessKiCount(kiCount);
      finalizeSetupReady(namespace, kiCount);
    }, 2800);
  };

  const retrySetupError = (namespace: Namespace) => {
    if (setupErrorKind === 'full') {
      continueFirstRunToFull(namespace);
      return;
    }
    if (setupErrorKind === 'test') {
      startTestRunAgain(namespace);
      return;
    }
    startGenerateWorkflow(namespace);
  };

  const runManagedSetup = (namespace: Namespace) => {
    const enabled = MANAGED_SETUP_SOURCES.filter((source) => managedSetupToggles[source.id]);
    if (enabled.length === 0) return;
    const sourceDetails = enabled.map((source) => ({
      name: source.sourceName,
      subtitle: source.description,
      typeLabel: source.typeLabel,
      icon: source.icon,
    }));
    const automations = enabled.map((source, index) => ({
      id: `managed-setup-${source.id}`,
      title: `Extract Knowledge Indicators from ${source.sourceName}`,
      type: 'FACT' as const,
      ownership: 'MANAGED BY ELASTIC' as const,
      tags: [source.sourceName, 'Bottom-Up'],
      description: `Extraction from ${source.sourceName} enabled during guided setup.`,
      evidence: `Evidence: ${3 + index} docs`,
    }));
    beginSetupRun(
      namespace,
      {
        sources: enabled.map((source) => source.sourceName),
        sourceDetails,
        automations,
        suggestedAutomations: [],
      },
      enabled.length * 4
    );
  };

  const defineDescriptionWithChat = () => {
    if (!activeNamespace || isDefiningDescription) return;
    setIsDefiningDescription(true);
    window.setTimeout(() => {
      const description = buildChatDescription(activeNamespace);
      const updated: Namespace = { ...activeNamespace, description };
      setActiveNamespace(updated);
      setNamespaces((current) =>
        current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
      );
      setIsDefiningDescription(false);
    }, 650);
  };

  const createIndexMenu: AppHeaderMenu = {
    primaryActionItem: {
      id: 'create-ai-index',
      label: 'Create AI index',
      iconType: 'plusInCircle',
      run: () => startWizard(),
      testId: 'contextEngineCreateAiIndex',
    },
  };

  const monitoringSelected =
    AGENT_MONITORING_ENABLED && screen === 'index' && contextAreaTab === 'monitoring';
  const landingHeaderTabs: AppHeaderTab[] = [
    {
      id: 'indices',
      label: 'AI indices',
      isSelected: !monitoringSelected,
      onClick: () => goToContextArea('indices'),
    },
    {
      id: 'monitoring',
      label: 'Agent monitoring',
      isSelected: monitoringSelected,
      onClick: () => goToContextArea('monitoring'),
    },
  ];
  const headerSectionTabs = AGENT_MONITORING_ENABLED ? landingHeaderTabs : undefined;

  const leaveWorkflow = () => {
    const originName = workflowOriginName ?? activeNamespace?.name ?? null;
    setShowTestRunModal(false);
    setWorkflowNotice(null);
    setWorkflowBackLabel(null);
    setWorkflowDraftPending(null);
    setWorkflowOriginName(null);
    if (workflowOriginTab) {
      selectNamespaceDetailTab(workflowOriginTab);
    }
    setWorkflowOriginTab(null);
    if (originName) {
      const origin = namespaces.find((item) => item.name === originName);
      if (origin) setActiveNamespace(origin);
    }
    setScreen('namespace');
  };

  const sourceRow = (source: Source) => {
    const selected = selectedSourceIds.includes(source.id);
    const suggestion =
      M3_INTENT_SOURCE_SUGGESTIONS_ENABLED && intentSuggestPhase === 'resolved'
        ? intentMatchById.get(source.id)
        : undefined;
    const pulsing = pulsingSourceId === source.id;
    const isAgentTrace = source.category === 'traces';
    return (
      <EuiPanel
        id={`context-engine-8-source-${source.id}`}
        key={source.id}
        hasBorder
        paddingSize="m"
        color={selected ? 'primary' : 'plain'}
        className={`contextEnginePrototype__sourceRow${
          selected ? ' contextEnginePrototype__sourceRow--selected' : ''
        }${pulsing ? ' contextEnginePrototype__sourceRow--pulse' : ''}`}
        onClick={() => toggleSource(source.id)}
        role="checkbox"
        aria-checked={selected}
        aria-label={`${selected ? 'Deselect' : 'Select'} ${source.name}`}
      >
        <EuiFlexGroup alignItems="flexStart" responsive={false} gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiCheckbox
              id={`context-engine-8-source-${source.id}`}
              className="contextEnginePrototype__selectCheckbox"
              checked={selected}
              onChange={() => toggleSource(source.id)}
              onClick={(event: React.MouseEvent) => event.stopPropagation()}
              label=""
            />
          </EuiFlexItem>
          {!isAgentTrace ? (
            <EuiFlexItem grow={false}>
              <span className="contextEnginePrototype__sourceIcon">
                <EuiIcon type={source.icon} aria-hidden={true} />
              </span>
            </EuiFlexItem>
          ) : null}
          <EuiFlexItem>
            <EuiFlexGroup
              alignItems="center"
              gutterSize="s"
              responsive={false}
              wrap
            >
              <EuiFlexItem grow={false}>
            <EuiText size="s">
              <strong>{source.name}</strong>
            </EuiText>
              </EuiFlexItem>
              {suggestion ? (
                <EuiFlexItem grow={false}>
                  <EuiBadge
                    color="hollow"
                    className="contextEnginePrototype__sourceSuggestBadge"
                  >
                    Suggested ✨
                  </EuiBadge>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
            <EuiText size="xs" color="subdued">
              {isAgentTrace ? (
                <>
                  {source.questionCount || '0'} questions · last active{' '}
                  {source.lastActive || 'unknown'} ·{' '}
                  <EuiCode>{source.streamName || source.id}</EuiCode>
                </>
              ) : (
              <span className="contextEnginePrototype__mono">{source.description}</span>
              )}
            </EuiText>
            {suggestion ? (
              <EuiText
                size="xs"
                className="contextEnginePrototype__sourceSuggestWhy"
              >
                {suggestion.why}
              </EuiText>
            ) : null}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  };

  const renderIndex = () => {
    const maxVisibleSources = 3;
    const healthFilterOptions = [
      { value: 'all', text: 'All' },
      { value: 'healthy', text: 'Ready' },
      ...(AGENT_MONITORING_ENABLED ? [{ value: 'issues', text: 'Has issues' }] : []),
      { value: 'needsSetup', text: 'Needs setup' },
    ];
    const userCreatedCount = namespaces.filter((item) => !item.managed).length;
    const showFullHero = userCreatedCount === 0;
    const showHeroHint = userCreatedCount > 0 && !landingHeroHintDismissed;

    const catalogItemModel = (namespace: Namespace) => {
      const displayName = catalogDisplayName(namespace);
      const lifecycle = surfaceCatalogLifecycle(namespace);
      const needsSetup = lifecycle.kind === 'needsSetup';
      const settingUp = lifecycle.kind === 'settingUp';
      const kiCount = namespace.managed
        ? MANAGED_ELASTIC_ENABLED_KI_COUNT
        : knowledgeTotal(namespace.knowledge);
      const shownSources = namespace.sources.slice(0, maxVisibleSources);
      const hiddenSourceCount = Math.max(0, namespace.sources.length - maxVisibleSources);
      const storageDisplay =
        namespace.storageType === 'dataStream' ? 'Data stream' : 'Index';
      const statusMeta = needsSetup
        ? namespace.managed
          ? 'Requires a one-time setup'
          : 'No automations running yet'
        : settingUp
          ? 'Populating · first knowledge in a few minutes'
          : `${storageDisplay} · ${kiCount} KI`;
      const updatedTime = looksLikeRelativeTime(namespace.updated)
        ? namespace.updated
        : null;
      const openItem = () => {
        if (needsSetup) {
          openNamespace(namespace, { focusSetup: true });
          return;
        }
        if (lifecycle.kind === 'issues') {
          openNamespace(namespace, { focusMonitoring: true });
          return;
        }
        openNamespace(namespace);
      };
      const lifecycleBadge = (() => {
        if (lifecycle.kind === 'needsSetup') {
          return (
            <EuiBadge
              color="warning"
              className="contextEnginePrototype__typeBadge contextEnginePrototype__lifecycleBadge--needsSetup"
            >
              Needs setup
            </EuiBadge>
          );
        }
        if (lifecycle.kind === 'settingUp') {
          return (
            <EuiBadge
              color="primary"
              className="contextEnginePrototype__typeBadge contextEnginePrototype__lifecycleBadge--settingUp"
            >
              <EuiLoadingSpinner size="s" />
              Setting up
            </EuiBadge>
          );
        }
        if (lifecycle.kind === 'issues') {
          return (
            <EuiBadge color="warning" className="contextEnginePrototype__typeBadge">
              {lifecycle.count} issue{lifecycle.count === 1 ? '' : 's'}
            </EuiBadge>
          );
        }
        return (
          <EuiBadge color="success" className="contextEnginePrototype__typeBadge">
            Ready
          </EuiBadge>
        );
      })();
      return {
        displayName,
        kiCount,
        shownSources,
        hiddenSourceCount,
        statusMeta,
        updatedTime,
        openItem,
        lifecycleBadge,
      };
    };

    const catalogNameLink = (displayName: string, openItem: () => void) => (
      <EuiLink
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openItem();
        }}
      >
        {displayName}
      </EuiLink>
    );

    const renderCatalogRow = (namespace: Namespace) => {
      const {
        displayName,
        kiCount,
        shownSources,
        hiddenSourceCount,
        openItem,
        lifecycleBadge,
      } = catalogItemModel(namespace);
      return (
        <EuiPanel
          key={namespace.name}
          hasBorder
          paddingSize="m"
          className="contextEnginePrototype__namespaceRow"
          onClick={openItem}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openItem();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${displayName}`}
        >
          <div className="contextEnginePrototype__namespaceRowInner">
            <div className="contextEnginePrototype__namespaceRowMain">
              <div className="contextEnginePrototype__namespaceRowTitle">
                <span className="contextEnginePrototype__namespaceRowName">
                  {catalogNameLink(displayName, openItem)}
                </span>
                {namespace.managed ? (
                  <EuiBadge
                    color="hollow"
                    iconType="lock"
                    className="contextEnginePrototype__typeBadge"
                  >
                    Managed
                  </EuiBadge>
                ) : null}
                {lifecycleBadge}
              </div>
              <EuiText
                size="xs"
                color="subdued"
                className="contextEnginePrototype__namespaceSources"
              >
                {shownSources.join(', ')}
                {hiddenSourceCount > 0 ? ` +${hiddenSourceCount}` : ''}
              </EuiText>
            </div>
            <div className="contextEnginePrototype__namespaceRowMeta">
              <div className="contextEnginePrototype__namespaceRowMetaCol">
                <span className="contextEnginePrototype__namespaceRowMetaLabel">
                  Knowledge indicators
                </span>
                <span className="contextEnginePrototype__namespaceRowMetaValue">{kiCount}</span>
              </div>
              {namespace.integration ? (
                <div className="contextEnginePrototype__namespaceRowMetaCol">
                  <span className="contextEnginePrototype__namespaceRowMetaLabel">
                    Integrated via
                  </span>
                  <span className="contextEnginePrototype__namespaceRowMetaValue">
                    {namespace.integration}
                  </span>
                </div>
              ) : null}
            </div>
            <EuiIcon
              type="arrowRight"
              color="subdued"
              className="contextEnginePrototype__namespaceRowChevron"
              aria-hidden={true}
            />
          </div>
        </EuiPanel>
      );
    };

    const renderCatalogCard = (namespace: Namespace) => {
      const {
        displayName,
        shownSources,
        hiddenSourceCount,
        statusMeta,
        updatedTime,
        openItem,
        lifecycleBadge,
      } = catalogItemModel(namespace);
      const cardClassName = namespace.managed
        ? 'contextEnginePrototype__namespaceCard contextEnginePrototype__namespaceCard--managed'
        : 'contextEnginePrototype__namespaceCard';
      return (
        <EuiFlexItem key={namespace.name}>
          <EuiPanel
            hasBorder
            paddingSize="m"
            className={cardClassName}
            onClick={openItem}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openItem();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open ${displayName}`}
          >
            <div className="contextEnginePrototype__namespaceCardBody">
              <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                <EuiFlexItem grow={true}>
                  <EuiTitle size="xs">
                    <h2>{catalogNameLink(displayName, openItem)}</h2>
                  </EuiTitle>
                </EuiFlexItem>
                {namespace.managed ? (
                  <EuiFlexItem grow={false}>
                    <EuiBadge
                      color="hollow"
                      iconType="lock"
                      className="contextEnginePrototype__typeBadge"
                    >
                      Managed
                    </EuiBadge>
                  </EuiFlexItem>
                ) : null}
                <EuiFlexItem grow={false}>{lifecycleBadge}</EuiFlexItem>
              </EuiFlexGroup>
              <EuiText
                size="xs"
                color="subdued"
                className="contextEnginePrototype__namespaceSources"
              >
                {shownSources.join(', ')}
                {hiddenSourceCount > 0 ? ` +${hiddenSourceCount}` : ''}
              </EuiText>
              <EuiText size="xs" color="subdued">
                {statusMeta}
              </EuiText>
            </div>
            {namespace.integration || updatedTime ? (
              <>
                <EuiHorizontalRule margin="s" />
                <EuiFlexGroup
                  className="contextEnginePrototype__namespaceCardFooter"
                  responsive={false}
                  gutterSize="m"
                  alignItems="center"
                >
                  {namespace.integration ? (
                    <EuiFlexItem>
                      <EuiText size="xs" color="subdued">
                        Integrated via
                      </EuiText>
                      <EuiText size="s">{namespace.integration}</EuiText>
                    </EuiFlexItem>
                  ) : null}
                  {updatedTime ? (
                    <EuiFlexItem>
                      <EuiText size="xs" color="subdued">
                        Updated
                      </EuiText>
                      <EuiText size="s">{updatedTime}</EuiText>
                    </EuiFlexItem>
                  ) : null}
                </EuiFlexGroup>
              </>
            ) : null}
          </EuiPanel>
        </EuiFlexItem>
      );
    };

    return (
      <>
        <FullWidthAppHeader
          title="Context"
          tabs={headerSectionTabs}
          menu={createIndexMenu}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section grow={false}>
          {AGENT_MONITORING_ENABLED && contextAreaTab === 'monitoring' ? (
            <AgentMonitoringSurface
              coreStart={coreStart}
              onBuildContextEngine={startWizard}
              onAnalyzeWithAgent={openAgentSidebar}
            />
          ) : (
            <div className="contextEnginePrototype__landingCatalog">
              {showFullHero ? (
                <EuiPanel
                  hasBorder
                  paddingSize="m"
                  className="contextEnginePrototype__landingHero"
                >
                  <div className="contextEnginePrototype__landingHeroInner">
                    <div className="contextEnginePrototype__landingHeroCopy">
                      <EuiTitle size="s">
                        <h2>Give your agent a card catalog, not a library</h2>
                      </EuiTitle>
                      <EuiText size="m" color="subdued">
                        <p className="contextEnginePrototype__landingBody">
                          You have an agent. Give it knowledge. An AI index is a live collection of
                          facts built from your data: connect your <strong>sources</strong> once,
                          and <strong>automations</strong> read them to produce Knowledge
                          Indicators. Nothing to configure first.
                        </p>
                      </EuiText>
                      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
                        <EuiFlexItem grow={false}>
                          <EuiButton
                            color="primary"
                            fill
                            iconType="plusInCircle"
                            onClick={startWizard}
                          >
                            Create AI index
                          </EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiButtonEmpty
                            href="https://www.elastic.co/docs"
                            target="_blank"
                            iconType="external"
                            iconSide="right"
                            aria-label="How it works"
                          >
                            How it works
                          </EuiButtonEmpty>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </div>
                    <div className="contextEnginePrototype__landingHeroArt">
                      <EuiImage
                        size="original"
                        src={coreStart.http.basePath.prepend(
                          '/plugins/contextEngineExampleEight/assets/empty_state.png'
                        )}
                        alt=""
                      />
                    </div>
                  </div>
                </EuiPanel>
              ) : showHeroHint ? (
                <div className="contextEnginePrototype__landingHint">
                  <EuiLink
                    href="https://www.elastic.co/docs"
                    target="_blank"
                    aria-label="Learn what an AI index is"
                  >
                    New to Context? Learn what an AI index is ›
                  </EuiLink>
                  <EuiButtonIcon
                    iconType="cross"
                    color="text"
                    aria-label="Dismiss"
                    onClick={dismissLandingHeroHint}
                  />
                </div>
              ) : null}

              <EuiFlexGroup
                className="contextEnginePrototype__indexSectionHeader"
                alignItems="center"
                justifyContent="spaceBetween"
                gutterSize="m"
                responsive={false}
                wrap
              >
                <EuiFlexItem grow={false}>
                  <EuiTitle size="xs">
                    <h2 className="contextEnginePrototype__sectionTitle">
                      Your AI indices
                      <span className="contextEnginePrototype__indexCount">
                        {namespaces.length}
                      </span>
                    </h2>
                  </EuiTitle>
                  {userCreatedCount === 0 ? (
                    <EuiText
                      size="s"
                      color="subdued"
                      className="contextEnginePrototype__indexSectionIntro"
                    >
                      <p>
                        You already have one running. Open it to see what an AI index actually
                        contains.
                      </p>
                    </EuiText>
                  ) : null}
                </EuiFlexItem>
              </EuiFlexGroup>

              {userCreatedCount > 0 ? (
                <EuiFlexGroup
                  className="contextEnginePrototype__indexToolbar"
                  gutterSize="m"
                  alignItems="flexEnd"
                  wrap
                >
                  <EuiFlexItem grow={2} className="contextEnginePrototype__indexSearch">
                    <EuiFieldSearch
                      compressed
                      fullWidth
                      placeholder="Search AI indices"
                      value={namespaceQuery}
                      onChange={(event) => setNamespaceQuery(event.target.value)}
                      aria-label="Search AI indices"
                    />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false} className="contextEnginePrototype__indexFilter">
                    <EuiFormRow label="Status" display="rowCompressed">
                      <EuiSelect
                        compressed
                        options={healthFilterOptions}
                        value={healthFilter}
                        onChange={(event) =>
                          setHealthFilter(event.target.value as HealthFilter)
                        }
                        aria-label="Filter by status"
                      />
                    </EuiFormRow>
                  </EuiFlexItem>
                </EuiFlexGroup>
              ) : null}

              {filteredNamespaces.length === 0 ? (
                <EuiPanel hasBorder paddingSize="l">
                  <EuiText color="subdued">No AI indices match your search or filters.</EuiText>
                </EuiPanel>
              ) : filteredNamespaces.length === 1 ? (
                renderCatalogRow(filteredNamespaces[0])
              ) : (
                <EuiFlexGrid columns={3} gutterSize="l">
                  {filteredNamespaces.map((namespace) => renderCatalogCard(namespace))}
                </EuiFlexGrid>
              )}
            </div>
          )}
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderCreate = () => {
    const activeTab =
      sourceCategories.find(({ id }) => id === activeCategory) ?? sourceCategories[0];
    const indexStepComplete = nameComplete && intentComplete;
    const sourcesStepComplete = sourcesComplete;
    const stepsDone = (indexStepComplete ? 1 : 0) + (sourcesStepComplete ? 1 : 0);
    const bothStepsComplete = indexStepComplete && sourcesStepComplete;
    const otherStepIncomplete =
      createPanel === 'index' ? !sourcesStepComplete : !indexStepComplete;
    const indexSubline = indexStepComplete
      ? 'Named, intent set.'
      : 'Name it and give it intent.';
    const sourcesTitle =
      selectedSources.length > 0 ? `Sources · ${selectedSources.length}` : 'Sources';
    const sourcesSubline =
      selectedSources.length > 0
        ? selectedSources.map((source) => source.name).join(', ')
        : 'Connectors and ES|QL views.';

    const primaryAction = (() => {
      if (bothStepsComplete) {
        return {
          label: 'Create AI index',
          disabled: false,
          onClick: createNamespace,
          microtext: null,
        };
      }
      if (otherStepIncomplete) {
        const goToSources = createPanel === 'index';
        // On name/intent: require some progress before advancing to sources.
        const canAdvanceFromIndex =
          Boolean(namespaceName.trim()) || intentComplete;
        return {
          label: goToSources ? 'Next: select sources' : 'Next: name and intent',
          disabled: goToSources ? !canAdvanceFromIndex : false,
          onClick: () => setCreatePanel(goToSources ? 'sources' : 'index'),
          microtext: (
            <EuiText size="s" color="subdued">
                      {stepsDone} of 2 steps done
            </EuiText>
          ),
        };
      }
      return {
        label: 'Create AI index',
        disabled: true,
        onClick: createNamespace,
        microtext: (
          <EuiText size="s" color="subdued">
            {createPanel === 'index'
              ? 'Add a name and intent to create'
              : 'Pick at least one source to create'}
          </EuiText>
        ),
      };
    })();

    const stepMarkerClass = (active: boolean, complete: boolean) => {
      if (complete) return 'contextEnginePrototype__createStepMarker--complete';
      if (active) return 'contextEnginePrototype__createStepMarker--active';
      return 'contextEnginePrototype__createStepMarker--incomplete';
    };

    const stepNode = (
      id: CreatePanel,
      title: string,
      subline: string,
      complete: boolean
    ) => {
      const active = createPanel === id;
      return (
        <button
          type="button"
          className={`contextEnginePrototype__createStep${
            active ? ' contextEnginePrototype__createStep--active' : ''
          }${complete ? ' contextEnginePrototype__createStep--complete' : ''}${
            !active && !complete ? ' contextEnginePrototype__createStep--incomplete' : ''
          }`}
          onClick={() => setCreatePanel(id)}
          aria-pressed={active}
        >
          <span className="contextEnginePrototype__createStepMarkerCol" aria-hidden={true}>
            <span
              className={`contextEnginePrototype__createStepMarker ${stepMarkerClass(
                active,
                complete
              )}`}
            >
              {complete ? (
                <EuiIcon type="check" size="s" color="ghost" />
              ) : active ? (
                <span className="contextEnginePrototype__createStepMarkerDot" />
              ) : null}
            </span>
          </span>
          <span className="contextEnginePrototype__createStepBody">
            <span className="contextEnginePrototype__createStepTitle">{title}</span>
            <span className="contextEnginePrototype__createStepDesc">{subline}</span>
          </span>
        </button>
      );
    };

    const timeCardSelected = storageType === 'dataStream';
    const referenceCardSelected = storageType === 'index';

    return (
      <>
        <FullWidthAppHeader
          title="Create AI index"
          back={headerBack(CONTEXT_APP_HREF, 'Context', goToIndex)}
          tabs={headerSectionTabs}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section>
          <EuiFlexGroup
            className="contextEnginePrototype__createLayout"
            gutterSize="l"
            alignItems="flexStart"
            responsive={true}
          >
            <EuiFlexItem grow={false} className="contextEnginePrototype__createMapColumn">
              <EuiPanel
                hasBorder
                paddingSize="m"
                className="contextEnginePrototype__createMap"
              >
                <div className="contextEnginePrototype__createStepper">
                  {stepNode('index', 'Name and intent', indexSubline, indexStepComplete)}
                  {stepNode('sources', sourcesTitle, sourcesSubline, sourcesStepComplete)}
                  <div
                    className="contextEnginePrototype__createStep contextEnginePrototype__createStep--preview"
                    aria-disabled={true}
                  >
                    <span className="contextEnginePrototype__createStepMarkerCol" aria-hidden={true}>
                      <span className="contextEnginePrototype__createStepMarker contextEnginePrototype__createStepMarker--preview" />
                    </span>
                    <span className="contextEnginePrototype__createStepBody">
                      <span className="contextEnginePrototype__createStepTitle">Automations</span>
                      <span className="contextEnginePrototype__createStepDesc">
                        After you create the index.
                      </span>
                    </span>
                  </div>
                </div>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem className="contextEnginePrototype__createPanelColumn">
              {createPanel === 'index' ? (
                <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__createPanel">
                  <EuiTitle size="s">
                    <h2>Name and intent</h2>
                  </EuiTitle>

                  <EuiSpacer size="l" />
                  <EuiFormRow
                    label="Name"
                    fullWidth
                    isInvalid={Boolean(namespaceName && namespaceNameError)}
                    error={
                      namespaceName && namespaceNameError ? [namespaceNameError] : undefined
                    }
                    helpText="Lowercase letters, numbers, and hyphens."
                  >
                    <EuiFieldText
                      fullWidth
                      placeholder="e.g. support-ticket-triage"
                      value={namespaceName}
                      isInvalid={Boolean(namespaceName && namespaceNameError)}
                      onChange={(event) =>
                        setNamespaceName(sanitizeNamespaceInput(event.target.value))
                      }
                      aria-label="AI index name"
                    />
                  </EuiFormRow>

                  <EuiSpacer size="l" />
                  <EuiText size="s">
                    <strong>Intent</strong>
                  </EuiText>
                  <EuiSpacer size="xs" />
                  <EuiText size="s" color="subdued">
                    Describe it in your own words.
                  </EuiText>
                  <EuiSpacer size="s" />
                      <EuiTextArea
                        fullWidth
                        rows={4}
                        placeholder="Help my support agents resolve cases using past tickets and our internal docs."
                        value={intentDescription}
                    onChange={(event) => {
                      setIntentDescription(event.target.value);
                      if (intentMode === 'upload') setIntentMode(null);
                    }}
                        aria-label="Intent description"
                      />

                  {INTENT_UPLOAD_ARTIFACTS_ENABLED ? (
                    <>
                      <EuiSpacer size="l" />
                      <EuiPanel
                        hasBorder
                        paddingSize="m"
                        className={`contextEnginePrototype__intentCard${
                          intentMode === 'upload'
                            ? ' contextEnginePrototype__intentCard--selected'
                            : ''
                        }`}
                        onClick={() => setIntentMode('upload')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event: React.KeyboardEvent) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setIntentMode('upload');
                          }
                        }}
                      >
                        <EuiText size="s" className="contextEnginePrototype__intentCardTitle">
                          <strong>Upload agent artifacts</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          A prompt, skill, or traces from any harness.
                        </EuiText>
                      </EuiPanel>
                      {intentMode === 'upload' && (
                        <>
                          <EuiSpacer size="m" />
                          {!intentUploadFileName ? (
                            <div className="contextEnginePrototype__intentUploadDropzone">
                              <EuiFilePicker
                                key={intentUploadPickerKey}
                                id="intent-upload-file"
                                fullWidth
                                display="large"
                                multiple={false}
                                initialPromptText="Drop a file or click to browse"
                                onChange={(files) => {
                                  const file = files?.[0];
                                  if (!file) return;
                                  setIntentUploadFileName(file.name);
                                  setIntentInferred(MOCK_INFERRED_INTENT);
                                }}
                                aria-label="Upload agent artifacts"
                              />
                              <EuiSpacer size="s" />
                              <EuiText size="xs" color="subdued">
                                Agent prompt (.md, .txt), skill definition, or exported traces
                                (.json / .jsonl) from Claude Code, Cursor, LangChain or any
                                harness.
                              </EuiText>
                            </div>
                          ) : (
                            <>
                              <EuiFlexGroup
                                className="contextEnginePrototype__intentUploadChip"
                                alignItems="center"
                                gutterSize="s"
                                responsive={false}
                              >
                                <EuiFlexItem grow={false}>
                                  <EuiIcon type="document" size="m" aria-hidden={true} />
                                </EuiFlexItem>
                                <EuiFlexItem grow={true}>
                                  <EuiText size="s">{intentUploadFileName}</EuiText>
                                </EuiFlexItem>
                                <EuiFlexItem grow={false}>
                                  <EuiButtonIcon
                                    iconType="cross"
                                    aria-label={`Remove ${intentUploadFileName}`}
                                    onClick={() => {
                                      setIntentUploadFileName(null);
                                      setIntentInferred('');
                                      setIntentUploadPickerKey((key) => key + 1);
                                    }}
                                  />
                                </EuiFlexItem>
                              </EuiFlexGroup>
                              <EuiSpacer size="m" />
                              <EuiPanel
                                color="success"
                                paddingSize="m"
                                className="contextEnginePrototype__intentInferred"
                                hasBorder={false}
                              >
                                <EuiText
                                  size="xs"
                                  className="contextEnginePrototype__intentMicroLabel"
                                >
                                  Inferred intent · edit if needed
                                </EuiText>
                                <EuiSpacer size="xs" />
                                <EuiTextArea
                                  fullWidth
                                  rows={4}
                                  value={intentInferred}
                                  onChange={(event) => setIntentInferred(event.target.value)}
                                  aria-label="Inferred intent"
                                />
                              </EuiPanel>
                            </>
                          )}
                        </>
                      )}
                    </>
                  ) : null}
                </EuiPanel>
              ) : (
                <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__createPanel">
                  <EuiTitle size="s">
                    <h2>Sources</h2>
                  </EuiTitle>
                  <EuiSpacer size="xs" />
                  <EuiText size="s" color="subdued">
                    Where the knowledge lives. Pick at least one.
                  </EuiText>

                  {M3_INTENT_SOURCE_SUGGESTIONS_ENABLED && intentSuggestPhase !== 'hidden' ? (
                    <>
                      <EuiSpacer size="m" />
                      <div
                        className="contextEnginePrototype__intentSuggestStrip"
                        role="status"
                        aria-live="polite"
                      >
                        {intentSuggestPhase === 'thinking' ? (
                          <EuiText size="s">
                            ✨ Reading your intent and matching it against your sources
                            <span
                              className="contextEnginePrototype__intentSuggestEllipsis"
                              aria-hidden={true}
                            />
                          </EuiText>
                        ) : (
                          <EuiFlexGroup
                            alignItems="center"
                            gutterSize="s"
                            responsive={false}
                            wrap
                          >
                            <EuiFlexItem grow={false}>
                              <EuiText size="s">✨ Best matches for your intent:</EuiText>
                            </EuiFlexItem>
                            {intentSourceMatches.map((match) => (
                              <EuiFlexItem key={match.sourceId} grow={false}>
                                <EuiButtonEmpty
                                  size="xs"
                                  flush="both"
                                  className="contextEnginePrototype__intentSuggestChip"
                                  onClick={() => focusSuggestedSource(match.sourceId)}
                                >
                                  {match.name}
                                </EuiButtonEmpty>
                              </EuiFlexItem>
                            ))}
                            <EuiFlexItem grow={false}>
                              <EuiText size="xs" color="subdued">
                                in Connectors · nothing is selected for you
                              </EuiText>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        )}
                      </div>
                    </>
                  ) : null}

                  <EuiSpacer size="m" />
                  <EuiTabs>
                    {sourceCategories.map((category) => {
                      const count = selectedSources.filter(
                        (source) => source.category === category.id
                      ).length;
                      const tracesDisabled =
                        category.id === 'traces' && !agentTracesAvailable;
                      return (
                        <EuiTab
                          key={category.id}
                          isSelected={activeCategory === category.id}
                          disabled={tracesDisabled}
                          onClick={() => setActiveCategory(category.id)}
                          prepend={
                            <EuiIcon type={category.icon} size="s" aria-hidden={true} />
                          }
                          append={
                            count > 0 ? <EuiBadge color="primary">{count}</EuiBadge> : undefined
                          }
                          title={
                            tracesDisabled
                              ? 'No running agents with traces yet.'
                              : undefined
                          }
                        >
                          {category.label}
                        </EuiTab>
                      );
                    })}
                  </EuiTabs>
                  <EuiSpacer size="m" />

                  {activeCategory === 'esql' ? (
                    <>
                      <EuiText size="xs" color="subdued">
                        Advanced: write a query over your raw data. If you are not sure what this
                        means, use Connectors instead.
                      </EuiText>
                      <EuiSpacer size="m" />
                    </>
                  ) : null}

                  {activeCategory === 'traces' ? (
                    <>
                      <EuiText size="s" color="subdued">
                        Pull in the questions a running agent already answers. This adds those
                        traces as a source; it does not connect the agent to this index.
                      </EuiText>
                      <EuiSpacer size="m" />
                    </>
                  ) : null}

                  {activeCategory === 'connectors' ? (
                    <>
                      <EuiFlexGroup direction="column" gutterSize="s">
                        {orderedConnectorCatalog.slice(0, CONNECTOR_LIST_PAGE_SIZE).map((source) => (
                          <EuiFlexItem key={source.id}>{sourceRow(source)}</EuiFlexItem>
                        ))}
                      </EuiFlexGroup>
                      <EuiSpacer size="m" />
                      <EuiButtonEmpty
                        flush="left"
                        size="s"
                        iconType="database"
                        onClick={() => setShowConnectorFlyout(true)}
                      >
                        Add a source
                      </EuiButtonEmpty>
                    </>
                  ) : activeCategory === 'traces' && !agentTracesAvailable ? (
                    <EuiPanel
                      hasBorder
                      paddingSize="l"
                      className="contextEnginePrototype__sourceEmptyState"
                      color="subdued"
                    >
                      <EuiText size="s" color="subdued">
                        No running agents with traces yet.
                      </EuiText>
                    </EuiPanel>
                  ) : activeCategory === 'esql' && !esqlDataReady && !esqlEditorRevealed ? (
                    <EuiPanel
                      hasBorder
                      paddingSize="l"
                      className="contextEnginePrototype__sourceEmptyState"
                      color="subdued"
                    >
                      <EuiText size="s">
                        An ES|QL view queries your raw indices directly. You will need to know which
                        index and fields to use. New here? Start with Connectors;
                        you can add an ES|QL source later.
                      </EuiText>
                      <EuiSpacer size="m" />
                      <EuiLink onClick={() => setEsqlEditorRevealed(true)}>
                        Write a query anyway
                      </EuiLink>
                    </EuiPanel>
                  ) : activeCategory === 'esql' ? (
                    <>
                      <EuiTextArea
                        fullWidth
                        rows={5}
                        value={esqlDraftQuery}
                        onChange={(event) => setEsqlDraftQuery(event.target.value)}
                        aria-label="ES|QL query"
                        className="contextEnginePrototype__mono contextEnginePrototype__esqlQuery"
                      />
                      <EuiSpacer size="xs" />
                      <EuiText size="xs" color="subdued">
                        Tip: Cmd+J opens autocomplete (mock).
                      </EuiText>
                      <EuiSpacer size="s" />
                      <EuiButtonEmpty
                        flush="left"
                        size="s"
                        iconType={esqlPreviousOpen ? 'arrowDown' : 'arrowRight'}
                        aria-expanded={esqlPreviousOpen}
                        onClick={() => setEsqlPreviousOpen((open) => !open)}
                      >
                        Show previous ES|QL queries
                      </EuiButtonEmpty>
                      {esqlPreviousOpen ? (
                        <>
                          <EuiSpacer size="s" />
                          <EuiFlexGroup direction="column" gutterSize="s">
                            {availableSources
                              .filter((source) => source.category === 'esql')
                              .map((source) => (
                                <EuiFlexItem key={source.id}>{sourceRow(source)}</EuiFlexItem>
                              ))}
                          </EuiFlexGroup>
                        </>
                      ) : null}
                    </>
                  ) : (
                  <EuiFlexGroup direction="column" gutterSize="s">
                    {visibleSources.map((source) => (
                      <EuiFlexItem key={source.id}>{sourceRow(source)}</EuiFlexItem>
                    ))}
                    <EuiFlexItem>
                      <EuiPanel
                        hasBorder
                        paddingSize="s"
                        className="contextEnginePrototype__dashedAction"
                      >
                          <EuiButtonEmpty
                            iconType="plus"
                            flush="left"
                            onClick={() => {
                              if (activeCategory === 'connectors') {
                                setShowConnectorFlyout(true);
                              } else if (activeCategory === 'traces') {
                                coreStart.notifications.toasts.addInfo(
                                  'Agent traces connect from APM (mock). Select a stream above.'
                                );
                              } else {
                                coreStart.notifications.toasts.addInfo(
                                  'Create ES|QL view (mock). Use an existing view from the list for now.'
                                );
                              }
                            }}
                          >
                          {activeTab.createLabel}
                        </EuiButtonEmpty>
                      </EuiPanel>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  )}

                  <EuiSpacer size="xl" />
                  <EuiAccordion
                    id="context-engine-8-sources-advanced"
                    arrowDisplay="right"
                    forceState={sourcesAdvancedOpen ? 'open' : 'closed'}
                    onToggle={(isOpen) => setSourcesAdvancedOpen(isOpen)}
                    buttonProps={{ color: 'primary' }}
                    buttonContent={
                      <EuiText color="primary" size="s">
                        <span className="contextEnginePrototype__sourcesAdvancedLink">
                          Index storage
                        </span>
                      </EuiText>
                    }
                    paddingSize="none"
                    className="contextEnginePrototype__sourcesAdvanced"
                  >
                    <EuiSpacer size="m" />
                    <EuiText size="s" color="subdued">
                      Should knowledge expire automatically? Cannot be changed after the index is
                      created.
                    </EuiText>
                    <EuiSpacer size="m" />
                    <EuiFlexGroup gutterSize="m" responsive={false}>
                      <EuiFlexItem>
                        <EuiPanel
                          hasBorder
                          paddingSize="m"
                          className={`contextEnginePrototype__intentCard${
                            timeCardSelected
                              ? ' contextEnginePrototype__intentCard--selected'
                              : ''
                          }`}
                          onClick={() => selectDataNature('dataStream')}
                          role="radio"
                          aria-checked={timeCardSelected}
                          tabIndex={0}
                          onKeyDown={(event: React.KeyboardEvent) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectDataNature('dataStream');
                            }
                          }}
                        >
                          <EuiFlexGroup alignItems="flexStart" gutterSize="s" responsive={false}>
                            <EuiFlexItem grow={false}>
                              <EuiRadio
                                id="data-nature-time-based"
                                checked={timeCardSelected}
                                onChange={() => selectDataNature('dataStream')}
                                label=""
                              />
                            </EuiFlexItem>
                            <EuiFlexItem>
                              <EuiText size="s">
                                <strong>Yes, time-based</strong>
                              </EuiText>
                              <EuiText size="xs" color="subdued">
                                Stored as a data stream
                              </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                        </EuiPanel>
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiPanel
                          hasBorder
                          paddingSize="m"
                          className={`contextEnginePrototype__intentCard${
                            referenceCardSelected
                              ? ' contextEnginePrototype__intentCard--selected'
                              : ''
                          }`}
                          onClick={() => selectDataNature('index')}
                          role="radio"
                          aria-checked={referenceCardSelected}
                          tabIndex={0}
                          onKeyDown={(event: React.KeyboardEvent) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectDataNature('index');
                            }
                          }}
                        >
                          <EuiFlexGroup alignItems="flexStart" gutterSize="s" responsive={false}>
                            <EuiFlexItem grow={false}>
                              <EuiRadio
                                id="data-nature-reference"
                                checked={referenceCardSelected}
                                onChange={() => selectDataNature('index')}
                                label=""
                              />
                            </EuiFlexItem>
                            <EuiFlexItem>
                              <EuiText size="s">
                                <strong>No, reference data</strong>
                              </EuiText>
                              <EuiText size="xs" color="subdued">
                                Stored as an index
                              </EuiText>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        </EuiPanel>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    <EuiSpacer size="s" />
                    <EuiText size="xs" color="subdued">
                      Suggested from your sources.
                    </EuiText>
                  </EuiAccordion>
                </EuiPanel>
              )}

              {showConnectorFlyout ? (
                <EuiFlyout
                  ownFocus
                  onClose={() => setShowConnectorFlyout(false)}
                  size="s"
                  aria-labelledby="context-engine-8-connector-flyout"
                >
                  <EuiFlyoutHeader hasBorder>
                    <EuiTitle size="s">
                      <h2 id="context-engine-8-connector-flyout">Add a source</h2>
                    </EuiTitle>
                  </EuiFlyoutHeader>
                  <EuiFlyoutBody>
                    <EuiText size="s" color="subdued">
                      Pick a connector type. In this prototype, Connect adds it to your Sources
                      list immediately.
                    </EuiText>
                    <EuiSpacer size="m" />
                    <EuiFlexGroup direction="column" gutterSize="s">
                      {connectorCatalog.map((source) => {
                        const already = connectedConnectorIds.includes(source.id);
                        return (
                          <EuiFlexItem key={source.id}>
                            <EuiPanel hasBorder paddingSize="m">
                              <EuiFlexGroup
                                alignItems="center"
                                gutterSize="m"
                                responsive={false}
                              >
                                <EuiFlexItem grow={false}>
                                  <EuiIcon type={source.icon} size="l" aria-hidden={true} />
                                </EuiFlexItem>
                                <EuiFlexItem>
                                  <EuiText size="s">
                                    <strong>{source.name}</strong>
                                  </EuiText>
                                  <EuiText size="xs" color="subdued">
                                    {source.description}
                                  </EuiText>
                                </EuiFlexItem>
                                <EuiFlexItem grow={false}>
                                  <EuiButton
                                    size="s"
                                    fill={!already}
                                    disabled={already}
                                    onClick={() => {
                                      setConnectedConnectorIds((current) =>
                                        current.includes(source.id)
                                          ? current
                                          : [...current, source.id]
                                      );
                                      setSelectedSourceIds((current) =>
                                        current.includes(source.id)
                                          ? current
                                          : [...current, source.id]
                                      );
                                      setActiveCategory('connectors');
                                      setShowConnectorFlyout(false);
                      coreStart.notifications.toasts.addSuccess(
                        `${source.name} added. We will know if it works when the automation runs.`
                      );
                                    }}
                                  >
                                    {already ? 'Connected' : 'Connect'}
                                  </EuiButton>
                                </EuiFlexItem>
                              </EuiFlexGroup>
                            </EuiPanel>
                          </EuiFlexItem>
                        );
                      })}
                    </EuiFlexGroup>
                  </EuiFlyoutBody>
                </EuiFlyout>
              ) : null}

              <EuiSpacer size="m" />
              <EuiFlexGroup
                className="contextEnginePrototype__createFooter"
                alignItems="center"
                gutterSize="m"
                responsive={false}
                wrap
              >
                <EuiFlexItem grow={false}>
                  <EuiButton
                    fill
                    iconSide="right"
                    iconType="arrowRight"
                    disabled={primaryAction.disabled}
                    onClick={primaryAction.onClick}
                  >
                    {primaryAction.label}
                  </EuiButton>
                </EuiFlexItem>
                {primaryAction.microtext ? (
                  <EuiFlexItem grow={false}>{primaryAction.microtext}</EuiFlexItem>
                ) : null}
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>
      </>
    );
  };

  const badgeLabel = (value: string) => {
    const labels: Record<string, string> = {
      NEW: 'New',
      UPDATE: 'Update',
      CURRENT: 'Current',
      FACT: 'Fact',
      PLAYBOOK: 'Playbook',
      POLICY: 'Policy',
      FAQ: 'FAQ',
      GLOSSARY: 'Glossary',
      'INDEX DESCRIPTOR': 'Index descriptor',
      'MANAGED BY ELASTIC': 'Managed by Elastic',
      'ADDED BY YOU': 'Added by you',
    };
    if (labels[value]) return labels[value];
    const lower = value.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const ownershipLabel = (ownership: string) => {
    if (ownership === 'MANAGED BY ELASTIC') return 'Managed by Elastic';
    if (ownership === 'NEW') return 'New';
    return 'Added by you';
  };

  const producesLabel = (type: string) => `Produces: ${badgeLabel(type)}`;

  const clearAutomationTweakSuccess = (automationId: string) => {
    const existing = automationTweakSuccessTimers.current[automationId];
    if (existing) {
      window.clearTimeout(existing);
      delete automationTweakSuccessTimers.current[automationId];
    }
    setAutomationTweakSuccess((current) => {
      if (!current[automationId]) return current;
      const next = { ...current };
      delete next[automationId];
      return next;
    });
  };

  const showAutomationTweakSuccess = (automationId: string) => {
    clearAutomationTweakSuccess(automationId);
    setAutomationTweakSuccess((current) => ({
      ...current,
      [automationId]: '✓ Automation updated and rerun scheduled.',
    }));
    automationTweakSuccessTimers.current[automationId] = window.setTimeout(() => {
      clearAutomationTweakSuccess(automationId);
    }, 5000);
  };

  const renderActiveAutomation = (
    automation: Automation,
    namespace: Namespace,
    options?: { setupPreview?: boolean }
  ) => {
    const setupPreview = Boolean(options?.setupPreview);
    const sourceNames = automationSourceNames(automation, namespace);
    const primarySource = sourceNames[0] || proposalSourceName(automation, namespace.sources);
    const producedCount = indicatorsForAutomation(automation, namespace.indicators).length;
    const producedTypes = [
      ...new Set(
        (reviewSampleOverride ?? buildSetupSampleKis(namespace)).map((sample) => sample.type)
      ),
    ];
    const tweakSuccess = automationTweakSuccess[automation.id];
    const menuOpen = automationMenuOpenId === `${automation.id}${setupPreview ? ':setup' : ''}`;
    const menuId = `${automation.id}${setupPreview ? ':setup' : ''}`;
    const isDisabled = Boolean(disabledAutomationIds[automation.id]);
    const cardClass = [
      'contextEnginePrototype__automationCard',
      isDisabled ? 'contextEnginePrototype__automationCard--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const closeMenu = () => setAutomationMenuOpenId(null);
    const menuItems = [
      {
        name: 'Refine with agent',
        icon: AI_AGENT_ICON,
        onClick: () => {
          closeMenu();
          openAgentSidebar({
            kind: 'automation-edit',
            contextChip: `Automation · ${automation.title}`,
            attachmentDetail: [
              `id: ${namespace.name}`,
              `sources: ${namespace.sources.join(', ') || 'none'}`,
              `automation: ${automation.title}`,
            ].join('\n'),
            userMessage: 'Help me refine this automation. This is open-ended; we can go back and forth.',
            proposalText: `Update "${automation.title}" to tighten the extract scope for ${primarySource} and refresh on a daily schedule.`,
            onApply: () => {
              if (!activeNamespace) return;
              const nextDescription = `${automation.description} Adjusted via AI Agent: tighter extract scope and daily refresh.`;
              const updated: Namespace = {
                ...activeNamespace,
                automations: activeNamespace.automations.map((item) =>
                  item.id === automation.id ? { ...item, description: nextDescription } : item
                ),
              };
              setActiveNamespace(updated);
              setNamespaces((current) =>
                current.map((item) => (item.name === updated.name ? updated : item))
              );
              showAutomationTweakSuccess(automation.id);
            },
          });
        },
      },
      {
        name: setupPreview ? 'Edit automation' : 'Edit workflow',
        icon: 'editorCodeBlock',
        onClick: () => {
          closeMenu();
          openWorkflow(automation, {
            backLabel: setupPreview ? catalogDisplayName(namespace) : 'Back to automations',
          });
        },
      },
      ...(setupPreview
        ? []
        : [
            {
              name: 'Run now',
              icon: 'play',
              disabled: isDisabled,
              onClick: () => {
                closeMenu();
                coreStart.notifications.toasts.addSuccess('Run scheduled');
              },
            },
            {
              name: isDisabled ? 'Enable' : 'Disable',
              icon: isDisabled ? 'check' : 'stop',
              color: isDisabled ? 'text' : 'danger',
              onClick: () => {
                closeMenu();
                setDisabledAutomationIds((current) => ({
                  ...current,
                  [automation.id]: !current[automation.id],
                }));
              },
            },
          ]),
    ];

    return (
      <EuiPanel key={automation.id} hasBorder paddingSize="m" className={cardClass}>
        <EuiFlexGroup
          alignItems="flexStart"
          justifyContent="spaceBetween"
          gutterSize="m"
          responsive={false}
        >
          <EuiFlexItem>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  <strong>{automation.title}</strong>
                </EuiText>
              </EuiFlexItem>
              {isDisabled ? (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow">Disabled</EuiBadge>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiPopover
              ownFocus
              button={
                <EuiButtonEmpty
                  size="s"
                  iconType="arrowDown"
                  iconSide="right"
                  aria-label="Edit automation"
                  aria-expanded={menuOpen}
                  onClick={() => {
                    setAutomationMenuOpenId(menuOpen ? null : menuId);
                  }}
                >
                  <span className="contextEnginePrototype__addAutomationButtonLabel">
                    <EuiIcon type="pencil" size="s" />
                    Edit automation
                  </span>
                </EuiButtonEmpty>
              }
              isOpen={menuOpen}
              closePopover={closeMenu}
              panelPaddingSize="none"
              anchorPosition="downRight"
            >
              <EuiContextMenu initialPanelId={0} panels={[{ id: 0, items: menuItems }]} />
            </EuiPopover>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiText size="xs" color="subdued">
          {ownershipLabel(automation.ownership)}
          {' · Last run '}
          {setupPreview ? 'just now' : mockAutomationLastRun(automation.id)}
        </EuiText>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          {automation.description || proposalBenefitDescription(primarySource)}
        </EuiText>
        <EuiSpacer size="s" />
        <div className="contextEnginePrototype__relationshipLine">
          <span className="contextEnginePrototype__relationshipLabel">READS</span>
          {sourceNames.map((sourceName) => (
            <EuiBadge
              key={sourceName}
              color="hollow"
              className="contextEnginePrototype__relationshipChip"
            >
              {sourceName}
            </EuiBadge>
          ))}
          <EuiIcon type="arrowRight" size="s" color="subdued" aria-hidden={true} />
          <span className="contextEnginePrototype__relationshipLabel">PRODUCES</span>
          {setupPreview ? (
            producedTypes.map((type) => (
              <EuiBadge
                key={type}
                color="hollow"
                className="contextEnginePrototype__relationshipChip"
              >
                {type}
              </EuiBadge>
            ))
          ) : (
            <button
              type="button"
              className="contextEnginePrototype__relationshipChipButton"
              onClick={() => openKnowledgeTabFilteredByAutomation(automation.title)}
            >
              <EuiBadge
                color="hollow"
                className="contextEnginePrototype__relationshipChip"
              >
                {knowledgeIndicatorCountLabel(producedCount)}
              </EuiBadge>
            </button>
          )}
        </div>
        {tweakSuccess ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s" color="success" className="contextEnginePrototype__automationConfirm">
              {tweakSuccess}
            </EuiText>
          </>
        ) : null}
      </EuiPanel>
    );
  };

  const renderNamespace = () => {
    const namespace = activeNamespace || namespaces[0];
    const displayName = catalogDisplayName(namespace);
    const lifecycle = surfaceCatalogLifecycle(namespace);
    const setupPhase: SetupPhase =
      setupPhaseByIndex[namespace.name] ??
      (namespace.lifecycleStatus === 'settingUp'
        ? namespace.automations.length > 0 || namespace.indicators.length > 0
          ? 'preview'
          : 'running'
        : 'configure');
    const setupComplete = namespace.lifecycleStatus === 'ready';
    const inSetupMode =
      !setupComplete &&
      (namespace.lifecycleStatus === 'needsSetup' ||
        namespace.lifecycleStatus === 'settingUp' ||
        (!namespace.managed &&
          (setupPhase === 'suggesting' ||
            setupPhase === 'selectStrategies' ||
            setupPhase === 'generating' ||
            setupPhase === 'preview' ||
            setupPhase === 'testError' ||
            setupPhase === 'generateError' ||
            setupPhase === 'running')));
    const extractionStrategies = strategiesByIndex[namespace.name] ?? [];
    const selectedStrategyIds = selectedStrategyIdsByIndex[namespace.name] ?? [];
    const generatedAutomation =
      namespace.automations.find((item) => item.id === 'generated-workflow-1') ??
      (setupPhase === 'preview' || setupPhase === 'success' || setupPhase === 'testError'
        ? namespace.automations[namespace.automations.length - 1]
        : undefined);
    const showInferenceGate =
      !namespace.managed &&
      !hasInference &&
      (setupPhase === 'configure' ||
        setupPhase === 'suggesting' ||
        setupPhase === 'selectStrategies');
    const pendingSuggestions = namespace.suggestedAutomations.filter(
      ({ id }) => !addedAutomations.includes(id)
    );
    const proposedAutomations: Automation[] = inSetupMode
      ? namespace.managed
        ? MANAGED_SETUP_SOURCES.map((source, index) => ({
            id: `proposed-${source.id}`,
            title: `Extract Knowledge Indicators from ${source.sourceName}`,
            type: 'FACT' as const,
            ownership: 'NEW' as const,
            tags: [source.sourceName, 'Bottom-Up'],
            description: source.description,
            evidence: `Proposed · ${index + 1}`,
          }))
        : pendingSuggestions
      : [];
    const kiTotal = (() => {
      if (!inSetupMode) return knowledgeTotal(namespace.knowledge);
      if (
        setupPhase === 'generating' ||
        setupPhase === 'preview' ||
        setupPhase === 'review' ||
        setupPhase === 'testError' ||
        setupPhase === 'generateError' ||
        setupPhase === 'running'
      ) {
        return setupSuccessKiCount || SAMPLE_SETUP_KI_COUNT;
      }
      return 0;
    })();
    const setupSampleKis = reviewSampleOverride ?? buildSetupSampleKis(namespace);
    const reviewKiTotal = setupSuccessKiCount || SAMPLE_SETUP_KI_COUNT;
    // Tab badge = cards actually listed (enabled + visible drafts). Demo
    // suggestedAutomations that are not drafts stay off this tab and off the count.
    const visibleDraftCount = inSetupMode
      ? pendingSuggestions.length
      : pendingSuggestions.filter((automation) => automation.id.startsWith('draft-')).length;
    const listedAutomationCount =
      inSetupMode && namespace.managed
        ? proposedAutomations.length
        : namespace.automations.length + visibleDraftCount;
    const generationHasProduced =
      setupPhase === 'generating' ||
      setupPhase === 'preview' ||
      setupPhase === 'review' ||
      setupPhase === 'testError' ||
      setupPhase === 'generateError' ||
      setupPhase === 'running' ||
      setupSuccessKiCount > 0;
    const activeAutomationCount =
      !namespace.managed && (kiTotal > 0 || generationHasProduced)
        ? Math.max(listedAutomationCount, 1)
        : listedAutomationCount;
    const knowledgeCounts =
      inSetupMode && setupSuccessKiCount > 0
        ? knowledgeFromKiCount(setupSuccessKiCount)
        : namespace.knowledge;
    const knowledgeSummaryParts: Array<{
      type: KnowledgeIndicator['type'];
      label: string;
      count: number;
    }> = (
      [
        { type: 'PLAYBOOK' as const, label: 'Playbook', count: knowledgeCounts.playbooks },
        { type: 'POLICY' as const, label: 'Policy', count: knowledgeCounts.policies },
        { type: 'FAQ' as const, label: 'FAQ', count: knowledgeCounts.faqs },
        { type: 'GLOSSARY' as const, label: 'Glossary', count: knowledgeCounts.glossaries },
        { type: 'FACT' as const, label: 'Fact', count: knowledgeCounts.facts },
      ] as Array<{ type: KnowledgeIndicator['type']; label: string; count: number }>
    ).filter(({ count }) => count > 0);
    /** Tabs stay on every index detail state, including pre-generation. */
    const effectiveDetailTab: NamespaceDetailTab = namespaceDetailTab;

    const descriptionPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">
                Intent and description
              </h2>
            </EuiTitle>
          </div>
          <div className="contextEnginePrototype__sectionActions">
            {M3_GENERATE_DESCRIPTION_ENABLED ? (
              <EuiButtonEmpty
                size="s"
                iconType="sparkles"
                isLoading={isDefiningDescription}
                onClick={defineDescriptionWithChat}
              >
                Generate description
              </EuiButtonEmpty>
            ) : null}
            <EuiButtonEmpty size="s" iconType="pencil">
              Edit
            </EuiButtonEmpty>
          </div>
        </div>
        <div>
          <EuiText size="xs" color="subdued">
            <strong>Intent</strong>
          </EuiText>
          <EuiText size="s">{namespace.intent?.value ?? 'Not set yet.'}</EuiText>
        </div>
        <EuiSpacer size="m" />
        <div>
          <EuiText size="xs" color="subdued">
            <strong>Description</strong>
          </EuiText>
          <EuiText size="s" color={isDefiningDescription ? 'subdued' : undefined}>
            {isDefiningDescription
              ? "Generating a description from this namespace's sources, Knowledge Indicators, and automations..."
              : namespace.description}
          </EuiText>
        </div>
      </EuiPanel>
    );

    const tryQuestionPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <TryQuestionPanel
          tryQuestion={reviewTryQuestion}
          onTryQuestionChange={(value) => {
            setReviewTryQuestion(value);
            setReviewTryResult(null);
          }}
          onTryQuestion={() => {
            const question = reviewTryQuestion.trim();
            if (!question) return;
            setReviewTryResult(
              answerSetupTryQuestion(question, trySamplesFromIndicators(namespace.indicators))
            );
          }}
          tryResult={reviewTryResult}
        />
      </EuiPanel>
    );

    const sourcesPanel = (
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__detailSection"
        id="context-engine-8-sources"
      >
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">Sources</h2>
            </EuiTitle>
            <EuiText size="s" color="subdued">
              {namespace.managed
                ? 'Managed sources for this index. Elastic keeps these up to date.'
                : 'Data feeding this index. Add a source.'}
            </EuiText>
          </div>
          <div className="contextEnginePrototype__sectionActions">
            {namespace.managed ? (
              <EuiButtonEmpty
                size="s"
                iconType="eye"
                onClick={() => {
                  document
                    .getElementById('context-engine-8-sources')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                View sources
              </EuiButtonEmpty>
            ) : (
              <EuiButtonEmpty size="s" iconType="pencil" onClick={editSourcesFromNamespace}>
                Edit
              </EuiButtonEmpty>
            )}
          </div>
        </div>
        <div className="contextEnginePrototype__list">
          {namespace.sourceDetails.map((source) => (
            <div key={source.name} className="contextEnginePrototype__listRow">
              <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
                <EuiFlexItem grow={false}>
                  <EuiIcon type={source.icon} aria-hidden={true} />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiText size="s">
                    <strong>{source.name}</strong>
                  </EuiText>
                  <EuiText size="xs" color="subdued">
                    {source.typeLabel}
                    {source.subtitle ? ` · ${source.subtitle}` : ''}
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </div>
          ))}
        </div>
      </EuiPanel>
    );

    const pickerSources =
      namespace.sourceDetails.length > 0
        ? namespace.sourceDetails.map((detail) => ({
            id: detail.name,
            name: detail.name,
            description: detail.subtitle || detail.typeLabel,
            icon: detail.icon,
          }))
        : availableSources
            .filter((source) => {
              if (source.category === 'connectors' || source.category === 'esql') return true;
              return source.category === 'traces' && M3_AGENT_TRACES_ENABLED;
            })
            .map((source) => ({
              id: source.id,
              name: source.name,
              description: source.description,
              icon: source.icon,
            }));

    const automationsTabDrafts = inSetupMode
      ? pendingSuggestions
      : pendingSuggestions.filter((automation) => automation.id.startsWith('draft-'));

    const renderDraftProposalCard = (automation: Automation) => {
      const sourceName = proposalSourceName(automation, namespace.sources);
      const editorOpen = proposalEditorOpenId === automation.id;
      return (
        <EuiPanel
          key={automation.id}
          hasBorder
          paddingSize="m"
          className="contextEnginePrototype__setupProposalCard"
        >
          <EuiFlexGroup
            alignItems="flexStart"
            justifyContent="spaceBetween"
            gutterSize="m"
            responsive={false}
          >
            <EuiFlexItem grow={true}>
              <EuiText size="s">
                <strong>{automation.title}</strong>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Edit proposal">
                    <EuiButtonIcon
                      iconType="pencil"
                      size="s"
                      color="text"
                      aria-label="Edit proposal"
                      display={editorOpen ? 'base' : 'empty'}
                      onClick={() =>
                        setProposalEditorOpenId(editorOpen ? null : automation.id)
                      }
                    />
                  </EuiToolTip>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty
                    size="s"
                    color="text"
                    onClick={() =>
                      openAgentSidebar({
                        kind: 'automation-edit',
                        contextChip: `Automation · ${automation.title}`,
                        userMessage: `Help me edit the proposal "${automation.title}".`,
                      })
                    }
                  >
                    Edit automation
                  </EuiButtonEmpty>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    size="s"
                    iconType="plus"
                    onClick={() => {
                      setProposalEditorOpenId(null);
                      addSuggestedAutomation(automation);
                    }}
                  >
                    Approve
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiText size="s" color="subdued">
            {automation.description || proposalBenefitDescription(sourceName)}
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
            {(automationSourceNames(automation, namespace).length > 0
              ? automationSourceNames(automation, namespace)
              : [sourceName]
            ).map((name) => (
              <EuiFlexItem grow={false} key={name}>
                <EuiBadge color="hollow" className="contextEnginePrototype__setupProposalChip">
                  READS {name}
                </EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
          {editorOpen ? (
            <>
              <EuiSpacer size="s" />
              <AutomationTweakInput
                placeholder={proposalEditPlaceholder(sourceName)}
                buttonLabel="Update proposal"
                hint="Plain words, no YAML. Nothing runs until you approve."
                onSubmit={(text) => updateProposalWithPrompt(automation, text)}
                onContinueInAgent={(typedText) => {
                  setProposalEditorOpenId(null);
                  openAgentSidebar({
                    kind: 'continue',
                    contextChip: `Automation · ${automation.title}`,
                    userMessage:
                      typedText || `Help me edit the proposal "${automation.title}".`,
                    proposalText: `Update the proposal based on your notes.`,
                    onApply: () =>
                      updateProposalWithPrompt(
                        automation,
                        typedText || 'Tighten proposal scope before approve'
                      ),
                  });
                }}
              />
            </>
          ) : null}
        </EuiPanel>
      );
    };

    const addAutomationControl = (
            <EuiPopover
              ownFocus
              button={
                <EuiButton
                  size="s"
                  iconType="arrowDown"
                  iconSide="right"
                  aria-label="Add automation"
                  aria-expanded={addAutomationMenuOpen}
                  onClick={() => setAddAutomationMenuOpen((open) => !open)}
                >
                  Add automation
                </EuiButton>
              }
              isOpen={addAutomationMenuOpen}
              closePopover={() => setAddAutomationMenuOpen(false)}
              panelPaddingSize="none"
              anchorPosition="downRight"
            >
              <EuiContextMenu
                initialPanelId={0}
                panels={[
                  {
                    id: 0,
                    items: [
                      {
                        name: 'Create workflow',
                        icon: 'editorCodeBlock',
                        onClick: () => {
                          setAddAutomationMenuOpen(false);
                          setCreateWorkflowName('');
                          setCreateWorkflowSourceIds([]);
                          setCreateWorkflowModalOpen(true);
                        },
                      },
                      {
                        name: 'Use AI Agent',
                        icon: AI_AGENT_ICON,
                        onClick: () => {
                          setAddAutomationMenuOpen(false);
                          const firstSource =
                            namespace.sources[0] ||
                            namespace.sourceDetails[0]?.name ||
                            'your sources';
                          openAgentSidebar({
                            kind: 'suggest-automations',
                            contextChip: `AI index · ${displayName}`,
                            attachmentDetail: [
                              `id: ${namespace.name}`,
                              `sources: ${namespace.sources.join(', ') || 'none'}`,
                              `automations: ${
                                namespace.automations.map((item) => item.title).join(', ') ||
                                'none'
                              }`,
                            ].join('\n'),
                            userMessage: `Propose a new automation for the '${displayName}' AI index. Ask me what to extract and from where if you need more.`,
                            proposalText: `Add an extract automation for ${firstSource} on ${displayName}.`,
                            onApply: () => {
                              addDraftAutomation({
                                id: `draft-agent-${Date.now()}`,
                                title: `Extract Knowledge Indicators from ${firstSource}`,
                                type: 'FACT',
                                ownership: 'NEW',
                                tags: [firstSource, 'NEW'],
                                description: proposalBenefitDescription(firstSource),
                              });
                            },
                          });
                        },
                      },
                    ],
                  },
                ]}
              />
            </EuiPopover>
    );

    const automationsPanel = (
      <>
        <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h2 className="contextEnginePrototype__sectionTitle">Automations</h2>
                </EuiTitle>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{listedAutomationCount}</EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>
          </div>
          <div className="contextEnginePrototype__sectionActions">{addAutomationControl}</div>
        </div>
        {inSetupMode && namespace.managed ? (
          <div className="contextEnginePrototype__list">
            {proposedAutomations.length === 0 ? (
              <EuiText size="s" color="subdued">
                No proposed automations yet.
              </EuiText>
            ) : (
              proposedAutomations.map((automation) => (
                <div key={automation.id} className="contextEnginePrototype__listRow">
                  <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
                    <EuiFlexItem>
                      <EuiText size="s">
                        <strong>{automation.title}</strong>
                      </EuiText>
                      <EuiText size="xs" color="subdued">
                        {producesLabel(automation.type)}
                        {' · '}
                        {automation.description}
                      </EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="hollow">Proposed</EuiBadge>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
        {automationsTabDrafts.length > 0 && (
          <>
            <EuiText size="xs" color="subdued">
              <strong>Draft</strong>
            </EuiText>
            <div className="contextEnginePrototype__setupProposalList">
              {automationsTabDrafts.map((automation) => renderDraftProposalCard(automation))}
            </div>
            <EuiSpacer size="m" />
          </>
        )}

        <div className="contextEnginePrototype__activeAutomations">
              <div className="contextEnginePrototype__automationCardList">
            {namespace.automations.length === 0 ? (
              <EuiText size="s" color="subdued">
                {automationsTabDrafts.length > 0
                  ? 'No active automations yet. Approve a draft above to get started.'
                      : inSetupMode
                        ? 'No proposed automations yet.'
                  : 'No automations yet.'}
              </EuiText>
            ) : (
              namespace.automations.map((automation) =>
                renderActiveAutomation(automation, namespace)
              )
            )}
          </div>
        </div>
          </>
        )}
        </EuiPanel>
      {createWorkflowModalOpen ? (
        <EuiModal onClose={() => setCreateWorkflowModalOpen(false)} maxWidth={520}>
          <EuiModalHeader>
            <EuiModalHeaderTitle>Name this automation</EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EuiFormRow label="Name" fullWidth>
              <EuiFieldText
                fullWidth
                value={createWorkflowName}
                onChange={(event) => setCreateWorkflowName(event.target.value)}
                placeholder="e.g. Extract escalation owners"
                aria-label="Automation name"
              />
            </EuiFormRow>
            <EuiSpacer size="m" />
            <EuiText size="xs" color="subdued">
              <strong>Sources</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiFlexGroup direction="column" gutterSize="s">
              {pickerSources.map((source) => {
                const selected = createWorkflowSourceIds.includes(source.id);
                return (
                  <EuiFlexItem key={source.id}>
                    <EuiPanel
                      hasBorder
                      paddingSize="s"
                      color={selected ? 'primary' : 'plain'}
                      className={`contextEnginePrototype__sourceRow${
                        selected ? ' contextEnginePrototype__sourceRow--selected' : ''
                      }`}
                      onClick={() =>
                        setCreateWorkflowSourceIds((current) =>
                          current.includes(source.id)
                            ? current.filter((id) => id !== source.id)
                            : [...current, source.id]
                        )
                      }
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={`${selected ? 'Deselect' : 'Select'} ${source.name}`}
                    >
                      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                        <EuiFlexItem grow={false}>
                          <span className="contextEnginePrototype__sourceIcon">
                            <EuiIcon type={source.icon} aria-hidden={true} />
                          </span>
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EuiText size="s">
                            <strong>{source.name}</strong>
                          </EuiText>
                          <EuiText size="xs" color="subdued">
                            {source.description}
                          </EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <span
                            className={`contextEnginePrototype__sourceCheck${
                              selected ? ' contextEnginePrototype__sourceCheck--selected' : ''
                            }`}
                            aria-hidden={true}
                          >
                            {selected ? <EuiIcon type="check" size="s" /> : null}
                          </span>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiPanel>
                  </EuiFlexItem>
                );
              })}
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiText size="xs" color="subdued">
              The generated automation is not locked to these sources. You or the agent can edit it
              to pull from elsewhere.
            </EuiText>
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButtonEmpty onClick={() => setCreateWorkflowModalOpen(false)}>
              Cancel
            </EuiButtonEmpty>
            <EuiButton
              fill
              disabled={!createWorkflowName.trim() || createWorkflowSourceIds.length === 0}
              onClick={() => {
                const selectedNames = pickerSources
                  .filter((source) => createWorkflowSourceIds.includes(source.id))
                  .map((source) => source.name);
                setCreateWorkflowModalOpen(false);
                openWorkflow(createWorkflowName.trim(), {
                  backLabel: 'Back to automations',
                  sourceNames: selectedNames,
                  createDraft: true,
                });
              }}
            >
              Continue
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      ) : null}
      </>
    );

    const tabKnowledgeIndicators = (() => {
      let list =
        kiTotal > 0 && namespace.indicators.length === 0
          ? buildSetupIndicators(namespace, kiTotal)
          : namespace.indicators;
      if (kiAutomationFilter) {
        list = list.filter((indicator) => {
          const automation = namespace.automations.find(
            (item) => item.title === kiAutomationFilter
          );
          if (!automation) {
            return indicator.extractedBy === kiAutomationFilter;
          }
          return indicatorMatchesAutomation(indicator, automation);
        });
      }
      if (kiTabTypeFilter) {
        list = list.filter((indicator) => indicator.type === kiTabTypeFilter);
      }
      return list;
    })();
    const activeTypeFilterCount = kiTabTypeFilter
      ? knowledgeSummaryParts.find((part) => part.type === kiTabTypeFilter)?.count ?? 0
      : 0;

    const kiTabSearch = kiSearchQuery.trim().toLowerCase();
    const kiTabList = tabKnowledgeIndicators.filter((indicator) => {
      if (!kiTabSearch) return true;
      const haystack = [
        indicator.title,
        indicator.description,
        indicator.category,
        indicator.type,
        ...indicator.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(kiTabSearch);
    });
    const flyoutIndicator =
      (kiFlyoutIndicatorId
        ? tabKnowledgeIndicators.find((item) => item.id === kiFlyoutIndicatorId) ||
          namespace.indicators.find((item) => item.id === kiFlyoutIndicatorId)
        : null) || null;
    const flyoutViewedVersion = selectedKiVersion ?? flyoutIndicator?.currentVersion ?? 1;
    const flyoutValueBlock = flyoutIndicator ? valueBlockFor(flyoutIndicator) : null;
    const flyoutMetaTags = flyoutIndicator ? operationalTagsFor(flyoutIndicator) : [];

    const typePill = (
      type: KnowledgeIndicator['type'] | null,
      label: string,
      count: number
    ) => (
      <button
        type="button"
        key={label}
        className={`contextEnginePrototype__kiTypePill${
          kiTabTypeFilter === type ? ' contextEnginePrototype__kiTypePill--active' : ''
        }`}
        onClick={() => setKiTabTypeFilter(type)}
      >
        {label} ({count})
      </button>
    );

    const knowledgePanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h2 className="contextEnginePrototype__sectionTitle">Knowledge Indicators</h2>
                </EuiTitle>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{kiTotal}</EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiText size="s" color="subdued">
              in{' '}
              <EuiBadge color="hollow" className="contextEnginePrototype__mono">
                {namespace.indexName}
              </EuiBadge>
            </EuiText>
          </div>
          <div className="contextEnginePrototype__sectionActions">
            <EuiLink
              color="subdued"
              onClick={(event) => {
                event.preventDefault();
                coreStart.notifications.toasts.addInfo(
                  'Discover opened (mock) for raw docs behind this index.'
                );
              }}
            >
              View all {kiTotal} in Discover ›
            </EuiLink>
          </div>
        </div>

        {kiAutomationFilter && (
          <>
            <EuiSpacer size="m" />
            <EuiPanel
              color="primary"
              paddingSize="s"
              hasBorder
              className="contextEnginePrototype__kiFilterBar"
              data-test-subj="contextEngineKiAutomationFilter"
            >
              <EuiFlexGroup
                alignItems="center"
                justifyContent="spaceBetween"
                gutterSize="m"
                responsive={false}
                wrap
              >
                <EuiFlexItem>
                  <EuiText size="s">
                    Produced by {kiAutomationFilter}
                    {` · ${knowledgeIndicatorCountLabel(tabKnowledgeIndicators.length)}`}
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty size="xs" flush="both" onClick={() => setKiAutomationFilter(null)}>
                    ✕ Clear filter
                  </EuiButtonEmpty>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          </>
        )}

        {kiTotal === 0 ? (
          <EuiText size="s" color="subdued">
            No knowledge yet. Complete setup to run the first extraction.
          </EuiText>
        ) : (
          <>
            <EuiFieldSearch
              placeholder="Search Knowledge Indicators"
              value={kiSearchQuery}
              onChange={(event) => setKiSearchQuery(event.target.value)}
              isClearable
              fullWidth
              compressed
              aria-label="Search Knowledge Indicators"
            />
            <div className="contextEnginePrototype__kiTypePills">
              {typePill(null, 'All', kiTotal)}
              {knowledgeSummaryParts.map((part) =>
                typePill(
                  part.type,
                  part.label.charAt(0).toUpperCase() + part.label.slice(1),
                  part.count
                )
              )}
            </div>
            <div className="contextEnginePrototype__kiTabList">
              {kiTabList.length === 0 ? (
            <EuiText size="s" color="subdued">
              No Knowledge Indicators match this filter.
            </EuiText>
          ) : (
                kiTabList.map((indicator) => (
                  <button
                    key={indicator.id}
                    type="button"
                    className="contextEnginePrototype__kiTabListRow"
                    onClick={() => openKiDetailFlyout(indicator)}
                  >
                    <EuiFlexGroup
                      alignItems="flexStart"
                      gutterSize="s"
                      responsive={false}
                      justifyContent="spaceBetween"
                    >
                      <EuiFlexItem>
                  <EuiText size="s">
                    <strong>{indicator.title}</strong>
                  </EuiText>
                  <EuiText size="xs" color="subdued">
                    {badgeLabel(indicator.type)} · {indicator.category}
                  </EuiText>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiBadge color="hollow">v{indicator.currentVersion}</EuiBadge>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    </button>
                ))
              )}
            </div>
          </>
        )}

        {flyoutIndicator && flyoutValueBlock ? (
          <EuiFlyout
            ownFocus
            size="m"
            onClose={closeKiDetailFlyout}
            aria-labelledby="context-engine-8-ki-flyout-title"
          >
            <EuiFlyoutHeader hasBorder>
              <EuiTitle size="s">
                <h2 id="context-engine-8-ki-flyout-title">{flyoutIndicator.title}</h2>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiFlexGroup gutterSize="xs" responsive={false} wrap alignItems="center">
                <EuiFlexItem grow={false}>
                  <EuiBadge color={typeBadgeColor(flyoutIndicator.type)}>
                    {badgeLabel(flyoutIndicator.type)}
                      </EuiBadge>
                </EuiFlexItem>
                {flyoutMetaTags.map((tag) => (
                  <EuiFlexItem grow={false} key={tag}>
                    <EuiBadge color="hollow">{badgeLabel(tag)}</EuiBadge>
                  </EuiFlexItem>
                ))}
              </EuiFlexGroup>
            </EuiFlyoutHeader>
            <EuiFlyoutBody>
              <div className="contextEnginePrototype__kiVersionRow">
                <EuiFlexGroup responsive={false} gutterSize="xs" alignItems="center" wrap>
                  {[...flyoutIndicator.versions]
                    .sort((a, b) => b.version - a.version)
                    .map((version) => {
                      const isSelected = version.version === flyoutViewedVersion;
                      const isCurrent = version.version === flyoutIndicator.currentVersion;
                      return (
                        <EuiFlexItem grow={false} key={version.version}>
                          <EuiButtonEmpty
                            size="xs"
                            flush="both"
                            color={isSelected ? 'primary' : 'text'}
                            onClick={() => setSelectedKiVersion(version.version)}
                          >
                            v{version.version}
                            {isCurrent ? ' · current' : ''}
                          </EuiButtonEmpty>
                        </EuiFlexItem>
                      );
                    })}
                </EuiFlexGroup>
                <EuiText size="xs" color="subdued">
                  Editing creates a new version; agents always retrieve the current version.
                </EuiText>
                  </div>
              <EuiSpacer size="m" />
              <EuiPanel paddingSize="m" color="subdued" hasBorder={false}>
                <EuiText size="xs" color="subdued">
                  <strong>{flyoutValueBlock.heading.toUpperCase()}</strong>
                </EuiText>
                <EuiSpacer size="xs" />
                {flyoutValueBlock.items ? (
                  <ol className="contextEnginePrototype__kiValueList">
                    {flyoutValueBlock.items.map((item) => (
                      <li key={item}>
                        <EuiText size="s">{item}</EuiText>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EuiText size="s" style={{ whiteSpace: 'pre-wrap' }}>
                    {flyoutValueBlock.text}
                  </EuiText>
                )}
              </EuiPanel>
              <EuiSpacer size="m" />
              <EuiText size="xs" color="subdued">
                <strong>DESCRIPTION</strong>
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiText size="s" color="subdued">
                {flyoutIndicator.description}
              </EuiText>
              <EuiSpacer size="m" />
              <div className="contextEnginePrototype__kiProvenance">
                <EuiText size="xs" color="subdued">
                  Extracted by <strong>{flyoutIndicator.extractedBy}</strong>
                  {' · '}
                  from <strong>{flyoutIndicator.category}</strong>
                </EuiText>
                <EuiText size="xs" color="subdued">
                  Used by: <strong>{flyoutIndicator.usedBy}</strong>
                </EuiText>
                <EuiText size="xs" color="subdued">
                  {flyoutIndicator.confidence}% confidence
                  {' · '}
                  Evidence: {flyoutIndicator.evidenceCount} docs
                </EuiText>
                <EuiText size="xs" color="subdued">
                  {flyoutIndicator.access}
                </EuiText>
                </div>
              <EuiSpacer size="m" />
              <EuiButton
                size="s"
                iconType="pencil"
                onClick={() => editKnowledgeIndicator(flyoutIndicator)}
              >
                ✎ Edit (creates v{flyoutIndicator.currentVersion + 1})
              </EuiButton>
              <EuiSpacer size="l" />
              <EuiText size="xs" color="subdued">
                <strong>VERSION HISTORY</strong>
              </EuiText>
              <EuiSpacer size="s" />
              <div className="contextEnginePrototype__kiHistoryList">
                {[...flyoutIndicator.versions]
                  .sort((a, b) => b.version - a.version)
                  .map((version) => {
                    const isCurrent = version.version === flyoutIndicator.currentVersion;
                    return (
                      <button
                        key={version.version}
                        type="button"
                        className={`contextEnginePrototype__kiHistoryItem${
                          isCurrent ? ' contextEnginePrototype__kiHistoryItem--current' : ''
                        }`}
                        onClick={() =>
                          setKnowledgeIndicatorCurrentVersion(flyoutIndicator, version.version)
                        }
                      >
                        <span className="contextEnginePrototype__kiHistoryVersion">
                          v{version.version}
                        </span>
                        <span className="contextEnginePrototype__kiHistoryMeta">
                          <strong>{version.summary}</strong>
                          <span>
                            {version.source} · {version.when}
                          </span>
                        </span>
                        {isCurrent ? (
                          <EuiBadge color="success">Current</EuiBadge>
                        ) : (
                          <span className="contextEnginePrototype__kiHistoryAction">Set current</span>
                        )}
                      </button>
                    );
                  })}
        </div>
            </EuiFlyoutBody>
            <EuiFlyoutFooter>
              <EuiButtonEmpty onClick={closeKiDetailFlyout}>Close</EuiButtonEmpty>
            </EuiFlyoutFooter>
          </EuiFlyout>
        ) : null}
      </EuiPanel>
    );

    const howItWorksCallout = howItWorksVisible ? (
      <EuiPanel
        hasBorder
        paddingSize="m"
        className="contextEnginePrototype__howItWorks"
        data-test-subj="contextEngineHowItWorks"
      >
        <EuiFlexGroup
          alignItems="center"
          justifyContent="spaceBetween"
          gutterSize="s"
          responsive={false}
        >
          <EuiFlexItem>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">How this index works</h2>
            </EuiTitle>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonIcon
              iconType="cross"
              color="text"
              aria-label="Dismiss how this index works"
              onClick={dismissHowItWorks}
              data-test-subj="contextEngineHowItWorksDismiss"
            />
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="s" />
        <div className="contextEnginePrototype__howItWorksFlow" aria-hidden={true}>
          <div className="contextEnginePrototype__howItWorksBox contextEnginePrototype__howItWorksBox--source">
            <strong>Sources</strong>
            <span>Your data</span>
          </div>
          <div className="contextEnginePrototype__howItWorksArrow">
            <span>read by</span>
            <EuiIcon type="arrowRight" size="s" />
          </div>
          <div className="contextEnginePrototype__howItWorksBox contextEnginePrototype__howItWorksBox--automation">
            <strong>Automations</strong>
            <span>Extract knowledge</span>
          </div>
          <div className="contextEnginePrototype__howItWorksArrow">
            <span>produce</span>
            <EuiIcon type="arrowRight" size="s" />
          </div>
          <div className="contextEnginePrototype__howItWorksBox contextEnginePrototype__howItWorksBox--ki">
            <strong>Knowledge Indicators</strong>
            <span>What agents retrieve</span>
          </div>
        </div>
        <EuiSpacer size="s" />
        <EuiText size="xs" color="subdued" className="contextEnginePrototype__howItWorksCopy">
          Agents retrieve Knowledge Indicators, not raw data. Each indicator shows the automation
          and sources it came from.
        </EuiText>
      </EuiPanel>
    ) : null;

    const tracesAnalysed = namespace.monitoring.traceCount ?? 0;
    const isMatureOverview = tracesAnalysed > 0;
    const efficiency = namespace.monitoring.efficiency;
    const indexSignals =
      tracesAnalysed > 0 ? signalsForNamespace(namespace.name, namespace.sources) : [];
    const signalCounts = signalCountsByType(indexSignals);
    const signalDistinct = signalDistinctByType(indexSignals);
    const signalOccurrenceTotal = totalSignalOccurrences(indexSignals);
    const improvementsAnalysed =
      improvementsAnalysedByIndex[namespace.name] ??
      !namespaceStartsUnanalysed(namespace.name, namespace.userCreated);
    const isAnalysingThisIndex = analysingIndexName === namespace.name;
    const catalogImprovements = withImprovementActions(improvementsForNamespace(namespace), {
      signals: indexSignals,
    });
    const namespaceImprovements =
      tracesAnalysed > 0 && improvementsAnalysed ? catalogImprovements : [];
    const improvementStatus = (id: string): ImprovementStatus =>
      improvementStatusById[id] ?? 'open';
    const improvementGroup = (id: string): ImprovementGroup => {
      if (improvementPendingById[id]) return 'open';
      const status = improvementStatus(id);
      if (status === 'applied' || status === 'dismissed') return status;
      return 'open';
    };
    const openImprovements = namespaceImprovements
      .filter((item) => improvementGroup(item.id) === 'open')
      .sort((a, b) => lastSeenRank(a.lastSeen) - lastSeenRank(b.lastSeen));
    const appliedImprovements = namespaceImprovements
      .filter((item) => improvementGroup(item.id) === 'applied')
      .sort(
        (a, b) => (improvementAppliedAtById[b.id] ?? 0) - (improvementAppliedAtById[a.id] ?? 0)
      );
    const dismissedImprovements = namespaceImprovements
      .filter((item) => improvementGroup(item.id) === 'dismissed')
      .sort(
        (a, b) =>
          (improvementDismissedAtById[b.id] ?? 0) - (improvementDismissedAtById[a.id] ?? 0)
      );
    const openImprovementsCount = openImprovements.length;
    const anotherGroupExpanded = appliedGroupOpen || dismissedGroupOpen;
    const evidenceImprovement =
      namespaceImprovements.find((item) => item.id === evidenceImprovementId) ?? null;
    const improvementFixText = (item: OverviewImprovement) =>
      improvementFixById[item.id] ?? item.proposedFix;
    const evidenceSignals = evidenceImprovement
      ? indexSignals.filter((signal) =>
          (evidenceImprovement.signalIds ?? []).includes(signal.id)
        )
      : [];
    const filteredSignals =
      signalFilter.mode === 'type'
        ? indexSignals.filter((signal) => signal.type === signalFilter.type)
        : signalFilter.mode === 'ids'
          ? signalsByIds(indexSignals, signalFilter.ids)
          : indexSignals;

    const focusSignals = (ids: string[]) => {
      setSignalFilter({ mode: 'ids', ids });
      setHighlightedSignalIds(ids);
      setHighlightedImprovementId(null);
      window.requestAnimationFrame(() => {
        document
          .getElementById('context-engine-8-signals')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    const focusImprovement = (id: string) => {
      setHighlightedImprovementId(id);
      window.requestAnimationFrame(() => {
        document
          .getElementById(`context-engine-8-improvement-${id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };

    const toggleTypeFilter = (type: SignalInternalType) => {
      setHighlightedImprovementId(null);
      setHighlightedSignalIds([]);
      setSignalFilter((current) => {
        if (current.mode === 'type' && current.type === type) {
          return { mode: 'all' };
        }
        return { mode: 'type', type };
      });
    };

    const improvementForSignal = (signalId: string) =>
      namespaceImprovements.find((item) => (item.signalIds ?? []).includes(signalId)) ?? null;

    const signalWindowLabel =
      signalWindow === '30d' ? '30 days' : signalWindow === 'lastN' ? `${signalWindowN} signals` : '7 days';
    const selectedSignalTrace =
      MONITORING_TRACES.find((trace) => trace.id === selectedSignalTraceId) ??
      MONITORING_TRACES[0];
    const openReviewItems = namespaceImprovements.filter(
      (item) => improvementStatus(item.id) === 'open' && !improvementPendingById[item.id]
    );
    const reviewSelectedCount = reviewSelectedIds.filter((id) =>
      openReviewItems.some((item) => item.id === id)
    ).length;

    const settleImprovement = (id: string) => {
      window.setTimeout(() => {
        setImprovementDepartingIds((current) =>
          current.includes(id) ? current : [...current, id]
        );
      }, 1200);
      window.setTimeout(() => {
        setImprovementPendingById((current) => {
          if (!current[id]) return current;
          const next = { ...current };
          delete next[id];
          return next;
        });
        setImprovementDepartingIds((current) => current.filter((item) => item !== id));
      }, 1500);
    };

    const approveImprovement = (id: string) => {
      if (improvementStatus(id) !== 'open' || improvementPendingById[id]) return;
      const catalogIndex = catalogImprovements.findIndex((item) => item.id === id);
      const willDrop = catalogIndex % 2 === 0;
      setImprovementStatusById((current) => ({ ...current, [id]: 'applied' }));
      setImprovementPendingById((current) => ({ ...current, [id]: 'applied' }));
      setImprovementAppliedAtById((current) => ({ ...current, [id]: Date.now() }));
      setImprovementOutcomeById((current) => ({ ...current, [id]: 'measuring' }));
      settleImprovement(id);
      window.setTimeout(() => {
        setImprovementOutcomeById((current) => {
          if (current[id] !== 'measuring') return current;
          return { ...current, [id]: willDrop ? 'improved' : 'unchanged' };
        });
      }, 4000);
    };

    const applyReviewedImprovements = () => {
      const ids = reviewSelectedIds.filter((id) =>
        openReviewItems.some((item) => item.id === id)
      );
      if (ids.length === 0) return;
      setReviewAllOpen(false);
      ids.forEach((id) => approveImprovement(id));
    };

    const openReviewAll = () => {
      const prechecked = openReviewItems
        .filter((item) => !(item.changes ?? []).some((change) => change.destructive))
        .map((item) => item.id);
      setReviewSelectedIds(prechecked);
      setReviewAllOpen(true);
    };

    const analyseSignals = () => {
      if (isAnalysingThisIndex) return;
      setAnalysingIndexName(namespace.name);
      window.setTimeout(() => {
        setImprovementsAnalysedByIndex((current) => ({ ...current, [namespace.name]: true }));
        setAnalysingIndexName(null);
      }, 2400);
    };

    const dismissImprovement = (id: string) => {
      if (improvementStatus(id) !== 'open' || improvementPendingById[id]) return;
      setImprovementStatusById((current) => ({ ...current, [id]: 'dismissed' }));
      setImprovementPendingById((current) => ({ ...current, [id]: 'dismissed' }));
      setImprovementDismissedAtById((current) => ({ ...current, [id]: Date.now() }));
      settleImprovement(id);
    };

    const undoDismissImprovement = (id: string) => {
      if (improvementStatus(id) !== 'dismissed') return;
      setImprovementStatusById((current) => ({ ...current, [id]: 'open' }));
      setImprovementPendingById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setImprovementDepartingIds((current) => current.filter((item) => item !== id));
      setImprovementDismissedAtById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    };

    const proposeAnotherFix = (id: string) => {
      setImprovementStatusById((current) => ({ ...current, [id]: 'open' }));
      setImprovementPendingById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setImprovementOutcomeById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setImprovementAppliedAtById((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    };

    const openUseInAgent = () => {
      setAgentHarness('claudeCode');
      setApiKeyRevealed(false);
      setAgentNotice(null);
      setScreen('agent');
    };

    const lastAutomation = namespace.automations[0];
    const lastSuccessfulRun = namespace.monitoring.lastSuccessfulRun;
    const overviewKiTotal = knowledgeTotal(namespace.knowledge);
    const kiTypeBreakdown = knowledgeSummaryParts
      .map((part) => {
        if (part.count === 1) return `1 ${part.label}`;
        if (part.type === 'POLICY') return `${part.count} Policies`;
        if (part.type === 'GLOSSARY') return `${part.count} Glossaries`;
        if (part.type === 'FAQ') return `${part.count} FAQs`;
        return `${part.count} ${part.label}s`;
      })
      .join(', ');
    const compositionLine =
      overviewKiTotal > 0
        ? `${knowledgeIndicatorCountLabel(overviewKiTotal)}${
            kiTypeBreakdown ? ` · ${kiTypeBreakdown}` : ''
          }`
        : 'No Knowledge Indicators yet.';
    const lastRunLine = lastAutomation
      ? lastSuccessfulRun
        ? `Last successful automation run: ${lastAutomation.title} · ${lastSuccessfulRun.when} · ${lastSuccessfulRun.failureRate} failure rate`
        : `Last successful automation run: ${lastAutomation.title} · just now`
      : 'No automations have run yet.';
    const neverSurfacedCount = efficiency?.neverSurfaced;
    const hasAgentUsage =
      tracesAnalysed > 0 &&
      Boolean(efficiency) &&
      neverSurfacedCount !== undefined;

    const overviewStatCell = (
      title: string,
      description: string,
      titleColor?: React.ComponentProps<typeof EuiStat>['titleColor']
    ) => (
      <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
        <EuiStat
          title={title}
          description={description}
          titleSize="m"
          textAlign="left"
          titleColor={titleColor}
        />
      </EuiFlexItem>
    );

    const overviewUsagePanel = (
      <EuiPanel
        hasBorder
        paddingSize="m"
        className="contextEnginePrototype__detailSection"
        id="context-engine-8-overview-monitoring"
        data-test-subj="contextEngineOverviewUsage"
      >
        <div>
          <EuiText size="s">{compositionLine}</EuiText>
          <EuiText size="s" color="subdued">
            {lastRunLine}
          </EuiText>
        </div>
        <div>
          <EuiTitle size="xs">
            <h2 className="contextEnginePrototype__sectionTitle">Agent usage</h2>
          </EuiTitle>
          {hasAgentUsage && efficiency && neverSurfacedCount !== undefined ? (
            <EuiText size="s">
              {`From ${tracesAnalysed.toLocaleString()} agent traces in the last 7 days.`}
            </EuiText>
          ) : (
            <EuiText size="s">
              No data yet. Retrieval stats appear once agents start retrieving from this index.
            </EuiText>
          )}
        </div>
        {hasAgentUsage && efficiency && neverSurfacedCount !== undefined ? (
          <EuiFlexGroup
            gutterSize="none"
            responsive={false}
            className="contextEnginePrototype__overviewStats"
          >
            {overviewStatCell(
              `${efficiency.retrievalHitRate}%`,
              'Retrieval hit rate',
              'success'
            )}
            {overviewStatCell(String(neverSurfacedCount), 'KIs never surfaced')}
            {overviewStatCell(`${efficiency.tokensSavedPct}%`, 'Tokens saved', 'success')}
            {overviewStatCell(`${efficiency.medianLatencyMs}ms`, 'Median latency')}
          </EuiFlexGroup>
        ) : null}
      </EuiPanel>
    );

    const analyseAction = (
      <EuiFlexGroup
        direction="column"
        alignItems="flexEnd"
        gutterSize="xs"
        responsive={false}
      >
        <EuiFlexItem grow={false}>
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButton size="s" onClick={() => setConfigureFlyoutOpen(true)}>
                Configure
              </EuiButton>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                fill
                size="s"
                isLoading={isAnalysingThisIndex}
                disabled={
                  isAnalysingThisIndex || tracesAnalysed === 0 || indexSignals.length === 0
                }
                onClick={analyseSignals}
                data-test-subj="contextEngineAnalyzeSignals"
              >
                Analyze and propose fixes
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">
            {tracesAnalysed === 0
              ? 'Nothing to analyze until agents start retrieving from this index.'
              : indexSignals.length === 0
                ? `No signals to analyze in the last ${signalWindowLabel}.`
                : 'Runs an agent over your signals. Takes a few minutes.'}
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
    );

    const signalResultFor = (item: IndexSignal) => {
      if (!improvementsAnalysed) return { kind: 'pending' as const };
      const linked = improvementForSignal(item.id);
      if (linked) return { kind: 'improvement' as const, improvement: linked };
      if (item.analyzed === false) return { kind: 'pending' as const };
      return { kind: 'none' as const };
    };

    const signalTableColumns: Array<EuiBasicTableColumn<IndexSignal>> = [
      {
        field: 'label',
        name: 'Signal',
        render: (_label: string, item: IndexSignal) => (
          <>
            <EuiText size="s">{item.label}</EuiText>
            <EuiText size="xs" className="contextEnginePrototype__signalInternal">
              {item.type}
            </EuiText>
          </>
        ),
      },
      {
        field: 'whatHappened',
        name: 'What happened',
        truncateText: true,
      },
      {
        field: 'occurrences',
        name: 'Occurrences',
        width: '130px',
      },
      {
        field: 'lastSeen',
        name: 'Last seen',
        width: '140px',
      },
      {
        name: 'Result',
        render: (item: IndexSignal) => {
          const result = signalResultFor(item);
          if (result.kind === 'improvement') {
            return (
              <EuiLink
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  focusImprovement(result.improvement.id);
                }}
              >
                {result.improvement.title}
              </EuiLink>
            );
          }
          return (
            <EuiText size="s" color="subdued">
              {result.kind === 'pending' ? 'Not yet analyzed' : 'No fix proposed'}
            </EuiText>
          );
        },
      },
      {
        name: '',
        width: '36px',
        align: 'right',
        render: () => (
          <EuiIcon
            type="arrowRight"
            size="s"
            color="subdued"
            className="contextEnginePrototype__signalRowChevron"
          />
        ),
      },
    ];

    const signalsColdStart = tracesAnalysed === 0;
    const signalsEmptyDetected = tracesAnalysed > 0 && indexSignals.length === 0;

    const signalsPanel = (
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__detailSection"
        id="context-engine-8-signals"
        data-test-subj="contextEngineSignals"
      >
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h2 className="contextEnginePrototype__sectionTitle">Signals</h2>
                </EuiTitle>
              </EuiFlexItem>
              {!signalsColdStart && !signalsEmptyDetected ? (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow">{indexSignals.length}</EuiBadge>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
            {signalsColdStart ? null : signalsEmptyDetected ? (
              <EuiText size="s">
                {`No issues detected in the last ${signalWindowLabel}.`}
              </EuiText>
            ) : (
              <EuiText size="xs" color="subdued">
                {`${indexSignals.length} distinct signal${
                  indexSignals.length === 1 ? '' : 's'
                } across ${signalOccurrenceTotal} occurrence${
                  signalOccurrenceTotal === 1 ? '' : 's'
                }, detected from your agents' traces and updated hourly.`}
              </EuiText>
            )}
          </div>
          <div className="contextEnginePrototype__sectionActions">{analyseAction}</div>
        </div>
        {signalsColdStart ? (
          <EuiText size="s">
            No signals yet. Signals appear once agents start using this index and traces come in.
          </EuiText>
        ) : signalsEmptyDetected ? null : (
          <>
            <div className="contextEnginePrototype__signalStrip">
              {(
                [
                  'esql_error',
                  'esql_zero_results',
                  'coverage_gap',
                ] as SignalInternalType[]
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`contextEnginePrototype__signalStripItem${
                    signalFilter.mode === 'type' && signalFilter.type === type
                      ? ' contextEnginePrototype__signalStripItem--selected'
                      : ''
                  }`}
                  onClick={() => toggleTypeFilter(type)}
                >
                  <EuiText size="s">
                    <strong>
                      {`${SIGNAL_TYPE_META[type].strip} · ${signalDistinct[type]} signal${
                        signalDistinct[type] === 1 ? '' : 's'
                      } · ${signalCounts[type]} occurrence${
                        signalCounts[type] === 1 ? '' : 's'
                      }`}
                    </strong>
                  </EuiText>
                </button>
              ))}
            </div>
            {signalFilter.mode !== 'all' ? (
              <>
                <EuiSpacer size="s" />
                <EuiText size="xs" color="subdued">
                  {`Showing ${filteredSignals.length} of ${indexSignals.length} signals`}
                </EuiText>
              </>
            ) : null}
            <EuiSpacer size="m" />
            <EuiBasicTable
              items={filteredSignals}
              columns={signalTableColumns}
              rowProps={(item) => ({
                className: `contextEnginePrototype__signalTableRow${
                  highlightedSignalIds.includes(item.id)
                    ? ' contextEnginePrototype__signalTableRow--highlight'
                    : ''
                }`,
                onClick: () => setSelectedSignalTraceId(item.traceId),
              })}
              noItemsMessage="No signals match this filter."
            />
          </>
        )}
      </EuiPanel>
    );

    const measuredOutcome = (item: OverviewImprovement) => {
      const linkedType =
        (item.signalIds ?? [])
          .map((id) => indexSignals.find((signal) => signal.id === id))
          .find((signal): signal is IndexSignal => Boolean(signal))?.type ?? 'esql_error';
      const before = signalCounts[linkedType];
      const after = Math.max(1, Math.round(before * 0.14));
      return {
        strip: SIGNAL_TYPE_META[linkedType].strip,
        source: sourceNamedInFix(improvementFixText(item)),
        before,
        after,
      };
    };

    const renderAppliedOutcome = (item: OverviewImprovement) => {
      const outcome = improvementOutcomeById[item.id] ?? 'measuring';
      const appliedAt = improvementAppliedAtById[item.id];
      const relative = appliedAt ? formatAppliedAgo(appliedAt) : 'just now';
      if (outcome === 'measuring') {
        return (
          <EuiText
            size="s"
            color="subdued"
            className="contextEnginePrototype__improvementOutcome contextEnginePrototype__improvementOutcome--measuring"
          >
            Applied {relative} · measuring effect
          </EuiText>
        );
      }
      const measured = measuredOutcome(item);
      if (outcome === 'improved') {
        return (
          <EuiText
            size="s"
            color="success"
            className="contextEnginePrototype__improvementOutcome contextEnginePrototype__improvementOutcome--improved"
          >
            <strong>
              {measured.strip} on {measured.source} down from {measured.before} to {measured.after}{' '}
              since applied
            </strong>
          </EuiText>
        );
      }
      return (
        <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
          <EuiFlexItem grow={false}>
            <EuiText
              size="s"
              className="contextEnginePrototype__improvementOutcome contextEnginePrototype__improvementOutcome--unchanged"
            >
              {measured.strip} on {measured.source} unchanged since applied
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty size="xs" flush="both" onClick={() => proposeAnotherFix(item.id)}>
              Propose another fix
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
      );
    };

    const renderImprovementCard = (item: OverviewImprovement, group: ImprovementGroup) => {
      const status = improvementStatus(item.id);
      const pending = improvementPendingById[item.id];
      const fixText = improvementFixText(item);
      const showDismissed = group === 'dismissed' || pending === 'dismissed';
      const showApplied = group === 'applied' || pending === 'applied';
      const showActions = group === 'open' && status === 'open' && !pending;
      const sourceSignals = signalsByIds(indexSignals, item.signalIds ?? []);
      const sourceLine = formatSignalSourceLine(sourceSignals);
      const cardClass = [
        'contextEnginePrototype__improvementCard',
        showApplied && improvementOutcomeById[item.id] === 'improved'
          ? 'contextEnginePrototype__improvementCard--applied'
          : '',
        showApplied && improvementOutcomeById[item.id] === 'measuring'
          ? 'contextEnginePrototype__improvementCard--measuring'
          : '',
        showApplied && improvementOutcomeById[item.id] === 'unchanged'
          ? 'contextEnginePrototype__improvementCard--unchanged'
          : '',
        showDismissed ? 'contextEnginePrototype__improvementCard--dismissed' : '',
        improvementDepartingIds.includes(item.id)
          ? 'contextEnginePrototype__improvementCard--departing'
          : '',
        highlightedImprovementId === item.id
          ? 'contextEnginePrototype__improvementCard--highlight'
          : '',
      ]
        .filter(Boolean)
        .join(' ');
      return (
        <EuiPanel
          key={item.id}
          id={`context-engine-8-improvement-${item.id}`}
          hasBorder
          paddingSize="m"
          className={cardClass}
        >
          <EuiFlexGroup
            alignItems="flexStart"
            justifyContent="spaceBetween"
            gutterSize="m"
            responsive={false}
          >
            <EuiFlexItem>
              <EuiText size="s">
                <strong>{item.title}</strong>
              </EuiText>
              {sourceSignals.length > 0 ? (
                <>
                  <EuiSpacer size="xs" />
                  <EuiLink
                    className="contextEnginePrototype__improvementSourceLink"
                    onClick={(event) => {
                      event.preventDefault();
                      focusSignals(item.signalIds ?? []);
                    }}
                  >
                    {sourceLine}
                  </EuiLink>
                </>
              ) : null}
              <EuiSpacer size="xs" />
              <EuiText size="s" color="subdued">
                {item.description}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued" className="contextEnginePrototype__improvementMeta">
                {item.casesCount} cases · last seen {item.lastSeen}
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
          {!showDismissed ? (
            <>
              <EuiSpacer size="s" />
              <div className="contextEnginePrototype__improvementFix">
                <EuiText size="s">
                  <strong>Proposed fix:</strong> {fixText}
                </EuiText>
              </div>
              <EuiSpacer size="s" />
              <ImprovementChangeChips changes={item.changes} />
            </>
          ) : null}
          <EuiSpacer size="s" />
          {showApplied ? renderAppliedOutcome(item) : null}
          {showDismissed ? (
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="xs"
                  flush="both"
                  onClick={() => undoDismissImprovement(item.id)}
                >
                  Undo
                </EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : null}
          {showActions ? (
            <EuiFlexGroup
              alignItems="center"
              gutterSize="s"
              responsive={false}
              wrap
              className="contextEnginePrototype__improvementActions"
            >
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  flush="both"
                  onClick={() => approveImprovement(item.id)}
                >
                  Approve fix
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  iconType={AI_AGENT_ICON}
                  onClick={() =>
                    openAgentSidebar({
                      kind: 'improvement-discuss',
                      contextChip: `Failure pattern · ${item.title}`,
                      userMessage:
                        'Propose an improvement for this failure pattern. Verify it against the source first, then suggest one bounded change.',
                      proposalText: fixText,
                      onApply: () => approveImprovement(item.id),
                    })
                  }
                >
                  Refine with AI Agent
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  iconSide="right"
                  iconType="arrowRight"
                  onClick={() => setEvidenceImprovementId(item.id)}
                >
                  View evidence ({item.casesCount} cases)
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  color="text"
                  onClick={() => dismissImprovement(item.id)}
                >
                  Dismiss
                </EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : null}
        </EuiPanel>
      );
    };

    const renderGroupToggle = (
      label: string,
      count: number,
      expanded: boolean,
      onToggle: () => void
    ) => (
      <button
        type="button"
        className="contextEnginePrototype__improvementGroupToggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <EuiIcon type={expanded ? 'arrowDown' : 'arrowRight'} size="s" />
        <span>
          {label} · {count}
        </span>
      </button>
    );

    const improvementsPanel = (
        <EuiPanel
          hasBorder
          paddingSize="l"
          className="contextEnginePrototype__detailSection"
        id="context-engine-8-improvements"
        data-test-subj="contextEngineImprovements"
      >
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h2 className="contextEnginePrototype__sectionTitle">Improvements</h2>
                </EuiTitle>
              </EuiFlexItem>
              {tracesAnalysed > 0 && improvementsAnalysed ? (
                <EuiFlexItem grow={false}>
                  <EuiBadge
                    color="accent"
                    className="contextEnginePrototype__improvementsOpenBadge"
                  >
                    {openImprovementsCount} open
                  </EuiBadge>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
            <EuiText size="s" color="subdued">
              Approving a fix applies it. Nothing changes without you.
            </EuiText>
          </div>
          {improvementsAnalysed && openReviewItems.length > 0 ? (
            <div className="contextEnginePrototype__sectionActions">
              <EuiButton
                size="s"
                onClick={openReviewAll}
                data-test-subj="contextEngineReviewAllImprovements"
              >
                Review all
              </EuiButton>
            </div>
          ) : null}
        </div>
        {tracesAnalysed === 0 ? (
          <>
            <EuiSpacer size="m" />
            <EuiText size="s">
              Improvements are proposed from signals. None yet.
            </EuiText>
          </>
        ) : !improvementsAnalysed ? (
          <>
            <EuiSpacer size="m" />
            <EuiText size="s">
              No fixes proposed yet. Analyze your signals to get suggestions.
            </EuiText>
            <EuiSpacer size="s" />
            {analyseAction}
          </>
        ) : (
          <div className="contextEnginePrototype__improvementsGroups">
            {openImprovements.length === 0 &&
            (appliedImprovements.length > 0 || dismissedImprovements.length > 0) ? (
              <>
                <EuiText size="s" color="subdued">
                  Nothing to review right now. New improvements appear when signals are analyzed.
                </EuiText>
                <EuiSpacer size="m" />
              </>
            ) : null}
            {openImprovements.length > 0 ? (
              <div className="contextEnginePrototype__improvementGroup">
                {anotherGroupExpanded ? (
                  <>
                    <div className="contextEnginePrototype__improvementGroupLabel">
                      Open · {openImprovements.length}
                    </div>
                    <EuiSpacer size="s" />
                  </>
                ) : null}
                <div className="contextEnginePrototype__improvementsList">
                  {openImprovements.map((item) => renderImprovementCard(item, 'open'))}
                </div>
              </div>
            ) : null}
            {appliedImprovements.length > 0 ? (
              <div className="contextEnginePrototype__improvementGroup">
                {renderGroupToggle(
                  'Applied',
                  appliedImprovements.length,
                  appliedGroupOpen,
                  () => setAppliedGroupOpen((current) => !current)
                )}
                {appliedGroupOpen ? (
                  <>
                    <EuiSpacer size="s" />
                    <div className="contextEnginePrototype__improvementsList">
                      {appliedImprovements.map((item) => renderImprovementCard(item, 'applied'))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {dismissedImprovements.length > 0 ? (
              <div className="contextEnginePrototype__improvementGroup">
                {renderGroupToggle(
                  'Dismissed',
                  dismissedImprovements.length,
                  dismissedGroupOpen,
                  () => setDismissedGroupOpen((current) => !current)
                )}
                <EuiText
                  size="xs"
                  color="subdued"
                  className="contextEnginePrototype__improvementGroupNote"
                >
                  Dismissed improvements can come back if the signal keeps recurring.
                </EuiText>
                {dismissedGroupOpen ? (
                  <>
                    <EuiSpacer size="s" />
                    <div className="contextEnginePrototype__improvementsList">
                      {dismissedImprovements.map((item) =>
                        renderImprovementCard(item, 'dismissed')
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        </EuiPanel>
    );

    const improvementEvidenceFlyout =
      evidenceImprovement && isMatureOverview ? (
        <EuiFlyout
          ownFocus
          size="m"
          onClose={() => setEvidenceImprovementId(null)}
          aria-labelledby="context-engine-8-improvement-flyout-title"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="s">
              <h2 id="context-engine-8-improvement-flyout-title">
                {evidenceImprovement.title}
              </h2>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Improvement · found in agent traces
            </EuiText>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            <EuiCallOut title="What we found" color="primary" size="s">
              <p>{evidenceImprovement.findingDetail}</p>
            </EuiCallOut>
            <EuiSpacer size="m" />
            <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
              <strong>PROPOSED FIX</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <div className="contextEnginePrototype__improvementFix">
              <EuiText size="s">{improvementFixText(evidenceImprovement)}</EuiText>
            </div>
            <EuiSpacer size="s" />
            <ImprovementChangeChips changes={evidenceImprovement.changes} />
            <EuiSpacer size="m" />
            <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
              <strong>SIGNALS</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Raw evidence that triggered this improvement. Open a row to see the trace.
            </EuiText>
            <EuiSpacer size="s" />
            <div className="contextEnginePrototype__signalEvidenceList">
              {evidenceSignals.map((signal) => (
                <button
                  key={signal.id}
                  type="button"
                  className="contextEnginePrototype__signalEvidenceRow"
                  onClick={() => setSelectedSignalTraceId(signal.traceId)}
                >
                  <EuiText size="s">
                    <strong>{signal.label}</strong>
                    {' · '}
                    {signal.whatHappened}
                  </EuiText>
                  <EuiText size="xs" color="subdued">
                    {signal.occurrences} occurrences · last seen {signal.lastSeen}
                  </EuiText>
                </button>
              ))}
            </div>
            <EuiSpacer size="m" />
            <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
              <strong>EVIDENCE</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiDescriptionList type="column" compressed>
              <EuiDescriptionListTitle>Cases</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                {evidenceImprovement.casesCount}
              </EuiDescriptionListDescription>
              <EuiDescriptionListTitle>First seen</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                {evidenceImprovement.firstSeen}
              </EuiDescriptionListDescription>
              <EuiDescriptionListTitle>Last seen</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                {evidenceImprovement.lastSeenDetail}
              </EuiDescriptionListDescription>
              <EuiDescriptionListTitle>Confidence</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                {evidenceImprovement.confidence}
              </EuiDescriptionListDescription>
              <EuiDescriptionListTitle>Trace source</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                <EuiCode>{evidenceImprovement.traceSource}</EuiCode>
              </EuiDescriptionListDescription>
            </EuiDescriptionList>
            <EuiSpacer size="m" />
            <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
              <strong>CASES</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Each case is one retrieval event; open one to step through its trace.
            </EuiText>
            <EuiSpacer size="s" />
            <div className="contextEnginePrototype__improvementCaseList">
              {evidenceImprovement.cases.map((caseRow) => (
                <div key={caseRow.id} className="contextEnginePrototype__improvementCaseRow">
                  <EuiCode>
                    {caseRow.timestamp} · {caseRow.tool} · {caseRow.source}
                  </EuiCode>
                  <EuiBadge color="success">Ok</EuiBadge>
                </div>
              ))}
            </div>
            <EuiSpacer size="s" />
            <EuiButtonEmpty
              size="s"
              iconSide="right"
              iconType="arrowRight"
              flush="left"
              onClick={(event) => {
                event.preventDefault();
              }}
            >
              View all cases
            </EuiButtonEmpty>
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiFlexGroup justifyContent="spaceBetween" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={() => setEvidenceImprovementId(null)}>
                  Close
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                {improvementStatus(evidenceImprovement.id) === 'open' &&
                !improvementPendingById[evidenceImprovement.id] ? (
                  <EuiButton
                    fill
                    onClick={() => {
                      const id = evidenceImprovement.id;
                      setEvidenceImprovementId(null);
                      approveImprovement(id);
                    }}
                  >
                    ✓ Approve fix
                  </EuiButton>
                ) : improvementStatus(evidenceImprovement.id) === 'applied' ? (
                  <EuiButton fill color="success" disabled>
                    Applied
                  </EuiButton>
                ) : (
                  <EuiButton fill disabled>
                    Dismissed
                  </EuiButton>
                )}
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlyoutFooter>
        </EuiFlyout>
      ) : null;

    const signalTraceFlyout = selectedSignalTraceId ? (
      <EuiFlyout
        ownFocus
        size="m"
        onClose={() => setSelectedSignalTraceId(null)}
        aria-labelledby="context-engine-8-signal-trace-title"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiTitle size="s">
            <h2 id="context-engine-8-signal-trace-title">Trace</h2>
          </EuiTitle>
          <EuiSpacer size="xs" />
          <EuiHealth color={selectedSignalTrace.status === 'error' ? 'danger' : 'success'}>
            <EuiCode>{selectedSignalTrace.id}</EuiCode>
          </EuiHealth>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          <EuiText size="s" color="subdued">
            {selectedSignalTrace.agent} · {selectedSignalTrace.model} ·{' '}
            {selectedSignalTrace.taskType} · {selectedSignalTrace.timestamp}
          </EuiText>
          <EuiSpacer size="m" />
          <EuiPanel hasBorder paddingSize="s">
            <EuiStat title={selectedSignalTrace.duration} description="Duration" titleSize="s" />
          </EuiPanel>
          <EuiSpacer size="m" />
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs" color="subdued">
              <strong>User request</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="s">{selectedSignalTrace.userRequest}</EuiText>
          </EuiPanel>
          <EuiSpacer size="s" />
          <EuiPanel hasBorder paddingSize="m">
            <EuiText size="xs" color="subdued">
              <strong>Final response</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="s">{selectedSignalTrace.finalResponse}</EuiText>
          </EuiPanel>
          <EuiSpacer size="m" />
          <EuiPanel hasBorder paddingSize="m">
            <EuiTitle size="xs">
              <h3>Span waterfall</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            {selectedSignalTrace.spans.map((span) => (
              <div key={span.id}>
                <div
                  className="contextEnginePrototype__amSpan"
                  style={{ paddingLeft: span.depth * 16 }}
                >
                  <div className="contextEnginePrototype__amSpanMeta">
                    <EuiBadge color={span.error ? 'danger' : 'hollow'}>{span.kind}</EuiBadge>
                    <EuiText size="s">
                      <strong>{span.name}</strong>
                      {span.error ? ' · error' : ''}
                    </EuiText>
                    {span.kind !== 'retrieval' && span.meta ? (
                      <EuiText size="xs" color="subdued">
                        {span.meta}
                      </EuiText>
                    ) : null}
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
                {span.kind === 'retrieval' && span.meta ? (
                  <div
                    className="contextEnginePrototype__retrievalAnnotation"
                    style={{ marginLeft: span.depth * 16 }}
                  >
                    <EuiCallOut color="warning" size="s" title="Retrieval miss">
                      <p>{span.meta}</p>
                    </EuiCallOut>
                  </div>
                ) : null}
              </div>
            ))}
          </EuiPanel>
        </EuiFlyoutBody>
        <EuiFlyoutFooter>
          <EuiButtonEmpty onClick={() => setSelectedSignalTraceId(null)}>Close</EuiButtonEmpty>
        </EuiFlyoutFooter>
      </EuiFlyout>
    ) : null;

    const reviewAllFlyout = reviewAllOpen ? (
      <EuiFlyout
        ownFocus
        size="m"
        onClose={() => setReviewAllOpen(false)}
        aria-labelledby="context-engine-8-review-all-title"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiTitle size="s">
            <h2 id="context-engine-8-review-all-title">Review all</h2>
          </EuiTitle>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            Choose which open improvements to apply. Destructive changes stay unchecked.
          </EuiText>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          {openReviewItems.length === 0 ? (
            <EuiText size="s" color="subdued">
              No open improvements to review.
            </EuiText>
          ) : (
            openReviewItems.map((item) => {
              const checked = reviewSelectedIds.includes(item.id);
              const hasDestructive = (item.changes ?? []).some((change) => change.destructive);
              return (
                <div key={item.id} className="contextEnginePrototype__reviewAllRow">
                  <EuiCheckbox
                    id={`review-improvement-${item.id}`}
                    checked={checked}
                    onChange={() => {
                      setReviewSelectedIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id]
                      );
                    }}
                    label={
                      <div>
                        <EuiText size="s">
                          <strong>{item.title}</strong>
                        </EuiText>
                        <EuiSpacer size="xs" />
                        <ImprovementChangeChips changes={item.changes} />
                        {hasDestructive ? (
                          <>
                            <EuiSpacer size="xs" />
                            <EuiText size="xs" color="warning">
                              Includes a destructive change.
                            </EuiText>
                          </>
                        ) : null}
                      </div>
                    }
                  />
                </div>
              );
            })
          )}
        </EuiFlyoutBody>
        <EuiFlyoutFooter>
          <EuiFlexGroup justifyContent="spaceBetween" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={() => setReviewAllOpen(false)}>Cancel</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                fill
                disabled={reviewSelectedCount === 0}
                onClick={applyReviewedImprovements}
              >
                Apply {reviewSelectedCount} {reviewSelectedCount === 1 ? 'change' : 'changes'}
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlyoutFooter>
      </EuiFlyout>
    ) : null;

    const configureFlyout = configureFlyoutOpen ? (
      <EuiFlyout
        ownFocus
        size="m"
        onClose={() => {
          setConfigureFlyoutOpen(false);
          setRunNowNotice(null);
        }}
        aria-labelledby="context-engine-8-configure-title"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiTitle size="s">
            <h2 id="context-engine-8-configure-title">Configure improvements</h2>
          </EuiTitle>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            How often the improvement agent runs, which signals it considers, and what it may
            change.
          </EuiText>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
            <strong>SCHEDULE</strong>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiRadio
            id="improvement-schedule-daily"
            label="Daily"
            checked={improvementSchedule === 'daily'}
            onChange={() => setImprovementSchedule('daily')}
          />
          <EuiSpacer size="xs" />
          <EuiRadio
            id="improvement-schedule-weekly"
            label="Weekly"
            checked={improvementSchedule === 'weekly'}
            onChange={() => setImprovementSchedule('weekly')}
          />
          <EuiSpacer size="xs" />
          <EuiRadio
            id="improvement-schedule-manual"
            label="Manual only"
            checked={improvementSchedule === 'manual'}
            onChange={() => setImprovementSchedule('manual')}
          />
          <EuiSpacer size="l" />
          <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
            <strong>SIGNAL WINDOW</strong>
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiText size="xs" color="subdued">
            Windowing keeps the agent from being overwhelmed by too much context.
          </EuiText>
          <EuiSpacer size="s" />
          <EuiRadio
            id="signal-window-7d"
            label="Last 7 days"
            checked={signalWindow === '7d'}
            onChange={() => setSignalWindow('7d')}
          />
          <EuiSpacer size="xs" />
          <EuiRadio
            id="signal-window-30d"
            label="Last 30 days"
            checked={signalWindow === '30d'}
            onChange={() => setSignalWindow('30d')}
          />
          <EuiSpacer size="xs" />
          <EuiRadio
            id="signal-window-lastn"
            label="Last N signals"
            checked={signalWindow === 'lastN'}
            onChange={() => setSignalWindow('lastN')}
          />
          {signalWindow === 'lastN' ? (
            <>
              <EuiSpacer size="s" />
              <EuiFormRow label="Number of signals">
                <EuiFieldText
                  value={signalWindowN}
                  onChange={(event) => setSignalWindowN(event.target.value)}
                  compressed
                />
              </EuiFormRow>
            </>
          ) : null}
          <EuiSpacer size="l" />
          <EuiText size="xs" className="contextEnginePrototype__improvementSectLabel">
            <strong>WHAT THE AGENT MAY CHANGE</strong>
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiText size="xs" color="subdued">
            Broader permissions let the agent fix more on its own, but it can also change things
            you rely on.
          </EuiText>
          <EuiSpacer size="s" />
          {(Object.keys(AGENT_CHANGE_OBJECT_LABELS) as AgentChangeObject[]).map((objectKey) => (
            <div key={objectKey} className="contextEnginePrototype__configurePermGroup">
              <EuiText size="s">
                <strong>{AGENT_CHANGE_OBJECT_LABELS[objectKey]}</strong>
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiFlexGroup gutterSize="m" responsive={false} wrap>
                {AGENT_CHANGE_OPS.map((op) => (
                  <EuiFlexItem grow={false} key={op}>
                    <EuiCheckbox
                      id={`agent-may-${objectKey}-${op}`}
                      label={op.charAt(0).toUpperCase() + op.slice(1)}
                      checked={agentMayChange[objectKey][op]}
                      onChange={() =>
                        setAgentMayChange((current) => ({
                          ...current,
                          [objectKey]: {
                            ...current[objectKey],
                            [op]: !current[objectKey][op],
                          },
                        }))
                      }
                    />
                  </EuiFlexItem>
                ))}
              </EuiFlexGroup>
            </div>
          ))}
          <EuiSpacer size="l" />
          <EuiButton
            onClick={() =>
              setRunNowNotice('Started. Proposed fixes will appear in Improvements.')
            }
          >
            Run now
          </EuiButton>
          {runNowNotice ? (
            <>
              <EuiSpacer size="s" />
              <EuiText size="s" color="subdued">
                {runNowNotice}
              </EuiText>
            </>
          ) : null}
        </EuiFlyoutBody>
        <EuiFlyoutFooter>
          <EuiButtonEmpty
            onClick={() => {
              setConfigureFlyoutOpen(false);
              setRunNowNotice(null);
            }}
          >
            Close
          </EuiButtonEmpty>
        </EuiFlyoutFooter>
      </EuiFlyout>
    ) : null;

    const viewCountLabel = (label: string, count: number) => (
      <>
        {label} <EuiNotificationBadge size="s">{count}</EuiNotificationBadge>
      </>
    );
    const indexViewOptions = [
      { id: 'overview', label: 'Overview' },
      {
        id: 'automations',
        label: viewCountLabel('Automations', activeAutomationCount),
      },
      {
        id: 'knowledge',
        label: viewCountLabel('Knowledge Indicators', kiTotal),
      },
      {
        id: 'improvements',
        label: viewCountLabel('Improvements', openImprovementsCount),
      },
    ];
    const indexViewSwitch = setupComplete ? (
      <EuiButtonGroup
        className="contextEnginePrototype__viewSwitch"
        legend="AI index views"
        type="single"
        buttonSize="compressed"
        options={indexViewOptions}
        idSelected={effectiveDetailTab}
        onChange={(id) => selectNamespaceDetailTab(id as NamespaceDetailTab)}
      />
    ) : null;

    const detailHeaderBadges: AppHeaderBadge[] = [
      lifecycle.kind === 'needsSetup'
        ? { label: 'Needs setup', color: 'warning' }
        : lifecycle.kind === 'settingUp'
          ? { label: 'Setting up', color: 'primary' }
          : { label: 'Ready', color: 'success' },
      ...(namespace.managed ? [{ label: 'Managed', color: 'hollow' as const }] : []),
    ];

    const useInAgentMenu: AppHeaderMenu | undefined = setupComplete
      ? {
          primaryActionItem: {
            id: 'use-in-an-agent',
            label: 'Use in an agent',
            iconType: 'bolt',
            run: () => openUseInAgent(),
            testId: 'contextEngineUseInAgent',
          },
        }
      : undefined;

    const enabledManagedSourceCount = MANAGED_SETUP_SOURCES.filter(
      (source) => managedSetupToggles[source.id]
    ).length;

    const updateProposalWithPrompt = (automation: Automation, userText: string) => {
      if (!activeNamespace) return;
      const sourceName = proposalSourceName(automation, namespace.sources);
      const nextDescription = `Adjusted before approve: ${userText}. Scope updated accordingly for ${sourceName}.`;
      const updated: Namespace = {
        ...activeNamespace,
        suggestedAutomations: activeNamespace.suggestedAutomations.map((item) =>
          item.id === automation.id ? { ...item, description: nextDescription } : item
        ),
      };
      setActiveNamespace(updated);
      setNamespaces((current) =>
        current.map((item) => (item.name === updated.name ? updated : item))
      );
      setProposalConfirmations((current) => ({
        ...current,
        [automation.id]: '✓ Proposal updated',
      }));
      setProposalEditorOpenId(null);
    };

    const setupReadyStrip =
      setupReadyBanner?.namespaceName === namespace.name ? (
        <EuiPanel
          hasBorder
          paddingSize="m"
          className="contextEnginePrototype__readyStrip"
          color="success"
        >
          <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
            <EuiFlexItem>
              <EuiText size="s">
                <strong>
                  {setupReadyBanner.managed
                    ? 'Set up complete. All users can now retrieve from this index.'
                    : `${displayName} is ready. Automations run on schedule to keep its Knowledge Indicators current.`}
                </strong>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonIcon
                iconType="cross"
                aria-label="Dismiss"
                color="text"
                onClick={() => {
                  writeStoredSetupReadyBanner(namespace.name, {
                    kiCount: setupReadyBanner.kiCount,
                    dismissed: true,
                    managed: setupReadyBanner.managed,
                  });
                  setSetupReadyBanner(null);
                }}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      ) : null;

    const setupManagedPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <EuiTitle size="s">
          <h2>Set up Elastic AI Index</h2>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          Choose which parts of your deployment it learns from. Admins only; afterwards every user
          can retrieve from it.
        </EuiText>
        {!isAdmin && (
          <>
            <EuiSpacer size="m" />
            <EuiCallOut size="s" color="warning" title="An admin needs to complete this setup." />
          </>
        )}
        <EuiSpacer size="m" />
        <div className="contextEnginePrototype__setupSourceList">
          {MANAGED_SETUP_SOURCES.map((source) => {
            const on = Boolean(managedSetupToggles[source.id]);
            return (
              <div
                key={source.id}
                className={`contextEnginePrototype__setupSourceRow${
                  on ? ' contextEnginePrototype__setupSourceRow--on' : ''
                }`}
              >
                <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
                  <EuiFlexItem>
                    <EuiText size="s">
                      <strong>{source.label}</strong>
                    </EuiText>
                    <EuiText size="xs" color="subdued">
                      {source.description}
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiSwitch
                      label={on ? 'On' : 'Off'}
                      showLabel={false}
                      checked={on}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        setManagedSetupToggles((current) => ({
                          ...current,
                          [source.id]: event.target.checked,
                        }))
                      }
                    />
                  </EuiFlexItem>
                </EuiFlexGroup>
              </div>
            );
          })}
        </div>
        <EuiSpacer size="m" />
        <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false} wrap>
          <EuiFlexItem grow={false}>
            <EuiButton
              fill
              disabled={!isAdmin || enabledManagedSourceCount === 0}
              onClick={() => runManagedSetup(namespace)}
            >
              Run automations ›
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="s" color="subdued">
              {enabledManagedSourceCount > 0
                ? `${enabledManagedSourceCount} source${
                    enabledManagedSourceCount === 1 ? '' : 's'
                  } enabled`
                : 'Enable at least one source'}
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );

    const setupStep3View: SetupStep3View =
      setupPhase === 'suggesting' || setupPhase === 'configure'
        ? 'suggesting'
        : setupPhase === 'generating'
          ? 'generating'
          : setupPhase === 'generateError'
            ? 'generateError'
            : setupPhase === 'testError'
              ? 'testError'
              : setupPhase === 'preview' || setupPhase === 'review'
                ? 'preview'
                : setupPhase === 'running'
                  ? 'runningFull'
                  : 'select';

    const setupStep3Sublabel =
      setupPhase === 'generating' || setupPhase === 'generateError'
        ? generateWaitPhase === 'test'
          ? 'Running a test on sample data...'
          : 'Generating your automation...'
        : setupPhase === 'preview' || setupPhase === 'review' || setupPhase === 'testError'
          ? 'Review what it created.'
          : setupPhase === 'running'
            ? 'Running on all data...'
            : 'Pick strategies, then generate.';

    const sendSetupErrorToAgent = () => {
      openAgentSidebar({
        kind: 'automation-edit',
        contextChip: `Automation · ${generatedAutomation?.title || 'setup'}`,
        attachmentDetail: [
          `id: ${namespace.name}`,
          `automation: ${generatedAutomation?.title || 'not generated'}`,
          setupPhase === 'testError'
            ? 'error: The run completed but saved empty values for every field.'
            : 'error: Generation stalled before an automation was produced.',
        ].join('\n'),
        userMessage:
          setupPhase === 'testError'
            ? 'Diagnose and fix this automation. The test run saved empty values for every field.'
            : 'Diagnose and fix this automation. Generation stalled before it finished.',
        proposalText: generatedAutomation
          ? `Fix "${generatedAutomation.title}" so the next test run writes populated Knowledge Indicators.`
          : 'Retry generation with a tighter extraction instruction.',
        onApply: () => {
          if (setupPhase === 'testError') {
            startTestRunAgain(namespace);
            return;
          }
          startGenerateWorkflow(namespace);
        },
      });
    };

    const setupStep3Panel = (
      <SetupStep3
        view={setupStep3View}
        showInferenceGate={showInferenceGate}
        onSetupInference={() => setDemoHasInference(true)}
        sourceNames={namespace.sources}
        strategies={extractionStrategies}
        selectedStrategyIds={selectedStrategyIds}
        onToggleStrategy={(id) =>
          setSelectedStrategyIdsByIndex((current) => {
            const ids = current[namespace.name] ?? [];
            const next = ids.includes(id)
              ? ids.filter((item) => item !== id)
              : [...ids, id];
            return { ...current, [namespace.name]: next };
          })
        }
        instructionOpenId={strategyInstructionOpenId}
        onToggleInstruction={(id) =>
          setStrategyInstructionOpenId((current) => (current === id ? null : id))
        }
        onChangeInstruction={(id, value) =>
          setStrategiesByIndex((current) => ({
            ...current,
            [namespace.name]: (current[namespace.name] ?? []).map((strategy) =>
              strategy.id === id ? { ...strategy, instruction: value } : strategy
            ),
          }))
        }
        elapsedSeconds={generateElapsedSeconds}
        generateWaitPhase={generateWaitPhase}
        automationSummary={
          generatedAutomation
            ? renderActiveAutomation(generatedAutomation, namespace, { setupPreview: true })
            : null
        }
        sampleKis={setupSampleKis}
        sampleTotal={Math.max(reviewKiTotal, setupSampleKis.length)}
        onViewAllKis={() => selectNamespaceDetailTab('knowledge')}
        tryQuestion={reviewTryQuestion}
        onTryQuestionChange={(value) => {
          setReviewTryQuestion(value);
          setReviewTryResult(null);
        }}
        onTryQuestion={() => {
          const question = reviewTryQuestion.trim();
          if (!question) return;
          setReviewTryResult(answerSetupTryQuestion(question, setupSampleKis));
        }}
        tryResult={reviewTryResult}
        onGenerate={() => startGenerateWorkflow(namespace)}
        onRetryGenerate={() => startGenerateWorkflow(namespace)}
        onSendErrorToAgent={sendSetupErrorToAgent}
        onRunTestAgain={() => startTestRunAgain(namespace)}
        onRunFull={() => continueFirstRunToFull(namespace)}
      />
    );

    const setupRailStep = (
      id: 'index' | 'sources' | 'strategies',
      title: string,
      subline: string,
      complete: boolean,
      active: boolean
    ) => (
      <div
        className={`contextEnginePrototype__createStep${
          active ? ' contextEnginePrototype__createStep--active' : ''
        }${complete && !active ? ' contextEnginePrototype__createStep--complete' : ''}${
          !active && !complete ? ' contextEnginePrototype__createStep--incomplete' : ''
        }`}
        aria-current={active ? 'step' : undefined}
      >
        <span className="contextEnginePrototype__createStepMarkerCol" aria-hidden={true}>
          <span
            className={`contextEnginePrototype__createStepMarker ${
              active
                ? 'contextEnginePrototype__createStepMarker--active'
                : complete
                  ? 'contextEnginePrototype__createStepMarker--complete'
                  : 'contextEnginePrototype__createStepMarker--incomplete'
            }`}
          >
            {active ? (
              <span className="contextEnginePrototype__createStepMarkerDot" />
            ) : complete ? (
              <EuiIcon type="check" size="s" color="ghost" />
            ) : null}
          </span>
        </span>
        <span className="contextEnginePrototype__createStepBody">
          <span className="contextEnginePrototype__createStepTitle">{title}</span>
          <span className="contextEnginePrototype__createStepDesc">{subline}</span>
        </span>
      </div>
    );

    const setupThreeStepLayout = (
      <EuiFlexGroup
        className="contextEnginePrototype__createLayout"
        gutterSize="l"
        alignItems="flexStart"
        responsive={true}
      >
        <EuiFlexItem grow={false} className="contextEnginePrototype__createMapColumn">
          <EuiPanel hasBorder paddingSize="m" className="contextEnginePrototype__createMap">
            <div className="contextEnginePrototype__createStepper">
              {setupRailStep(
                'index',
                'Name and intent',
                'Named, intent set.',
                true,
                false
              )}
              {setupRailStep(
                'sources',
                namespace.sources.length > 0
                  ? `Sources · ${namespace.sources.length}`
                  : 'Sources',
                namespace.sources.join(', ') || 'Connectors and ES|QL views.',
                true,
                false
              )}
              {setupRailStep(
                'strategies',
                'Automations',
                setupStep3Sublabel,
                false,
                true
              )}
            </div>
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem className="contextEnginePrototype__createPanelColumn">
          {setupStep3Panel}
        </EuiFlexItem>
      </EuiFlexGroup>
    );

    const setupPanel = (() => {
      if (namespace.managed) {
        if (setupPhase === 'running') {
          return (
            <SetupWaitPanel
              headline="Setting up"
              description="Automations are running and the index is being populated. You can leave, we will keep going."
              elapsedSeconds={generateElapsedSeconds}
            />
          );
        }
        return setupManagedPanel;
      }
      if (setupPhase === 'error') {
        return (
          <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
            <EuiEmptyPrompt
              color="danger"
              iconType="error"
              title={<h2>Error found in this automation.</h2>}
              body={
                <EuiText size="s">
                  The run completed but saved empty values for every field. Right-click the error
                  to send it to the AI Agent, or use the button.
                </EuiText>
              }
              actions={
                <EuiFlexGroup gutterSize="s" responsive={false} wrap>
                  <EuiFlexItem grow={false}>
                    <EuiButton iconType={AI_AGENT_ICON} onClick={sendSetupErrorToAgent}>
                      Send error to AI Agent
                    </EuiButton>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty onClick={() => retrySetupError(namespace)}>
                      Try again
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>
              }
            />
          </EuiPanel>
        );
      }
      return setupThreeStepLayout;
    })();

    const selectedDetailContent = (() => {
      switch (effectiveDetailTab) {
        case 'automations':
          return automationsPanel;
        case 'knowledge':
          return knowledgePanel;
        case 'improvements':
          return (
            <>
              {signalsPanel}
              {improvementsPanel}
            </>
          );
        case 'overview':
        default:
          if (inSetupMode) {
            return setupPanel;
          }
          return (
            <>
              {overviewUsagePanel}
              {howItWorksCallout}
              {setupReadyStrip}
              {descriptionPanel}
              {tryQuestionPanel}
              {sourcesPanel}
            </>
          );
      }
    })();

    return (
      <>
        <FullWidthAppHeader
          title={displayName}
          back={headerBack(CONTEXT_APP_HREF, 'Context', goToIndex)}
          tabs={headerSectionTabs}
          badges={detailHeaderBadges}
          menu={useInAgentMenu}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section>
          {indexViewSwitch}
          <EuiSpacer size="m" />
          <div className="contextEnginePrototype__detailStack">{selectedDetailContent}</div>
          {improvementEvidenceFlyout}
          {signalTraceFlyout}
          {reviewAllFlyout}
          {configureFlyout}
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderIssue = () => {
    const namespace = activeNamespace || namespaces[0];
    const issue = activeIssue || namespace.monitoring.issues[0];
    if (!issue) {
      return (
        <>
          <FullWidthAppHeader
            title="Issue"
            back={headerBack(
              contextIndexHref(namespace.name),
              catalogDisplayName(namespace),
              () => setScreen('namespace')
            )}
            tabs={headerSectionTabs}
            spacing="largeBleed"
          />
          <EuiPageTemplate.Section>
            <EuiText>No issue selected.</EuiText>
          </EuiPageTemplate.Section>
        </>
      );
    }
    const subPatternTraces = issue.subPatterns.reduce((sum, pattern) => sum + pattern.traces, 0);

    return (
      <>
        <FullWidthAppHeader
          title={issue.title}
          back={headerBack(
            contextIndexHref(namespace.name),
            catalogDisplayName(namespace),
            () => setScreen('namespace')
          )}
          tabs={headerSectionTabs}
          badges={[
            {
              label: issue.severity,
              color: issue.severity === 'high' ? 'danger' : 'warning',
            },
          ]}
          metadata={headerMeta(`Fix path: ${issue.fixPath}`)}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section>
          <EuiFlexGroup direction="column" gutterSize="m">
            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiTitle size="s">
                  <h2>What&apos;s happening</h2>
                </EuiTitle>
                <EuiSpacer size="s" />
                <EuiText size="s">{issue.description}</EuiText>
                <EuiSpacer size="m" />
                <EuiText size="xs" color="subdued">
                  <strong>ROOT CAUSE</strong>
                </EuiText>
                <EuiSpacer size="xs" />
                <EuiText size="s">{issue.rootCause}</EuiText>
                <EuiSpacer size="m" />
                <EuiText size="xs" color="subdued">
                  <strong>DETECTION SIGNAL</strong>
                </EuiText>
                <EuiSpacer size="xs" />
                <EuiText size="s">{issue.detectionSignal}</EuiText>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
                  <EuiFlexItem>
                    <EuiTitle size="s">
                      <h2>Sub-patterns</h2>
                    </EuiTitle>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="hollow">
                      {issue.subPatterns.length} groups · {subPatternTraces} traces
                    </EuiBadge>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
                <EuiText size="s" color="subdued">
                  How the affected traces break down. Open a trace to see the question, what was
                  retrieved, and the missing fact.
                </EuiText>
                <EuiSpacer size="m" />
                <EuiFlexGroup direction="column" gutterSize="s">
                  {issue.subPatterns.map((pattern) => (
                    <EuiFlexItem key={pattern.title}>
                      <EuiPanel hasBorder paddingSize="m">
                        <EuiFlexGroup alignItems="center" responsive={false}>
                          <EuiFlexItem>
                            <EuiFlexGroup
                              alignItems="center"
                              responsive={false}
                              gutterSize="s"
                              wrap
                            >
                              <EuiFlexItem grow={false}>
                                <EuiText size="s">
                                  <strong>{pattern.title}</strong>
                                </EuiText>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false}>
                                <EuiBadge color="hollow">{pattern.traces} traces</EuiBadge>
                              </EuiFlexItem>
                            </EuiFlexGroup>
                            <EuiText size="xs" color="subdued">
                              {pattern.examples}
                            </EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiButtonEmpty iconSide="right" iconType="arrowRight">
                              View in Discover
                            </EuiButtonEmpty>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiPanel>
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiTitle size="s">
                  <h2>Suggested fix</h2>
                </EuiTitle>
                <EuiSpacer size="m" />
                <EuiPanel
                  paddingSize="m"
                  color="subdued"
                  className="contextEnginePrototype__fixBox"
                >
                  <EuiFlexGroup alignItems="flexStart" gutterSize="m" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon type="compute" size="l" aria-hidden={true} />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="s">{issue.suggestedFix}</EuiText>
                      <EuiSpacer size="s" />
                      <EuiText size="xs" color="subdued">
                        {issue.suggestedFixDetail}
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
                <EuiSpacer size="m" />
                <EuiFlexGroup justifyContent="flexEnd">
                  <EuiFlexItem grow={false}>
                    <EuiButton
                      fill
                      iconType="wrench"
                      onClick={() => openWorkflow('Add criterion-bound KI')}
                    >
                      Go fix this issue
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderWorkflow = () => {
    const workflowNameMatch = workflowYaml.match(/^name:\s*(.+)$/m);
    const workflowName = workflowNameMatch?.[1]?.trim() || 'Workflow';
    const sampleKis = sampleTestRunIndicators(workflowSourceName);
    const validation = validateWorkflowYaml(workflowYaml);

    const runTest = () => {
      if (!validation.ok) {
        setWorkflowNotice({
          type: 'warning',
          text: `Fix validation errors before a test run: ${validation.message}`,
        });
        return;
      }
      setWorkflowNotice(null);
      setShowTestRunModal(true);
    };

    const saveWorkflow = () => {
      if (!validation.ok) {
        setWorkflowNotice({ type: 'danger', text: `Cannot save: ${validation.message}` });
        return;
      }
      if (workflowDraftPending) {
        const yamlName = workflowYaml.match(/^name:\s*(.+)$/m)?.[1]?.trim();
        const sourceName = workflowDraftPending.sourceNames[0] || 'selected sources';
        addDraftAutomation({
          id: `draft-${Date.now()}`,
          title: yamlName || workflowDraftPending.name,
          type: 'FACT',
          ownership: 'NEW',
          tags: [...workflowDraftPending.sourceNames, 'NEW'],
          description: proposalBenefitDescription(sourceName),
        });
        setWorkflowDraftPending(null);
        setWorkflowDirty(false);
        setWorkflowNotice(null);
        setWorkflowBackLabel(null);
        setWorkflowOriginName(null);
        setWorkflowOriginTab(null);
        selectNamespaceDetailTab('automations');
        setScreen('namespace');
        return;
      }
      setWorkflowDirty(false);
      setWorkflowNotice({ type: 'success', text: 'Workflow saved.' });
    };

    const originName = workflowOriginName ?? activeNamespace?.name ?? null;
    const originNamespace = originName
      ? namespaces.find((item) => item.name === originName) ?? activeNamespace
      : activeNamespace;
    const originLabel =
      workflowBackLabel ||
      (originNamespace ? catalogDisplayName(originNamespace) : 'AI index');
    const workflowMenu: AppHeaderMenu = {
      items: [
        {
          id: 'json-schema',
          label: 'JSON Schema',
          iconType: 'download',
          order: 100,
          run: () =>
            setWorkflowNotice({
              type: 'success',
              text: 'JSON Schema download started.',
            }),
        },
        {
          id: 'documentation',
          label: 'Documentation',
          iconType: 'popout',
          order: 200,
          href: 'https://www.elastic.co/docs',
          target: '_blank',
        },
        {
          id: 'actions',
          label: 'Actions',
          iconType: 'boxesHorizontal',
          order: 300,
          items: [
            {
              id: 'validate',
              label: 'Validate',
              iconType: 'check',
              order: 100,
              run: () =>
                setWorkflowNotice({
                  type: validation.ok ? 'success' : 'warning',
                  text: validation.ok ? 'No validation errors' : validation.message,
                }),
            },
            {
              id: 'export',
              label: 'Export',
              iconType: 'exportAction',
              order: 200,
              run: () =>
                setWorkflowNotice({
                  type: 'success',
                  text: 'Export started.',
                }),
            },
            {
              id: 'duplicate',
              label: 'Duplicate',
              iconType: 'copy',
              order: 300,
              run: () =>
                setWorkflowNotice({
                  type: 'success',
                  text: 'Would duplicate this workflow.',
                }),
            },
          ],
        },
      ],
    };

    return (
      <>
        <FullWidthAppHeader
          title={workflowName}
          back={headerBack(
            originName ? contextIndexHref(originName) : CONTEXT_APP_HREF,
            originLabel,
            leaveWorkflow
          )}
          tabs={headerSectionTabs}
          badges={[
            workflowDirty
              ? { label: 'Unsaved changes', color: 'warning' }
              : { label: 'Saved', color: 'success' },
          ]}
          menu={workflowMenu}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section
          grow
          paddingSize="none"
          className="contextEnginePrototype__workflowSection"
        >
          <div className="contextEnginePrototype__workflowShell">
            <header className="contextEnginePrototype__workflowToolbar">
              <EuiFlexGroup
                alignItems="center"
                justifyContent="flexEnd"
                gutterSize="m"
                responsive={false}
                wrap
              >
                <EuiFlexItem grow={false}>
                  <EuiSwitch
                    label="Enabled"
                    checked={workflowEnabled}
                    onChange={(event) => setWorkflowEnabledInYaml(event.target.checked)}
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Run workflow">
                    <EuiButtonIcon
                      size="s"
                      display="base"
                      color="success"
                      iconType="play"
                      aria-label="Run workflow"
                      onClick={runTest}
                    />
                  </EuiToolTip>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton size="s" fill onClick={saveWorkflow} disabled={!workflowDirty}>
                    Save
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </header>

            {workflowNotice && (
              <div className="contextEnginePrototype__workflowNotice">
                <EuiCallOut
                  size="s"
                  color={workflowNotice.type}
                  title={workflowNotice.text}
                  onDismiss={() => setWorkflowNotice(null)}
                />
              </div>
            )}

            <div className="contextEnginePrototype__workflowBody">
              <div
                className="contextEnginePrototype__workflowEditor"
                ref={workflowEditorRef}
                style={
                  {
                    '--context-workflow-editor-height': `${workflowEditorHeight}px`,
                    height: workflowEditorHeight,
                  } as React.CSSProperties
                }
              >
                <CodeEditor
                  languageId="yaml"
                  width="100%"
                  height={workflowEditorHeight}
                  value={workflowYaml}
                  transparentBackground
                  onChange={(value) => {
                    setWorkflowYaml(value);
                    setWorkflowDirty(true);
                    if (/^enabled:\s*false\s*$/m.test(value)) {
                      setWorkflowEnabled(false);
                    } else if (/^enabled:\s*true\s*$/m.test(value)) {
                      setWorkflowEnabled(true);
                    }
                  }}
                  accessibilityOverlayEnabled={false}
                  options={{
                    fontSize: 13,
                    lineNumbers: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    automaticLayout: true,
                    readOnly: false,
                    padding: { top: 12, bottom: 12 },
                    fixedOverflowWidgets: true,
                  }}
                  aria-label="Workflow YAML editor"
                />
              </div>
            </div>

            <footer className="contextEnginePrototype__workflowFooter">
              <EuiFlexGroup
                alignItems="center"
                justifyContent="spaceBetween"
                gutterSize="m"
                responsive={false}
                wrap
              >
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon
                        type={validation.ok ? 'checkInCircleFilled' : 'error'}
                        color={validation.ok ? 'success' : 'danger'}
                        aria-hidden={true}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs">
                        <strong>
                          {validation.ok ? 'No validation errors' : validation.message}
                        </strong>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                    <EuiFlexItem grow={false}>
                      <EuiToolTip content="Keyboard shortcuts">
                        <EuiButtonIcon
                          size="s"
                          iconType="keyboard"
                          aria-label="Keyboard shortcuts"
                          color="text"
                        />
                      </EuiToolTip>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiToolTip content="Editor settings">
                        <EuiButtonIcon
                          size="s"
                          iconType="controlsHorizontal"
                          aria-label="Editor settings"
                          color="text"
                        />
                      </EuiToolTip>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
              </EuiFlexGroup>
            </footer>
          </div>
        </EuiPageTemplate.Section>

        {showTestRunModal && (
          <EuiModal
            onClose={() => setShowTestRunModal(false)}
            maxWidth={640}
            aria-label="Test run preview"
          >
            <EuiModalHeader>
              <EuiModalHeaderTitle>Test run preview</EuiModalHeaderTitle>
            </EuiModalHeader>
            <EuiModalBody>
              <EuiText size="s" color="subdued">
                Sample Knowledge Indicators this workflow would extract from{' '}
                <EuiCode>{workflowSourceName}</EuiCode> before you commit.
              </EuiText>
              <EuiSpacer size="m" />
              <div className="contextEnginePrototype__list">
                {sampleKis.map((ki) => (
                  <div key={ki.title} className="contextEnginePrototype__listRow">
                    <EuiText size="s">
                      <strong>{ki.title}</strong>
                    </EuiText>
                    <EuiText size="xs" color="subdued">
                      {producesLabel(ki.type)} · preview
                    </EuiText>
                    <EuiSpacer size="xs" />
                    <EuiText size="s" color="subdued">
                      {ki.summary}
                    </EuiText>
                  </div>
                ))}
              </div>
            </EuiModalBody>
            <EuiModalFooter>
              <EuiButtonEmpty onClick={() => setShowTestRunModal(false)}>Close</EuiButtonEmpty>
              <EuiButton
                fill
                onClick={() => {
                  setShowTestRunModal(false);
                  setWorkflowNotice({
                    type: 'success',
                    text: 'Test run complete. Sample KIs look good · save the workflow when ready.',
                  });
                }}
              >
                Looks good
              </EuiButton>
            </EuiModalFooter>
          </EuiModal>
        )}
      </>
    );
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setAgentNotice({ type: 'success', text: successMessage });
    } catch {
      setAgentNotice({ type: 'warning', text: 'Could not copy to clipboard.' });
    }
  };

  const renderAgent = () => {
    const namespace = activeNamespace || namespaces[0];
    const indexName = namespace.indexName;
    const mcpUrl = `https://${DEMO_MCP_HOST}/mcp/${slugify(namespace.name) || 'namespace'}`;
    const packages = buildAgentPackages(namespace.name, indexName, mcpUrl);
    const activePackage =
      packages.find((item) => item.id === agentHarness) || packages[0];
    const maskedKey = `${DEMO_API_KEY.slice(0, 8)}${'•'.repeat(16)}${DEMO_API_KEY.slice(-4)}`;
    const isAgentBuilder = activePackage.id === 'agentBuilder';

    return (
      <>
        <FullWidthAppHeader
          title={`Connect ${catalogDisplayName(namespace)} to your agent`}
          back={headerBack(
            contextIndexHref(namespace.name),
            catalogDisplayName(namespace),
            () => {
              setAgentNotice(null);
              setScreen('namespace');
            }
          )}
          tabs={headerSectionTabs}
          metadata={headerMeta(
            `Integration package for ${indexName}${
              namespace.integration ? ` · typically wired via ${namespace.integration}` : ''
            }`
          )}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section>
          {agentNotice && (
            <>
              <EuiCallOut
                size="s"
                color={agentNotice.type}
                title={agentNotice.text}
                onDismiss={() => setAgentNotice(null)}
              >
                {agentNotice.action ? (
                  <>
                    <EuiSpacer size="s" />
                    <EuiButton size="s" fill onClick={agentNotice.action.onClick}>
                      {agentNotice.action.label}
                    </EuiButton>
                  </>
                ) : null}
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          <EuiFlexGroup
            gutterSize="l"
            alignItems="flexStart"
            className="contextEnginePrototype__agentLayout"
          >
            <EuiFlexItem grow={7}>
              <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__agentPackage">
                <EuiTabs>
                  {packages.map((item) => (
                    <EuiTab
                      key={item.id}
                      isSelected={activePackage.id === item.id}
                      onClick={() => setAgentHarness(item.id)}
                    >
                      {item.label}
                    </EuiTab>
                  ))}
                </EuiTabs>
                <EuiSpacer size="l" />
                {isAgentBuilder ? (
                  <div className="contextEnginePrototype__agentBuilderPane">
                    {(() => {
                      const readyIndexes = namespaces.filter(
                        (item) => item.lifecycleStatus === 'ready' || Boolean(item.managed)
                      );
                      const contextLinks: Array<{ name: string; label: string; ns?: Namespace }> =
                        [];
                      readyIndexes.forEach((item) => {
                        if (contextLinks.length < 2) {
                          contextLinks.push({
                            name: item.name,
                            label: catalogDisplayName(item),
                            ns: item,
                          });
                        }
                      });
                      if (contextLinks.length < 2) {
                        contextLinks.push({
                          name: namespace.name,
                          label: catalogDisplayName(namespace),
                          ns: namespace,
                        });
                      }
                      if (contextLinks.length < 2) {
                        contextLinks.push({
                          name: managedElasticNamespace.name,
                          label: 'Elastic AI Index',
                        });
                      }
                      const uniqueLinks = contextLinks.filter(
                        (item, index, arr) =>
                          arr.findIndex((other) => other.name === item.name) === index
                      );
                      while (uniqueLinks.length < 2) {
                        uniqueLinks.push({
                          name: `demo-index-${uniqueLinks.length}`,
                          label:
                            uniqueLinks.length === 0
                              ? catalogDisplayName(namespace)
                              : 'support-ticket-triage',
                        });
                      }
                      return (
                        <>
                          <EuiText size="xs" color="subdued">
                            <strong>SETTINGS</strong>
                          </EuiText>
                          <EuiSpacer size="s" />
                          <EuiPanel
                            hasBorder
                            paddingSize="m"
                            className="contextEnginePrototype__agentContextBlock"
                          >
                            <EuiFlexGroup
                              alignItems="center"
                              justifyContent="spaceBetween"
                              gutterSize="m"
                              responsive={false}
                              wrap
                            >
                              <EuiFlexItem>
                                <EuiText size="s">
                                  <strong>Context</strong>
                                </EuiText>
                                <EuiText size="s" color="subdued">
                                  {agentBuilderContextOn
                                    ? 'Context Engine is on · retrieving from 2 AI indices'
                                    : 'Context Engine is off · not retrieving'}
                                </EuiText>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false}>
                                <EuiSwitch
                                  label={agentBuilderContextOn ? 'On' : 'Off'}
                                  checked={agentBuilderContextOn}
                                  onChange={(event) =>
                                    setAgentBuilderContextOn(event.target.checked)
                                  }
                                />
                              </EuiFlexItem>
                            </EuiFlexGroup>
                            {agentBuilderContextOn ? (
                              <>
                                <EuiSpacer size="s" />
                                <EuiText size="s">
                                  {uniqueLinks.slice(0, 2).map((item, index) => (
                                    <React.Fragment key={item.name}>
                                      {index > 0 ? ' · ' : null}
                                      <EuiLink
                                        onClick={() => {
                                          if (item.ns) {
                                            setActiveNamespace(item.ns);
                                            setScreen('namespace');
                                            selectNamespaceDetailTab('overview');
                                            return;
                                          }
                                          setScreen('index');
                                        }}
                                      >
                                        {item.label}
                                      </EuiLink>
                                    </React.Fragment>
                                  ))}
                                </EuiText>
                              </>
                            ) : null}
                            <EuiSpacer size="s" />
                            <EuiButtonEmpty
                              size="s"
                              flush="left"
                              iconSide="right"
                              iconType="arrowRight"
                              onClick={() => setScreen('index')}
                            >
                              Manage in Context
                            </EuiButtonEmpty>
                          </EuiPanel>
                          <EuiSpacer size="l" />
                          {isIndexConnectedInAgentBuilder(namespace) ? (
                            <EuiButton
                              fill
                              iconType="comment"
                              onClick={() => openInChat(namespace)}
                            >
                              Open in chat
                            </EuiButton>
                          ) : (
                            <EuiButton
                              fill
                              onClick={() => openAgentBuilderManage('support-triage')}
                            >
                              Enable in Agent Builder ›
                            </EuiButton>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                <div className="contextEnginePrototype__agentSteps">
                  {activePackage.steps.map((step, index) => (
                    <div key={step.title} className="contextEnginePrototype__agentStep">
                      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                        <EuiFlexItem grow={false}>
                          <EuiBadge color="hollow">{index + 1}</EuiBadge>
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EuiTitle size="xs">
                            <h2>{step.title}</h2>
                          </EuiTitle>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                      <EuiSpacer size="s" />
                      <EuiCodeBlock
                        language={step.language}
                        fontSize="s"
                        paddingSize="m"
                        isCopyable
                        overflowHeight={220}
                      >
                        {step.code}
                      </EuiCodeBlock>
                    </div>
                  ))}
                </div>
                )}
              </EuiPanel>
            </EuiFlexItem>

            {!isAgentBuilder && (
            <EuiFlexItem grow={3}>
              <EuiPanel
                hasBorder
                paddingSize="l"
                className="contextEnginePrototype__agentCredentials"
              >
                <EuiTitle size="xs">
                  <h2>Credentials</h2>
                </EuiTitle>
                <EuiSpacer size="s" />
                <EuiText size="s" color="subdued">
                  Point your agent at this namespace&apos;s MCP server. Keep the API key secret.
                </EuiText>
                <EuiSpacer size="m" />

                <EuiText size="xs" color="subdued">
                  <strong>MCP SERVER</strong>
                </EuiText>
                <EuiSpacer size="xs" />
                <EuiFlexGroup gutterSize="s" responsive={false} alignItems="center">
                  <EuiFlexItem className="contextEnginePrototype__agentCredentialValue">
                    <EuiCode className="contextEnginePrototype__mono">{mcpUrl}</EuiCode>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      iconType="copyClipboard"
                      onClick={() => copyText(mcpUrl, 'MCP server URL copied.')}
                    >
                      Copy
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>

                <EuiSpacer size="m" />
                <EuiText size="xs" color="subdued">
                  <strong>API KEY</strong>
                </EuiText>
                <EuiSpacer size="xs" />
                <EuiFlexGroup gutterSize="s" responsive={false} alignItems="center">
                  <EuiFlexItem className="contextEnginePrototype__agentCredentialValue">
                    <EuiCode className="contextEnginePrototype__mono">
                      {apiKeyRevealed ? DEMO_API_KEY : maskedKey}
                    </EuiCode>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      onClick={() => setApiKeyRevealed((current) => !current)}
                    >
                      {apiKeyRevealed ? 'Hide' : 'Show'}
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      iconType="copyClipboard"
                      onClick={() => copyText(DEMO_API_KEY, 'API key copied.')}
                    >
                      Copy
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </EuiFlexGroup>

                <EuiSpacer size="l" />
                <EuiFlexGroup direction="column" gutterSize="s">
                  <EuiFlexItem>
                    <EuiButton
                      fullWidth
                      iconType="download"
                      onClick={() =>
                        setAgentNotice({
                          type: 'success',
                          text: `Bootstrap skill for ${namespace.name} is ready to download (.zip).`,
                        })
                      }
                    >
                      Download bootstrap skill (.zip)
                    </EuiButton>
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiButton
                      fullWidth
                      fill
                      iconType="check"
                      onClick={() =>
                        setAgentNotice({
                          type: 'success',
                            text: `Connection OK · MCP server reached ${indexName}.`,
                        })
                      }
                    >
                      Test connection
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderAgentBuilderManage = () => {
    const namespace = activeNamespace || namespaces[0];
    const agents = [
      {
        id: 'support-triage',
        name: 'Support triage agent',
        description: 'Ticket routing and resolution',
      },
      {
        id: 'sales-outreach',
        name: 'Sales outreach agent',
        description: 'Outbound sequences and replies',
      },
      {
        id: 'docs-qa',
        name: 'Docs Q&A agent',
        description: 'Product documentation answers',
      },
    ];

    return (
      <>
        <FullWidthAppHeader
          title="Agent Builder · Manage Context"
          back={headerBack(
            contextIndexHref(namespace.name),
            'Use in an agent',
            () => {
              setAgentBuilderManageNotice(null);
              setHighlightedAgentBuilderRow(null);
              setScreen('agent');
              setAgentHarness('agentBuilder');
            }
          )}
          tabs={headerSectionTabs}
          metadata={headerMeta(
            `Enable Context for an agent so it can retrieve from ${catalogDisplayName(
              namespace
            )}.`
          )}
          spacing="largeBleed"
        />
        <EuiPageTemplate.Section>
          {agentBuilderManageNotice && (
            <>
              <EuiCallOut
                size="s"
                color={agentBuilderManageNotice.type}
                title={agentBuilderManageNotice.text}
                onDismiss={() => setAgentBuilderManageNotice(null)}
              >
                {agentBuilderManageNotice.action ? (
                  <>
                    <EuiSpacer size="s" />
                    <EuiButton size="s" fill onClick={agentBuilderManageNotice.action.onClick}>
                      {agentBuilderManageNotice.action.label}
                    </EuiButton>
                  </>
                ) : null}
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          <EuiPanel hasBorder paddingSize="m">
            <EuiFlexGroup direction="column" gutterSize="s">
              {agents.map((agent) => {
                const highlighted = highlightedAgentBuilderRow === agent.id;
                // Mock: support-triage is the target agent for enable/disable.
                const isTarget = agent.id === 'support-triage';
                const rowEnabled = isTarget
                  ? isIndexConnectedInAgentBuilder(namespace)
                  : false;
                return (
                  <EuiFlexItem key={agent.id}>
                    <EuiPanel
                      hasBorder
                      paddingSize="m"
                      className={`contextEnginePrototype__agentBuilderRow${
                        highlighted
                          ? ' contextEnginePrototype__agentBuilderRow--highlighted'
                          : ''
                      }`}
                      id={highlighted ? 'context-engine-8-agent-builder-highlight' : undefined}
                    >
                      <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false}>
                        <EuiFlexItem>
                          <EuiText size="s">
                            <strong>{agent.name}</strong>
                          </EuiText>
                          <EuiText size="xs" color="subdued">
                            {agent.description}
                          </EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiSwitch
                            label={rowEnabled ? 'Context on' : 'Context off'}
                            checked={rowEnabled}
                            disabled={!isTarget || Boolean(namespace.managed)}
                            onChange={(event) => {
                              if (!isTarget || namespace.managed) return;
                              const next = event.target.checked;
                              setAgentBuilderEnabledByIndex((current) => ({
                                ...current,
                                [namespace.name]: next,
                              }));
                              if (next) {
                                setAgentBuilderManageNotice({
                                  type: 'success',
                                  text: `Context enabled for ${agent.name}.`,
                                  action: {
                                    label: 'Open in chat',
                                    onClick: () => {
                                      setAgentBuilderManageNotice(null);
                                      openInChat(namespace);
                                    },
                                  },
                                });
                              } else {
                                setAgentBuilderManageNotice(null);
                              }
                            }}
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiPanel>
                  </EuiFlexItem>
                );
              })}
            </EuiFlexGroup>
          </EuiPanel>
        </EuiPageTemplate.Section>
      </>
    );
  };

  const screenContent = {
    index: renderIndex,
    create: renderCreate,
    namespace: renderNamespace,
    workflow: renderWorkflow,
    issue: AGENT_MONITORING_ENABLED ? renderIssue : renderNamespace,
    agent: renderAgent,
    agentBuilderManage: renderAgentBuilderManage,
  }[screen]();

  return (
    <KibanaRenderContextProvider {...coreStart}>
      <EuiPageTemplate
        offset={0}
        // grow fills viewport height and overflows #app-main-scroll; only the
        // workflow editor needs a full-height shell.
        grow={screen === 'workflow'}
        className={`contextEnginePrototype${
          screen === 'workflow' ? ' contextEnginePrototype--workflow' : ''
        }`}
      >
        {screenContent}
        <AgentMockOverlay seed={agentSidebarSeed} />
      </EuiPageTemplate>
    </KibanaRenderContextProvider>
  );
}

export const renderApp = (
  coreStart: CoreStart,
  plugins: AppPluginStartDependencies,
  { element, history }: Pick<AppMountParameters, 'element' | 'history'>
) => {
  ReactDOM.render(
    <ContextEngineApp coreStart={coreStart} plugins={plugins} history={history} />,
    element
  );
  return () => ReactDOM.unmountComponentAtNode(element);
};
