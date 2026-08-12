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
import {
  EuiAccordion,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
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
import type { AppMountParameters, CoreStart } from '@kbn/core/public';
import { CodeEditor } from '@kbn/code-editor';
import { KibanaRenderContextProvider } from '@kbn/react-kibana-context-render';

import './app.scss';
import {
  AI_AGENT_ICON,
  ELASTIC_AI_AGENT_ID,
  openContextAgentChat,
  type AppPluginStartDependencies,
  type ContextAgentSeed,
} from './ai_agent';
import { AgentMockOverlay } from './agent_mock_overlay';
import { AutomationTweakInput } from './automation_tweak_input';
import {
  operationalTagsFor,
  typeBadgeColor,
  valueBlockFor,
} from './knowledge_indicators';
import { currentUser$ } from './current_user';
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
  type KnowledgeIndicator,
  type MonitoringIssue,
  type Namespace,
  type NamespaceSource,
  type NamespaceStorageType,
} from './namespace_data';

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
type NamespaceDetailTab = 'overview' | 'automations' | 'knowledge';
type ImprovementStatus = 'open' | 'applying' | 'applied' | 'dismissed';
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
}
type CreatePanel = 'index' | 'sources';
type IntentMode = 'describe' | 'traces' | 'upload';

/**
 * Feature flag: Upload agent artifacts intent path.
 * Keep the upload UI/code; hide the card while false.
 */
const INTENT_UPLOAD_ARTIFACTS_ENABLED = false;

/**
 * Demo empty states on the Sources step.
 * Connectors start with none connected; ES|QL starts with no data until ingest mock.
 */
const MOCK_START_WITH_EMPTY_CONNECTORS = true;
const MOCK_START_WITH_EMPTY_ESQL = true;

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

/** Icon row for the zero-connector empty state (types you can connect). */
const CONNECTOR_EMPTY_TYPE_ICONS: Array<{ id: string; label: string; icon: string }> = [
  { id: 'google-drive', label: 'Drive', icon: 'logoGoogleG' },
  { id: 'zendesk', label: 'Zendesk', icon: 'plugs' },
  { id: 'slack', label: 'Slack', icon: 'logoSlack' },
  { id: 'sharepoint', label: 'SharePoint', icon: 'logoWindows' },
  { id: 'salesforce', label: 'Salesforce', icon: 'cloudStorm' },
  { id: 'github', label: 'GitHub', icon: 'logoGithub' },
];

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
 * Mock: new-user has managed Elastic AI Index already Active (no setup on Get started).
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

type SetupPhase = 'configure' | 'running' | 'review' | 'success';
type FirstRunScale = 'test' | 'full';

const SAMPLE_SETUP_KI_COUNT = 6;

interface SetupSampleKi {
  key: string;
  type: string;
  content: string;
  from: string;
  badge?: 'Updated' | 'New' | 'Hit';
}

type ReviewTryResult =
  | {
      kind: 'hit';
      answer: string;
      hitKey: string;
      hitLabel: string;
    }
  | {
      kind: 'miss';
      answer: string;
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

/** One sample card per approved automation that ran (falls back to sources). */
const buildSetupSampleKis = (namespace: Namespace): SetupSampleKi[] => {
  if (namespace.automations.length > 0) {
    return namespace.automations.map((automation, index) => {
      const sourceName =
        automation.tags.find((tag) => namespace.sources.includes(tag)) ||
        namespace.sources[index] ||
        automation.title.replace(/^Extract Knowledge Indicators from\s+/i, '') ||
        'your source';
      return sampleKiForSource(sourceName, index);
    });
  }
  return namespace.sources.map((sourceName, index) => sampleKiForSource(sourceName, index));
};

const isUsableIntentSentence = (intentValue?: string) => {
  const intent = intentValue?.trim() ?? '';
  if (intent.length < 12) return false;
  if (!/\s/.test(intent)) return false;
  if (/^(test|asdf|foo|bar|hello|hi)\b/i.test(intent)) return false;
  return true;
};

const mockSetupPageCount = (namespace: Namespace) =>
  Math.max(240, namespace.sources.length * 380 + 120);

const mockFullSetupKiCount = (namespace: Namespace) =>
  Math.max(24, namespace.sources.length * 8);

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
            source: 'Extraction workflow',
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

/** Mock: apply a plain-text tweak to review samples (Updated + New cards). */
const applyTweakToSetupSamples = (
  samples: SetupSampleKi[],
  userText: string
): SetupSampleKi[] => {
  const next = samples.map((sample, index) => {
    if (index !== 0) return sample;
    let content = sample.content.replace(/\.$/, '');
    if (/archiv/i.test(userText)) {
      content = `${content}; archived pages ignored.`;
    } else if (/meeting/i.test(userText)) {
      content = `${content}; meeting notes skipped.`;
    } else if (/split|service/i.test(userText)) {
      content = `${content}; split by service where possible.`;
    } else {
      content = `${content}; extraction narrowed per your prompt.`;
    }
    return { ...sample, content: `${content}.`, badge: 'Updated' as const };
  });
  const from = samples[0]?.from || 'your sources';
  let newContent =
    'Extraction rules updated to match your prompt; sample refreshed.';
  if (/archiv/i.test(userText)) {
    newContent = 'Archived pages excluded; 2 stale runbooks dropped from extraction.';
  } else if (/meeting/i.test(userText)) {
    newContent = 'Meeting notes skipped; extraction limited to durable source docs.';
  } else if (/split|service/i.test(userText)) {
    newContent = 'Runbooks split by service; ownership tags added to each playbook.';
  }
  next.push({
    key: `sample-new-${Date.now()}`,
    type: 'Fact',
    content: newContent,
    from,
    badge: 'New',
  });
  return next;
};

/** Mock: agents already running in this deployment with APM/OTel traces. */
const traceStreams = [
  {
    id: 'traces-apm.agent-support.default',
    agentName: 'Support triage agent',
    questionCount: '1,204',
    lastActive: '2 hours ago',
    streamName: 'traces-apm.agent-support.default',
  },
  {
    id: 'traces-apm.agent-sales.default',
    agentName: 'Sales outreach agent',
    questionCount: '642',
    lastActive: 'yesterday',
    streamName: 'traces-apm.agent-sales.default',
  },
  {
    id: 'traces-otel-langgraph.docs_qa-default',
    agentName: 'Docs Q&A agent',
    questionCount: '318',
    lastActive: '3 days ago',
    streamName: 'traces-otel-langgraph.docs_qa-default',
  },
];

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
}

/** Proto 4: Signals, oTel Traces, and Elastic Features are hidden for now. */
const sourceCategories: Array<{
  id: SourceCategory;
  label: string;
  icon: string;
  createLabel: string;
}> = [
  {
    id: 'esql',
    label: 'ES|QL Views',
    icon: 'editorCodeBlock',
    createLabel: 'Create a new ES|QL view',
  },
  { id: 'connectors', label: 'Connectors', icon: 'plugs', createLabel: 'Add a connector' },
];

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
    icon: 'cloudStorm',
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
    id: 'support-triage',
    name: 'Support triage agent',
    description: 'traces-apm.agent-support.default · 1,204 traces',
    category: 'traces',
    typeLabel: 'OTel traces',
    icon: 'apmTrace',
  },
  {
    id: 'sales-agent',
    name: 'Sales outreach agent',
    description: 'traces-apm.agent-sales.default · 642 traces',
    category: 'traces',
    typeLabel: 'OTel traces',
    icon: 'apmTrace',
  },
  {
    id: 'docs-agent',
    name: 'Docs Q&A (LangGraph)',
    description: 'traces-otel-langgraph.docs_qa-default · 318 traces',
    category: 'traces',
    typeLabel: 'OTel traces',
    icon: 'apmTrace',
  },
  {
    id: 'support-bot',
    name: 'Support bot (CrewAI)',
    description: 'traces-genai-crewai.support_bot-prod · 512 traces',
    category: 'traces',
    typeLabel: 'OTel traces',
    icon: 'apmTrace',
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

const mockAutomationLastRun = (automationId: string) => {
  const labels = ['2 hours ago', 'yesterday', '3 days ago', 'this morning'];
  let hash = 0;
  for (let index = 0; index < automationId.length; index += 1) {
    hash += automationId.charCodeAt(index);
  }
  return labels[hash % labels.length];
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

/** Deep link open query: `/app/contextEngineExample5?open=Elastic`. */
const readOpenIndexDeepLink = (search: string): string | null => {
  try {
    return new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('open');
  } catch {
    return null;
  }
};

/**
 * Proto demo flag for user-created indexes only (hasMonitoringData).
 * false: Overview shows traces-connected placeholder; hides suggestions.
 * true: Overview shows stats strip + Improvements (when tracesAnalysed > 0).
 */
const MOCK_USER_CREATED_MONITORING_ANALYSIS_READY = false;

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
 * tables). First three show by default; View all expands the rest in place.
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
        description: `For exception fingerprint questions, your agent queried raw ${primary} 6 times instead of retrieving knowledge.`,
        casesCount: 6,
        lastSeen: 'today',
        proposedFix: `Broaden the ${primary} automation to extract per-service exception summaries, so these questions answer from knowledge.`,
        tweakPlaceholder: 'Adjust the fix, e.g. only production hosts...',
        createsAutomation: false,
        findingDetail: `The agent queried ${primary} directly instead of retrieving a knowledge item (6 times).`,
        firstSeen: 'Jul 31, 21:16',
        lastSeenDetail: 'Today, 09:24',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['n1', 'n2', 'n3']),
      },
      {
        id: `${prefix}-disk-gap`,
        title: 'Disk pressure questions miss knowledge 11 times',
        description: `Host disk questions fell back to scanning ${secondary}; no Knowledge Indicators cover disk pressure playbooks.`,
        casesCount: 11,
        lastSeen: 'yesterday',
        proposedFix: `Add an automation on ${secondary} extracting disk-pressure playbooks per host class.`,
        tweakPlaceholder: 'Adjust the fix, e.g. only hosts above 90%...',
        createsAutomation: true,
        findingDetail: `Disk pressure questions fell back to scanning ${secondary} (11 times).`,
        firstSeen: 'Jul 28, 14:02',
        lastSeenDetail: 'Yesterday, 16:41',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(secondary, ['n4', 'n5', 'n6']),
      },
      {
        id: `${prefix}-service-error-gap`,
        title: 'Service error lookups skip knowledge (18 cases)',
        description: `Service error questions always query ${secondary} directly; a small error-signal glossary would answer them from knowledge.`,
        casesCount: 18,
        lastSeen: 'today',
        proposedFix: `Extract an error-signal glossary (service, fingerprint, owner) from ${secondary}.`,
        tweakPlaceholder: 'Adjust the fix...',
        createsAutomation: false,
        findingDetail: `Service error questions always queried ${secondary} directly (18 times).`,
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
        findingDetail: `Log-level filter questions scanned ${primary} (9 times).`,
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
        findingDetail: `NPE clusters were re-queried from ${primary} (14 times).`,
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
        findingDetail: `TimeoutException questions scanned ${secondary} (7 times).`,
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
        description: `For refund questions, your agent queried raw ${primary} 6 times instead of retrieving knowledge.`,
        casesCount: 6,
        lastSeen: 'today',
        proposedFix: `Broaden the ${primary} automation to extract refund-path FAQs, so these questions answer from knowledge.`,
        tweakPlaceholder: 'Adjust the fix, e.g. only last 90 days...',
        createsAutomation: false,
        findingDetail: `The agent queried ${primary} directly instead of retrieving a knowledge item (6 times).`,
        firstSeen: 'Jul 31, 21:16',
        lastSeenDetail: 'Today, 09:24',
        confidence: 'High',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['s1', 's2', 's3']),
      },
      {
        id: `${prefix}-sla-gap`,
        title: 'SLA questions miss knowledge 19 times',
        description: `SLA questions fell back to scanning ${primary}; no Knowledge Indicators cover SLA windows by priority.`,
        casesCount: 19,
        lastSeen: 'yesterday',
        proposedFix: `Add an automation on ${primary} extracting SLA window policies by priority.`,
        tweakPlaceholder: 'Adjust the fix, e.g. P1/P2 only...',
        createsAutomation: true,
        findingDetail: `SLA questions fell back to scanning ${primary} (19 times).`,
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
        findingDetail: `Escalation questions always opened ${secondary} directly (29 times).`,
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
        findingDetail: `Macro linkage questions scanned ${primary} (12 times).`,
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
        findingDetail: `Ownership questions opened ${secondary} (8 times).`,
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
        findingDetail: `Priority routing scanned ${primary} (10 times).`,
        firstSeen: 'Jul 26, 12:03',
        lastSeenDetail: 'Yesterday, 19:22',
        confidence: 'Medium',
        traceSource: 'traces-agent_builder.otel',
        cases: improvementCases(primary, ['s16', 's17', 's18']),
      },
    ];
  }

  // Generic / managed Elastic / other indexes: grounded on their listed sources.
  return [
    {
      id: `${prefix}-bypass-1`,
      title: `Agent bypasses knowledge for ${primary} questions`,
      description: `For common questions, your agent queried raw ${primary} 6 times instead of retrieving knowledge.`,
      casesCount: 6,
      lastSeen: 'today',
      proposedFix: `Broaden the ${primary} automation so these questions answer from knowledge.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: false,
      findingDetail: `The agent queried ${primary} directly (6 times).`,
      firstSeen: 'Jul 31, 21:16',
      lastSeenDetail: 'Today, 09:24',
      confidence: 'High',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(primary, ['g1', 'g2', 'g3']),
    },
    {
      id: `${prefix}-gap-2`,
      title: `${secondary} questions miss knowledge 19 times`,
      description: `Questions fell back to scanning ${secondary}; no Knowledge Indicators cover the recurring ask.`,
      casesCount: 19,
      lastSeen: 'yesterday',
      proposedFix: `Add an automation on ${secondary} extracting the missing facts.`,
      tweakPlaceholder: 'Adjust the fix...',
      createsAutomation: true,
      findingDetail: `Questions fell back to scanning ${secondary} (19 times).`,
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
      findingDetail: `Lookups always queried ${primary} (29 times).`,
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
      findingDetail: `Stale retrievals against ${secondary} (9 times).`,
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
      findingDetail: `Entity resolution scanned ${primary} (14 times).`,
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
      findingDetail: `Policy questions opened ${secondary} (7 times).`,
      firstSeen: 'Jul 26, 12:03',
      lastSeenDetail: 'Yesterday, 19:22',
      confidence: 'Medium',
      traceSource: 'traces-agent_builder.otel',
      cases: improvementCases(secondary, ['g16', 'g17', 'g18']),
    },
  ];
};

const HOW_IT_WORKS_STORAGE_KEY = 'context.index.howItWorks.dismissed';

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
  return fuzzy?.title || indicator.extractedBy || 'Extraction workflow';
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
  const [activeCategory, setActiveCategory] = useState<SourceCategory>('esql');
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
  /** Optional add-on: merge agent traces into the same intent signal. */
  const [intentTracesEnabled, setIntentTracesEnabled] = useState(false);
  const [intentTraceStream, setIntentTraceStream] = useState<string>(
    () => traceStreams[0]?.id ?? ''
  );
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
  const [workflowEditable, setWorkflowEditable] = useState(true);
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [workflowDirty, setWorkflowDirty] = useState(false);
  const [workflowNotice, setWorkflowNotice] = useState<{
    type: 'success' | 'warning' | 'danger';
    text: string;
  } | null>(null);
  const [showTestRunModal, setShowTestRunModal] = useState(false);
  const [workflowEditorHeight, setWorkflowEditorHeight] = useState(640);
  const workflowEditorRef = useRef<HTMLDivElement | null>(null);
  const [agentHarness, setAgentHarness] = useState<AgentHarness>('claudeCode');
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [agentNotice, setAgentNotice] = useState<{
    type: 'success' | 'warning' | 'danger';
    text: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  /**
   * Mock store shared with Agent Builder > Context: which indexes are enabled
   * for Elastic AI Agent. Managed indexes are always treated as connected.
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
  const [setupPhaseByIndex, setSetupPhaseByIndex] = useState<Record<string, SetupPhase>>({});
  const [managedSetupToggles, setManagedSetupToggles] = useState<Record<string, boolean>>({
    dashboards: false,
    visualisations: false,
    alerts: false,
    slos: false,
  });
  const [setupSuccessKiCount, setSetupSuccessKiCount] = useState(0);
  const [firstRunScale, setFirstRunScale] = useState<FirstRunScale>('test');
  const [activeSetupRun, setActiveSetupRun] = useState<FirstRunScale | null>(null);
  /** How many per-source progress lines have completed during a first run (then drafting). */
  const [setupRunProgress, setSetupRunProgress] = useState(0);
  const [reviewSampleOverride, setReviewSampleOverride] = useState<SetupSampleKi[] | null>(null);
  const [reviewTweakApplying, setReviewTweakApplying] = useState(false);
  const [reviewTweakEcho, setReviewTweakEcho] = useState('');
  const [proposalConfirmations, setProposalConfirmations] = useState<Record<string, string>>({});
  const [proposalEditorOpenId, setProposalEditorOpenId] = useState<string | null>(null);
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
    const sub = currentUser$.subscribe((user) => setIsAdmin(user.isAdmin));
    return () => sub.unsubscribe();
  }, []);

  const [isDefiningDescription, setIsDefiningDescription] = useState(false);
  const [namespaceQuery, setNamespaceQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [focusMonitoring, setFocusMonitoring] = useState(false);
  const [namespaceDetailTab, setNamespaceDetailTab] =
    useState<NamespaceDetailTab>('overview');
  const [improvementStatusById, setImprovementStatusById] = useState<
    Record<string, ImprovementStatus>
  >({});
  const [improvementFixById, setImprovementFixById] = useState<Record<string, string>>({});
  const [improvementsExpanded, setImprovementsExpanded] = useState(false);
  const [agentSidebarSeed, setAgentSidebarSeed] = useState<ContextAgentSeed | null>(null);
  /** KI detail flyout on the Knowledge Indicators tab (replaces the old browser page). */
  const [kiFlyoutIndicatorId, setKiFlyoutIndicatorId] = useState<string | null>(null);
  const [evidenceImprovementId, setEvidenceImprovementId] = useState<string | null>(null);
  const [showSuggestedAutomations, setShowSuggestedAutomations] = useState(false);
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

  const dismissHowItWorks = () => {
    try {
      window.localStorage.setItem(HOW_IT_WORKS_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failures in proto/demo.
    }
    setHowItWorksDismissed(true);
    setHowItWorksVisible(false);
  };

  // Local tab state only — writing ?tab= into the URL makes Kibana's app router
  // treat it as a navigation and show "Unable to load page".
  const selectNamespaceDetailTab = (tab: NamespaceDetailTab) => {
    if (tab !== 'knowledge') {
      setKiTabTypeFilter(null);
    }
    setNamespaceDetailTab(tab);
  };

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
        .getElementById('context-engine-5-overview-monitoring')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [screen, focusMonitoring, activeNamespace?.name]);

  useEffect(() => {
    if (screen !== 'agentBuilderManage' || !highlightedAgentBuilderRow) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById('context-engine-5-agent-builder-highlight')
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
   * Single intent signal. Description and optional agent traces combine;
   * upload (feature-flagged) can also contribute when enabled.
   */
  const intentSignal = useMemo(() => {
    if (INTENT_UPLOAD_ARTIFACTS_ENABLED && intentMode === 'upload') {
      return intentInferred.trim();
    }
    const parts: string[] = [];
    if (intentDescription.trim()) {
      parts.push(intentDescription.trim());
    }
    if (intentTracesEnabled) {
      const selected = traceStreams.find((stream) => stream.id === intentTraceStream);
      if (selected) {
        parts.push(
          `Questions from ${selected.agentName}: ${selected.questionCount} questions, last active ${selected.lastActive}.`
        );
      }
    }
    return parts.join(' ');
  }, [
    intentMode,
    intentDescription,
    intentTracesEnabled,
    intentTraceStream,
    intentInferred,
  ]);

  const intentComplete = (() => {
    if (INTENT_UPLOAD_ARTIFACTS_ENABLED && intentMode === 'upload') {
      return Boolean(intentUploadFileName) && Boolean(intentInferred.trim());
    }
    const hasDescription = Boolean(intentDescription.trim());
    const hasTraces = intentTracesEnabled && Boolean(intentTraceStream);
    return hasDescription || hasTraces;
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

  /** Connectors / ES|QL lists respect demo empty states, then intent-suggest sort. */
  const visibleSources = useMemo(() => {
    let filtered = availableSources.filter(({ category }) => category === activeCategory);
    if (activeCategory === 'connectors') {
      filtered = filtered.filter((source) => connectedConnectorIds.includes(source.id));
    }
    if (activeCategory === 'esql' && !esqlDataReady) {
      filtered = [];
    }
    if (activeCategory !== 'connectors' || intentSuggestPhase !== 'resolved') {
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
    connectedConnectorIds,
    esqlDataReady,
  ]);

  const connectorCatalog = useMemo(
    () => availableSources.filter((source) => source.category === 'connectors'),
    []
  );

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
    if (screen !== 'create' || createPanel !== 'sources') {
      return;
    }
    if (!intentSignal) {
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
        .getElementById(`context-engine-5-source-${sourceId}`)
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
    return namespaces.filter((namespace) => {
      const lifecycle = resolveCatalogLifecycle(namespace);
      if (healthFilter === 'needsSetup' && lifecycle.kind !== 'needsSetup') return false;
      if (healthFilter === 'healthy' && lifecycle.kind !== 'ready') return false;
      if (healthFilter === 'issues' && lifecycle.kind !== 'issues') return false;
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

  const goToIndex = () => {
    setScreen('index');
    setActiveNamespace(null);
    setActiveIssue(null);
    setActiveIndicatorId(null);
    setSelectedKiVersion(null);
    setAddedAutomations([]);
    setShowSuggestedAutomations(false);
    setKiTabTypeFilter(null);
    setKiAutomationFilter(null);
    selectNamespaceDetailTab('overview');
  };

  const startWizard = () => {
    setSelectedSourceIds([]);
    setNamespaceName('');
    setStorageType('index');
    setDataNatureTouched(false);
    setSourcesAdvancedOpen(false);
    setActiveCategory('connectors');
    setCreatePanel('index');
    setIntentMode(null);
    setIntentDescription('');
    setIntentTracesEnabled(false);
    setIntentTraceStream(traceStreams[0]?.id ?? '');
    setIntentUploadFileName(null);
    setIntentInferred('');
    setIntentUploadPickerKey((key) => key + 1);
    setConnectedConnectorIds(
      MOCK_START_WITH_EMPTY_CONNECTORS
        ? []
        : availableSources.filter((s) => s.category === 'connectors').map((s) => s.id)
    );
    setEsqlDataReady(!MOCK_START_WITH_EMPTY_ESQL);
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
    setActiveCategory('esql');
    setCreatePanel('sources');
    const savedIntent = activeNamespace.intent;
    setIntentMode(savedIntent?.type ?? null);
    const savedValue = savedIntent?.value ?? '';
    const tracesMatch = traceStreams.find((stream) =>
      savedValue.includes(stream.agentName)
    );
    const descriptionOnly =
      savedIntent?.type === 'describe'
        ? savedValue
            .replace(
              /\s*Questions from [^:]+: \d+ questions, last active [^.]+\.\s*/g,
              ' '
            )
            .trim()
        : '';
    setIntentDescription(
      savedIntent?.type === 'describe'
        ? descriptionOnly
        : savedIntent?.type === 'upload'
          ? savedValue
          : ''
    );
    setIntentTracesEnabled(Boolean(tracesMatch) || savedIntent?.type === 'traces');
    setIntentTraceStream(tracesMatch?.id ?? traceStreams[0]?.id ?? '');
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
    setSelectedSourceIds((current) =>
      current.includes(id) ? current.filter((sourceId) => sourceId !== id) : [...current, id]
    );
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
      INTENT_UPLOAD_ARTIFACTS_ENABLED && intentMode === 'upload'
        ? 'upload'
        : intentDescription.trim()
          ? 'describe'
          : 'traces';
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
      // Proto/demo: first create reveals pre-existing env indexes + the new card.
      if (!hasCreatedIndex) {
        return [managed, namespace, ...demoEnvironmentNamespaces];
      }
      return [...current, namespace];
    });
    setHasCreatedIndex(true);
    setSetupPhase(namespace.name, 'configure');
    setSetupSuccessKiCount(0);
    setActiveSetupRun(null);
    setSetupRunProgress(0);
    setFirstRunScale('test');
    setAddedAutomations([]);
    setActiveIssue(null);
    setShowSuggestedAutomations(false);
    setSetupReadyBanner(null);
    setKiTabTypeFilter(null);
    setReviewSampleOverride(null);
    openNamespace(namespace, { focusSetup: true });
    coreStart.notifications.toasts.addSuccess('AI index created');
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
    setShowSuggestedAutomations(false);
    setImprovementStatusById({});
    setImprovementFixById({});
    setEvidenceImprovementId(null);
    setKiAutomationFilter(null);
    setKiTabTypeFilter(null);
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

  const openWorkflow = (automation?: Automation | string) => {
    const automationObj = typeof automation === 'string' ? undefined : automation;
    const automationTitle = typeof automation === 'string' ? automation : automation?.title;
    const sourceName = resolveWorkflowSource(automationObj);
    const yaml = buildWorkflowYaml(sourceName, automationTitle);
    setWorkflowSourceName(sourceName);
    setWorkflowYaml(yaml);
    setWorkflowEditable(true);
    setWorkflowEnabled(!/^enabled:\s*false\s*$/m.test(yaml));
    setWorkflowDirty(false);
    setWorkflowNotice(null);
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

  const mockRunProgressDoneLabel = (sourceName: string) => {
    if (/slack/i.test(sourceName)) return `${sourceName} · 1 candidate FAQ`;
    if (/drive|google/i.test(sourceName)) return `${sourceName} · 3 candidate facts`;
    if (/confluence|wiki|doc/i.test(sourceName)) return `${sourceName} · 2 candidate facts`;
    return `${sourceName} · 2 candidate facts`;
  };

  const mockRunProgressActiveLabel = (sourceName: string, index: number) => {
    if (index === 0 || /bigquery|es\|ql|view|analytics/i.test(sourceName)) {
      return `Searching ${sourceName}...`;
    }
    return `Reading ${sourceName}...`;
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
    setFirstRunScale('test');
    setSetupPhase(namespace.name, 'configure');
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

  const startFirstRun = (namespace: Namespace, scale: FirstRunScale) => {
    clearSetupTimer();
    setActiveSetupRun(scale);
    setSetupSuccessKiCount(0);
    setSetupRunProgress(0);
    setReviewSampleOverride(null);
    setReviewTweakApplying(false);
    setReviewTweakEcho('');
    setReviewTryQuestion('');
    setReviewTryResult(null);
    setSetupPhase(namespace.name, 'running');
    patchNamespace(namespace.name, { lifecycleStatus: 'settingUp' });
    const sourceCount = Math.max(
      1,
      namespace.automations.length > 0 ? namespace.automations.length : namespace.sources.length
    );
    // Advance one source line every ~1.5s, then drafting, then review.
    let step = 0;
    const tick = () => {
      step += 1;
      setSetupRunProgress(step);
      if (step <= sourceCount) {
        setupTimerRef.current = window.setTimeout(tick, 1500);
        return;
      }
      // Drafting line shown; settle into review shortly after.
      setupTimerRef.current = window.setTimeout(() => {
        const kiCount = scale === 'test' ? SAMPLE_SETUP_KI_COUNT : mockFullSetupKiCount(namespace);
        setSetupSuccessKiCount(kiCount);
        patchNamespace(namespace.name, {
          indicators: buildSetupIndicators(namespace, kiCount),
          knowledge: knowledgeFromKiCount(kiCount),
        });
        setSetupPhase(namespace.name, 'review');
        setupTimerRef.current = null;
      }, 1500);
    };
    setupTimerRef.current = window.setTimeout(tick, 1500);
  };

  const continueFirstRunToFull = (namespace: Namespace) => {
    clearSetupTimer();
    setActiveSetupRun('full');
    setSetupRunProgress(0);
    setSetupPhase(namespace.name, 'running');
    patchNamespace(namespace.name, { lifecycleStatus: 'settingUp' });
    const sourceCount = Math.max(
      1,
      namespace.automations.length > 0 ? namespace.automations.length : namespace.sources.length
    );
    let step = 0;
    const tick = () => {
      step += 1;
      setSetupRunProgress(step);
      if (step <= sourceCount) {
        setupTimerRef.current = window.setTimeout(tick, 1500);
        return;
      }
      setupTimerRef.current = window.setTimeout(() => {
        const kiCount = mockFullSetupKiCount(namespace);
        setSetupSuccessKiCount(kiCount);
        finalizeSetupReady(namespace, kiCount);
      }, 1500);
    };
    setupTimerRef.current = window.setTimeout(tick, 1500);
  };

  const finishFirstRunFromReview = (namespace: Namespace) => {
    finalizeSetupReady(namespace, setupSuccessKiCount || mockFullSetupKiCount(namespace));
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

  const pageHeader = (title: string, description?: string, rightSideItems?: React.ReactNode[]) => (
    <EuiPageTemplate.Header
      pageTitle={title}
      description={description}
      rightSideItems={rightSideItems}
    />
  );

  const sourceRow = (source: Source) => {
    const selected = selectedSourceIds.includes(source.id);
    const suggestion =
      intentSuggestPhase === 'resolved' ? intentMatchById.get(source.id) : undefined;
    const pulsing = pulsingSourceId === source.id;
    return (
      <EuiPanel
        id={`context-engine-5-source-${source.id}`}
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
        <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
          <EuiFlexItem grow={false}>
            <span className="contextEnginePrototype__sourceIcon">
              <EuiIcon type={source.icon} aria-hidden={true} />
            </span>
          </EuiFlexItem>
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
              <span className="contextEnginePrototype__mono">{source.description}</span>
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
    );
  };

  const renderIndex = () => {
    const maxVisibleSources = 3;
    const healthFilterOptions = [
      { value: 'all', text: 'All' },
      { value: 'healthy', text: 'Healthy' },
      { value: 'issues', text: 'Has issues' },
      { value: 'needsSetup', text: 'Needs setup' },
    ];
    return (
      <>
        {pageHeader(
          'Context',
          'AI indexes built from your data sources, ready for retrieval by any agent.',
          [
            <EuiButton key="create" fill iconType="plusInCircle" onClick={startWizard}>
              Create AI Index
            </EuiButton>,
          ]
        )}
        <EuiPageTemplate.Section grow={false}>
          {!hasCreatedIndex ? (
            <EuiFlexGroup
              className="contextEnginePrototype__landingEmpty"
              justifyContent="center"
              alignItems="center"
            >
              <EuiFlexItem grow={false} className="contextEnginePrototype__landingEmptyItem">
                <EuiEmptyPrompt
                  className="contextEnginePrototype__landingPrompt"
                  layout="horizontal"
                  color="plain"
                  paddingSize="none"
                  icon={
                    <EuiImage
                      size="fullWidth"
                      src={coreStart.http.basePath.prepend(
                        '/plugins/contextEngineExampleFive/assets/empty_state.png'
                      )}
                      alt=""
                    />
                  }
                  title={
                    <h2 className="contextEnginePrototype__landingTitle">
                      Get started with Context
                    </h2>
                  }
                  body={
                    <>
                      <EuiText size="m" color="subdued">
                      <p className="contextEnginePrototype__landingBody">
                        You have an agent. Give it knowledge. An AI index is a live collection of
                          facts built from your data: connect your <strong>sources</strong> once,
                          and <strong>automations</strong> keep extracting and refreshing the{' '}
                          <strong>Knowledge Indicators</strong> your agent retrieves, so it answers
                          from knowledge instead of scanning raw data every time. The model behind
                          it is built in; there is nothing to configure first.
                        </p>
                      </EuiText>
                      <EuiSpacer
                        size="l"
                        className="contextEnginePrototype__landingBodySpacer"
                      />
                      <EuiFlexGroup
                        gutterSize="s"
                        alignItems="center"
                        responsive={false}
                        wrap
                      >
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
                            aria-label="Learn what an AI index is"
                          >
                            Learn what an AI index is
                          </EuiButtonEmpty>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </>
                  }
                  footer={
                    <>
                      {(() => {
                        // New-user: managed index is Active; no setup action on this page.
                        // TODO(existing-customer): "Not enabled · Enable it in your agent ›"
                        const managed =
                          namespaces.find((item) => item.managed) ??
                          ({
                            ...managedElasticNamespace,
                            lifecycleStatus: 'ready',
                          } as Namespace);
                        return (
                          <div
                        className="contextEnginePrototype__landingManagedRow"
                        aria-label={MANAGED_ELASTIC_DISPLAY_NAME}
                      >
                        <EuiFlexGroup
                              alignItems="center"
                              justifyContent="spaceBetween"
                          gutterSize="m"
                          responsive={false}
                              wrap
                            >
                              <EuiFlexItem grow={true}>
                            <EuiFlexGroup
                              className="contextEnginePrototype__landingManagedTitleRow"
                              alignItems="center"
                              gutterSize="s"
                              responsive={false}
                                  wrap
                            >
                              <EuiFlexItem grow={false}>
                                    <EuiText size="xs">
                                      <p className="contextEnginePrototype__landingManagedTitle">
                                        {MANAGED_ELASTIC_DISPLAY_NAME} is already running for you
                                      </p>
                                </EuiText>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false}>
                                <EuiBadge
                                  color="hollow"
                                  iconType="lock"
                                  className="contextEnginePrototype__typeBadge"
                                >
                                  Managed
                                </EuiBadge>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false}>
                                <EuiBadge
                                  color="success"
                                  className="contextEnginePrototype__typeBadge"
                                >
                                  Active
                                </EuiBadge>
                              </EuiFlexItem>
                            </EuiFlexGroup>
                                <EuiText size="xs" color="subdued">
                                  Dashboards, Visualisations, Alerts and SLOs enabled
                            </EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                                <EuiLink onClick={() => openInChat(managed)}>
                                  Open in chat ›
                                </EuiLink>
                              </EuiFlexItem>
                            </EuiFlexGroup>
                          </div>
                        );
                      })()}
                      <div className="contextEnginePrototype__landingHelp">
                      <EuiTitle size="xxs">
                        <span>Need help?</span>
                      </EuiTitle>{' '}
                      <EuiLink href="https://www.elastic.co/docs" target="_blank">
                        Read documentation
                      </EuiLink>
                      </div>
                    </>
                  }
                />
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : filteredNamespaces.length === 0 ? (
            <EuiPanel hasBorder paddingSize="l">
              <EuiText color="subdued">No AI indexes match your search or filters.</EuiText>
            </EuiPanel>
          ) : (
            <>
              <EuiFlexGroup
                className="contextEnginePrototype__indexToolbar"
                gutterSize="m"
                alignItems="flexEnd"
                wrap
              >
                <EuiFlexItem grow={2} className="contextEnginePrototype__indexSearch">
                  <EuiFormRow label="Search" display="rowCompressed" fullWidth>
                    <EuiFieldSearch
                      compressed
                      fullWidth
                      placeholder="Search AI indexes"
                      value={namespaceQuery}
                      onChange={(event) => setNamespaceQuery(event.target.value)}
                      aria-label="Search AI indexes"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                <EuiFlexItem grow={false} className="contextEnginePrototype__indexFilter">
                  <EuiFormRow label="Health" display="rowCompressed">
                    <EuiSelect
                      compressed
                      options={healthFilterOptions}
                      value={healthFilter}
                      onChange={(event) => setHealthFilter(event.target.value as HealthFilter)}
                      aria-label="Filter by health"
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="l" />
              <EuiFlexGrid columns={3} gutterSize="l">
              {filteredNamespaces.map((namespace) => {
                const displayName = catalogDisplayName(namespace);
                const lifecycle = resolveCatalogLifecycle(namespace);
                const needsSetup = lifecycle.kind === 'needsSetup';
                const settingUp = lifecycle.kind === 'settingUp';
                const kiCount = namespace.managed
                  ? MANAGED_ELASTIC_ENABLED_KI_COUNT
                  : knowledgeTotal(namespace.knowledge);
                const shownSources = namespace.sources.slice(0, maxVisibleSources);
                const hiddenSourceCount = Math.max(0, namespace.sources.length - maxVisibleSources);
                const storageDisplay =
                  namespace.storageType === 'dataStream' ? 'Data stream' : 'Index';
                const statusMeta =
                  needsSetup
                    ? namespace.managed
                      ? 'Requires a one-time setup'
                      : 'No automations running yet'
                    : settingUp
                      ? 'Populating · first knowledge in a few minutes'
                      : `${storageDisplay} · ${kiCount} KI`;
                const metaLabel = namespace.managed ? 'Ownership' : 'Updated';
                const metaValue = namespace.managed ? 'Elastic' : namespace.updated;
                const cardClassName = namespace.managed
                  ? 'contextEnginePrototype__namespaceCard contextEnginePrototype__namespaceCard--managed'
                  : 'contextEnginePrototype__namespaceCard';
                const openCard = () => {
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
                      <EuiBadge
                        color="warning"
                        className="contextEnginePrototype__typeBadge"
                      >
                        {lifecycle.count} issue{lifecycle.count === 1 ? '' : 's'}
                      </EuiBadge>
                    );
                  }
                  return (
                    <EuiBadge
                      color="success"
                      className="contextEnginePrototype__typeBadge"
                    >
                      {namespace.managed ? 'Active' : 'Ready'}
                    </EuiBadge>
                  );
                })();

                return (
                  <EuiFlexItem key={namespace.name}>
                    <EuiPanel
                      hasBorder
                      paddingSize="m"
                      className={cardClassName}
                      onClick={openCard}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openCard();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${displayName}`}
                    >
                      <div className="contextEnginePrototype__namespaceCardBody">
                        <EuiFlexGroup
                          alignItems="center"
                          gutterSize="s"
                          responsive={false}
                          wrap
                        >
                          <EuiFlexItem grow={true}>
                            <EuiTitle size="xs">
                              <h2>{displayName}</h2>
                            </EuiTitle>
                          </EuiFlexItem>
                          {namespace.managed && (
                              <EuiFlexItem grow={false}>
                                <EuiBadge
                                  color="hollow"
                                  iconType="lock"
                                  className="contextEnginePrototype__typeBadge"
                                >
                                  Managed
                                </EuiBadge>
                              </EuiFlexItem>
                          )}
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

                      <EuiHorizontalRule margin="s" />
                      <EuiFlexGroup
                        className="contextEnginePrototype__namespaceCardFooter"
                        responsive={false}
                        gutterSize="m"
                        alignItems="center"
                      >
                        <EuiFlexItem>
                          <EuiText size="xs" color="subdued">
                            Integrated via
                          </EuiText>
                          {namespace.integration ? (
                            <EuiText size="s">{namespace.integration}</EuiText>
                          ) : (
                            <EuiText size="s" color="subdued">
                              Not connected yet
                            </EuiText>
                          )}
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EuiText size="xs" color="subdued">
                            {metaLabel}
                          </EuiText>
                          <EuiText size="s">{metaValue}</EuiText>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiPanel>
                  </EuiFlexItem>
                );
              })}
            </EuiFlexGrid>
            </>
          )}
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderCreate = () => {
    const activeTab = sourceCategories.find(({ id }) => id === activeCategory)!;
    const hasAgentTraces = traceStreams.length > 0;
    const indexStepComplete = nameComplete && intentComplete;
    const sourcesStepComplete = sourcesComplete;
    const stepsDone = (indexStepComplete ? 1 : 0) + (sourcesStepComplete ? 1 : 0);
    const bothStepsComplete = indexStepComplete && sourcesStepComplete;
    const otherStepIncomplete =
      createPanel === 'index' ? !sourcesStepComplete : !indexStepComplete;
    const indexTitle = nameComplete ? namespaceSlug : 'AI index';
    const indexSubline = indexStepComplete
      ? 'Named, intent set.'
      : 'Name it and give it intent.';
    const sourcesTitle =
      selectedSources.length > 0 ? `Sources · ${selectedSources.length}` : 'Sources';
    const sourcesSubline =
      selectedSources.length > 0
        ? selectedSources.map((source) => source.name).join(', ')
        : 'ES|QL views and connectors.';

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
      if (active) return 'contextEnginePrototype__createStepMarker--active';
      if (complete) return 'contextEnginePrototype__createStepMarker--complete';
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
          }${complete && !active ? ' contextEnginePrototype__createStep--complete' : ''}${
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
        </button>
      );
    };

    const timeCardSelected = storageType === 'dataStream';
    const referenceCardSelected = storageType === 'index';
    const dataNatureWarning = (() => {
      if (dataNatureTouched || !dataNatureSuggestion) {
        return 'This cannot be changed after the index is created.';
      }
      if (dataNatureSuggestion === 'index') {
        return 'Suggested from your sources (docs and tickets). Check it; this cannot be changed after the index is created.';
      }
      if (dataNatureSuggestion === 'dataStream') {
        return 'Suggested from your sources (query over raw data, likely logs or events). Check it; this cannot be changed after the index is created.';
      }
      return 'Your sources are mixed; pick one. This cannot be changed after the index is created.';
    })();

    return (
      <>
        <EuiPageTemplate.Section grow={false}>
          <div className="contextEnginePrototype__wizardHeader">
            <EuiButtonEmpty iconType="arrowLeft" onClick={goToIndex} flush="left" color="text">
              Cancel
            </EuiButtonEmpty>
            <EuiSpacer size="s" />
            <EuiTitle size="l">
              <h1>Create AI index</h1>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText color="subdued">
              An AI index is a live collection of knowledge from your data, ready for any agent to
              retrieve. About 10 minutes; automations run in the background after.
            </EuiText>
          </div>
        </EuiPageTemplate.Section>

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
                  {stepNode('index', indexTitle, indexSubline, indexStepComplete)}
                  {stepNode('sources', sourcesTitle, sourcesSubline, sourcesStepComplete)}
                </div>

                <div className="contextEnginePrototype__createAgentEducation">
                  <EuiIcon type="bulb" size="s" aria-hidden={true} />
                  <EuiText size="xs" color="subdued">
                    After create, connect any agent to retrieve from this index. You will do that
                    from the index page.
                  </EuiText>
                </div>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem className="contextEnginePrototype__createPanelColumn">
              {createPanel === 'index' ? (
                <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__createPanel">
                  <EuiTitle size="s">
                    <h2>Name and intent</h2>
                  </EuiTitle>
                  <EuiSpacer size="xs" />
                  <EuiText size="s" color="subdued">
                    What this index is called, and what it should help your agent do.
                  </EuiText>

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
                    Tell the engine what this index should help your agent do. Describe it in your
                    own words, optionally add traces from a running agent, or both.
                  </EuiText>
                  <EuiSpacer size="m" />
                  <EuiText size="xs" className="contextEnginePrototype__intentMicroLabel">
                        YOUR DESCRIPTION
                      </EuiText>
                      <EuiSpacer size="xs" />
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

                      <EuiSpacer size="m" />
                  {intentTracesEnabled ? (
                    <>
                      <EuiFlexGroup
                        alignItems="center"
                        justifyContent="spaceBetween"
                        gutterSize="s"
                        responsive={false}
                      >
                        <EuiFlexItem grow={false}>
                          <EuiCheckbox
                            id="intent-traces-enabled"
                            checked={intentTracesEnabled}
                            disabled={!hasAgentTraces}
                            onChange={(event) => {
                              const next = event.target.checked;
                              setIntentTracesEnabled(next);
                              if (next && !intentTraceStream && traceStreams[0]) {
                                setIntentTraceStream(traceStreams[0].id);
                              }
                              if (intentMode === 'upload') setIntentMode(null);
                            }}
                            label="Use an existing agent's traces"
                          />
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiButtonEmpty
                        size="xs"
                            flush="both"
                            onClick={() => setIntentTracesEnabled(false)}
                          >
                            Remove
                          </EuiButtonEmpty>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                      <EuiSpacer size="s" />
                      <EuiText size="s" color="subdued">
                        Borrow the questions an agent already answers today. Combined with your
                        description above into one intent signal.
                      </EuiText>
                      <EuiSpacer size="m" />
                      {hasAgentTraces ? (
                        <EuiPanel hasBorder paddingSize="m" color="subdued">
                          <EuiFlexGroup direction="column" gutterSize="m">
                            {traceStreams.map((option) => {
                              const selected = intentTraceStream === option.id;
                              return (
                                <EuiFlexItem key={option.id}>
                                  <EuiPanel
                                    hasBorder
                                    paddingSize="m"
                                    className={`contextEnginePrototype__sourceRow${
                                      selected
                                        ? ' contextEnginePrototype__sourceRow--selected'
                                        : ''
                                    }`}
                                    onClick={() => setIntentTraceStream(option.id)}
                                    role="radio"
                                    aria-checked={selected}
                                  >
                                    <EuiFlexGroup
                                      alignItems="center"
                                      gutterSize="m"
                                      responsive={false}
                                    >
                                      <EuiFlexItem grow={false}>
                                        <EuiRadio
                                          id={`trace-${option.id}`}
                                          checked={selected}
                                          onChange={() => setIntentTraceStream(option.id)}
                                          label=""
                                        />
                                      </EuiFlexItem>
                                      <EuiFlexItem>
                                        <EuiText size="s">
                                          <strong>{option.agentName}</strong>
                                        </EuiText>
                                        <EuiText size="xs" color="subdued">
                                          {option.questionCount} questions · last active{' '}
                                          {option.lastActive} ·{' '}
                                          <EuiCode>{option.streamName}</EuiCode>
                                        </EuiText>
                                      </EuiFlexItem>
                                    </EuiFlexGroup>
                                  </EuiPanel>
                                </EuiFlexItem>
                              );
                            })}
                          </EuiFlexGroup>
                        </EuiPanel>
                      ) : (
                        <EuiPanel hasBorder paddingSize="m" color="subdued">
                          <EuiText size="s" color="subdued">
                            No agent traces found. This add-on needs an agent already running with
                            tracing enabled.
                          </EuiText>
                        </EuiPanel>
                      )}
                    </>
                  ) : (
                    <EuiButtonEmpty
                      size="s"
                      iconType="plus"
                      flush="left"
                      disabled={!hasAgentTraces}
                      onClick={() => {
                        setIntentTracesEnabled(true);
                        if (!intentTraceStream && traceStreams[0]) {
                          setIntentTraceStream(traceStreams[0].id);
                        }
                        if (intentMode === 'upload') setIntentMode(null);
                      }}
                    >
                      {hasAgentTraces
                        ? 'Add traces from an agent'
                        : 'Add traces from an agent (none available)'}
                    </EuiButtonEmpty>
                  )}

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
                    Where the knowledge lives. Automations will read these and extract what your
                    agent needs. Pick at least one; add more anytime.
                  </EuiText>

                  {intentSuggestPhase !== 'hidden' ? (
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
                      return (
                        <EuiTab
                          key={category.id}
                          isSelected={activeCategory === category.id}
                          onClick={() => setActiveCategory(category.id)}
                          prepend={
                            <EuiIcon type={category.icon} size="s" aria-hidden={true} />
                          }
                          append={
                            count > 0 ? <EuiBadge color="primary">{count}</EuiBadge> : undefined
                          }
                        >
                          {category.label}
                        </EuiTab>
                      );
                    })}
                  </EuiTabs>
                  <EuiSpacer size="m" />

                  {activeCategory === 'connectors' && visibleSources.length === 0 ? (
                    <EuiPanel
                      hasBorder
                      paddingSize="l"
                      className="contextEnginePrototype__sourceEmptyState"
                      color="subdued"
                    >
                      <EuiText size="s">
                        <strong>You can connect to any of these types of data sources</strong>
                      </EuiText>
                      <EuiSpacer size="m" />
                      <div className="contextEnginePrototype__sourceEmptyIcons">
                        {CONNECTOR_EMPTY_TYPE_ICONS.map((item) => (
                          <div key={item.id} className="contextEnginePrototype__sourceEmptyIcon">
                            <EuiIcon type={item.icon} size="l" aria-hidden={true} />
                            <EuiText size="xs" color="subdued">
                              {item.label}
                            </EuiText>
                          </div>
                        ))}
                      </div>
                      <EuiSpacer size="m" />
                      <EuiButton fill iconType="plus" onClick={() => setShowConnectorFlyout(true)}>
                        Connect a data source
                      </EuiButton>
                    </EuiPanel>
                  ) : activeCategory === 'esql' && !esqlDataReady ? (
                    <EuiPanel
                      hasBorder
                      paddingSize="l"
                      className="contextEnginePrototype__sourceEmptyState"
                      color="subdued"
                    >
                      <EuiText size="s">
                        No data in Elastic yet. Create an index or upload your data, then query it
                        here.
                      </EuiText>
                      <EuiSpacer size="m" />
                      <EuiLink
                        onClick={() => {
                          setEsqlDataReady(true);
                          coreStart.notifications.toasts.addSuccess(
                            'Ingest guide opened (mock). Sample ES|QL views are ready.'
                          );
                        }}
                      >
                        How to ingest data ›
                      </EuiLink>
                    </EuiPanel>
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
                    id="context-engine-5-sources-advanced"
                    arrowDisplay="right"
                    forceState={sourcesAdvancedOpen ? 'open' : 'closed'}
                    onToggle={(isOpen) => setSourcesAdvancedOpen(isOpen)}
                    buttonContent={
                      <EuiText size="s">
                        <strong>
                          Storage: {storageType === 'dataStream' ? 'data stream' : 'index'} · cannot
                          change later · Advanced
                        </strong>
                      </EuiText>
                    }
                    paddingSize="m"
                    className="contextEnginePrototype__sourcesAdvanced"
                  >
                    <EuiText size="s" color="subdued">
                      Should knowledge expire automatically? Time-based data (logs, metrics,
                      events) can expire; reference data stays until changed.
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
                                Knowledge can expire and stay current automatically.
                              </EuiText>
                              <EuiSpacer size="xs" />
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
                                Knowledge persists until edited or removed.
                              </EuiText>
                              <EuiSpacer size="xs" />
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
                      {dataNatureWarning}
                    </EuiText>
                  </EuiAccordion>
                </EuiPanel>
              )}

              {showConnectorFlyout ? (
                <EuiFlyout
                  ownFocus
                  onClose={() => setShowConnectorFlyout(false)}
                  size="s"
                  aria-labelledby="context-engine-5-connector-flyout"
                >
                  <EuiFlyoutHeader hasBorder>
                    <EuiTitle size="s">
                      <h2 id="context-engine-5-connector-flyout">Connect a data source</h2>
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
                                        `${source.name} connected`
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

  const renderActiveAutomation = (automation: Automation, namespace: Namespace) => {
    const sourceNames = automationSourceNames(automation, namespace);
    const primarySource = sourceNames[0] || proposalSourceName(automation, namespace.sources);
    const producedCount = indicatorsForAutomation(automation, namespace.indicators).length;
    const tweakSuccess = automationTweakSuccess[automation.id];
    const menuOpen = automationMenuOpenId === automation.id;
    const isDisabled = Boolean(disabledAutomationIds[automation.id]);
    const cardClass = [
      'contextEnginePrototype__automationCard',
      isDisabled ? 'contextEnginePrototype__automationCard--disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const closeMenu = () => setAutomationMenuOpenId(null);

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
            <EuiFlexGroup alignItems="center" gutterSize="xs" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  iconType={AI_AGENT_ICON}
                  disabled={isDisabled}
                  onClick={() => {
                    setAutomationMenuOpenId(null);
                    openAgentSidebar({
                      kind: 'automation-edit',
                      contextChip: `Automation · ${automation.title}`,
                      userMessage: 'Help me edit this automation.',
                      proposalText: `Update "${automation.title}" to tighten the extract scope for ${primarySource} and refresh on a daily schedule.`,
                      onApply: () => {
                        if (!activeNamespace) return;
                        const nextDescription = `${automation.description} Adjusted via AI Agent: tighter extract scope and daily refresh.`;
                        const updated: Namespace = {
                          ...activeNamespace,
                          automations: activeNamespace.automations.map((item) =>
                            item.id === automation.id
                              ? { ...item, description: nextDescription }
                              : item
                          ),
                        };
                        setActiveNamespace(updated);
                        setNamespaces((current) =>
                          current.map((item) =>
                            item.name === updated.name ? updated : item
                          )
                        );
                        showAutomationTweakSuccess(automation.id);
                      },
                    });
                  }}
                >
                  Refine with AI Agent
                </EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiPopover
                  ownFocus
                  button={
                    <EuiButtonIcon
                      iconType="boxesHorizontal"
                      size="s"
                      color="text"
                      aria-label="More automation actions"
                      aria-expanded={menuOpen}
                      onClick={() => {
                        setAutomationMenuOpenId(menuOpen ? null : automation.id);
                      }}
                    />
                  }
                  isOpen={menuOpen}
                  closePopover={closeMenu}
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
                            name: 'Edit workflow ›',
                            icon: 'editorCodeBlock',
                            onClick: () => {
                              closeMenu();
                              openWorkflow(automation);
                            },
                          },
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
                            icon: isDisabled ? 'check' : 'minusInCircle',
                            onClick: () => {
                              closeMenu();
                              setDisabledAutomationIds((current) => ({
                                ...current,
                                [automation.id]: !current[automation.id],
                              }));
                            },
                          },
                        ],
                      },
                    ]}
                  />
                </EuiPopover>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
            <EuiText size="xs" color="subdued">
              {producesLabel(automation.type)}
              {' · '}
              {ownershipLabel(automation.ownership)}
          {' · Last run '}
          {mockAutomationLastRun(automation.id)}
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="s" color="subdued">
              {automation.description}
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
              <button
                type="button"
                className="contextEnginePrototype__relationshipChipButton"
                onClick={() => openKnowledgeTabFilteredByAutomation(automation.title)}
              >
                <EuiBadge
                  color="accent"
                  iconType="aggregate"
                  className="contextEnginePrototype__relationshipChip contextEnginePrototype__relationshipChip--accent"
                >
                  {producedCount} Knowledge Indicators ›
                </EuiBadge>
              </button>
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
    const lifecycle = resolveCatalogLifecycle(namespace);
    const inSetupMode =
      namespace.lifecycleStatus === 'needsSetup' || namespace.lifecycleStatus === 'settingUp';
    const setupPhase: SetupPhase =
      setupPhaseByIndex[namespace.name] ??
      (namespace.lifecycleStatus === 'settingUp' ? 'running' : 'configure');
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
      // Honest setup counts: 0 → sample after test review → full after full run.
      if (setupPhase === 'configure') return 0;
      if (setupPhase === 'running' && setupSuccessKiCount === 0) return 0;
      return setupSuccessKiCount;
    })();
    const primarySetupSource = namespace.sources[0] || 'your sources';
    const setupPageCount = mockSetupPageCount(namespace);
    const setupSampleKis = reviewSampleOverride ?? buildSetupSampleKis(namespace);
    const setupAutomationCount = Math.max(1, namespace.automations.length || namespace.sources.length);
    const setupBenefit = setupBenefitClause(namespace.intent?.value, namespace.sources);
    const reviewKiTotal = setupSuccessKiCount || SAMPLE_SETUP_KI_COUNT;
    // Tab badge = automations actually available to list (approved + still-proposed).
    const activeAutomationCount = inSetupMode
      ? namespace.managed
        ? proposedAutomations.length
        : namespace.automations.length + pendingSuggestions.length
      : namespace.automations.length + pendingSuggestions.length;
    const setupRunSourceNames =
      namespace.automations.length > 0
        ? namespace.automations.map(
            (automation, index) =>
              automation.tags.find((tag) => namespace.sources.includes(tag)) ||
              namespace.sources[index] ||
              primarySetupSource
          )
        : namespace.sources;
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
        { type: 'PLAYBOOK' as const, label: 'playbooks', count: knowledgeCounts.playbooks },
        { type: 'POLICY' as const, label: 'policies', count: knowledgeCounts.policies },
        { type: 'FAQ' as const, label: 'FAQs', count: knowledgeCounts.faqs },
        {
          type: 'GLOSSARY' as const,
          label: knowledgeCounts.glossaries === 1 ? 'glossary' : 'glossaries',
          count: knowledgeCounts.glossaries,
        },
        { type: 'FACT' as const, label: 'facts', count: knowledgeCounts.facts },
      ] as Array<{ type: KnowledgeIndicator['type']; label: string; count: number }>
    ).filter(({ count }) => count > 0);
    /** Tabs unlock at the review moment (first KIs) and stay for all later states. */
    const detailTabsVisible =
      !inSetupMode || setupPhase === 'review' || setupSuccessKiCount > 0;
    const effectiveDetailTab: NamespaceDetailTab = detailTabsVisible
      ? namespaceDetailTab
      : 'overview';

    const suggestedSourceNames = Array.from(
      new Set(
        pendingSuggestions.flatMap((automation) =>
          automation.tags.filter((tag) => namespace.sources.includes(tag))
        )
      )
    );
    const suggestedFromLabel = (
      suggestedSourceNames.length > 0 ? suggestedSourceNames : namespace.sources
    ).join(' and ');

    const descriptionPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">
                <EuiIcon type="document" size="m" aria-hidden={true} />
                Description
              </h2>
            </EuiTitle>
          </div>
          <div className="contextEnginePrototype__sectionActions">
            <EuiButtonEmpty
              size="s"
              iconType="sparkles"
              isLoading={isDefiningDescription}
              onClick={defineDescriptionWithChat}
            >
              Generate description
            </EuiButtonEmpty>
            <EuiButtonEmpty size="s" iconType="pencil">
              Edit
            </EuiButtonEmpty>
          </div>
        </div>
        <EuiText size="s" color={isDefiningDescription ? 'subdued' : undefined}>
          {isDefiningDescription
            ? "Generating a description from this namespace's sources, Knowledge Indicators, and automations…"
            : namespace.description}
        </EuiText>
      </EuiPanel>
    );

    const sourcesPanel = (
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__detailSection"
        id="context-engine-5-sources"
      >
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2>Sources</h2>
            </EuiTitle>
            <EuiText size="s" color="subdued">
              {namespace.managed
                ? 'Managed sources for this index. Elastic keeps these up to date.'
                : 'Data feeding this index. Add a source to refresh context and suggestions.'}
            </EuiText>
          </div>
          <div className="contextEnginePrototype__sectionActions">
            {namespace.managed ? (
              <EuiButtonEmpty
                size="s"
                iconType="eye"
                onClick={() => {
                  document
                    .getElementById('context-engine-5-sources')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                View sources
              </EuiButtonEmpty>
            ) : (
              <EuiButtonEmpty size="s" iconType="pencil" onClick={editSourcesFromNamespace}>
                Edit sources
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

    const automationsPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">
                <EuiIcon type="play" size="m" aria-hidden={true} />
                Automations
              </h2>
            </EuiTitle>
            <EuiText size="s" color="subdued">
              Extract and refresh Knowledge Indicators from sources.
            </EuiText>
          </div>
          {!inSetupMode && !namespace.managed ? (
          <div className="contextEnginePrototype__sectionActions">
              <EuiButtonEmpty
                size="s"
                iconType="plusInCircle"
                onClick={() => {
                  const sourceList =
                    namespace.sources.length > 0
                      ? namespace.sources.join(', ')
                      : namespace.sourceDetails.map((source) => source.name).join(', ') ||
                        'attached sources';
                  openAgentSidebar({
                    kind: 'suggest-automations',
                    contextChip: `AI index · ${displayName} · sources: ${sourceList}`,
                    userMessage: 'Suggest automations for this index.',
                    proposalText: `Add extract automations for ${sourceList} on ${displayName}.`,
                    onApply: () => {
                      setShowSuggestedAutomations(true);
                      coreStart.notifications.toasts.addSuccess(
                        'Suggested automations added to review.'
                      );
                    },
                  });
                }}
              >
              Add automation
            </EuiButtonEmpty>
          </div>
          ) : null}
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
        {pendingSuggestions.length > 0 && (
          <>
            <EuiSpacer size="s" />
            <EuiText size="xs" color="subdued">
              <strong>Suggested automations</strong>
            </EuiText>
            <EuiPanel
              color="primary"
              paddingSize="s"
              hasBorder
              className="contextEnginePrototype__suggestionBlock"
            >
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
                      <EuiIcon type="plusInCircle" color="primary" aria-hidden={true} />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="s">
                        {`${pendingSuggestions.length} suggested automation${
                          pendingSuggestions.length === 1 ? '' : 's'
                            } ready to add${
                              suggestedFromLabel ? ` from ${suggestedFromLabel}` : ''
                            }`}
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty
                    size="xs"
                    flush="both"
                    onClick={() => setShowSuggestedAutomations((current) => !current)}
                  >
                    {showSuggestedAutomations ? 'Hide' : 'Review'}
                  </EuiButtonEmpty>
                </EuiFlexItem>
              </EuiFlexGroup>
              {showSuggestedAutomations && (
                <div className="contextEnginePrototype__list">
                  {pendingSuggestions.map((automation) => (
                    <div key={automation.id} className="contextEnginePrototype__listRow">
                      <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
                        <EuiFlexItem>
                          <EuiText size="s">
                            <strong>{automation.title}</strong>
                          </EuiText>
                          <EuiText size="xs" color="subdued">
                            {producesLabel(automation.type)}
                            {' · New'}
                                {automation.tags.includes('UPDATE')
                                  ? ' · Update available'
                                  : ''}
                            {' · '}
                            {automation.description}
                          </EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiButton
                            size="s"
                            iconType="plus"
                            onClick={() => addSuggestedAutomation(automation)}
                          >
                            Add
                          </EuiButton>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </div>
                  ))}
                </div>
              )}
            </EuiPanel>
            <EuiSpacer size="m" />
          </>
        )}

        <div className="contextEnginePrototype__activeAutomations">
          <EuiText size="xs" color="subdued">
                <strong>
                  {inSetupMode && namespace.automations.length > 0 ? 'Approved' : 'Active'}
                </strong>
          </EuiText>
              <div className="contextEnginePrototype__automationCardList">
            {namespace.automations.length === 0 ? (
              <EuiText size="s" color="subdued">
                {pendingSuggestions.length > 0
                  ? 'No active automations yet. Add a suggestion above to get started.'
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
        <EuiFlexGroup
          alignItems="center"
          justifyContent="spaceBetween"
          gutterSize="m"
          responsive={false}
          wrap
        >
          <EuiFlexItem>
            <EuiText size="s">
              <strong>{kiTotal} Knowledge Indicators</strong>
              {' in '}
              <EuiBadge color="hollow" className="contextEnginePrototype__mono">
                {namespace.indexName}
              </EuiBadge>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiLink
              color="subdued"
              onClick={(event) => {
                event.preventDefault();
                coreStart.notifications.toasts.addInfo(
                  'Discover opened (mock) for raw docs behind this index.'
                );
              }}
            >
              View raw docs in Discover ›
            </EuiLink>
          </EuiFlexItem>
        </EuiFlexGroup>

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
                    {` · ${tabKnowledgeIndicators.length} Knowledge Indicators`}
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

        <EuiSpacer size="m" />
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
            <EuiSpacer size="s" />
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
            <EuiSpacer size="m" />
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
            aria-labelledby="context-engine-5-ki-flyout-title"
          >
            <EuiFlyoutHeader hasBorder>
              <EuiTitle size="s">
                <h2 id="context-engine-5-ki-flyout-title">{flyoutIndicator.title}</h2>
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
              <h2>How this index works</h2>
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
    const overviewKiCount = knowledgeTotal(namespace.knowledge);
    const namespaceImprovements = improvementsForNamespace(namespace);
    const improvementStatus = (id: string): ImprovementStatus =>
      improvementStatusById[id] ?? 'open';
    const openImprovementsCount = namespaceImprovements.filter(
      (item) => improvementStatus(item.id) === 'open'
    ).length;
    const visibleImprovements = improvementsExpanded
      ? namespaceImprovements
      : namespaceImprovements.slice(0, 3);
    const evidenceImprovement =
      namespaceImprovements.find((item) => item.id === evidenceImprovementId) ?? null;
    const improvementFixText = (item: OverviewImprovement) =>
      improvementFixById[item.id] ?? item.proposedFix;

    const approveImprovement = (id: string) => {
      if (improvementStatus(id) !== 'open') return;
      setImprovementStatusById((current) => ({ ...current, [id]: 'applying' }));
      window.setTimeout(() => {
        setImprovementStatusById((current) => ({ ...current, [id]: 'applied' }));
      }, 1500);
    };

    const dismissImprovement = (id: string) => {
      if (improvementStatus(id) !== 'open') return;
      setImprovementStatusById((current) => ({ ...current, [id]: 'dismissed' }));
    };

    const undoDismissImprovement = (id: string) => {
      if (improvementStatus(id) !== 'dismissed') return;
      setImprovementStatusById((current) => ({ ...current, [id]: 'open' }));
    };

    const scrollToImprovements = () => {
      selectNamespaceDetailTab('overview');
      window.requestAnimationFrame(() => {
        document
          .getElementById('context-engine-5-improvements')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    const openUseInAgent = () => {
      setAgentHarness('claudeCode');
      setApiKeyRevealed(false);
      setAgentNotice(null);
      setScreen('agent');
    };

    const overviewStatsPanel = (
      <EuiPanel
        hasBorder
        paddingSize="m"
        className="contextEnginePrototype__detailSection"
        id="context-engine-5-overview-monitoring"
        data-test-subj="contextEngineOverviewStats"
      >
        {isMatureOverview ? (
          <EuiFlexGroup
            gutterSize="none"
            responsive={false}
            className="contextEnginePrototype__overviewStats"
          >
            <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
              <EuiStat
                title={String(overviewKiCount)}
                description="Knowledge Indicators"
                titleSize="m"
                textAlign="left"
              />
            </EuiFlexItem>
            <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
              <EuiStat
                title={efficiency ? `${efficiency.retrievalHitRate}%` : 'n/a'}
                description="Retrieval hit rate"
                titleSize="m"
                textAlign="left"
                titleColor="success"
              />
            </EuiFlexItem>
            <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
              <EuiStat
                title={efficiency ? `${efficiency.tokensSavedPct}%` : 'n/a'}
                description="Tokens saved vs baseline"
                titleSize="m"
                textAlign="left"
                titleColor="success"
              />
            </EuiFlexItem>
            <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
              <EuiStat
                title={efficiency ? `${efficiency.medianLatencyMs}ms` : 'n/a'}
                description="Median latency"
                titleSize="m"
                textAlign="left"
              />
            </EuiFlexItem>
            <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
              <EuiStat
                title={tracesAnalysed.toLocaleString()}
                description="Traces analysed"
                titleSize="m"
                textAlign="left"
              />
            </EuiFlexItem>
            <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <button
                  type="button"
                  className="contextEnginePrototype__overviewStatButton"
                onClick={scrollToImprovements}
                aria-label={`View ${openImprovementsCount} open improvements`}
                >
                  <EuiStat
                  title={String(openImprovementsCount)}
                  description="Open improvements"
                    titleSize="m"
                    textAlign="left"
                  titleColor={openImprovementsCount > 0 ? 'accent' : undefined}
                  />
                </button>
            </EuiFlexItem>
          </EuiFlexGroup>
        ) : (
          <>
            <EuiFlexGroup
              gutterSize="none"
              responsive={false}
              className="contextEnginePrototype__overviewStats"
            >
              <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <EuiStat
                  title={String(overviewKiCount)}
                  description="Knowledge Indicators"
                  titleSize="m"
                  textAlign="left"
                />
            </EuiFlexItem>
              <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <EuiStat
                  title="No data"
                  description="Retrieval hit rate"
                  titleSize="m"
                  textAlign="left"
                  titleColor="subdued"
                />
              </EuiFlexItem>
              <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <EuiStat
                  title="No data"
                  description="Tokens saved vs baseline"
                  titleSize="m"
                  textAlign="left"
                  titleColor="subdued"
                />
              </EuiFlexItem>
              <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <EuiStat
                  title="No data"
                  description="Median latency"
                  titleSize="m"
                  textAlign="left"
                  titleColor="subdued"
                />
              </EuiFlexItem>
              <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <EuiStat
                  title="0"
                  description="Traces analysed"
                  titleSize="m"
                  textAlign="left"
                />
              </EuiFlexItem>
              <EuiFlexItem className="contextEnginePrototype__overviewStatCell">
                <EuiStat
                  title="0"
                  description="Issues"
                  titleSize="m"
                  textAlign="left"
                />
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiText size="xs" color="subdued">
              Retrieval stats appear once agents start retrieving from this index.
            </EuiText>
          </>
        )}
      </EuiPanel>
    );

    const improvementsPanel = isMatureOverview ? (
        <EuiPanel
          hasBorder
          paddingSize="l"
          className="contextEnginePrototype__detailSection"
        id="context-engine-5-improvements"
        data-test-subj="contextEngineImprovements"
      >
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
              <EuiTitle size="xs">
                  <h2>Improvements</h2>
              </EuiTitle>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBadge
                  color="accent"
                  className="contextEnginePrototype__improvementsOpenBadge"
                >
                  {openImprovementsCount} open
                </EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="xs" color="subdued">
              Learning from your agents&apos; traces ·{' '}
              <EuiLink
                onClick={(event) => {
                  event.preventDefault();
                }}
              >
                configure
              </EuiLink>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="xs" />
              <EuiText size="s" color="subdued">
          Gaps found in real agent usage, each with a proposed fix. Approving applies it to the
          automations; nothing changes without you.
              </EuiText>
        <EuiSpacer size="m" />
        <div className="contextEnginePrototype__improvementsList">
          {visibleImprovements.map((item) => {
            const status = improvementStatus(item.id);
            const fixText = improvementFixText(item);
            const cardClass = [
              'contextEnginePrototype__improvementCard',
              status === 'applied' ? 'contextEnginePrototype__improvementCard--applied' : '',
              status === 'dismissed'
                ? 'contextEnginePrototype__improvementCard--dismissed'
                : '',
            ]
              .filter(Boolean)
              .join(' ');
              return (
              <EuiPanel
                key={item.id}
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
                {status !== 'dismissed' ? (
                  <>
                    <EuiSpacer size="s" />
                    <div className="contextEnginePrototype__improvementFix">
                      <EuiText size="s">
                        <strong>Proposed fix:</strong> {fixText}
                      </EuiText>
                    </div>
                  </>
                ) : null}
                <EuiSpacer size="s" />
                {status === 'applying' ? (
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                    <EuiFlexItem grow={false}>
                      <EuiLoadingSpinner size="m" />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">
                        ⟳ Applying the fix...
                      </EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                      <EuiButtonEmpty
                        size="xs"
                        flush="both"
                        iconType={AI_AGENT_ICON}
                        onClick={() =>
                          openAgentSidebar({
                            kind: 'improvement-watch',
                            contextChip: `Failure pattern · ${item.title}`,
                            userMessage: `Watch the apply for: ${item.title}`,
                          })
                        }
                      >
                        Watch in AI Agent ›
                      </EuiButtonEmpty>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                ) : null}
                {status === 'applied' ? (
                            <EuiText size="s" color="success">
                    <strong>
                      {item.createsAutomation
                        ? '✓ Applied. Automation created; first run scheduled.'
                        : '✓ Applied. Automation updated; rerun scheduled.'}
                    </strong>
                  </EuiText>
                ) : null}
                {status === 'dismissed' ? (
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued">
                        Dismissed; we will not suggest this again.
                            </EuiText>
                          </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButtonEmpty
                        size="xs"
                        flush="both"
                        onClick={() => undoDismissImprovement(item.id)}
                      >
                        ↩ Undo
                      </EuiButtonEmpty>
                    </EuiFlexItem>
                        </EuiFlexGroup>
                ) : null}
                {status === 'open' ? (
                  <EuiFlexGroup
                    alignItems="center"
                    gutterSize="s"
                    responsive={false}
                    wrap
                    className="contextEnginePrototype__improvementActions"
                  >
                          <EuiFlexItem grow={false}>
                      <EuiButton size="s" fill onClick={() => approveImprovement(item.id)}>
                        ✓ Approve fix
                      </EuiButton>
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
            })}
          </div>
        <EuiSpacer size="m" />
        <EuiButtonEmpty
          size="s"
          iconSide="right"
          iconType={improvementsExpanded ? 'arrowUp' : 'arrowRight'}
          flush="left"
          onClick={() => setImprovementsExpanded((current) => !current)}
        >
          {improvementsExpanded
            ? 'Show fewer'
            : `View all improvements (${openImprovementsCount}) ›`}
        </EuiButtonEmpty>
        </EuiPanel>
    ) : null;

    const improvementEvidenceFlyout =
      evidenceImprovement && isMatureOverview ? (
        <EuiFlyout
          ownFocus
          size="m"
          onClose={() => setEvidenceImprovementId(null)}
          aria-labelledby="context-engine-5-improvement-flyout-title"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="s">
              <h2 id="context-engine-5-improvement-flyout-title">
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
                {improvementStatus(evidenceImprovement.id) === 'open' ? (
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
                ) : improvementStatus(evidenceImprovement.id) === 'applying' ? (
                  <EuiButton fill isLoading disabled>
                    Applying...
                  </EuiButton>
                ) : improvementStatus(evidenceImprovement.id) === 'applied' ? (
                  <EuiButton fill color="success" disabled>
                    ✓ Applied
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

    const tabLabelWithCount = (label: string, count: number) => (
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>{label}</EuiFlexItem>
        {count > 0 ? (
        <EuiFlexItem grow={false}>
          <EuiNotificationBadge>{count}</EuiNotificationBadge>
        </EuiFlexItem>
        ) : null}
      </EuiFlexGroup>
    );

    // Use EuiTabs + panel (not EuiTabbedContent): controlled EuiTabbedContent with
    // autoFocus="selected" crashes via focusTab() when selectedTabId is unset.
    const detailTabItems: Array<{
      id: NamespaceDetailTab;
      name: React.ReactNode;
    }> = [
      { id: 'overview', name: 'Overview' },
      { id: 'automations', name: tabLabelWithCount('Automations', activeAutomationCount) },
      { id: 'knowledge', name: tabLabelWithCount('Knowledge Indicators', kiTotal) },
    ];

    const enabledManagedSourceCount = MANAGED_SETUP_SOURCES.filter(
      (source) => managedSetupToggles[source.id]
    ).length;

    const setupRunningPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        {namespace.managed ? (
          <>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiLoadingSpinner size="m" />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiTitle size="s">
                  <h2>Setting up...</h2>
                </EuiTitle>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              Automations are running and the index is being populated. You can leave; we will keep
              going.
            </EuiText>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              Next: once knowledge is ready, connect an agent so it can retrieve from this index.{' '}
              <EuiLink onClick={openUseInAgent}>Use in an agent</EuiLink>
            </EuiText>
          </>
        ) : (
          <>
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiLoadingSpinner size="m" />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiTitle size="s">
                  <h2>
                    {activeSetupRun === 'full'
                      ? 'Full run in progress...'
                      : 'Test run in progress...'}
                  </h2>
                </EuiTitle>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="m" />
            <div className="contextEnginePrototype__setupRunProgress" role="status" aria-live="polite">
              {setupRunSourceNames.map((sourceName, index) => {
                const done = setupRunProgress > index;
                const active = setupRunProgress === index;
                return (
                  <div
                    key={`${sourceName}-${index}`}
                    className={`contextEnginePrototype__setupRunProgressRow${
                      done ? ' contextEnginePrototype__setupRunProgressRow--done' : ''
                    }${active ? ' contextEnginePrototype__setupRunProgressRow--active' : ''}`}
                  >
                    {done ? (
                      <EuiIcon type="check" color="success" size="s" aria-hidden={true} />
                    ) : active ? (
                      <EuiLoadingSpinner size="s" />
                    ) : (
                      <span className="contextEnginePrototype__setupRunProgressDot" aria-hidden={true} />
                    )}
                    <EuiText size="s" color={done || active ? undefined : 'subdued'}>
                      {done
                        ? mockRunProgressDoneLabel(sourceName)
                        : mockRunProgressActiveLabel(sourceName, index)}
                    </EuiText>
                  </div>
                );
              })}
              <div
                className={`contextEnginePrototype__setupRunProgressRow${
                  setupRunProgress > setupRunSourceNames.length
                    ? ' contextEnginePrototype__setupRunProgressRow--done'
                    : ''
                }${
                  setupRunProgress === setupRunSourceNames.length
                    ? ' contextEnginePrototype__setupRunProgressRow--active'
                    : ''
                }`}
              >
                {setupRunProgress > setupRunSourceNames.length ? (
                  <EuiIcon type="check" color="success" size="s" aria-hidden={true} />
                ) : setupRunProgress === setupRunSourceNames.length ? (
                  <EuiLoadingSpinner size="s" />
                ) : (
                  <span className="contextEnginePrototype__setupRunProgressDot" aria-hidden={true} />
                )}
                <EuiText
                  size="s"
                  color={
                    setupRunProgress >= setupRunSourceNames.length ? undefined : 'subdued'
                  }
                >
                  Drafting Knowledge Indicators...
                </EuiText>
              </div>
            </div>
            <EuiSpacer size="m" />
            <div className="contextEnginePrototype__setupSampleGrid">
              {setupSampleKis.map((sample) => (
                <div
                  key={sample.key}
                  className="contextEnginePrototype__setupSampleSkeleton"
                  aria-hidden={true}
                />
              ))}
            </div>
            <EuiSpacer size="m" />
            <EuiText size="s" color="subdued">
              {activeSetupRun === 'full'
                ? `Full results in about 40 minutes; you can leave, we will keep going.`
                : 'First results in about 2 minutes; you can leave, we will keep going.'}
            </EuiText>
          </>
        )}
      </EuiPanel>
    );

    const applyReviewTweak = (userText: string) =>
      new Promise<void>((resolve) => {
        setReviewTweakApplying(true);
        setReviewTweakEcho(userText);
        window.setTimeout(() => {
          const base = reviewSampleOverride ?? buildSetupSampleKis(namespace);
          setReviewSampleOverride(applyTweakToSetupSamples(base, userText));
          const from = setupSuccessKiCount > 0 ? setupSuccessKiCount : SAMPLE_SETUP_KI_COUNT;
          const nextCount = from + 2;
          setSetupSuccessKiCount(nextCount);
          patchNamespace(namespace.name, {
            indicators: buildSetupIndicators(namespace, nextCount),
            knowledge: knowledgeFromKiCount(nextCount),
          });
          setReviewTweakApplying(false);
          setReviewTweakEcho('');
          setReviewTryResult(null);
          resolve();
        }, 2000);
      });

    const runReviewTryQuestion = (samples: SetupSampleKi[]) => {
      const question = reviewTryQuestion.trim();
      if (!question) return;
      const lower = question.toLowerCase();
      // Canned miss: refunds before that KI is covered by refine.
      if (/\brefund/.test(lower) && !/\bsla\b|\bstore credit\b/.test(lower)) {
        setReviewTryResult({
          kind: 'miss',
          answer:
            'I would need to scan raw tickets for refund handling. No distilled Knowledge Indicator covers this yet.',
        });
        return;
      }
      const revenueHit =
        samples.find((sample) => /revenue|emea|account/i.test(sample.content)) ||
        samples.find((sample) => /bigquery|revenue/i.test(sample.from));
      if (/\brevenue\b|\bemea\b|\bq2\b/.test(lower) && revenueHit) {
        setReviewTryResult({
          kind: 'hit',
          answer: revenueHit.content,
          hitKey: revenueHit.key,
          hitLabel: revenueHit.content.slice(0, 48) + (revenueHit.content.length > 48 ? '…' : ''),
        });
        return;
      }
      const keywordHit = samples.find((sample) => {
        const haystack = `${sample.content} ${sample.from}`.toLowerCase();
        return lower
          .split(/\W+/)
          .filter((token) => token.length > 3)
          .some((token) => haystack.includes(token));
      });
      const hit = keywordHit || samples[0];
      if (!hit) {
        setReviewTryResult({
          kind: 'miss',
          answer: 'No sample Knowledge Indicators are available to answer from yet.',
        });
        return;
      }
      setReviewTryResult({
        kind: 'hit',
        answer: hit.content,
        hitKey: hit.key,
        hitLabel: hit.content.slice(0, 48) + (hit.content.length > 48 ? '…' : ''),
      });
    };

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

    const setupReviewPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <EuiTitle size="s">
          <h2>
            {activeSetupRun === 'full'
              ? '✓ Run complete. Here is a sample of what it created.'
              : '✓ Test run complete. Here is a sample of what it created.'}
          </h2>
        </EuiTitle>
        <EuiSpacer size="s" />
        {reviewTweakApplying ? (
          <div className="contextEnginePrototype__automationTweakApplying" role="status">
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiLoadingSpinner size="m" />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiText size="s">
                  <strong>Adjusting the automation and rerunning...</strong>
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiText size="s" color="subdued">
              Applying: &ldquo;{reviewTweakEcho}&rdquo;
            </EuiText>
          </div>
        ) : (
          <>
            <EuiText size="s" color="subdued">
              {reviewKiTotal} Knowledge Indicators from {setupAutomationCount} automation
              {setupAutomationCount === 1 ? '' : 's'}. {setupBenefit}
            </EuiText>
            <EuiSpacer size="m" />
            <EuiFlexGroup
              alignItems="center"
              gutterSize="s"
              responsive={false}
              wrap
              className="contextEnginePrototype__setupSampleOverlineRow"
            >
              <EuiFlexItem grow={false}>
                <EuiText size="xs" className="contextEnginePrototype__setupSampleOverline">
                  SAMPLE · {setupSampleKis.length} of {reviewKiTotal} Knowledge Indicators
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  ·
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiLink
                  onClick={() => selectNamespaceDetailTab('knowledge')}
                  className="contextEnginePrototype__setupSampleViewAll"
                >
                  View all {reviewKiTotal} in Knowledge Indicators ›
                </EuiLink>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <div className="contextEnginePrototype__setupSampleGrid">
              {setupSampleKis.map((sample) => {
                const isHit =
                  reviewTryResult?.kind === 'hit' && reviewTryResult.hitKey === sample.key;
                return (
                  <EuiPanel
                    key={sample.key}
                    hasBorder
                    paddingSize="m"
                    className={`contextEnginePrototype__setupSampleCard${
                      isHit ? ' contextEnginePrototype__setupSampleCard--hit' : ''
                    }`}
                  >
                    <EuiFlexGroup
                      alignItems="center"
                      gutterSize="s"
                      responsive={false}
                      wrap
                    >
                      <EuiFlexItem grow={false}>
                        <EuiToolTip
                          content={
                            KI_TYPE_TOOLTIPS[sample.type] ||
                            `${sample.type} Knowledge Indicator`
                          }
                        >
                          <EuiBadge color="hollow" className="contextEnginePrototype__typeBadge">
                            {sample.type}
                          </EuiBadge>
                        </EuiToolTip>
                      </EuiFlexItem>
                      {isHit ? (
                        <EuiFlexItem grow={false}>
                          <EuiBadge color="success" className="contextEnginePrototype__typeBadge">
                            Hit
                          </EuiBadge>
                        </EuiFlexItem>
                      ) : sample.badge ? (
                        <EuiFlexItem grow={false}>
                          <EuiBadge
                            color={sample.badge === 'New' ? 'accent' : 'success'}
                            className="contextEnginePrototype__typeBadge"
                          >
                            {sample.badge}
                          </EuiBadge>
                        </EuiFlexItem>
                      ) : null}
                    </EuiFlexGroup>
                    <EuiSpacer size="s" />
                    <EuiText size="s">{sample.content}</EuiText>
                    <EuiSpacer size="xs" />
                    <EuiText size="xs" color="subdued">
                      From {sample.from}
                    </EuiText>
                  </EuiPanel>
                );
              })}
            </div>
            <EuiSpacer size="m" />
            <EuiPanel
              hasBorder
              paddingSize="m"
              className="contextEnginePrototype__reviewTryBar"
              color="subdued"
            >
              <EuiText size="xs" className="contextEnginePrototype__intentMicroLabel">
                TRY A QUESTION
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiFlexGroup
                alignItems="flexStart"
                gutterSize="s"
                responsive={false}
                className="contextEnginePrototype__reviewTryRow"
              >
                <EuiFlexItem>
                  <EuiFieldText
                    fullWidth
                    compressed
                    placeholder="Ask something your agent should answer, e.g. What was EMEA revenue in Q2?"
                    value={reviewTryQuestion}
                    onChange={(event) => setReviewTryQuestion(event.target.value)}
                    aria-label="Try a question"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        runReviewTryQuestion(setupSampleKis);
                      }
                    }}
                  />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    size="s"
                    fill
                    disabled={!reviewTryQuestion.trim()}
                    onClick={() => runReviewTryQuestion(setupSampleKis)}
                  >
                    Test
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
              {reviewTryResult ? (
                <>
                  <EuiSpacer size="s" />
                  <EuiText size="s">{reviewTryResult.answer}</EuiText>
                  <EuiSpacer size="xs" />
                  {reviewTryResult.kind === 'hit' ? (
                    <EuiText size="xs" color="subdued">
                      Answered from knowledge · hit: {reviewTryResult.hitLabel}
                    </EuiText>
                  ) : (
                    <>
                      <EuiText size="xs" color="subdued">
                        Answered from raw data · no Knowledge Indicator covered this
                      </EuiText>
                      <EuiSpacer size="xs" />
                      <EuiText size="xs" color="subdued">
                        Refine the automation to cover it ↓
                      </EuiText>
                    </>
                  )}
                </>
              ) : null}
            </EuiPanel>
            <EuiSpacer size="m" />
            <EuiText size="s" color="subdued">
              Look right? Run on all data. Something off? Describe the change and the sample
              reruns.
            </EuiText>
            <EuiSpacer size="s" />
            <AutomationTweakInput
              placeholder="Describe what to change, e.g. ignore archived pages, split runbooks by service, skip meeting notes..."
              buttonLabel="Update automation"
              isSubmitting={reviewTweakApplying}
              onSubmit={applyReviewTweak}
              onContinueInAgent={(typedText) => {
                openAgentSidebar({
                  kind: 'continue',
                  contextChip: 'Sample KIs',
                  userMessage:
                    typedText ||
                    'Help me refine the sample Knowledge Indicators before I run on all data.',
                  proposalText:
                    'Adjust the sample extraction scope and rerun so the cards above update.',
                  onApply: () => {
                    void applyReviewTweak(
                      typedText || 'Tighten sample extraction to the agent\'s top questions'
                    );
                  },
                });
              }}
            />
          </>
        )}
        <EuiSpacer size="m" />
        <EuiFlexGroup alignItems="center" gutterSize="m" responsive={false} wrap>
          <EuiFlexItem grow={false}>
            {activeSetupRun === 'test' ? (
              <EuiButton
                fill
                disabled={reviewTweakApplying}
                onClick={() => continueFirstRunToFull(namespace)}
              >
                Looks good, run on all data ›
              </EuiButton>
            ) : (
              <EuiButton
                fill
                disabled={reviewTweakApplying}
                onClick={() => finishFirstRunFromReview(namespace)}
              >
                Looks good, finish
              </EuiButton>
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );

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
                    : `✓ ${displayName} is ready. ${setupReadyBanner.kiCount} Knowledge Indicators live. The automation keeps them fresh on schedule.`}
                </strong>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonIcon
                iconType="cross"
                aria-label="Dismiss"
                color="text"
                onClick={() => setSetupReadyBanner(null)}
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

    const userAutomationsApproved =
      pendingSuggestions.length === 0 && namespace.automations.length > 0;
    const userSetupStep = userAutomationsApproved ? 3 : 2;
    const firstRunUnlocked = userAutomationsApproved;
    const setupProposalRows = [
      ...namespace.automations.map((automation) => ({ automation, approved: true })),
      ...pendingSuggestions.map((automation) => ({ automation, approved: false })),
    ];

    const setupUserPanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__setupCard">
        <EuiTitle size="s">
          <h2>Finish setting up {displayName}</h2>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="s" color="subdued">
          Your index exists but is not useful yet. Two steps to first knowledge.
        </EuiText>
        <EuiSpacer size="m" />
        <div className="contextEnginePrototype__setupChecklist">
          <div className="contextEnginePrototype__setupChecklistRow contextEnginePrototype__setupChecklistRow--done">
            <span className="contextEnginePrototype__setupStepMarker" aria-hidden={true}>
              <EuiIcon type="check" size="s" />
            </span>
            <div className="contextEnginePrototype__setupChecklistBody">
              <EuiText size="s">
                <strong>Sources connected</strong>
              </EuiText>
              <EuiText size="xs" color="subdued">
                {namespace.sources.join(', ') || 'No sources'}
              </EuiText>
            </div>
          </div>

          <div
            className={`contextEnginePrototype__setupChecklistRow${
              userSetupStep === 2
                ? ' contextEnginePrototype__setupChecklistRow--current'
                : ' contextEnginePrototype__setupChecklistRow--done'
            }`}
          >
            <span className="contextEnginePrototype__setupStepMarker" aria-hidden={true}>
              {userAutomationsApproved ? (
                <EuiIcon type="check" size="s" />
              ) : (
                '2'
              )}
            </span>
            <div className="contextEnginePrototype__setupChecklistBody">
              <EuiFlexGroup
                alignItems="center"
                justifyContent="spaceBetween"
                gutterSize="m"
                responsive={false}
              >
                <EuiFlexItem grow={true}>
                  <EuiText size="s">
                    <strong>Approve suggested automations</strong>
                  </EuiText>
                </EuiFlexItem>
                {pendingSuggestions.length > 1 ? (
                  <EuiFlexItem grow={false}>
                    <EuiButton
                      fill
                      size="s"
                      onClick={() => {
                        setProposalEditorOpenId(null);
                        approveAllSuggestedAutomations();
                      }}
                    >
                      Approve all ({pendingSuggestions.length})
                    </EuiButton>
                  </EuiFlexItem>
                ) : null}
              </EuiFlexGroup>
              <EuiText size="xs" color="subdued">
                {pendingSuggestions.length > 0
                  ? `${pendingSuggestions.length} proposed, one per source. Review what it will do before anything runs.`
                  : `${namespace.automations.length} approved`}
              </EuiText>
              {setupProposalRows.length > 0 && (
                <div className="contextEnginePrototype__setupProposalList">
                  {setupProposalRows.map(({ automation, approved }) => {
                    const sourceName = proposalSourceName(automation, namespace.sources);
                    const editorOpen =
                      !approved && proposalEditorOpenId === automation.id;
                    const displayDescription = automation.description.startsWith(
                      'Adjusted before approve:'
                    )
                      ? automation.description
                      : proposalBenefitDescription(sourceName);
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
                            {approved ? (
                              <EuiText
                                size="s"
                                color="subdued"
                                className="contextEnginePrototype__setupProposalApproved"
                              >
                                ✓ Approved
                              </EuiText>
                            ) : (
                              <EuiFlexGroup
                                alignItems="center"
                                gutterSize="s"
                                responsive={false}
                              >
                                <EuiFlexItem grow={false}>
                                  <EuiToolTip content="Edit proposal">
                                    <EuiButtonIcon
                                      iconType="pencil"
                                      size="s"
                                      color="text"
                                      aria-label="Edit proposal"
                                      aria-expanded={editorOpen}
                                      display={editorOpen ? 'base' : 'empty'}
                                      onClick={() =>
                                        setProposalEditorOpenId(
                                          editorOpen ? null : automation.id
                                        )
                                      }
                                    />
                                  </EuiToolTip>
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
                            )}
                          </EuiFlexItem>
                        </EuiFlexGroup>
                        <EuiText size="s" color="subdued">
                          {displayDescription}
                        </EuiText>
                        <EuiSpacer size="xs" />
                        <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
                          <EuiFlexItem grow={false}>
                            <EuiBadge
                              color="hollow"
                              className="contextEnginePrototype__setupProposalChip"
                            >
                              READS {sourceName}
                            </EuiBadge>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                        {proposalConfirmations[automation.id] ? (
                          <>
                            <EuiSpacer size="xs" />
                            <EuiText
                              size="xs"
                              color="success"
                              className="contextEnginePrototype__proposalConfirm"
                            >
                              {proposalConfirmations[automation.id]}
                            </EuiText>
                          </>
                        ) : null}
                        {editorOpen ? (
                          <>
                            <EuiSpacer size="s" />
                            <AutomationTweakInput
                              placeholder={proposalEditPlaceholder(sourceName)}
                              buttonLabel="Update proposal"
                              hint="Plain words, no YAML. Nothing runs until you approve."
                              onSubmit={(text) =>
                                updateProposalWithPrompt(automation, text)
                              }
                              onContinueInAgent={(typedText) => {
                                setProposalEditorOpenId(null);
                                openAgentSidebar({
                                  kind: 'continue',
                                  contextChip: `Automation · ${automation.title}`,
                                  userMessage:
                                    typedText ||
                                    `Help me edit the proposal "${automation.title}".`,
                                  proposalText: `Update the proposal for ${sourceName} based on your notes.`,
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
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className={`contextEnginePrototype__setupChecklistRow${
              userSetupStep === 3
                ? ' contextEnginePrototype__setupChecklistRow--current'
                : ' contextEnginePrototype__setupChecklistRow--upcoming'
            }`}
          >
            <span className="contextEnginePrototype__setupStepMarker" aria-hidden={true}>
              3
            </span>
            <div
              className={`contextEnginePrototype__setupChecklistBody${
                firstRunUnlocked ? '' : ' contextEnginePrototype__setupFirstRun--locked'
              }`}
            >
              <EuiText size="s">
                <strong>First run</strong>
              </EuiText>
              <EuiText size="xs" color="subdued">
                {firstRunUnlocked
                  ? 'Choose the scale; you review a sample either way.'
                  : 'Approve the automations above to unlock the first run.'}
              </EuiText>
              <EuiSpacer size="s" />
              <EuiFlexGroup gutterSize="s" responsive={false}>
                <EuiFlexItem>
                  <EuiPanel
                    hasBorder
                    paddingSize="s"
                    className={`contextEnginePrototype__setupScaleCard${
                      firstRunUnlocked && firstRunScale === 'test'
                        ? ' contextEnginePrototype__setupScaleCard--selected'
                        : ''
                    }`}
                    onClick={firstRunUnlocked ? () => setFirstRunScale('test') : undefined}
                    role="radio"
                    aria-checked={firstRunScale === 'test'}
                    aria-disabled={!firstRunUnlocked}
                  >
                    <EuiFlexGroup alignItems="flexStart" gutterSize="s" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiRadio
                          id="first-run-scale-test"
                          checked={firstRunScale === 'test'}
                          disabled={!firstRunUnlocked}
                          onChange={() => setFirstRunScale('test')}
                          label=""
                        />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiText size="s">
                          <strong>Test run</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          Sample of your data · about 2 min
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiPanel
                    hasBorder
                    paddingSize="s"
                    className={`contextEnginePrototype__setupScaleCard${
                      firstRunUnlocked && firstRunScale === 'full'
                        ? ' contextEnginePrototype__setupScaleCard--selected'
                        : ''
                    }`}
                    onClick={firstRunUnlocked ? () => setFirstRunScale('full') : undefined}
                    role="radio"
                    aria-checked={firstRunScale === 'full'}
                    aria-disabled={!firstRunUnlocked}
                  >
                    <EuiFlexGroup alignItems="flexStart" gutterSize="s" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiRadio
                          id="first-run-scale-full"
                          checked={firstRunScale === 'full'}
                          disabled={!firstRunUnlocked}
                          onChange={() => setFirstRunScale('full')}
                          label=""
                        />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiText size="s">
                          <strong>Full run</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          All {setupPageCount.toLocaleString()} pages · about 40 min
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiPanel>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="xxl" />
              <EuiButton
                fill
                size="s"
                disabled={!firstRunUnlocked}
                onClick={() => startFirstRun(namespace, firstRunScale)}
              >
                {firstRunScale === 'test' ? 'Run test ›' : 'Run on all data ›'}
              </EuiButton>
            </div>
          </div>
        </div>
      </EuiPanel>
    );

    const setupPanel = (() => {
      if (setupPhase === 'running') return setupRunningPanel;
      if (setupPhase === 'review') return setupReviewPanel;
      return namespace.managed ? setupManagedPanel : setupUserPanel;
    })();

    const selectedDetailContent = (() => {
      switch (effectiveDetailTab) {
        case 'automations':
          return automationsPanel;
        case 'knowledge':
          return knowledgePanel;
        case 'overview':
        default:
          if (inSetupMode) {
          return (
            <>
                {namespace.lifecycleStatus === 'needsSetup' && setupPhase === 'configure' && (
                  <>
                    <EuiText size="s" color="subdued">
                      This index needs a one-time setup before agents can retrieve from it.
                    </EuiText>
                    <EuiSpacer size="m" />
                  </>
                )}
                {setupPanel}
              </>
            );
          }
          return (
            <>
              {setupReadyStrip}
              {setupReadyStrip ? <EuiSpacer size="m" /> : null}
              {howItWorksCallout}
              {overviewStatsPanel}
              {improvementsPanel}
              {descriptionPanel}
              {sourcesPanel}
              {improvementEvidenceFlyout}
            </>
          );
      }
    })();

    const tabIntro =
      effectiveDetailTab === 'automations' ? (
        <EuiText size="xs" color="subdued" className="contextEnginePrototype__tabIntro">
          Automations read your sources on a schedule and produce the Knowledge Indicators.
        </EuiText>
      ) : effectiveDetailTab === 'knowledge' ? (
        <EuiText size="xs" color="subdued" className="contextEnginePrototype__tabIntro">
          The knowledge your agents retrieve. Each indicator shows the automation and sources it
          came from.
        </EuiText>
      ) : null;

    return (
      <>
        <EuiPageTemplate.Section grow={false} className="contextEnginePrototype__backstackHeader">
          <EuiButtonEmpty
            iconType="arrowLeft"
            onClick={goToIndex}
            flush="left"
            color="primary"
            className="contextEnginePrototype__backstackLink"
          >
            Back to Context
          </EuiButtonEmpty>
          <EuiSpacer size="s" />
          <EuiFlexGroup
            alignItems="flexStart"
            justifyContent="spaceBetween"
            responsive={false}
            gutterSize="m"
          >
            <EuiFlexItem>
              <EuiFlexGroup alignItems="center" responsive={false} gutterSize="s" wrap>
                <EuiFlexItem grow={false}>
                  <EuiTitle size="l">
                    <h1>{displayName}</h1>
                  </EuiTitle>
                </EuiFlexItem>
                {howItWorksDismissed && !howItWorksVisible && (
                  <EuiFlexItem grow={false}>
                    <EuiToolTip content="How this index works">
                      <EuiButtonIcon
                        iconType="info"
                        color="primary"
                        aria-label="How this index works"
                        onClick={() => {
                          setHowItWorksVisible(true);
                          selectNamespaceDetailTab('overview');
                        }}
                        data-test-subj="contextEngineHowItWorksReopen"
                      />
                    </EuiToolTip>
                  </EuiFlexItem>
                )}
                {namespace.managed && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge
                      color="hollow"
                      iconType="lock"
                      className="contextEnginePrototype__typeBadge"
                    >
                      Managed
                    </EuiBadge>
                  </EuiFlexItem>
                )}
                <EuiFlexItem grow={false}>
                  {lifecycle.kind === 'needsSetup' ? (
                    <EuiBadge
                      color="warning"
                      className="contextEnginePrototype__typeBadge contextEnginePrototype__lifecycleBadge--needsSetup"
                    >
                      Needs setup
                    </EuiBadge>
                  ) : lifecycle.kind === 'settingUp' ? (
                    <EuiBadge
                      color="primary"
                      className="contextEnginePrototype__typeBadge contextEnginePrototype__lifecycleBadge--settingUp"
                    >
                      <EuiLoadingSpinner size="s" />
                      Setting up
                    </EuiBadge>
                  ) : (
                  <EuiBadge color="success" className="contextEnginePrototype__typeBadge">
                      {namespace.managed ? 'Active' : 'Ready'}
                  </EuiBadge>
                  )}
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="xs" />
              <EuiText size="s" color="subdued">
                {namespace.sources.join(' · ') || 'No sources yet'}
              </EuiText>
            </EuiFlexItem>
            {!inSetupMode && (
            <EuiFlexItem grow={false}>
              <EuiFlexGroup responsive={false} gutterSize="s">
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Open this namespace in the chat UI">
                      <EuiButton
                        iconType="comment"
                        aria-label="Open this namespace in the chat UI"
                        onClick={() => openInChat(namespace)}
                      >
                      Open in chat
                    </EuiButton>
                  </EuiToolTip>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Open the integration package to use this namespace in an agent">
                    <EuiButton
                      id="context-engine-5-use-in-agent"
                      iconType="bolt"
                        onClick={openUseInAgent}
                      aria-label="Open the integration package to use this namespace in an agent"
                    >
                      Use in an agent
                    </EuiButton>
                  </EuiToolTip>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiPageTemplate.Section>

        <EuiPageTemplate.Section>
          <div className="contextEnginePrototype__detailStack">
            {detailTabsVisible ? (
              <>
            <EuiTabs>
              {detailTabItems.map((tab) => (
                <EuiTab
                  key={tab.id}
                  isSelected={namespaceDetailTab === tab.id}
                  onClick={() => selectNamespaceDetailTab(tab.id)}
                >
                  {tab.name}
                </EuiTab>
              ))}
            </EuiTabs>
            {tabIntro}
              </>
            ) : null}
            <div className="contextEnginePrototype__detailStack" role="tabpanel">
              {selectedDetailContent}
            </div>
          </div>
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderIssue = () => {
    const namespace = activeNamespace || namespaces[0];
    const issue = activeIssue || namespace.monitoring.issues[0];
    if (!issue) {
      return (
        <EuiPageTemplate.Section>
          <EuiButtonEmpty iconType="arrowLeft" onClick={() => setScreen('namespace')}>
            Back to {catalogDisplayName(namespace)}
          </EuiButtonEmpty>
          <EuiSpacer size="m" />
          <EuiText>No issue selected.</EuiText>
        </EuiPageTemplate.Section>
      );
    }
    const subPatternTraces = issue.subPatterns.reduce((sum, pattern) => sum + pattern.traces, 0);

    return (
      <>
        <EuiPageTemplate.Section grow={false} className="contextEnginePrototype__backstackHeader">
          <EuiButtonEmpty
            iconType="arrowLeft"
            onClick={() => {
              setActiveIssue(null);
              setScreen('namespace');
            }}
            flush="left"
            color="primary"
            className="contextEnginePrototype__backstackLink"
          >
            Back to {catalogDisplayName(namespace)}
          </EuiButtonEmpty>
          <EuiSpacer size="s" />
          <EuiTitle size="l">
            <h1>{issue.title}</h1>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiFlexGroup responsive={false} gutterSize="s" wrap>
            <EuiFlexItem grow={false}>
              <EuiBadge color={issue.severity === 'high' ? 'danger' : 'warning'}>
                {issue.severity}
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">{issue.traces} affected traces</EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">KI-addressable</EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            Fix path: {issue.fixPath}
          </EuiText>
        </EuiPageTemplate.Section>

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
      setWorkflowDirty(false);
      setWorkflowNotice({ type: 'success', text: 'Workflow saved.' });
    };

    return (
      <>
        <EuiPageTemplate.Section
          grow
          paddingSize="none"
          className="contextEnginePrototype__workflowSection"
        >
          <div className="contextEnginePrototype__workflowShell">
            <header className="contextEnginePrototype__workflowTopBar">
              <EuiFlexGroup
                alignItems="flexEnd"
                justifyContent="spaceBetween"
                gutterSize="l"
                responsive={false}
                wrap
              >
                <EuiFlexItem grow={false} className="contextEnginePrototype__workflowHeaderLeft">
                  <EuiButtonEmpty
                    iconType="sortLeft"
                    size="xs"
                    flush="left"
                    color="primary"
                    onClick={() => {
                      setShowTestRunModal(false);
                      setWorkflowNotice(null);
                      setScreen('namespace');
                    }}
                  >
                    Back to{' '}
                    {activeNamespace
                      ? catalogDisplayName(activeNamespace)
                      : 'namespace'}
                  </EuiButtonEmpty>
                  <EuiFlexGroup
                    alignItems="center"
                    gutterSize="m"
                    responsive={false}
                    wrap
                    className="contextEnginePrototype__workflowTitleRow"
                  >
                    <EuiFlexItem grow={false} className="contextEnginePrototype__workflowTitleItem">
                      <EuiTitle size="m">
                        <h1>{workflowName}</h1>
                      </EuiTitle>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      {workflowDirty ? (
                        <EuiBadge className="contextEnginePrototype__workflowUnsavedBadge">
                          Unsaved changes
                        </EuiBadge>
                      ) : (
                        <EuiBadge color="hollow" iconType="check">
                          Saved
                        </EuiBadge>
                      )}
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiFlexGroup
                    justifyContent="flexEnd"
                    alignItems="center"
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
              <div className="contextEnginePrototype__workflowEditorChrome">
                <EuiButtonEmpty
                  size="xs"
                  iconType="download"
                  color="text"
                  className="contextEnginePrototype__workflowSchemaLink"
                  onClick={(event: React.MouseEvent) => {
                    event.preventDefault();
                    setWorkflowNotice({
                      type: 'success',
                      text: 'JSON Schema download started.',
                    });
                  }}
                >
                  JSON Schema
                </EuiButtonEmpty>
              </div>

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
                    if (!workflowEditable) return;
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
                    readOnly: !workflowEditable,
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
                      <EuiButtonEmpty
                        size="s"
                        iconType="popout"
                        iconSide="right"
                        href="https://www.elastic.co/docs"
                        target="_blank"
                      >
                        Documentation
                      </EuiButtonEmpty>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButtonEmpty
                        size="s"
                        onClick={() =>
                          setWorkflowNotice({
                            type: 'success',
                            text: 'Actions menu · Validate, Export, and Duplicate live here.',
                          })
                        }
                      >
                        <span className="contextEnginePrototype__workflowActionsLabel">
                          <strong>Actions menu</strong>
                          <span className="contextEnginePrototype__workflowKbd">
                            <kbd>⌘</kbd>
                            <kbd>K</kbd>
                          </span>
                        </span>
                      </EuiButtonEmpty>
                    </EuiFlexItem>
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
        <EuiPageTemplate.Section grow={false} className="contextEnginePrototype__backstackHeader">
          <EuiButtonEmpty
            iconType="arrowLeft"
            onClick={() => {
              setAgentNotice(null);
              setScreen('namespace');
            }}
            flush="left"
            color="primary"
            className="contextEnginePrototype__backstackLink"
          >
            Back to {catalogDisplayName(namespace)}
          </EuiButtonEmpty>
          <EuiSpacer size="s" />
          <EuiTitle size="l">
            <h1>Connect {catalogDisplayName(namespace)} to your agent</h1>
          </EuiTitle>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            Integration package for <EuiCode>{indexName}</EuiCode>
            {namespace.integration ? ` · typically wired via ${namespace.integration}` : ''}
          </EuiText>
        </EuiPageTemplate.Section>

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
                                    ? 'Context Engine is on · retrieving from 2 AI indexes'
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
        <EuiPageTemplate.Section grow={false} className="contextEnginePrototype__backstackHeader">
          <EuiButtonEmpty
            iconType="arrowLeft"
            onClick={() => {
              setAgentBuilderManageNotice(null);
              setHighlightedAgentBuilderRow(null);
              setScreen('agent');
              setAgentHarness('agentBuilder');
            }}
            flush="left"
            color="primary"
            className="contextEnginePrototype__backstackLink"
          >
            Back to Use in an agent
          </EuiButtonEmpty>
          <EuiSpacer size="s" />
          <EuiTitle size="l">
            <h1>Agent Builder · Manage Context</h1>
          </EuiTitle>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            Enable Context for an agent so it can retrieve from{' '}
            <EuiCode>{catalogDisplayName(namespace)}</EuiCode>.
          </EuiText>
        </EuiPageTemplate.Section>

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
                      id={highlighted ? 'context-engine-5-agent-builder-highlight' : undefined}
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
    issue: renderIssue,
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
