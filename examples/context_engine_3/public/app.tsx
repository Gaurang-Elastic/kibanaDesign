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
  EuiHealth,
  EuiHorizontalRule,
  EuiIcon,
  EuiLink,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiNotificationBadge,
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
  MANAGED_ELASTIC_DISPLAY_NAME,
  MANAGED_ELASTIC_ENABLED_KI_COUNT,
  buildChatDescription,
  buildNamespaceFromWizard,
  demoEnvironmentNamespaces,
  knowledgeTotal,
  managedElasticNamespace,
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
type StorageType = NamespaceStorageType;
type StorageFilter = 'all' | StorageType;
type HealthFilter = 'all' | 'healthy' | 'issues';
type KiVersionFilter = 'all' | 'current' | 'hasNewer';
type AgentHarness = 'claudeCode' | 'claudeSdk' | 'langchain' | 'cowork' | 'mcp';
type NamespaceDetailTab = 'overview' | 'automations' | 'knowledge' | 'monitoring';

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
  { id: 'signals', label: 'Signals', icon: 'visBarVertical', createLabel: 'Create a stream' },
  {
    id: 'traces',
    label: 'oTel Traces',
    icon: 'apmTrace',
    createLabel: 'Connect a trace data stream',
  },
  {
    id: 'features',
    label: 'Elastic Features',
    icon: 'database',
    createLabel: 'Explore Elastic features',
  },
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

/** Deep link from Agent Builder Context badges: `/app/contextEngineExample3?open=Elastic`. */
const readOpenIndexDeepLink = (search: string): string | null => {
  try {
    return new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('open');
  } catch {
    return null;
  }
};

/** Deep link from Agent Builder "+ Create new AI index": `/app/contextEngineExample3?create=1`. */
const readCreateDeepLink = (search: string): boolean => {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    return params.get('create') === '1' || params.get('create') === 'true';
  } catch {
    return false;
  }
};

/**
 * Proto demo flag for user-created indexes only.
 * false: Monitoring shows traces-connected / awaiting analysis.
 * true: Monitoring shows the existing issues list and efficiency panel.
 */
const MOCK_USER_CREATED_MONITORING_ANALYSIS_READY = false;

function ContextEngineApp({
  coreStart,
  history,
}: {
  coreStart: CoreStart;
  history: AppMountParameters['history'];
}) {
  const openIndexFromUrl =
    readOpenIndexDeepLink(history.location.search) ??
    readOpenIndexDeepLink(window.location.search);
  const openCreateFromUrl =
    readCreateDeepLink(history.location.search) ||
    readCreateDeepLink(window.location.search);
  const openManagedElastic =
    openIndexFromUrl?.toLowerCase() === 'elastic' ||
    openIndexFromUrl === managedElasticNamespace.name;

  const [screen, setScreen] = useState<Screen>(() => {
    if (openCreateFromUrl) return 'create';
    if (openManagedElastic) return 'namespace';
    return 'index';
  });
  const [activeCategory, setActiveCategory] = useState<SourceCategory>('esql');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [namespaceName, setNamespaceName] = useState('');
  const [storageType, setStorageType] = useState<StorageType>('index');
  /** Fresh-user catalog: managed Elastic only until the first create. */
  const [hasCreatedIndex, setHasCreatedIndex] = useState(() => openManagedElastic);
  const [elasticEnabled, setElasticEnabled] = useState(() => openManagedElastic);
  const [justCreatedName, setJustCreatedName] = useState<string | null>(null);
  const [namespaces, setNamespaces] = useState<Namespace[]>(() => [
    { ...managedElasticNamespace },
  ]);
  const [activeNamespace, setActiveNamespace] = useState<Namespace | null>(() =>
    openManagedElastic ? { ...managedElasticNamespace } : null
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
  const [namespaceDetailTab, setNamespaceDetailTab] =
    useState<NamespaceDetailTab>('overview');
  const [showSuggestedAutomations, setShowSuggestedAutomations] = useState(false);
  const [kiTypeFilter, setKiTypeFilter] = useState<KnowledgeIndicator['type'] | null>(null);
  const [kiSearchQuery, setKiSearchQuery] = useState('');
  const [kiSourceFilter, setKiSourceFilter] = useState('all');
  const [kiVersionFilter, setKiVersionFilter] = useState<KiVersionFilter>('all');

  // Local tab state only — writing ?tab= into the URL makes Kibana's app router
  // treat it as a navigation and show "Unable to load page".
  const selectNamespaceDetailTab = (tab: NamespaceDetailTab) => {
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
    selectNamespaceDetailTab('monitoring');
    setFocusMonitoring(false);
  }, [screen, focusMonitoring, activeNamespace?.name]);

  const selectedSources = useMemo(
    () => availableSources.filter(({ id }) => selectedSourceIds.includes(id)),
    [selectedSourceIds]
  );
  const visibleSources = availableSources.filter(({ category }) => category === activeCategory);
  const namespaceSlug = slugify(namespaceName) || 'namespace';
  const storagePrefix = storageType === 'dataStream' ? 'ds' : 'idx';
  const namespaceNameError = validateNamespaceName(namespaceName);
  const catalogDisplayName = (namespace: Namespace) =>
    namespace.managed ? MANAGED_ELASTIC_DISPLAY_NAME : namespace.name;

  const filteredNamespaces = useMemo(() => {
    const query = namespaceQuery.trim().toLowerCase();
    return namespaces.filter((namespace) => {
      if (storageFilter !== 'all' && namespace.storageType !== storageFilter) return false;
      // Managed Elastic stays filterable as "healthy" only after Enable.
      if (namespace.managed && !elasticEnabled) {
        if (healthFilter === 'healthy') return false;
        if (healthFilter === 'issues') return false;
      } else {
        if (healthFilter === 'healthy' && !namespaceIsHealthy(namespace)) return false;
        if (healthFilter === 'issues' && namespaceIsHealthy(namespace)) return false;
      }
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
  }, [namespaces, namespaceQuery, storageFilter, healthFilter, elasticEnabled]);

  const goToIndex = () => {
    setScreen('index');
    setActiveNamespace(null);
    setActiveIssue(null);
    setActiveIndicatorId(null);
    setSelectedKiVersion(null);
    setAddedAutomations([]);
    setShowSuggestedAutomations(false);
    selectNamespaceDetailTab('overview');
  };

  const startWizard = () => {
    setSelectedSourceIds([]);
    setNamespaceName('');
    setStorageType('index');
    setActiveCategory('esql');
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
    setActiveCategory('esql');
    setScreen('create');
  };

  const updateActiveNamespaceStorageType = (next: StorageType) => {
    if (!activeNamespace) return;
    const nextPrefix = next === 'dataStream' ? '.context-ds' : '.context-idx';
    const slug = activeNamespace.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const nextIndexName = `${nextPrefix}-${slug}`;
    const updated: Namespace = {
      ...activeNamespace,
      storageType: next,
      indexName: nextIndexName,
    };
    setNamespaces((current) =>
      current.map((item) => (item.name === activeNamespace.name ? updated : item))
    );
    setActiveNamespace(updated);
  };

  const toggleSource = (id: string) => {
    setSelectedSourceIds((current) =>
      current.includes(id) ? current.filter((sourceId) => sourceId !== id) : [...current, id]
    );
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
    const existing = namespaces.find((namespace) => namespace.name === normalizedName);
    const built = existing
      ? {
          ...existing,
          sources: selectedSources.map(({ name }) => name),
          sourceDetails,
          storageType,
        }
      : buildNamespaceFromWizard(
          normalizedName,
          selectedSources.map(({ name }) => name),
          sourceDetails,
          // New AI indexes default to Index; storage can be changed on details.
          'index'
        );
    // Fresh create: show 0 KI / extracting on the catalog card.
    const namespace: Namespace = existing
      ? built
      : {
          ...built,
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
    setJustCreatedName(normalizedName);
    setActiveNamespace(null);
    setAddedAutomations([]);
    setActiveIssue(null);
    setShowSuggestedAutomations(false);
    selectNamespaceDetailTab('overview');
    setScreen('index');
  };

  const enableManagedElastic = () => {
    setElasticEnabled(true);
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
    setShowSuggestedAutomations(false);
    if (options?.focusMonitoring) {
      selectNamespaceDetailTab('monitoring');
      setFocusMonitoring(false);
    } else {
      selectNamespaceDetailTab('overview');
      setFocusMonitoring(false);
    }
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

  const sourceRow = (source: Source, showType = false) => {
    const selected = selectedSourceIds.includes(source.id);
    return (
      <EuiPanel
        key={source.id}
        hasBorder
        paddingSize="m"
        color={selected ? 'primary' : 'plain'}
        className={showType ? undefined : 'contextEnginePrototype__sourceRow'}
        onClick={() => toggleSource(source.id)}
      >
        <EuiFlexGroup alignItems="center" responsive={false} gutterSize="m">
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
              <span className="contextEnginePrototype__mono">{source.description}</span>
            </EuiText>
          </EuiFlexItem>
          {showType && (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" className="contextEnginePrototype__typeBadge">
                {source.typeLabel}
              </EuiBadge>
            </EuiFlexItem>
          )}
          <EuiFlexItem grow={false}>
            <EuiIcon type={selected ? 'check' : 'plus'} color="primary" aria-hidden={true} />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    );
  };

  const renderIndex = () => {
    const maxVisibleSources = 3;
    const storageFilterOptions = [
      { value: 'all', text: 'All' },
      { value: 'index', text: 'Index' },
      { value: 'dataStream', text: 'Data stream' },
    ];
    const healthFilterOptions = [
      { value: 'all', text: 'All' },
      { value: 'healthy', text: 'Healthy' },
      { value: 'issues', text: 'Has issues' },
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
            <>
              <EuiSpacer size="l" />
              <EuiText size="m" className="contextEnginePrototype__getStartedTitle">
                Get started
              </EuiText>
              <EuiSpacer size="s" />
              <EuiText size="s" color="subdued">
                Once you enable or create an index, this page becomes your catalog, with search
                and filters.{' '}
                <EuiLink href="#" onClick={(event) => event.preventDefault()}>
                  Learn what an AI index is
                </EuiLink>
              </EuiText>
              <EuiSpacer size="l" />
              <EuiFlexGroup
                className="contextEnginePrototype__getStartedGrid"
                gutterSize="xl"
                alignItems="stretch"
              >
                <EuiFlexItem>
                  <EuiPanel
                    hasBorder
                    paddingSize="l"
                    className="contextEnginePrototype__getStartedCard"
                    aria-label={MANAGED_ELASTIC_DISPLAY_NAME}
                  >
                    <div className="contextEnginePrototype__getStartedCardBody">
                      <span
                        className="contextEnginePrototype__getStartedIcon"
                        aria-hidden={true}
                      >
                        <EuiIcon type="logoElastic" size="m" />
                      </span>
                      <EuiFlexGroup
                        alignItems="center"
                        gutterSize="s"
                        responsive={false}
                        wrap
                      >
                        <EuiFlexItem grow={false}>
                          <EuiTitle size="xs">
                            <h2>{MANAGED_ELASTIC_DISPLAY_NAME}</h2>
                          </EuiTitle>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiText
                            size="xs"
                            color="subdued"
                            className="contextEnginePrototype__managedMeta"
                          >
                            <EuiIcon type="lock" size="s" aria-hidden={true} /> Managed
                          </EuiText>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                      <EuiText size="s" color="subdued">
                        Built-in and managed by Elastic. Covers Dashboards, Visualisations,
                        Alerts, and SLOs. Enable it to give your agents context with zero setup.
                      </EuiText>
                      <EuiFlexGroup
                        className="contextEnginePrototype__namespaceSources"
                        wrap
                        responsive={false}
                        gutterSize="s"
                      >
                        {['Dashboards', 'Visualisations', 'Alerts', 'SLOs'].map((source) => (
                          <EuiFlexItem grow={false} key={source}>
                            <EuiBadge
                              color="hollow"
                              className="contextEnginePrototype__typeBadge"
                            >
                              {source}
                            </EuiBadge>
                          </EuiFlexItem>
                        ))}
                      </EuiFlexGroup>
                    </div>
                    <div className="contextEnginePrototype__getStartedCardActions">
                      {elasticEnabled ? (
                        <EuiButton
                          onClick={() => {
                            const managed =
                              namespaces.find((item) => item.managed) ??
                              managedElasticNamespace;
                            openNamespace(managed);
                          }}
                        >
                          Open
                        </EuiButton>
                      ) : (
                        <EuiButton fill onClick={enableManagedElastic}>
                          Enable
                        </EuiButton>
                      )}
                    </div>
                  </EuiPanel>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiPanel
                    hasBorder
                    paddingSize="l"
                    className="contextEnginePrototype__getStartedCard"
                    aria-label="Create your own AI index"
                  >
                    <div className="contextEnginePrototype__getStartedCardBody">
                      <span
                        className="contextEnginePrototype__getStartedIcon contextEnginePrototype__getStartedIcon--muted"
                        aria-hidden={true}
                      >
                        <EuiIcon type="plus" />
                      </span>
                      <EuiTitle size="xs">
                        <h2>Create your own AI index</h2>
                      </EuiTitle>
                      <EuiText size="s" color="subdued">
                        Build an index from your ES|QL views and connectors. We generate the
                        description and pick the storage for you.
                      </EuiText>
                    </div>
                    <div className="contextEnginePrototype__getStartedCardActions">
                      <EuiButton onClick={startWizard}>Create AI index</EuiButton>
                    </div>
                  </EuiPanel>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
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
                  <EuiFormRow label="Storage type" display="rowCompressed">
                    <EuiSelect
                      compressed
                      options={storageFilterOptions}
                      value={storageFilter}
                      onChange={(event) => setStorageFilter(event.target.value as StorageFilter)}
                      aria-label="Filter by storage type"
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
                const issueCount = namespaceIssueCount(namespace);
                const healthy = namespaceIsHealthy(namespace);
                const isManagedPending = Boolean(namespace.managed && !elasticEnabled);
                const isJustCreated = justCreatedName === namespace.name;
                const kiCount = namespace.managed
                  ? elasticEnabled
                    ? MANAGED_ELASTIC_ENABLED_KI_COUNT
                    : 0
                  : knowledgeTotal(namespace.knowledge);
                const shownSources = namespace.sources.slice(0, maxVisibleSources);
                const hiddenSourceCount = Math.max(0, namespace.sources.length - maxVisibleSources);
                const storageDisplay =
                  namespace.storageType === 'dataStream' ? 'Data stream' : 'Index';
                const metaLabel = namespace.managed ? 'Ownership' : 'Updated';
                const metaValue = namespace.managed ? 'Elastic' : namespace.updated;
                const cardClassName = namespace.managed
                  ? 'contextEnginePrototype__namespaceCard contextEnginePrototype__namespaceCard--managed'
                  : 'contextEnginePrototype__namespaceCard';
                const canOpen = !isManagedPending;
                const openCard = () => {
                  if (!canOpen) return;
                  openNamespace(namespace);
                };

                if (isManagedPending) {
                  return (
                    <EuiFlexItem key={namespace.name}>
                      <EuiPanel
                        hasBorder
                        paddingSize="l"
                        className="contextEnginePrototype__getStartedCard"
                        aria-label={displayName}
                      >
                        <div className="contextEnginePrototype__getStartedCardBody">
                          <EuiFlexGroup
                            alignItems="center"
                            gutterSize="s"
                            responsive={false}
                            wrap
                          >
                            <EuiFlexItem grow={false}>
                              <EuiTitle size="xs">
                                <h2>{displayName}</h2>
                              </EuiTitle>
                            </EuiFlexItem>
                            <EuiFlexItem grow={false}>
                              <EuiText
                                size="xs"
                                color="subdued"
                                className="contextEnginePrototype__managedMeta"
                              >
                                <EuiIcon type="lock" size="s" aria-hidden={true} /> Managed
                              </EuiText>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                          <EuiText size="s" color="subdued">
                            Built-in and managed by Elastic. Covers Dashboards, Visualisations,
                            Alerts, and SLOs. Enable it to give your agents context with zero
                            setup.
                          </EuiText>
                          <EuiFlexGroup
                            className="contextEnginePrototype__namespaceSources"
                            wrap
                            responsive={false}
                            gutterSize="xs"
                          >
                            {namespace.sources.map((source) => (
                              <EuiFlexItem grow={false} key={source}>
                                <EuiBadge
                                  color="hollow"
                                  className="contextEnginePrototype__typeBadge"
                                >
                                  {source}
                                </EuiBadge>
                              </EuiFlexItem>
                            ))}
                          </EuiFlexGroup>
                        </div>
                        <div className="contextEnginePrototype__getStartedCardActions">
                          <EuiButton fill size="s" onClick={enableManagedElastic}>
                            Enable
                          </EuiButton>
                        </div>
                      </EuiPanel>
                    </EuiFlexItem>
                  );
                }

                return (
                  <EuiFlexItem key={namespace.name}>
                    <EuiPanel
                      hasBorder
                      paddingSize="m"
                      className={cardClassName}
                      onClick={openCard}
                      onKeyDown={(event: React.KeyboardEvent) => {
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
                          justifyContent="spaceBetween"
                          responsive={false}
                          gutterSize="s"
                        >
                          <EuiFlexItem>
                            <EuiTitle size="xs">
                              <h2>{displayName}</h2>
                            </EuiTitle>
                          </EuiFlexItem>
                          {namespace.managed && (
                            <EuiFlexItem grow={false}>
                              <EuiText
                                size="xs"
                                color="subdued"
                                className="contextEnginePrototype__managedMeta"
                              >
                                <EuiIcon type="lock" size="s" aria-hidden={true} /> Managed
                              </EuiText>
                            </EuiFlexItem>
                          )}
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
                                +{hiddenSourceCount}
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
                            <EuiText size="xs" color="subdued">
                              {isJustCreated && kiCount === 0
                                ? `${storageDisplay} · Extracting`
                                : `${storageDisplay} · ${kiCount} KI`}
                            </EuiText>
                          </EuiFlexItem>
                          <EuiFlexItem grow={false}>
                            {isJustCreated ? (
                              <EuiBadge
                                color="hollow"
                                className="contextEnginePrototype__typeBadge"
                              >
                                New
                              </EuiBadge>
                            ) : healthy ? (
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
                                onClickAriaLabel={`View ${issueCount} monitoring issues for ${displayName}`}
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

    return (
      <>
        <EuiPageTemplate.Section grow={false}>
          <div className="contextEnginePrototype__wizardHeader">
            <EuiButtonEmpty iconType="arrowLeft" onClick={goToIndex} flush="left" color="text">
              Cancel
            </EuiButtonEmpty>
            <EuiSpacer size="s" />
            <EuiTitle size="l">
              <h1>Create new AI index</h1>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText color="subdued">
              Name your AI index, pick sources, and choose storage — or add sources later.
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
                  helpText="Lowercase letters, numbers, and hyphens only — matching Elasticsearch index naming rules."
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
                <EuiSpacer size="s" />
                <EuiText size="xs" color="subdued">
                  uses{' '}
                  <EuiCode>
                    .context-{storagePrefix}-{namespaceSlug}
                  </EuiCode>{' '}
                  to store pre-computed context.
                </EuiText>
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiPanel hasBorder paddingSize="l">
                <EuiFlexGroup alignItems="center" responsive={false} gutterSize="s">
                  <EuiFlexItem grow={false}>
                    <EuiTitle size="s">
                      <h2>Sources</h2>
                    </EuiTitle>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="primary">{selectedSources.length}</EuiBadge>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="s" />
                <EuiText size="s" color="subdued">
                  Pick what this AI index should build context from. You can add more than one.
                </EuiText>

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
                        prepend={<EuiIcon type={category.icon} size="s" aria-hidden={true} />}
                        append={count > 0 ? <EuiBadge color="primary">{count}</EuiBadge> : undefined}
                      >
                        {category.label}
                      </EuiTab>
                    );
                  })}
                </EuiTabs>
                <EuiSpacer size="m" />

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
                      <EuiButtonEmpty iconType="plus" flush="left">
                        {activeTab.createLabel}
                      </EuiButtonEmpty>
                    </EuiPanel>
                  </EuiFlexItem>
                </EuiFlexGroup>

                <EuiSpacer size="l" />
                <EuiTitle size="xs">
                  <h3>Selected sources</h3>
                </EuiTitle>
                <EuiSpacer size="s" />
                {selectedSources.length > 0 ? (
                  <EuiFlexGroup direction="column" gutterSize="s">
                    {selectedSources.map((source) => (
                      <EuiFlexItem key={`selected-${source.id}`}>
                        {sourceRow(source, true)}
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGroup>
                ) : (
                  <EuiText size="s" color="subdued">
                    No sources selected. You can add them later.
                  </EuiText>
                )}
              </EuiPanel>
            </EuiFlexItem>

            <EuiFlexItem>
              <EuiFlexGroup justifyContent="flexEnd">
                <EuiFlexItem grow={false}>
                  <EuiButton
                    fill
                    iconSide="right"
                    iconType="arrowRight"
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
    const activeAutomationCount = namespace.automations.length;
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
    const hasFailingTracesOrIssues = namespace.monitoring.issues.length > 0;
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
    const healthySummaryParts = [
      `${kiTotal} Knowledge Indicators`,
      `${namespace.sources.length} source${namespace.sources.length === 1 ? '' : 's'}`,
      namespace.monitoring.connected
        ? namespace.monitoring.issuesSummary ||
          `${namespace.monitoring.traceCount?.toLocaleString() || 0} traces connected`
        : 'agent connected, no traces yet',
    ];

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
            <EuiButtonEmpty size="s" iconType="pencil" onClick={editSourcesFromNamespace}>
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
    );

    const storageTypePanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2>Storage type</h2>
            </EuiTitle>
            <EuiText size="s" color="subdued">
              How this AI index stores pre-computed context. New indexes default to Index; you can
              switch to a data stream here.
            </EuiText>
          </div>
        </div>
        <EuiPanel
          hasBorder
          paddingSize="m"
          color={namespace.storageType === 'index' ? 'primary' : 'plain'}
          className="contextEnginePrototype__radioCard"
          onClick={() => updateActiveNamespaceStorageType('index')}
        >
          <EuiRadio
            id={`detail-storage-index-${namespace.name}`}
            name={`detailStorageType-${namespace.name}`}
            checked={namespace.storageType === 'index'}
            onChange={() => updateActiveNamespaceStorageType('index')}
            label={
              <span>
                <strong>Index</strong> <EuiBadge>idx</EuiBadge>
              </span>
            }
          />
          <EuiText size="s" color="subdued">
            Enterprise data - docs, tickets, knowledge bases and other reference context that
            isn&apos;t time-based.
          </EuiText>
        </EuiPanel>
        <EuiPanel
          hasBorder
          paddingSize="m"
          color={namespace.storageType === 'dataStream' ? 'primary' : 'plain'}
          className="contextEnginePrototype__radioCard"
          onClick={() => updateActiveNamespaceStorageType('dataStream')}
        >
          <EuiRadio
            id={`detail-storage-stream-${namespace.name}`}
            name={`detailStorageType-${namespace.name}`}
            checked={namespace.storageType === 'dataStream'}
            onChange={() => updateActiveNamespaceStorageType('dataStream')}
            label={
              <span>
                <strong>Data stream</strong> <EuiBadge>ds</EuiBadge>
              </span>
            }
          />
          <EuiText size="s" color="subdued">
            Observability and security - time-based context for agents (logs, metrics, traces,
            alerts).
          </EuiText>
        </EuiPanel>
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
          <div className="contextEnginePrototype__sectionActions">
            <EuiButtonEmpty size="s" iconType="plusInCircle">
              Add automation
            </EuiButtonEmpty>
          </div>
        </div>

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
                        } ready to add${suggestedFromLabel ? ` from ${suggestedFromLabel}` : ''}`}
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
              )}
            </EuiPanel>
            <EuiSpacer size="m" />
          </>
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
    );

    const knowledgePanel = (
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__detailSection">
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">
                <EuiIcon type="aggregate" size="m" aria-hidden={true} />
                Knowledge Indicators
              </h2>
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
    );

    const showMonitoringAnalysis =
      !namespace.userCreated ||
      MOCK_USER_CREATED_MONITORING_ANALYSIS_READY ||
      namespace.monitoring.analysisReady === true;
    const showConnectedAwaitingAnalysis =
      Boolean(namespace.userCreated) &&
      namespace.monitoring.connected &&
      !showMonitoringAnalysis;

    const monitoringPanel = (
      <EuiPanel
        hasBorder
        paddingSize="l"
        className="contextEnginePrototype__detailSection"
        id="context-engine-3-monitoring"
      >
        <div className="contextEnginePrototype__sectionHeader">
          <div>
            <EuiTitle size="xs">
              <h2 className="contextEnginePrototype__sectionTitle">
                <EuiIcon type="stats" size="m" aria-hidden={true} />
                Monitoring
              </h2>
            </EuiTitle>
            <EuiText size="s" color="subdued">
              {showConnectedAwaitingAnalysis
                ? 'Traces are flowing in. Analysis will appear once enough agent activity is observed.'
                : namespace.monitoring.connected
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

        {showConnectedAwaitingAnalysis && (
          <>
            <EuiFlexGroup
              alignItems="center"
              gutterSize="m"
              responsive={false}
              wrap
              data-test-subj="contextEngineMonitoringConnectionState"
            >
              <EuiFlexItem grow={false}>
                <EuiHealth color="success">Traces connected</EuiHealth>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiCode>{namespace.monitoring.traceId}</EuiCode>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  {(namespace.monitoring.traceCount ?? 0).toLocaleString()} traces
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              Issue detection and efficiency metrics will populate here automatically.
            </EuiText>
          </>
        )}

        {namespace.monitoring.connected && showMonitoringAnalysis && (
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
                        {badgeLabel(issue.severity)} · {issue.traces} traces · {issue.description}
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

        {showMonitoringAnalysis &&
          (namespace.monitoring.connected || namespace.monitoring.efficiency) && (
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
              Payoff vs a no-context baseline: hit rate, tokens, and retrieval latency.
            </EuiText>
            <EuiSpacer size="m" />
            <EuiFlexGroup gutterSize="m" className="contextEnginePrototype__efficiencyStats">
              <EuiFlexItem>
                <EuiStat
                  title={
                    namespace.monitoring.efficiency
                      ? `${namespace.monitoring.efficiency.retrievalHitRate}%`
                      : 'n/a'
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
                      : 'n/a'
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
                      : 'n/a'
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
              Connect traces to measure retrieval hit rate, tokens saved, and median latency vs a
              no-context baseline.
            </EuiText>
          </EuiPanel>
        )}
      </EuiPanel>
    );

    const tabLabelWithCount = (label: string, count: number) => (
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>{label}</EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiNotificationBadge>{count}</EuiNotificationBadge>
        </EuiFlexItem>
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
      { id: 'monitoring', name: 'Monitoring' },
    ];

    const selectedDetailContent = (() => {
      switch (namespaceDetailTab) {
        case 'automations':
          return automationsPanel;
        case 'knowledge':
          return knowledgePanel;
        case 'monitoring':
          return monitoringPanel;
        case 'overview':
        default:
          return (
            <>
              {descriptionPanel}
              {sourcesPanel}
              {storageTypePanel}
            </>
          );
      }
    })();

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
            {hasFailingTracesOrIssues ? (
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
                    <EuiLink onClick={() => selectNamespaceDetailTab('monitoring')}>
                      Review issues →
                    </EuiLink>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiCallOut>
            ) : (
              <EuiPanel
                color="success"
                paddingSize="s"
                hasBorder
                className="contextEnginePrototype__healthBanner"
              >
                <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
                  <EuiFlexItem grow={false}>
                    <EuiIcon type="dot" color="success" aria-hidden={true} />
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="s">
                      <strong>Healthy</strong>
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiText size="s" color="subdued">
                      {healthySummaryParts.join(' · ')}
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            )}

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
    create: renderCreate,
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
        // grow fills viewport height and overflows #app-main-scroll; only the
        // workflow editor needs a full-height shell.
        grow={screen === 'workflow'}
        className={`contextEnginePrototype${
          screen === 'workflow' ? ' contextEnginePrototype--workflow' : ''
        }`}
      >
        {screenContent}
      </EuiPageTemplate>
    </KibanaRenderContextProvider>
  );
}

export const renderApp = (
  coreStart: CoreStart,
  { element, history }: Pick<AppMountParameters, 'element' | 'history'>
) => {
  ReactDOM.render(<ContextEngineApp coreStart={coreStart} history={history} />, element);
  return () => ReactDOM.unmountComponentAtNode(element);
};
