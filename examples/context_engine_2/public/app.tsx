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
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiButtonIcon,
  EuiCallOut,
  EuiCode,
  EuiCodeBlock,
  EuiFieldSearch,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexGrid,
  EuiFlexItem,
  EuiFormRow,
  EuiHorizontalRule,
  EuiIcon,
  EuiLink,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiPageTemplate,
  EuiPanel,
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
  hasVersionHistory,
  operationalTagsFor,
  typeBadgeColor,
  valueBlockFor,
} from './knowledge_indicators';
import {
  buildChatDescription,
  buildNamespaceFromWizard,
  initialNamespaces,
  knowledgeTotal,
  namespaceIssueCount,
  namespaceIsHealthy,
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
  | 'knowledge'
  | 'agent';
type SourceCategory = 'esql' | 'connectors' | 'signals' | 'traces' | 'features';
type CreateSourceTab = 'esql' | 'connectors';
type StorageType = NamespaceStorageType;
type StorageFilter = 'all' | StorageType;
type HealthFilter = 'all' | 'healthy' | 'issues';
type KiVersionFilter = 'all' | 'current' | 'hasNewer';
type AgentHarness = 'claudeCode' | 'claudeSdk' | 'langchain' | 'cowork' | 'mcp';

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

const CREATE_SOURCE_TABS: Array<{ id: CreateSourceTab; label: string; icon: string }> = [
  { id: 'esql', label: 'ES|QL', icon: 'editorCodeBlock' },
  { id: 'connectors', label: 'Connectors', icon: 'plugs' },
];

const ESQL_SUGGESTIONS = [
  '(FROM ...)',
  '(ROW ...)',
  '(TS ...)',
  '$.alert-actions',
  'ai-index-idx-sw1-data',
  'ai-index-idx-sml-data-000001',
  'content-gmail-7981',
  'bigquery-export-*',
  'analytics-events',
];

const ESQL_EDITOR_PLACEHOLDER =
  "// Start typing ES|QL, or describe what you're looking for in a // comment, then press Cmd+J to generate the query";

const isEsqlDraftEmpty = (value: string) => {
  const trimmed = value.trim();
  return !trimmed || trimmed === 'FROM _' || trimmed === ESQL_EDITOR_PLACEHOLDER;
};

const truncateEsqlLabel = (query: string, max = 42) => {
  const compact = query.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
};

type WorkflowProfile = 'support' | 'logs';

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
  return 'logs';
};

const buildSupportWorkflowYaml = (sourceName: string, workflowName: string) => `version: '1'
name: ${workflowName}
enabled: true
triggers:
  - type: manual
steps:
  # One row per case. STATS collapses the feed into an array on the case.
  - name: query_cases
    type: elasticsearch.esql.query
    with:
      query: >
        FROM support-cases*
        | WHERE feed_type IN ("email", "web", "chatter", "comment")
        | STATS
            problem     = TOP(case_subject, 1),
            product     = TOP(product_name, 1),
            version     = TOP(stack_version, 1),
            links_kb    = VALUES(kb_url),
            feed_events = VALUES(feed_body)
          BY case_id
        | KEEP case_id, problem, product, version, links_kb, feed_events

  - name: loop_cases
    type: foreach
    foreach: '{{ steps.query_cases.output.values }}'
    steps:
      - name: extract_ki
        type: ai.agent
        agentId: customer_support_ki_agent
        timeout: 180s
        with:
          message: >
            Distil one atomic KI from the case and upsert it into this
            context namespace, keyed on case_id so re-runs update in place.`;

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
  return workflowProfileForSource(sourceName) === 'support'
    ? buildSupportWorkflowYaml(sourceName, name)
    : buildLogsWorkflowYaml(sourceName, name);
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

const agentHarnessFromIntegration = (integration: string): AgentHarness => {
  const value = integration.toLowerCase();
  if (value.includes('langchain') || value.includes('langgraph')) return 'langchain';
  if (value.includes('claude agent')) return 'claudeSdk';
  if (value.includes('claude')) return 'claudeCode';
  if (value.includes('cowork')) return 'cowork';
  return 'mcp';
};

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
    return 'Enter a namespace name.';
  }
  if (name.startsWith('-')) {
    return 'Name must start with a lowercase letter or number.';
  }
  const normalized = slugify(name);
  if (!normalized) {
    return 'Enter a namespace name.';
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return 'Use lowercase letters, numbers, and hyphens only (no spaces or special characters).';
  }
  if (normalized.length > 200) {
    return 'Name is too long for an Elasticsearch index.';
  }
  return undefined;
};

const getStorageRecommendation = (
  sources: Source[]
): { type: StorageType; reason: string; isMixed: boolean } => {
  const hasTimeBased = sources.some(
    (source) => source.category === 'traces' || source.category === 'signals'
  );
  const hasReference = sources.some(
    (source) =>
      source.category === 'esql' ||
      source.category === 'connectors' ||
      source.category === 'features'
  );

  if (hasTimeBased && !hasReference) {
    return {
      type: 'dataStream',
      reason: 'time-based context from traces/signals.',
      isMixed: false,
    };
  }

  if (hasTimeBased && hasReference) {
    return {
      type: 'index',
      reason:
        'Mixed sources default to Index; choose Data stream if this namespace is primarily time-based.',
      isMixed: true,
    };
  }

  return {
    type: 'index',
    reason: "reference context that isn't time-based.",
    isMixed: false,
  };
};

function ContextEngineApp({ coreStart }: { coreStart: CoreStart }) {
  const [screen, setScreen] = useState<Screen>('index');
  const [createSourceTab, setCreateSourceTab] = useState<CreateSourceTab>('esql');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [customEsqlSources, setCustomEsqlSources] = useState<Source[]>([]);
  const [esqlDraft, setEsqlDraft] = useState(ESQL_EDITOR_PLACEHOLDER);
  const [showEsqlSuggestions, setShowEsqlSuggestions] = useState(false);
  const [namespaceName, setNamespaceName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [storageType, setStorageType] = useState<StorageType>('index');
  const [storageTypeTouched, setStorageTypeTouched] = useState(false);
  const [namespaces, setNamespaces] = useState(initialNamespaces);
  const [activeNamespace, setActiveNamespace] = useState<Namespace | null>(null);
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
  const [agentHarness, setAgentHarness] = useState<AgentHarness>('langchain');
  const [apiKeyRevealed, setApiKeyRevealed] = useState(false);
  const [agentNotice, setAgentNotice] = useState<{
    type: 'success' | 'warning' | 'danger';
    text: string;
  } | null>(null);
  const [isDefiningDescription, setIsDefiningDescription] = useState(false);
  const [namespaceQuery, setNamespaceQuery] = useState('');
  const [storageFilter, setStorageFilter] = useState<StorageFilter>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [focusMonitoring, setFocusMonitoring] = useState(false);
  const [kiTypeFilter, setKiTypeFilter] = useState<KnowledgeIndicator['type'] | null>(null);
  const [kiSearchQuery, setKiSearchQuery] = useState('');
  const [kiSourceFilter, setKiSourceFilter] = useState('all');
  const [kiVersionFilter, setKiVersionFilter] = useState<KiVersionFilter>('all');

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
    if (screen !== 'namespace' || !focusMonitoring) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById('context-engine-monitoring')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setFocusMonitoring(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen, focusMonitoring, activeNamespace?.name]);

  const allSources = useMemo(
    () => [...availableSources, ...customEsqlSources],
    [customEsqlSources]
  );
  const selectedSources = useMemo(
    () => allSources.filter(({ id }) => selectedSourceIds.includes(id)),
    [allSources, selectedSourceIds]
  );
  const namespaceSlug = slugify(namespaceName) || 'namespace';
  const storagePrefix = storageType === 'dataStream' ? 'ds' : 'idx';
  const backingIndexName = `ai-index-${storagePrefix}-${namespaceSlug}`;
  const namespaceNameError = validateNamespaceName(namespaceName);
  const esqlSuggestions = useMemo(() => {
    const match = esqlDraft.match(/FROM\s+([^\s|]*)$/i);
    if (!match) return [];
    const fragment = match[1].replace(/_$/, '').toLowerCase();
    return ESQL_SUGGESTIONS.filter((item) => item.toLowerCase().includes(fragment)).slice(0, 8);
  }, [esqlDraft]);
  const storageRecommendation = useMemo(
    () => getStorageRecommendation(selectedSources),
    [selectedSources]
  );

  useEffect(() => {
    if (storageTypeTouched) return;
    setStorageType(storageRecommendation.type);
  }, [storageRecommendation.type, storageTypeTouched]);

  const filteredNamespaces = useMemo(() => {
    const query = namespaceQuery.trim().toLowerCase();
    return namespaces.filter((namespace) => {
      if (storageFilter !== 'all' && namespace.storageType !== storageFilter) return false;
      if (healthFilter === 'healthy' && !namespaceIsHealthy(namespace)) return false;
      if (healthFilter === 'issues' && namespaceIsHealthy(namespace)) return false;
      if (!query) return true;
      const haystack = [
        namespace.name,
        namespace.integration,
        namespace.description,
        namespace.indexName,
        ...namespace.sources,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [namespaces, namespaceQuery, storageFilter, healthFilter]);

  const goToIndex = () => {
    setScreen('index');
    setActiveNamespace(null);
    setActiveIssue(null);
    setActiveIndicatorId(null);
    setSelectedKiVersion(null);
    setAddedAutomations([]);
  };

  const startWizard = () => {
    setSelectedSourceIds([]);
    setCustomEsqlSources([]);
    setEsqlDraft(ESQL_EDITOR_PLACEHOLDER);
    setShowEsqlSuggestions(false);
    setNamespaceName('');
    setCreateDescription('');
    setStorageType('index');
    setStorageTypeTouched(false);
    setCreateSourceTab('esql');
    setScreen('create');
  };

  const chooseStorageType = (next: StorageType) => {
    setStorageTypeTouched(true);
    setStorageType(next);
  };

  const removeSelectedSource = (id: string) => {
    setSelectedSourceIds((current) => current.filter((sourceId) => sourceId !== id));
    setCustomEsqlSources((current) => current.filter((source) => source.id !== id));
  };

  const addEsqlSource = () => {
    if (isEsqlDraftEmpty(esqlDraft)) return;
    const query = esqlDraft.replace(/\s+/g, ' ').trim();
    const id = `esql-custom-${Date.now()}`;
    const label = truncateEsqlLabel(query);
    const source: Source = {
      id,
      name: label,
      description: `ES|QL · ${query}`,
      category: 'esql',
      typeLabel: 'ES|QL view',
      icon: 'editorCodeBlock',
    };
    setCustomEsqlSources((current) => [...current, source]);
    setSelectedSourceIds((current) => [...current, id]);
    setEsqlDraft(ESQL_EDITOR_PLACEHOLDER);
    setShowEsqlSuggestions(false);
  };

  const applyEsqlSuggestion = (suggestion: string) => {
    const next = suggestion.startsWith('(')
      ? suggestion.replace(/^\(|\.\.\.\)$/g, '').trim()
      : `FROM ${suggestion}`;
    setEsqlDraft(next.startsWith('FROM') ? next : `FROM ${suggestion}`);
    setShowEsqlSuggestions(false);
  };

  const createNamespace = () => {
    const normalizedName = slugify(namespaceName);
    if (validateNamespaceName(normalizedName)) return;

    const sourceDetails: NamespaceSource[] = selectedSources.map((source) => ({
      name: source.name,
      subtitle: source.description,
      typeLabel: source.typeLabel,
      icon: source.icon,
    }));
    const namespace = buildNamespaceFromWizard(
      normalizedName,
      selectedSources.map(({ name }) => name),
      sourceDetails,
      storageType,
      'Claude Agent SDK',
      createDescription
    );
    setNamespaces((current) => [...current, namespace]);
    setActiveNamespace(namespace);
    setAddedAutomations([]);
    setActiveIssue(null);
    setScreen('namespace');
  };

  const openNamespace = (
    namespace: Namespace,
    options?: {
      focusMonitoring?: boolean;
    }
  ) => {
    setActiveNamespace(namespace);
    setAddedAutomations([]);
    setActiveIssue(null);
    setActiveIndicatorId(null);
    setSelectedKiVersion(null);
    setKiTypeFilter(null);
    setIsDefiningDescription(false);
    setFocusMonitoring(Boolean(options?.focusMonitoring));
    setScreen('namespace');
  };

  const openKnowledgeIndicators = (type?: KnowledgeIndicator['type']) => {
    if (!activeNamespace) return;
    const filtered = type
      ? activeNamespace.indicators.filter((indicator) => indicator.type === type)
      : activeNamespace.indicators;
    const first = filtered[0] ?? activeNamespace.indicators[0] ?? null;
    setKiTypeFilter(type ?? null);
    setKiSearchQuery('');
    setKiSourceFilter('all');
    setKiVersionFilter('all');
    setActiveIndicatorId(first?.id ?? null);
    setSelectedKiVersion(first?.currentVersion ?? null);
    setScreen('knowledge');
  };

  const selectKnowledgeIndicator = (indicator: KnowledgeIndicator) => {
    setActiveIndicatorId(indicator.id);
    setSelectedKiVersion(indicator.currentVersion);
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
    return (
      taggedSource ||
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
    const updated: Namespace = {
      ...activeNamespace,
      monitoring: {
        ...activeNamespace.monitoring,
        connected: true,
        traceId: `traces-apm.agent-${slugify(activeNamespace.name)}.default`,
        traceLabel: `${activeNamespace.name} · 0 traces`,
        traceCount: 0,
        issuesSummary: 'No failing traces yet',
        issues: [],
        efficiency: activeNamespace.monitoring.efficiency || {
          retrievalHitRate: 0,
          tokensSavedPct: 0,
          medianLatencyMs: 0,
        },
      },
    };
    setActiveNamespace(updated);
    setNamespaces((current) =>
      current.map((namespace) => (namespace.name === updated.name ? updated : namespace))
    );
  };

  const addSuggestedAutomation = (automation: Automation) => {
    if (!activeNamespace) return;
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

  const renderIndex = () => {
    const maxVisibleSources = 3;
    const storageFilterOptions = [
      { id: 'all', label: 'All' },
      { id: 'index', label: 'Index' },
      { id: 'dataStream', label: 'Data stream' },
    ];
    const healthFilterOptions = [
      { id: 'all', label: 'All' },
      { id: 'healthy', label: 'Healthy' },
      { id: 'issues', label: 'Has issues' },
    ];

    return (
      <>
        {pageHeader(
          'Context',
          'Manage AI indexes to organize and retrieve contextual knowledge for your agents.',
          [
            <EuiButton key="create" fill iconType="plusInCircle" onClick={startWizard}>
              Create AI Index
            </EuiButton>,
          ]
        )}
        <EuiPageTemplate.Section>
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
                  placeholder="Search namespaces"
                  value={namespaceQuery}
                  onChange={(event) => setNamespaceQuery(event.target.value)}
                  aria-label="Search namespaces"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFormRow label="Storage type" display="rowCompressed">
                <EuiButtonGroup
                  legend="Filter namespaces by storage type"
                  options={storageFilterOptions}
                  idSelected={storageFilter}
                  onChange={(id) => setStorageFilter(id as StorageFilter)}
                  buttonSize="compressed"
                  color="text"
                />
              </EuiFormRow>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFormRow label="Health" display="rowCompressed">
                <EuiButtonGroup
                  legend="Filter namespaces by health"
                  options={healthFilterOptions}
                  idSelected={healthFilter}
                  onChange={(id) => setHealthFilter(id as HealthFilter)}
                  buttonSize="compressed"
                  color="text"
                />
              </EuiFormRow>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="xxl" />
          {filteredNamespaces.length === 0 ? (
            <EuiPanel hasBorder paddingSize="l">
              <EuiText color="subdued">No namespaces match your search or filters.</EuiText>
            </EuiPanel>
          ) : (
            <EuiFlexGrid columns={3} gutterSize="m">
              {filteredNamespaces.map((namespace) => {
                const issueCount = namespaceIssueCount(namespace);
                const healthy = namespaceIsHealthy(namespace);
                const kiCount = namespace.indicators.length;
                const shownSources = namespace.sources.slice(0, maxVisibleSources);
                const hiddenSourceCount = Math.max(0, namespace.sources.length - maxVisibleSources);
                const storageDisplay =
                  namespace.storageType === 'dataStream' ? 'Data stream' : 'Index';
                const metaLabel = namespace.managed ? 'Ownership' : 'Updated';
                const metaValue = namespace.managed ? 'Elastic' : namespace.updated;
                const cardClassName = namespace.managed
                  ? 'contextEnginePrototype__namespaceCard contextEnginePrototype__namespaceCard--managed'
                  : 'contextEnginePrototype__namespaceCard';

                return (
                  <EuiFlexItem key={namespace.name}>
                    <EuiPanel
                      hasBorder
                      paddingSize="m"
                      className={cardClassName}
                      onClick={() => openNamespace(namespace)}
                      onKeyDown={(event: React.KeyboardEvent) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openNamespace(namespace);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${namespace.name} namespace`}
                    >
                      <div className="contextEnginePrototype__namespaceCardBody">
                        <EuiFlexGroup
                          alignItems="flexStart"
                          justifyContent="spaceBetween"
                          responsive={false}
                          gutterSize="s"
                        >
                          <EuiFlexItem>
                            <EuiTitle size="xs">
                              <h2>{namespace.name}</h2>
                            </EuiTitle>
                            {namespace.managed && (
                              <EuiText
                                size="xs"
                                color="subdued"
                                className="contextEnginePrototype__managedMeta"
                              >
                                <EuiIcon type="lock" size="s" aria-hidden={true} /> Managed
                              </EuiText>
                            )}
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiText size="xs" color="subdued">
                              {storageDisplay}
                            </EuiText>
                          </EuiFlexItem>
                        </EuiFlexGroup>

                        <EuiFlexGroup
                          className="contextEnginePrototype__namespaceSources"
                          wrap
                          responsive={false}
                          gutterSize="xs"
                        >
                          {shownSources.map((source) => (
                            <EuiFlexItem grow={false} key={source}>
                              <EuiBadge
                                color="hollow"
                                className="contextEnginePrototype__typeBadge"
                              >
                                {source}
                              </EuiBadge>
                            </EuiFlexItem>
                          ))}
                          {hiddenSourceCount > 0 && (
                            <EuiFlexItem grow={false}>
                              <EuiText size="xs" color="subdued">
                                +{hiddenSourceCount} more
                              </EuiText>
                            </EuiFlexItem>
                          )}
                        </EuiFlexGroup>

                        <EuiFlexGroup
                          alignItems="center"
                          justifyContent="spaceBetween"
                          responsive={false}
                          gutterSize="s"
                        >
                          <EuiFlexItem grow={false}>
                            <EuiText size="s">
                              {kiCount} Knowledge Indicator{kiCount === 1 ? '' : 's'}
                            </EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            {healthy ? (
                              <EuiBadge
                                color="success"
                                className="contextEnginePrototype__typeBadge"
                              >
                                Healthy
                              </EuiBadge>
                            ) : (
                              <EuiBadge
                                color="warning"
                                className="contextEnginePrototype__typeBadge contextEnginePrototype__healthLink"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openNamespace(namespace, { focusMonitoring: true });
                                }}
                                onClickAriaLabel={`View ${issueCount} monitoring issues for ${namespace.name}`}
                              >
                                {issueCount} issue{issueCount === 1 ? '' : 's'}
                              </EuiBadge>
                            )}
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </div>

                      <EuiHorizontalRule margin="s" />
                      <EuiFlexGroup
                        className="contextEnginePrototype__namespaceCardFooter"
                        responsive={false}
                        gutterSize="m"
                      >
                        <EuiFlexItem>
                          <EuiText size="xs" color="subdued">
                            Integrated via
                          </EuiText>
                          <EuiText size="s">{namespace.integration}</EuiText>
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
          )}
        </EuiPageTemplate.Section>
      </>
    );
  };

  const renderCreateAiIndex = () => {
    const esqlCount = selectedSources.filter((source) => source.category === 'esql').length;

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
              Name your AI index, then add sources, or skip and add sources later.
            </EuiText>
          </div>
        </EuiPageTemplate.Section>

        <EuiPageTemplate.Section>
          <EuiFlexGroup direction="column" gutterSize="m">
            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiTitle size="s">
                  <h2>Name</h2>
                </EuiTitle>
                <EuiSpacer size="m" />
                <EuiFormRow
                  fullWidth
                  isInvalid={Boolean(namespaceName && namespaceNameError)}
                  error={namespaceName && namespaceNameError ? [namespaceNameError] : undefined}
                  helpText="Use lowercase letters, numbers, hyphens, and underscores. A backing index is generated from this name."
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
                {namespaceName && !namespaceNameError && (
                  <>
                    <EuiSpacer size="s" />
                    <EuiText size="xs" color="subdued">
                      Uses <EuiCode>{backingIndexName}</EuiCode> to store pre-computed context.
                    </EuiText>
                  </>
                )}
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiTitle size="s">
                  <h2>Description</h2>
                </EuiTitle>
                <EuiSpacer size="m" />
                <EuiFormRow
                  fullWidth
                  helpText="Optional. Describe what this AI index is for."
                >
                  <EuiTextArea
                    fullWidth
                    rows={3}
                    placeholder="Describe what this AI index is for."
                    value={createDescription}
                    onChange={(event) => setCreateDescription(event.target.value)}
                    aria-label="AI index description"
                  />
                </EuiFormRow>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiTitle size="s">
                  <h2>Sources</h2>
                </EuiTitle>

                {selectedSources.length > 0 && (
                  <>
                    <EuiSpacer size="m" />
                    <EuiFlexGroup wrap responsive={false} gutterSize="xs">
                      {selectedSources.map((source) => (
                        <EuiFlexItem grow={false} key={source.id}>
                          <EuiBadge
                            color="hollow"
                            iconType="cross"
                            iconSide="right"
                            onClick={() => removeSelectedSource(source.id)}
                            onClickAriaLabel={`Remove ${source.name}`}
                          >
                            {source.name}
                          </EuiBadge>
                        </EuiFlexItem>
                      ))}
                    </EuiFlexGroup>
                  </>
                )}

                <EuiSpacer size="m" />
                <EuiTabs>
                  {CREATE_SOURCE_TABS.map((tab) => (
                    <EuiTab
                      key={tab.id}
                      isSelected={createSourceTab === tab.id}
                      onClick={() => setCreateSourceTab(tab.id)}
                      prepend={<EuiIcon type={tab.icon} size="s" aria-hidden={true} />}
                      append={
                        tab.id === 'esql' && esqlCount > 0 ? (
                          <EuiBadge color="primary">{esqlCount}</EuiBadge>
                        ) : undefined
                      }
                    >
                      {tab.label}
                    </EuiTab>
                  ))}
                </EuiTabs>
                <EuiSpacer size="m" />

                {createSourceTab === 'esql' ? (
                  <div className="contextEnginePrototype__esqlSource">
                    <div className="contextEnginePrototype__esqlEditor">
                      <CodeEditor
                        languageId="plaintext"
                        width="100%"
                        height={160}
                        value={esqlDraft}
                        transparentBackground
                        onChange={(value) => {
                          setEsqlDraft(value);
                          setShowEsqlSuggestions(/FROM\s+\S*$/i.test(value));
                        }}
                        accessibilityOverlayEnabled={false}
                        options={{
                          fontSize: 13,
                          lineNumbers: 'on',
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          automaticLayout: true,
                          padding: { top: 12, bottom: 12 },
                          fixedOverflowWidgets: true,
                        }}
                        aria-label="ES|QL source editor"
                      />
                      {showEsqlSuggestions && esqlSuggestions.length > 0 && (
                        <div className="contextEnginePrototype__esqlSuggestions" role="listbox">
                          {esqlSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              className="contextEnginePrototype__esqlSuggestion"
                              onClick={() => applyEsqlSuggestion(suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <EuiSpacer size="s" />
                    <div className="contextEnginePrototype__esqlActions">
                      <EuiButton
                        iconType="plusInCircle"
                        color="text"
                        onClick={addEsqlSource}
                        isDisabled={isEsqlDraftEmpty(esqlDraft)}
                      >
                        Add ES|QL source
                      </EuiButton>
                    </div>
                  </div>
                ) : (
                  <div className="contextEnginePrototype__connectorsEmpty">
                    <EuiIcon type="plugs" size="xl" color="subdued" />
                    <EuiSpacer size="s" />
                    <EuiTitle size="xs">
                      <h3>Connectors coming soon</h3>
                    </EuiTitle>
                    <EuiSpacer size="xs" />
                    <EuiText size="s" color="subdued">
                      Support for adding connectors as a source is not available yet.
                    </EuiText>
                  </div>
                )}
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiTitle size="s">
                  <h2>Storage type</h2>
                </EuiTitle>
                <EuiText size="s" color="subdued">
                  Choose how this AI index stores pre-computed context.
                </EuiText>
                {storageRecommendation.isMixed && (
                  <>
                    <EuiSpacer size="s" />
                    <EuiText size="s" color="subdued">
                      {storageRecommendation.reason}
                    </EuiText>
                  </>
                )}
                <EuiSpacer size="m" />
                <EuiPanel
                  hasBorder
                  paddingSize="m"
                  color={storageType === 'index' ? 'primary' : 'plain'}
                  className="contextEnginePrototype__radioCard"
                  onClick={() => chooseStorageType('index')}
                >
                  <EuiRadio
                    id="storage-index"
                    name="storageType"
                    checked={storageType === 'index'}
                    onChange={() => chooseStorageType('index')}
                    label={
                      <span>
                        <strong>Index</strong> <EuiBadge>idx</EuiBadge>
                      </span>
                    }
                  />
                  <EuiText size="s" color="subdued">
                    Enterprise data — docs, tickets, knowledge bases and other reference context
                    that isn&apos;t time-based.
                  </EuiText>
                </EuiPanel>
                <EuiSpacer size="s" />
                <EuiPanel
                  hasBorder
                  paddingSize="m"
                  color={storageType === 'dataStream' ? 'primary' : 'plain'}
                  className="contextEnginePrototype__radioCard"
                  onClick={() => chooseStorageType('dataStream')}
                >
                  <EuiRadio
                    id="storage-stream"
                    name="storageType"
                    checked={storageType === 'dataStream'}
                    onChange={() => chooseStorageType('dataStream')}
                    label={
                      <span>
                        <strong>Data stream</strong> <EuiBadge>ds</EuiBadge>
                      </span>
                    }
                  />
                  <EuiText size="s" color="subdued">
                    Observability & security — time-based context for agents (logs, metrics,
                    traces, alerts).
                  </EuiText>
                </EuiPanel>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiFlexGroup justifyContent="flexEnd">
                <EuiFlexItem grow={false}>
                  <EuiButton
                    fill
                    disabled={Boolean(namespaceNameError)}
                    onClick={createNamespace}
                  >
                    Create AI index
                  </EuiButton>
                </EuiFlexItem>
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

  const renderActiveAutomation = (automation: Automation) => {
    const sourceTag = automation.tags.find(
      (tag) => !['new', 'Bottom-Up', 'Index Metadata', 'UPDATE'].includes(tag)
    );
    return (
      <div key={automation.id} className="contextEnginePrototype__listRow">
        <EuiFlexGroup alignItems="flexStart" responsive={false} gutterSize="m">
          <EuiFlexItem>
            <EuiText size="s">
              <strong>{automation.title}</strong>
            </EuiText>
            <EuiText size="xs" color="subdued">
              {producesLabel(automation.type)}
              {' · '}
              {ownershipLabel(automation.ownership)}
              {sourceTag ? ` · ${sourceTag}` : ''}
              {automation.evidence ? ` · ${automation.evidence}` : ''}
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="s" color="subdued">
              {automation.description}
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="s"
              iconSide="right"
              iconType="arrowRight"
              onClick={() => openWorkflow(automation)}
            >
              Edit workflow
            </EuiButtonEmpty>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
    );
  };

  const renderNamespace = () => {
    const namespace = activeNamespace || namespaces[0];
    const kiTotal = knowledgeTotal(namespace.knowledge);
    const pendingSuggestions = namespace.suggestedAutomations.filter(
      ({ id }) => !addedAutomations.includes(id)
    );
    const knowledgeSummaryParts: Array<{
      type: KnowledgeIndicator['type'];
      label: string;
      count: number;
    }> = [
      { type: 'PLAYBOOK', label: 'playbooks', count: namespace.knowledge.playbooks },
      { type: 'POLICY', label: 'policies', count: namespace.knowledge.policies },
      { type: 'FAQ', label: 'FAQs', count: namespace.knowledge.faqs },
      { type: 'GLOSSARY', label: 'glossaries', count: namespace.knowledge.glossaries },
      { type: 'FACT', label: 'facts', count: namespace.knowledge.facts },
    ].filter(({ count }) => count > 0);

    const highIssueCount = namespace.monitoring.issues.filter(
      ({ severity }) => severity === 'high'
    ).length;
    const showIssuesBanner =
      namespace.monitoring.connected && namespace.monitoring.issues.length > 0;
    const showConnectBanner = !namespace.monitoring.connected;

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
                    <h1>{namespace.name}</h1>
                  </EuiTitle>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow" className="contextEnginePrototype__typeBadge">
                    Active
                  </EuiBadge>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="xs" />
              <EuiText size="s" color="subdued">
                {namespace.sources.join(' · ') || 'No sources yet'}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup responsive={false} gutterSize="s">
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Open this namespace in the chat UI">
                    <EuiButton iconType="comment" aria-label="Open this namespace in the chat UI">
                      Open in chat
                    </EuiButton>
                  </EuiToolTip>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Open the integration package to use this namespace in an agent">
                    <EuiButton
                      iconType="bolt"
                      onClick={() => {
                        const ns = activeNamespace || namespaces[0];
                        setAgentHarness(agentHarnessFromIntegration(ns.integration));
                        setApiKeyRevealed(false);
                        setAgentNotice(null);
                        setScreen('agent');
                      }}
                      aria-label="Open the integration package to use this namespace in an agent"
                    >
                      Use in an agent
                    </EuiButton>
                  </EuiToolTip>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>

        <EuiPageTemplate.Section>
          <div className="contextEnginePrototype__detailStack">
            {showIssuesBanner && (
              <EuiCallOut
                color="warning"
                iconType="warning"
                size="s"
                className="contextEnginePrototype__healthBanner"
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
                      {namespace.monitoring.issuesSummary ||
                        `${namespace.monitoring.issues.length} KI-addressable issues`}
                      {highIssueCount > 0
                        ? ` · ${highIssueCount} high issue${highIssueCount === 1 ? '' : 's'}`
                        : ''}
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiLink onClick={() => setFocusMonitoring(true)}>Review issues →</EuiLink>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiCallOut>
            )}
            {showConnectBanner && (
              <EuiPanel
                color="subdued"
                paddingSize="s"
                hasBorder
                className="contextEnginePrototype__healthBanner"
              >
                <EuiFlexGroup
                  alignItems="center"
                  justifyContent="spaceBetween"
                  gutterSize="m"
                  responsive={false}
                  wrap
                >
                  <EuiFlexItem>
                    <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiIcon type="visBarVerticalStacked" color="subdued" />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiText size="s">
                          No traces connected yet · connect traces to monitor this namespace
                        </EuiText>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiLink onClick={connectTraces}>Connect traces</EuiLink>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            )}

            <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
              <div className="contextEnginePrototype__sectionHeader">
                <div>
                  <EuiTitle size="xs">
                    <h2>Description</h2>
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

            <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
              <div className="contextEnginePrototype__sectionHeader">
                <div>
                  <EuiTitle size="xs">
                    <h2>Sources</h2>
                  </EuiTitle>
                  <EuiText size="s" color="subdued">
                    Data feeding this namespace. Add a source to refresh context and suggestions.
                  </EuiText>
                </div>
                <div className="contextEnginePrototype__sectionActions">
                  <EuiButtonEmpty size="s" iconType="pencil" onClick={startWizard}>
                    Edit sources
                  </EuiButtonEmpty>
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

            <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
              <div className="contextEnginePrototype__sectionHeader">
                <div>
                  <EuiTitle size="xs">
                    <h2>Automations</h2>
                  </EuiTitle>
                  <EuiText size="s" color="subdued">
                    Extract and refresh Knowledge Indicators from sources.
                  </EuiText>
                </div>
                <div className="contextEnginePrototype__sectionActions">
                  <EuiButtonEmpty size="s" iconType="plusInCircle">
                    Add automation
                  </EuiButtonEmpty>
                </div>
              </div>

              {pendingSuggestions.length > 0 && (
                <EuiPanel
                  color="subdued"
                  hasBorder
                  paddingSize="m"
                  className="contextEnginePrototype__suggestionBlock"
                >
                  <EuiText size="xs" color="subdued">
                    <strong>Suggested</strong>
                  </EuiText>
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
                              {automation.tags.includes('UPDATE') ? ' · Update available' : ''}
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
                </EuiPanel>
              )}

              <div className="contextEnginePrototype__activeAutomations">
                <EuiText size="xs" color="subdued">
                  <strong>Active</strong>
                </EuiText>
                <div className="contextEnginePrototype__list">
                  {namespace.automations.length === 0 ? (
                    <EuiText size="s" color="subdued">
                      {pendingSuggestions.length > 0
                        ? 'No active automations yet. Add a suggestion above to get started.'
                        : 'No automations yet.'}
                    </EuiText>
                  ) : (
                    namespace.automations.map((automation) => renderActiveAutomation(automation))
                  )}
                </div>
              </div>
            </EuiPanel>

            <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
              <div className="contextEnginePrototype__sectionHeader">
                <div>
                  <EuiTitle size="xs">
                    <h2>Knowledge Indicators</h2>
                  </EuiTitle>
                  <EuiText size="s" color="subdued">
                    {kiTotal} in <EuiCode>{namespace.indexName}</EuiCode>
                    {knowledgeSummaryParts.length > 0 && (
                      <>
                        {' · '}
                        {knowledgeSummaryParts.map((part, index) => (
                          <React.Fragment key={part.type}>
                            {index > 0 && ' · '}
                            <EuiLink onClick={() => openKnowledgeIndicators(part.type)}>
                              {part.count} {part.label}
                            </EuiLink>
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </EuiText>
                </div>
                <div className="contextEnginePrototype__sectionActions">
                  <EuiButtonEmpty
                    size="s"
                    iconSide="right"
                    iconType="arrowRight"
                    onClick={() => openKnowledgeIndicators()}
                  >
                    View all
                  </EuiButtonEmpty>
                </div>
              </div>
            </EuiPanel>

            <EuiPanel
              hasBorder
              paddingSize="l"
              className="contextEnginePrototype__detailSection"
              id="context-engine-monitoring"
            >
              <div className="contextEnginePrototype__sectionHeader">
                <div>
                  <EuiTitle size="xs">
                    <h2>Monitoring</h2>
                  </EuiTitle>
                  <EuiText size="s" color="subdued">
                    {namespace.monitoring.connected
                      ? namespace.monitoring.issuesSummary ||
                        `${namespace.monitoring.traceCount?.toLocaleString() || 0} traces connected`
                      : 'Connect traces to refine automations from real agent activity.'}
                  </EuiText>
                </div>
                <div className="contextEnginePrototype__sectionActions">
                  {!namespace.monitoring.connected && (
                    <EuiButton size="s" iconType="visBarVerticalStacked" onClick={connectTraces}>
                      Connect traces
                    </EuiButton>
                  )}
                </div>
              </div>

              {namespace.monitoring.connected && (
                <div className="contextEnginePrototype__list">
                  <div className="contextEnginePrototype__listRow">
                    <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
                      <EuiFlexItem>
                        <EuiText size="s">
                          <strong>Traces</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          <span className="contextEnginePrototype__mono">
                            {namespace.monitoring.traceId}
                          </span>
                          {' · '}
                          {namespace.monitoring.traceLabel ||
                            `${namespace.monitoring.traceCount?.toLocaleString() || 0} traces`}
                        </EuiText>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButtonEmpty size="s" iconSide="right" iconType="arrowRight">
                          View in Discover
                        </EuiButtonEmpty>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </div>

                  {namespace.monitoring.issues.length === 0 ? (
                    <EuiText size="s" color="subdued">
                      No KI-addressable issues detected yet.
                    </EuiText>
                  ) : (
                    namespace.monitoring.issues.map((issue) => (
                      <button
                        key={issue.id}
                        type="button"
                        className="contextEnginePrototype__listRow contextEnginePrototype__listRow--button"
                        onClick={() => {
                          setActiveIssue(issue);
                          setScreen('issue');
                        }}
                      >
                        <EuiFlexGroup alignItems="flexStart" responsive={false} gutterSize="m">
                          <EuiFlexItem grow={false}>
                            <EuiIcon
                              type="warning"
                              color={issue.severity === 'high' ? 'danger' : 'warning'}
                              aria-hidden={true}
                            />
                          </EuiFlexItem>
                          <EuiFlexItem>
                            <EuiText size="s">
                              <strong>{issue.title}</strong>
                            </EuiText>
                            <EuiText size="xs" color="subdued">
                              {badgeLabel(issue.severity)} · {issue.traces} traces ·{' '}
                              {issue.description}
                            </EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            <EuiIcon type="arrowRight" color="subdued" aria-hidden={true} />
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </button>
                    ))
                  )}
                </div>
              )}

              {(namespace.monitoring.connected || namespace.monitoring.efficiency) && (
                <EuiPanel
                  color="subdued"
                  hasBorder
                  paddingSize="m"
                  className="contextEnginePrototype__efficiencyPanel"
                >
                  <EuiText size="xs" color="subdued">
                    <strong>Efficiency</strong>
                  </EuiText>
                  <EuiSpacer size="xs" />
                  <EuiText size="xs" color="subdued">
                    Payoff vs a no-context baseline — hit rate, tokens, and retrieval latency.
                  </EuiText>
                  <EuiSpacer size="m" />
                  <EuiFlexGroup gutterSize="m" className="contextEnginePrototype__efficiencyStats">
                    <EuiFlexItem>
                      <EuiStat
                        title={
                          namespace.monitoring.efficiency
                            ? `${namespace.monitoring.efficiency.retrievalHitRate}%`
                            : '—'
                        }
                        description="Retrieval hit rate"
                        titleSize="m"
                        textAlign="left"
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiStat
                        title={
                          namespace.monitoring.efficiency
                            ? `${namespace.monitoring.efficiency.tokensSavedPct}%`
                            : '—'
                        }
                        description="Tokens saved vs baseline"
                        titleSize="m"
                        textAlign="left"
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiStat
                        title={
                          namespace.monitoring.efficiency
                            ? `${namespace.monitoring.efficiency.medianLatencyMs}ms`
                            : '—'
                        }
                        description="Median retrieval latency"
                        titleSize="m"
                        textAlign="left"
                      />
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              )}

              {!namespace.monitoring.connected && !namespace.monitoring.efficiency && (
                <EuiPanel
                  color="subdued"
                  hasBorder
                  paddingSize="m"
                  className="contextEnginePrototype__efficiencyPanel"
                >
                  <EuiText size="xs" color="subdued">
                    <strong>Efficiency</strong>
                  </EuiText>
                  <EuiSpacer size="xs" />
                  <EuiText size="s" color="subdued">
                    Connect traces to measure retrieval hit rate, tokens saved, and median latency
                    vs a no-context baseline.
                  </EuiText>
                </EuiPanel>
              )}
            </EuiPanel>
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
            Back to {namespace.name}
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
            Back to {namespace.name}
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

  const renderKnowledge = () => {
    const namespace = activeNamespace || namespaces[0];
    const allIndicators = namespace.indicators;
    const sourceOptions = Array.from(
      new Set(allIndicators.map((indicator) => indicator.category))
    ).sort();
    const query = kiSearchQuery.trim().toLowerCase();

    const indicators = allIndicators.filter((indicator) => {
      if (kiTypeFilter && indicator.type !== kiTypeFilter) return false;
      if (kiSourceFilter !== 'all' && indicator.category !== kiSourceFilter) return false;
      if (kiVersionFilter === 'current' && hasVersionHistory(indicator)) return false;
      if (kiVersionFilter === 'hasNewer' && !hasVersionHistory(indicator)) return false;
      if (!query) return true;
      const haystack = [
        indicator.title,
        indicator.description,
        indicator.category,
        indicator.type,
        ...indicator.tags,
        typeof indicator.value === 'string' ? indicator.value : (indicator.value || []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    const activeIndicator =
      indicators.find(({ id }) => id === activeIndicatorId) || indicators[0] || null;
    const viewedVersion = selectedKiVersion ?? activeIndicator?.currentVersion ?? 1;
    const kiCount = indicators.length;
    const valueBlock = activeIndicator ? valueBlockFor(activeIndicator) : null;
    const metaTags = activeIndicator ? operationalTagsFor(activeIndicator) : [];

    return (
      <>
        <EuiPageTemplate.Section grow={false} className="contextEnginePrototype__backstackHeader">
          <EuiButtonEmpty
            iconType="arrowLeft"
            onClick={() => {
              setKiTypeFilter(null);
              setKiSearchQuery('');
              setKiSourceFilter('all');
              setKiVersionFilter('all');
              setScreen('namespace');
            }}
            flush="left"
            color="primary"
            className="contextEnginePrototype__backstackLink"
          >
            Back to {namespace.name}
          </EuiButtonEmpty>
          <EuiSpacer size="s" />
          <EuiTitle size="l">
            <h1>Knowledge Indicators</h1>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiFlexGroup responsive={false} gutterSize="s" alignItems="center" wrap>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">
                {kiCount}
                {kiCount !== allIndicators.length ? ` of ${allIndicators.length}` : ''} KIs
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" className="contextEnginePrototype__mono">
                {namespace.indexName}
              </EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>

        <EuiPageTemplate.Section>
          {allIndicators.length === 0 ? (
            <EuiPanel hasBorder paddingSize="l">
              <EuiText color="subdued">
                No Knowledge Indicators yet. Add automations to extract them from your sources.
              </EuiText>
            </EuiPanel>
          ) : (
            <EuiPanel hasBorder paddingSize="none" className="contextEnginePrototype__kiBrowser">
              <EuiFlexGroup
                gutterSize="none"
                responsive={false}
                className="contextEnginePrototype__kiBrowserBody"
              >
                <EuiFlexItem grow={false} className="contextEnginePrototype__kiSidebar">
                  <div className="contextEnginePrototype__kiSidebarHeader">
                    <EuiText size="xs" color="subdued">
                      <strong>
                        {kiCount} {kiTypeFilter ? badgeLabel(kiTypeFilter).toUpperCase() : 'KIS'}
                      </strong>
                    </EuiText>
                    <EuiSpacer size="s" />
                    <EuiFieldSearch
                      placeholder="Search KIs"
                      value={kiSearchQuery}
                      onChange={(event) => setKiSearchQuery(event.target.value)}
                      isClearable
                      fullWidth
                      compressed
                      aria-label="Search Knowledge Indicators"
                    />
                    <EuiSpacer size="s" />
                    <EuiFlexGroup direction="column" gutterSize="s">
                      <EuiFlexItem>
                        <EuiSelect
                          compressed
                          fullWidth
                          aria-label="Filter by type"
                          options={[
                            { value: 'all', text: 'All types' },
                            { value: 'FACT', text: 'Fact' },
                            { value: 'PLAYBOOK', text: 'Playbook' },
                            { value: 'POLICY', text: 'Policy' },
                            { value: 'FAQ', text: 'FAQ' },
                            { value: 'GLOSSARY', text: 'Glossary' },
                          ]}
                          value={kiTypeFilter || 'all'}
                          onChange={(event) => {
                            const value = event.target.value;
                            setKiTypeFilter(
                              value === 'all' ? null : (value as KnowledgeIndicator['type'])
                            );
                          }}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiSelect
                          compressed
                          fullWidth
                          aria-label="Filter by source"
                          options={[
                            { value: 'all', text: 'All sources' },
                            ...sourceOptions.map((source) => ({ value: source, text: source })),
                          ]}
                          value={kiSourceFilter}
                          onChange={(event) => setKiSourceFilter(event.target.value)}
                        />
                      </EuiFlexItem>
                      <EuiFlexItem>
                        <EuiSelect
                          compressed
                          fullWidth
                          aria-label="Filter by version status"
                          options={[
                            { value: 'all', text: 'All version statuses' },
                            { value: 'current', text: 'Current (single version)' },
                            { value: 'hasNewer', text: 'Has newer version' },
                          ]}
                          value={kiVersionFilter}
                          onChange={(event) =>
                            setKiVersionFilter(event.target.value as KiVersionFilter)
                          }
                        />
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </div>
                  <div className="contextEnginePrototype__kiSidebarList">
                    {indicators.length === 0 ? (
                      <div className="contextEnginePrototype__kiEmptyList">
                        <EuiText size="s" color="subdued">
                          No KIs match these filters.{' '}
                          <EuiLink
                            onClick={() => {
                              setKiTypeFilter(null);
                              setKiSearchQuery('');
                              setKiSourceFilter('all');
                              setKiVersionFilter('all');
                            }}
                          >
                            Clear filters
                          </EuiLink>
                        </EuiText>
                      </div>
                    ) : (
                      indicators.map((indicator) => {
                        const selected = indicator.id === activeIndicator?.id;
                        return (
                          <button
                            key={indicator.id}
                            type="button"
                            className={`contextEnginePrototype__kiListItem${
                              selected ? ' contextEnginePrototype__kiListItem--selected' : ''
                            }`}
                            onClick={() => selectKnowledgeIndicator(indicator)}
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
                        );
                      })
                    )}
                  </div>
                </EuiFlexItem>

                <EuiFlexItem className="contextEnginePrototype__kiDetail">
                  {activeIndicator && valueBlock ? (
                    <div className="contextEnginePrototype__kiDetailStack">
                      <div className="contextEnginePrototype__kiDetailBlock">
                        <EuiTitle size="s">
                          <h2>{activeIndicator.title}</h2>
                        </EuiTitle>
                        <EuiBadge
                          color={typeBadgeColor(activeIndicator.type)}
                          className="contextEnginePrototype__kiTypeBadge"
                        >
                          {badgeLabel(activeIndicator.type)}
                        </EuiBadge>
                        {metaTags.length > 0 && (
                          <EuiFlexGroup
                            responsive={false}
                            gutterSize="xs"
                            wrap
                            className="contextEnginePrototype__kiMetaChips"
                          >
                            {metaTags.map((tag) => (
                              <EuiFlexItem grow={false} key={tag}>
                                <EuiBadge
                                  color="hollow"
                                  className="contextEnginePrototype__kiMetaChip"
                                >
                                  {badgeLabel(tag)}
                                </EuiBadge>
                              </EuiFlexItem>
                            ))}
                          </EuiFlexGroup>
                        )}
                      </div>

                      <div className="contextEnginePrototype__kiVersionRow">
                        <EuiFlexGroup
                          responsive={false}
                          gutterSize="xs"
                          alignItems="center"
                          className="contextEnginePrototype__kiVersionTabs"
                          wrap
                        >
                          {[...activeIndicator.versions]
                            .sort((a, b) => b.version - a.version)
                            .map((version) => {
                              const isSelected = version.version === viewedVersion;
                              const isCurrent = version.version === activeIndicator.currentVersion;
                              return (
                                <EuiFlexItem grow={false} key={version.version}>
                                  <EuiButtonEmpty
                                    size="xs"
                                    flush="both"
                                    color={isSelected ? 'primary' : 'text'}
                                    className={
                                      isSelected
                                        ? 'contextEnginePrototype__kiVersionTab contextEnginePrototype__kiVersionTab--active'
                                        : 'contextEnginePrototype__kiVersionTab'
                                    }
                                    onClick={() => setSelectedKiVersion(version.version)}
                                  >
                                    v{version.version}
                                    {isCurrent ? ' · current' : ''}
                                  </EuiButtonEmpty>
                                </EuiFlexItem>
                              );
                            })}
                        </EuiFlexGroup>
                        <EuiText size="xs" color="subdued" className="contextEnginePrototype__kiVersionHint">
                          Editing creates a new version. Agents always retrieve the current version.
                        </EuiText>
                      </div>

                      <EuiPanel
                        paddingSize="m"
                        color="subdued"
                        hasBorder={false}
                        className="contextEnginePrototype__kiValue"
                      >
                        <EuiText size="xs" color="subdued">
                          <strong>{valueBlock.heading.toUpperCase()}</strong>
                        </EuiText>
                        <EuiSpacer size="xs" />
                        {valueBlock.items ? (
                          <ol className="contextEnginePrototype__kiValueList">
                            {valueBlock.items.map((item) => (
                              <li key={item}>
                                <EuiText size="s">{item}</EuiText>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <EuiText size="s" style={{ whiteSpace: 'pre-wrap' }}>
                            {valueBlock.text}
                          </EuiText>
                        )}
                      </EuiPanel>

                      <EuiPanel
                        paddingSize="s"
                        color="transparent"
                        hasBorder={false}
                        className="contextEnginePrototype__kiDescription"
                      >
                        <EuiText size="xs" color="subdued">
                          <strong>DESCRIPTION</strong>
                        </EuiText>
                        <EuiSpacer size="xs" />
                        <EuiText size="s" color="subdued">
                          {activeIndicator.description}
                        </EuiText>
                      </EuiPanel>

                      <div className="contextEnginePrototype__kiProvenance">
                        <EuiText size="xs" color="subdued">
                          Extracted by: <strong>{activeIndicator.extractedBy}</strong>
                          {' · '}
                          from <strong>{activeIndicator.category}</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          Used by: <strong>{activeIndicator.usedBy}</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          {activeIndicator.confidence}% confidence
                          {' · '}
                          <EuiLink href="#ki-evidence" onClick={(e) => e.preventDefault()}>
                            Evidence: {activeIndicator.evidenceCount} docs
                          </EuiLink>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          {activeIndicator.access}
                        </EuiText>
                      </div>

                      <div>
                        <EuiButton
                          size="s"
                          iconType="pencil"
                          onClick={() => editKnowledgeIndicator(activeIndicator)}
                        >
                          Edit (creates v{activeIndicator.currentVersion + 1})
                        </EuiButton>
                      </div>

                      <div className="contextEnginePrototype__kiHistory">
                        <EuiText size="xs" color="subdued">
                          <strong>VERSION HISTORY</strong>
                        </EuiText>
                        <EuiText size="xs" color="subdued">
                          Click a version to make it current.
                        </EuiText>
                        <div className="contextEnginePrototype__kiHistoryList">
                          {[...activeIndicator.versions]
                            .sort((a, b) => b.version - a.version)
                            .map((version) => {
                              const isCurrent = version.version === activeIndicator.currentVersion;
                              return (
                                <button
                                  key={version.version}
                                  type="button"
                                  className={`contextEnginePrototype__kiHistoryItem${
                                    isCurrent
                                      ? ' contextEnginePrototype__kiHistoryItem--current'
                                      : ''
                                  }`}
                                  onClick={() =>
                                    setKnowledgeIndicatorCurrentVersion(
                                      activeIndicator,
                                      version.version
                                    )
                                  }
                                  aria-pressed={isCurrent}
                                  aria-label={`Set v${version.version} as current version`}
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
                                    <EuiBadge
                                      color="success"
                                      className="contextEnginePrototype__typeBadge"
                                    >
                                      Current
                                    </EuiBadge>
                                  ) : (
                                    <span className="contextEnginePrototype__kiHistoryAction">
                                      Set current
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EuiText size="s" color="subdued">
                      Select a Knowledge Indicator from the list.
                    </EuiText>
                  )}
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          )}
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
                    Back to {activeNamespace?.name || 'namespace'}
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
                            text: 'Actions menu — Validate, Export, and Duplicate live here.',
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
                    text: 'Test run complete. Sample KIs look good — save the workflow when ready.',
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
            Back to {namespace.name}
          </EuiButtonEmpty>
          <EuiSpacer size="s" />
          <EuiTitle size="l">
            <h1>Connect {namespace.name} to your agent</h1>
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
              />
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
              </EuiPanel>
            </EuiFlexItem>

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
                          text: `Connection OK — MCP server reached ${indexName}.`,
                        })
                      }
                    >
                      Test connection
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

  const screenContent = {
    index: renderIndex,
    create: renderCreateAiIndex,
    namespace: renderNamespace,
    workflow: renderWorkflow,
    issue: renderIssue,
    knowledge: renderKnowledge,
    agent: renderAgent,
  }[screen]();

  return (
    <KibanaRenderContextProvider {...coreStart}>
      <EuiPageTemplate
        offset={0}
        className={`contextEnginePrototype${
          screen === 'workflow' ? ' contextEnginePrototype--workflow' : ''
        }`}
      >
        {screenContent}
      </EuiPageTemplate>
    </KibanaRenderContextProvider>
  );
}

export const renderApp = (coreStart: CoreStart, element: AppMountParameters['element']) => {
  ReactDOM.render(<ContextEngineApp coreStart={coreStart} />, element);
  return () => ReactDOM.unmountComponentAtNode(element);
};
