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
import heroLight from './assets/context-ai-index-light.svg';
import heroDark from './assets/context-ai-index-dark.svg';
import funnelLight from './assets/context-next-automation-light.svg';
import funnelDark from './assets/context-next-automation-dark.svg';
import {
  EuiAccordion,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiCallOut,
  EuiConfirmModal,
  EuiContextMenu,
  EuiContextMenuItem,
  EuiContextMenuPanel,
  EuiCode,
  EuiCodeBlock,
  EuiFieldSearch,
  EuiFieldText,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiHorizontalRule,
  EuiIcon,
  EuiLink,
  EuiLoadingSpinner,
  EuiNotificationBadge,
  EuiPageTemplate,
  EuiPanel,
  EuiPopover,
  EuiSelect,
  EuiSpacer,
  EuiSwitch,
  EuiText,
  EuiTextArea,
  EuiTitle,
  useEuiTheme,
  useIsDarkMode,
} from '@elastic/eui';
import type { AppMountParameters, CoreStart } from '@kbn/core/public';
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
import type { AppPluginStartDependencies } from './ai_agent';
import {
  CONTEXT_ENGINE_ENABLED,
  FEEDBACK_LOOP_ENABLED,
  MEMORY_ENABLED,
  NEXT_STEP_BANNER,
  OVERVIEW_STATS_ENABLED,
  TRY_QUESTION_ENABLED,
  demoFlags$,
  setDemoCatalogState,
  setDemoProto11Setup,
  type CatalogDemoState,
} from './demo_flags';
import {
  PROTO11_TICK_MS,
  advanceProto11,
  createProto11Namespace,
  createSampleNamespace,
  indicatorSourceGroup,
  proto11AddedLine,
  proto11StatusPill,
  sampleNameFor,
  sampleScenarioOf,
  sourceHasOutstandingRejections,
  startFullRun,
  startRerun,
  type CreateFromGoalOptions,
} from './proto11_data';
import { Proto11ConnectedAgentsPanel } from './proto11_agents_panel';
import { Proto11Landing } from './proto11_landing';
import {
  Proto11FixFlyout,
  Proto11RejectedNotice,
  Proto11RunCallout,
  Proto11SampleCallout,
} from './proto11_overview';
import { Proto11TestQuestion } from './proto11_test_question';
import type { ConnectedAgent, Proto11Meta, Proto11SampleScenario } from './proto11_types';
import { ImprovementsTab } from './improvements_tab';
import { initialOpenImprovementCount } from './improvements_data';
import type { OverviewImprovement } from './improvements_data';
import {
  indicatorSourceLabel,
  slugify,
  statsFromIndicators,
  typeBadgeColor,
  typeLabel,
  type HydratedKnowledgeIndicator,
  type KnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import { KnowledgeTab } from './knowledge_tab';
import {
  automationAddedLine,
  automationMetaLine,
  backingIndexName,
  gmailSyncYaml,
  indexCountLabel,
  indexState,
  initialNamespaces,
  persistUserNamespaces,
  workflowYamlFor,
  type Automation,
  type AutomationStep,
  type IndexTrace,
  type Namespace,
  type NamespaceSource,
} from './namespace_data';
import {
  SourcesPicker,
  allDraftSources,
  draftFromSources,
  emptySourcesDraft,
  sourcesSignature,
  type SourcesDraft,
} from './sources_picker';
import { AgentTracesPanel } from './traces_panel';
import { TABLE_SPARKLES_TYPE } from './register_table_sparkles';

type Screen = 'index' | 'create' | 'detail';
type DetailTab = 'overview' | 'knowledge' | 'improvements';
type EditablePanel = 'description' | 'traces' | 'sources' | 'agents';

const EDITABLE_PANEL_LABEL: Record<EditablePanel, string> = {
  description: 'Description',
  traces: 'Agent traces',
  sources: 'Sources',
  agents: 'Connected agents',
};

const tracesSignature = (traces: IndexTrace[]) =>
  traces.map((trace) => `${trace.type}\0${trace.value}`).join('\n');
type AgentPhase =
  | 'compose'
  | 'streaming'
  | 'confirm'
  | 'added'
  | 'running'
  | 'result'
  | 'empty';

interface AgentSession {
  mode: 'suggest' | 'create';
  composer: string;
  sentMessage: string;
  phase: AgentPhase;
  toolLines: string[];
  draft: Automation | null;
  created: KnowledgeIndicator[];
}

const CONTEXT_APP_HREF = '/app/contextEngineExample11';
const SUGGEST_COMPOSER = 'Suggest an automation for this AI index.';
const DOCS_HREF = 'https://www.elastic.co/docs';
const CREATE_DESCRIPTION =
  "Name your AI index. You'll add sources and automations next.";
const NAME_HELPER =
  'Use lowercase letters, numbers, hyphens, and underscores. A backing index is generated from this name.';
const DESCRIPTION_PLACEHOLDER =
  'Describe what this AI index is for and the information its Knowledge Indicators contain. Include example questions they should help answer and any known gaps in that information.';
const DESCRIPTION_HELPER =
  'Important: This description shapes generated automation workflows and helps agents decide when the index is relevant.';
const TRY_CAVEAT =
  'Answers come only from this AI index, never a general-knowledge fallback.';
const AUTOMATIONS_LOCKED_MESSAGE = 'Add a source above to unlock automations.';
const DESCRIPTION_EMPTY =
  'Optional. Shapes suggested automations and helps agents decide when this index is relevant.';
const TRACES_EMPTY = 'Optional. Tunes Knowledge Indicators to the questions agents actually ask.';
const SOURCES_EMPTY = 'Data feeding this AI index. Adding one unlocks automations.';
const SOURCES_SUBTITLE = 'Data feeding this AI index.';
const AUTOMATIONS_EMPTY =
  'Automations keep Knowledge Indicators current as your sources change.';
const READY_CALLOUT_TITLE = 'Your AI index is ready. Add a source to start building context.';
const READY_CALLOUT_MEMORY = 'Agents can store and recall memories in this index.';

const headerBack = (href: string, label: string, onGo: () => void): AppHeaderBack => ({
  href,
  label,
  onClick: (event) => {
    event.preventDefault();
    onGo();
  },
});

const headerMeta = (label: string): AppHeaderMetadataItems => [{ type: 'text', label }];

const PageHeader = ({
  sectionClassName,
  ...props
}: React.ComponentProps<typeof AppHeader> & { sectionClassName?: string }) => (
  <EuiPageTemplate.Section
    grow={false}
    restrictWidth={false}
    paddingSize="none"
    className={`contextEnginePrototype__headerSection${
      sectionClassName ? ` ${sectionClassName}` : ''
    }`}
  >
    <AppHeader {...props} spacing="bleed" />
  </EuiPageTemplate.Section>
);

const PageBody = ({
  children,
  grow = false,
  className,
}: {
  children: React.ReactNode;
  grow?: boolean;
  className?: string;
}) => (
  <EuiPageTemplate.Section
    grow={grow}
    restrictWidth={1200}
    paddingSize="none"
    className={`contextEnginePrototype__bodySection${className ? ` ${className}` : ''}`}
  >
    {children}
  </EuiPageTemplate.Section>
);

const relativeNow = () => 'just now';

const automationTitleFor = (namespace: Namespace) => {
  const source = namespace.sources[0]?.name;
  return source
    ? `Extract Knowledge Indicators from ${source}`
    : `Extract Knowledge Indicators for ${namespace.displayName}`;
};

const draftAutomation = (namespace: Namespace): Automation => {
  const sourceNames = namespace.sources.map((source) => source.name);
  const gmail = namespace.sources.find((source) => source.id === 'gmail' || source.name === 'Gmail');
  if (gmail) {
    const connectorId = `g${namespace.name.replace(/[^a-z0-9]/g, '')}`;
    const title = `Scheduled Gmail sync to AI index (${namespace.displayName})`;
    return {
      id: `${namespace.name}-auto-${Date.now()}`,
      title,
      enabled: true,
      hasRun: false,
      triggerCount: 1,
      stepCount: 4,
      scheduleLabel: 'Runs every hour',
      addedBy: 'you',
      lastRunAt: null,
      description: `Syncs Gmail messages into ${namespace.displayName} as Knowledge Indicators.`,
      reads: sourceNames,
      producesCount: 0,
      steps: [
        {
          name: 'list_messages',
          explanation: `Retrieves all message IDs from the ${connectorId} Gmail connector.`,
        },
        {
          name: 'sync_messages',
          explanation: '(foreach loop) For each message:',
          children: [
            {
              name: 'get_message',
              explanation: 'Fetches full message details: subject, body, sender, date.',
            },
            {
              name: 'upsert_ki',
              explanation: `Writes or updates the message into the ${namespace.displayName} AI index as a Knowledge Indicator, keyed on the Gmail message ID so repeated runs update rather than duplicate.`,
            },
          ],
        },
      ],
      properties: [
        'Run this automation from the Workflows page.',
        'Idempotent. Safe to re-run; existing Knowledge Indicators are updated, not duplicated.',
        'A single message failure is skipped without aborting the whole sync.',
      ],
      yaml: gmailSyncYaml(title, namespace.indexName, connectorId),
    };
  }

  const title = automationTitleFor(namespace);
  return {
    id: `${namespace.name}-auto-${Date.now()}`,
    title,
    enabled: true,
    hasRun: false,
    triggerCount: 1,
    stepCount: 2,
    scheduleLabel: 'Runs every hour',
    addedBy: 'you',
    lastRunAt: null,
    description: `Reads attached sources and writes Knowledge Indicators into ${namespace.displayName}.`,
    reads: sourceNames,
    producesCount: 0,
    steps: [
      {
        name: 'read_sources',
        explanation: `Reads ${sourceNames.join(' and ') || 'the attached sources'}.`,
      },
      {
        name: 'write_indicators',
        explanation: `Writes or updates Knowledge Indicators into ${namespace.indexName}, keyed so repeated runs update rather than duplicate.`,
      },
    ],
    properties: [
      'Run this automation from the Workflows page.',
      'Idempotent. Safe to re-run; existing Knowledge Indicators are updated, not duplicated.',
      'A single source failure is skipped without aborting the whole run.',
    ],
    yaml: workflowYamlFor(title, namespace.indexName, sourceNames),
  };
};

const renderAutomationStep = (step: AutomationStep) => (
  <li key={step.name}>
    <EuiCode>{step.name}</EuiCode> {step.explanation}
    {step.children && step.children.length > 0 ? (
      <ul>
        {step.children.map((child) => (
          <li key={child.name}>
            <EuiCode>{child.name}</EuiCode> {child.explanation}
          </li>
        ))}
      </ul>
    ) : null}
  </li>
);

const SAMPLE_TIMESTAMP = '2026-09-24T19:54:05.265Z';

const sampleIndicatorsFor = (namespace: Namespace): KnowledgeIndicator[] => {
  const first = namespace.sources[0]?.name ?? 'Source';
  const second = namespace.sources[1]?.name ?? first;
  const crawled = {
    provenance: {
      created_by: {
        uri: 'crawler://sml',
        metadata: { ingestion_method: 'crawled' as const },
      },
    },
  };
  return [
    {
      id: `${namespace.name}-sample-policy`,
      '@timestamp': SAMPLE_TIMESTAMP,
      type: 'policy',
      title: `Policy extracted from ${second}`,
      description: `A policy the agent can cite from ${second}.`,
      content: namespace.intent || `Follow the written policy in ${second}.`,
      updated_at: SAMPLE_TIMESTAMP,
      references: [{ uri: `source://${slugify(second)}`, relation: 'derived_from' }],
      governance: crawled,
    },
    {
      id: `${namespace.name}-sample-playbook`,
      '@timestamp': SAMPLE_TIMESTAMP,
      type: 'playbook',
      title: `Playbook extracted from ${first}`,
      description: `Steps distilled from ${first}.`,
      content: [
        'Confirm the incoming request.',
        `Look up the matching fact from ${second}.`,
        'Reply with the cited policy.',
      ].join('\n'),
      updated_at: SAMPLE_TIMESTAMP,
      references: [{ uri: `source://${slugify(first)}`, relation: 'derived_from' }],
      governance: crawled,
    },
    {
      id: `${namespace.name}-sample-fact`,
      '@timestamp': SAMPLE_TIMESTAMP,
      type: 'fact',
      title: `Fact extracted from ${first}`,
      description: `A concrete fact from ${first}.`,
      content: `The primary fact agents should lead with from ${first}.`,
      updated_at: SAMPLE_TIMESTAMP,
      references: [{ uri: `source://${slugify(first)}`, relation: 'derived_from' }],
      governance: crawled,
    },
  ];
};

type OverviewStatTone = 'default' | 'success' | 'danger' | 'muted';

const OverviewStatCell = ({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: OverviewStatTone;
}) => (
  <div
    className={`contextEnginePrototype__overviewStatCell${
      tone !== 'default' ? ` contextEnginePrototype__overviewStatCell--${tone}` : ''
    }`}
  >
    <div className="contextEnginePrototype__overviewStatLabel">{label}</div>
    <div className="contextEnginePrototype__overviewStatValue">{value}</div>
  </div>
);

const CatalogStateBadges = ({ namespace }: { namespace: Namespace }) => {
  const needsSetup = indexState(namespace) !== 'ready' && !namespace.proto11;
  const sample = Boolean(namespace.proto11?.sample);
  return (
    <div className="contextEnginePrototype__cardBadges">
      {!needsSetup && !namespace.managed && !sample ? null : (
        <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false} wrap>
          {sample ? (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" className="contextEnginePrototype__cardBadge">
                Sample
              </EuiBadge>
            </EuiFlexItem>
          ) : null}
          {namespace.managed ? (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow" iconType="lock" className="contextEnginePrototype__cardBadge">
                Managed
              </EuiBadge>
            </EuiFlexItem>
          ) : null}
          {needsSetup ? (
            <EuiFlexItem grow={false}>
              <EuiBadge color="warning" className="contextEnginePrototype__cardBadge">
                Needs setup
              </EuiBadge>
            </EuiFlexItem>
          ) : null}
        </EuiFlexGroup>
      )}
    </div>
  );
};

const sourceTypeLabel = (source: NamespaceSource) =>
  source.typeLabel === 'ES|QL' ||
  source.typeLabel === 'Managed' ||
  source.typeLabel === 'Connector'
    ? source.typeLabel
    : 'Index';

const SHOW_MEMORY_TOGGLE = MEMORY_ENABLED && CONTEXT_ENGINE_ENABLED;

const MemorySwitch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="contextEnginePrototype__memorySwitch">
    <EuiSwitch
      label="Enable agent memory"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <EuiText size="s" color="subdued">
      <p>Agents can store and recall memories in this index.</p>
    </EuiText>
  </div>
);

const ReadyCallout = ({
  onDismiss,
  memoryEnabled,
}: {
  onDismiss: () => void;
  memoryEnabled?: boolean;
}) => (
  <EuiCallOut
    color="success"
    iconType="checkInCircleFilled"
    title={READY_CALLOUT_TITLE}
    onDismiss={onDismiss}
  >
    {memoryEnabled ? <p>{READY_CALLOUT_MEMORY}</p> : null}
  </EuiCallOut>
);

const sourceSummary = (namespace: Namespace) => {
  const names = namespace.sources.map((source) => source.name);
  if (names.length === 0) return 'No sources yet';
  const shown = names.slice(0, 3);
  const hidden = names.length - shown.length;
  return hidden > 0 ? `${shown.join(', ')} +${hidden}` : shown.join(', ');
};

const integrationLabel = (namespace: Namespace) =>
  namespace.managed ? 'Elastic (built-in)' : 'Not connected';

const suggestionChipsFor = (namespace: Namespace) => {
  const names = namespace.sources.map((source) => source.name);
  if (names.length === 0) return [];
  return [
    `Extract playbooks from ${names[0]}`,
    `Keep ${names[1] || names[0]} facts current`,
    `Build a glossary from ${names[2] || names[0]}`,
  ];
};

const DisabledReason = ({ children }: { children: React.ReactNode }) => (
  <EuiText size="s" color="subdued" className="contextEnginePrototype__disabledReason">
    {children}
  </EuiText>
);

function ContextEngineApp({
  coreStart,
  plugins,
}: {
  coreStart: CoreStart;
  plugins: AppPluginStartDependencies;
}) {
  const [screen, setScreen] = useState<Screen>('index');
  const [namespaces, setNamespaces] = useState<Namespace[]>(() => initialNamespaces());
  const [activeName, setActiveName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [namespaceQuery, setNamespaceQuery] = useState('');
  const [flags, setFlags] = useState(demoFlags$.value);

  const [createName, setCreateName] = useState('');
  const [createIntent, setCreateIntent] = useState('');
  const [sourcesDraft, setSourcesDraft] = useState<SourcesDraft>(() => emptySourcesDraft());
  const [createTraces, setCreateTraces] = useState<IndexTrace[]>([]);
  const [createMemoryEnabled, setCreateMemoryEnabled] = useState(true);
  const [nextStepDismissed, setNextStepDismissed] = useState(false);
  const [readyCalloutDismissed, setReadyCalloutDismissed] = useState<Record<string, boolean>>({});
  const automationsPanelRef = useRef<HTMLDivElement>(null);
  const sourcesPanelRef = useRef<HTMLDivElement>(null);
  const [pendingAutomationsScroll, setPendingAutomationsScroll] = useState(false);
  const [pendingSourcesScroll, setPendingSourcesScroll] = useState(false);
  const [tracesEditing, setTracesEditing] = useState(false);
  const [tracesDraft, setTracesDraft] = useState<IndexTrace[]>([]);
  const [agentsEditing, setAgentsEditing] = useState(false);
  const [agentsDraft, setAgentsDraft] = useState<ConnectedAgent[]>([]);
  const [automationsAddOpen, setAutomationsAddOpen] = useState(false);
  const [automationsMenuOpen, setAutomationsMenuOpen] = useState<string | null>(null);
  const [catalogActionsOpen, setCatalogActionsOpen] = useState<string | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<Namespace | null>(null);
  const [useInAgentNamespace, setUseInAgentNamespace] = useState<Namespace | null>(null);

  const [agentOpen, setAgentOpen] = useState(false);
  const [agent, setAgent] = useState<AgentSession | null>(null);
  const [previewAutomation, setPreviewAutomation] = useState<Automation | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    namespaceName: string;
    automation: Automation;
  } | null>(null);
  const [editIntentOpen, setEditIntentOpen] = useState(false);
  const [sourcesEditing, setSourcesEditing] = useState(false);
  const [pendingPanelSwitch, setPendingPanelSwitch] = useState<EditablePanel | null>(null);
  const requestEditRef = useRef<(panel: EditablePanel) => void>(() => undefined);
  const [intentDraft, setIntentDraft] = useState('');
  const [memoryDraft, setMemoryDraft] = useState(true);
  const [openImprovementCount, setOpenImprovementCount] = useState(0);
  const [fixFlyoutFor, setFixFlyoutFor] = useState<string | null>(null);
  const isDarkMode = useIsDarkMode();
  const { colorMode } = useEuiTheme();
  const funnelSrc = colorMode === 'DARK' ? funnelDark : funnelLight;
  const [question, setQuestion] = useState('');
  const [questionResult, setQuestionResult] = useState<
    | { kind: 'hit'; answer: string; indicator: KnowledgeIndicator }
    | { kind: 'miss' }
    | null
  >(null);
  const composerRef = useRef<HTMLInputElement | null>(null);

  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => {
    persistUserNamespaces(namespaces);
  }, [namespaces]);

  useEffect(() => {
    const sub = demoFlags$.subscribe(setFlags);
    return () => {
      sub.unsubscribe();
      clearTimers();
    };
  }, []);

  useEffect(() => {
    coreStart.chrome.setBreadcrumbs([]);
  }, [coreStart.chrome]);

  const hasActiveProto11Run = namespaces.some(
    (item) =>
      item.proto11 &&
      !item.proto11.sample &&
      (item.proto11.phase === 'firstPass' ||
        item.proto11.phase === 'fullRun' ||
        item.proto11.fix === 'rerunning' ||
        item.proto11.fix === 'fixed')
  );

  useEffect(() => {
    if (!hasActiveProto11Run) return;
    const timer = window.setInterval(() => {
      setNamespaces((current) => {
        let changed = false;
        const next = current.map((item) => {
          const advanced = advanceProto11(item);
          if (advanced !== item) changed = true;
          return advanced;
        });
        return changed ? next : current;
      });
    }, PROTO11_TICK_MS);
    return () => window.clearInterval(timer);
  }, [hasActiveProto11Run]);

  const replaceNamespace = (next: Namespace) => {
    setNamespaces((current) =>
      current.map((item) => (item.name === next.name ? next : item))
    );
  };

  const closeCatalogActions = () => setCatalogActionsOpen(null);

  const copyBackingIndexName = async (namespace: Namespace) => {
    const name = backingIndexName(namespace.name);
    try {
      await navigator.clipboard.writeText(name);
      coreStart.notifications.toasts.addSuccess(`${name} copied`);
    } catch {
      coreStart.notifications.toasts.addDanger('Could not copy the backing index name.');
    }
  };

  const confirmDeleteIndex = () => {
    if (!pendingDeleteIndex || pendingDeleteIndex.managed) return;
    const deletedName = pendingDeleteIndex.displayName;
    setNamespaces((current) => current.filter((item) => item.name !== pendingDeleteIndex.name));
    setPendingDeleteIndex(null);
    if (activeName === pendingDeleteIndex.name) {
      goLanding();
    }
    coreStart.notifications.toasts.addSuccess(`${deletedName} deleted`);
  };

  const openUseInAgent = (namespace: Namespace) => {
    setUseInAgentNamespace(namespace);
  };

  const replaceKnowledgeIndicator = (
    namespaceName: string,
    next: HydratedKnowledgeIndicator
  ) => {
    setNamespaces((current) =>
      current.map((item) =>
        item.name === namespaceName
          ? {
              ...item,
              indicators: item.indicators.map((indicator) =>
                indicator.id === next.id ? next : indicator
              ),
            }
          : item
      )
    );
  };

  const confirmDeleteAutomation = () => {
    if (!pendingDelete) return;
    const namespace = namespaces.find((item) => item.name === pendingDelete.namespaceName);
    if (!namespace) {
      setPendingDelete(null);
      return;
    }
    const remaining = namespace.automations.filter(
      (item) => item.id !== pendingDelete.automation.id
    );
    replaceNamespace({
      ...namespace,
      automations: remaining,
      lastSuccessfulRun:
        namespace.lastSuccessfulRun?.name === pendingDelete.automation.title
          ? remaining[0]
            ? {
                name: remaining[0].title,
                when: namespace.updated,
              }
            : undefined
          : namespace.lastSuccessfulRun,
    });
    setPendingDelete(null);
  };

  const activeNamespace = namespaces.find((item) => item.name === activeName) ?? null;
  const showImprovementsTab =
    FEEDBACK_LOOP_ENABLED &&
    flags.feedbackLoopEnabled &&
    Boolean(activeNamespace && indexState(activeNamespace) === 'ready');

  useEffect(() => {
    if (detailTab === 'improvements' && !showImprovementsTab) {
      setDetailTab('overview');
    }
  }, [detailTab, showImprovementsTab]);

  useEffect(() => {
    if (!activeNamespace || !showImprovementsTab) {
      setOpenImprovementCount(0);
      return;
    }
    setOpenImprovementCount(
      initialOpenImprovementCount(activeNamespace, {
        coldStart: flags.feedbackLoopColdStart,
        healthy: flags.feedbackLoopHealthy,
      })
    );
  }, [
    activeNamespace?.name,
    showImprovementsTab,
    flags.feedbackLoopColdStart,
    flags.feedbackLoopHealthy,
  ]);
  const proto11On = flags.proto11Setup;
  const visibleNamespaces = namespaces.filter((item) => {
    if (item.managed) return true;
    if (item.proto11 && !proto11On) return false;
    if (flags.catalogState === 'empty') return false;
    // Learning is the empty catalog: get-started plus the managed index only.
    // Created indexes stay persisted and come back in Working.
    if (flags.catalogState === 'learning') return Boolean(item.proto11);
    return true;
  });
  const proto11HeaderBadges: AppHeaderBadge[] | undefined = proto11On
    ? [{ label: 'Proto 11', color: 'hollow' }]
    : undefined;

  const filteredNamespaces = useMemo(() => {
    const query = namespaceQuery.trim().toLowerCase();
    const matched = visibleNamespaces.filter((item) => {
      if (!query) return true;
      return (
        item.displayName.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.intent.toLowerCase().includes(query)
      );
    });
    return [...matched.filter((item) => item.managed), ...matched.filter((item) => !item.managed)];
  }, [visibleNamespaces, namespaceQuery]);

  const goLanding = () => {
    setScreen('index');
    setActiveName(null);
    setDetailTab('overview');
    setQuestion('');
    setQuestionResult(null);
    setSourcesEditing(false);
    setEditIntentOpen(false);
    setTracesEditing(false);
    setAgentsEditing(false);
    setPendingPanelSwitch(null);
    setAutomationsAddOpen(false);
    setAutomationsMenuOpen(null);
  };

  useEffect(() => {
    setNextStepDismissed(false);
  }, [activeName, screen]);

  useEffect(() => {
    if (!pendingAutomationsScroll || detailTab !== 'overview') return;
    automationsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPendingAutomationsScroll(false);
  }, [pendingAutomationsScroll, detailTab]);

  useEffect(() => {
    if (!pendingSourcesScroll || detailTab !== 'overview') return;
    sourcesPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPendingSourcesScroll(false);
  }, [pendingSourcesScroll, detailTab]);

  const goToAutomations = () => {
    setDetailTab('overview');
    setPendingAutomationsScroll(true);
  };

  const goToSources = () => {
    setDetailTab('overview');
    setPendingSourcesScroll(true);
    requestEditRef.current('sources');
  };

  useEffect(() => {
    if (
      screen === 'detail' &&
      activeName &&
      !visibleNamespaces.some((item) => item.name === activeName)
    ) {
      goLanding();
    }
  }, [flags.catalogState, flags.proto11Setup]);

  const updateProto11Meta = (namespaceName: string, patch: Partial<Proto11Meta>) => {
    setNamespaces((current) =>
      current.map((item) =>
        item.name === namespaceName && item.proto11
          ? { ...item, proto11: { ...item.proto11, ...patch } }
          : item
      )
    );
  };

  const updateProto11Namespace = (
    namespaceName: string,
    update: (namespace: Namespace) => Namespace
  ) => {
    setNamespaces((current) =>
      current.map((item) => (item.name === namespaceName ? update(item) : item))
    );
  };

  const createFromGoal = (options: Omit<CreateFromGoalOptions, 'takenNames'>) => {
    const created = createProto11Namespace({
      ...options,
      takenNames: namespaces.map((item) => item.name),
    });
    setNamespaces((current) => [created, ...current]);
    openDetail(created);
  };

  const trySample = (scenario: Proto11SampleScenario) => {
    const existing = namespaces.find((item) => sampleScenarioOf(item) === scenario);
    if (existing) {
      openDetail(existing);
      return;
    }
    const created = createSampleNamespace(scenario);
    setNamespaces((current) => [
      created,
      ...current.filter((item) => item.name !== sampleNameFor(scenario)),
    ]);
    openDetail(created);
  };

  const removeSample = (namespaceName: string) => {
    setNamespaces((current) => current.filter((item) => item.name !== namespaceName));
    goLanding();
    coreStart.notifications.toasts.addSuccess('Sample data removed');
  };

  const openCreate = () => {
    setCreateName('');
    setCreateIntent('');
    setCreateMemoryEnabled(true);
    setSourcesDraft(emptySourcesDraft());
    setCreateTraces([]);
    setScreen('create');
  };

  const openDetail = (namespace: Namespace, tab: DetailTab = 'overview') => {
    setActiveName(namespace.name);
    setDetailTab(tab);
    setQuestion('');
    setQuestionResult(null);
    setSourcesEditing(false);
    setEditIntentOpen(false);
    setTracesEditing(false);
    setAgentsEditing(false);
    setPendingPanelSwitch(null);
    setAutomationsAddOpen(false);
    setAutomationsMenuOpen(null);
    setScreen('detail');
  };

  const createDisabledReason = !createName.trim()
    ? 'Enter a name to create'
    : visibleNamespaces.some((item) => item.name === createName.trim())
      ? 'An AI index with this name already exists'
      : null;

  const createNamespace = () => {
    if (createDisabledReason) return;
    const name = createName.trim();
    const indexName = backingIndexName(name);
    const created: Namespace = {
      name,
      displayName: name,
      intent: createIntent.trim(),
      memoryEnabled: SHOW_MEMORY_TOGGLE ? createMemoryEnabled : true,
      owner: 'you',
      updated: relativeNow(),
      indexName,
      storageType: 'index', // Search-team #16065: always index in the UI
      userCreated: true,
      sources: [],
      traces: createTraces,
      automations: [],
      indicators: [],
      knowledge: statsFromIndicators([]),
      tryQuestions: [],
    };
    setNamespaces((current) => [created, ...current]);
    openDetail(created);
  };

  const suggestDisabledReason = () => {
    if (flags.skillUnavailable) {
      return 'Automation generation is unavailable in this environment.';
    }
    return null;
  };

  const openAgent = (namespace: Namespace, mode: 'suggest' | 'create') => {
    if (mode === 'suggest' && suggestDisabledReason()) return;
    if (mode === 'suggest') {
      if (plugins.agentBuilder?.openChat) {
        plugins.agentBuilder.openChat({
          newConversation: true,
          initialMessage: SUGGEST_COMPOSER,
          autoSendInitialMessage: false,
          attachments: [
            {
              type: 'group',
              id: `ai-index-${namespace.name}`,
              label: namespace.displayName,
              items: [
                {
                  type: 'text',
                  data: {
                    content: `AI index ${namespace.displayName}. ${namespace.intent}`.trim(),
                  },
                  description: namespace.displayName,
                },
              ],
            },
          ],
        });
        return;
      }
      const chromeButton = document.querySelector<HTMLButtonElement>(
        '[data-test-subj="AgentBuilderNavControlButton"], [data-test-subj="AgentBuilderNavControlButtonIcon"]'
      );
      if (chromeButton) {
        chromeButton.click();
        return;
      }
    }
    clearTimers();
    const session: AgentSession = {
      mode,
      composer: mode === 'suggest' ? SUGGEST_COMPOSER : '',
      sentMessage: '',
      phase: 'compose',
      toolLines: [],
      draft: null,
      created: [],
    };
    setAgent(session);
    setAgentOpen(true);
  };

  const openRefineAgent = (namespace: Namespace, item: OverviewImprovement) => {
    const message = `Propose an improvement for this failure pattern. Verify it against the source first, then suggest one bounded change. Proposed fix: ${item.proposedFix}`;
    if (plugins.agentBuilder?.openChat) {
      plugins.agentBuilder.openChat({
        newConversation: true,
        initialMessage: message,
        autoSendInitialMessage: false,
        attachments: [
          {
            type: 'group',
            id: `ai-index-${namespace.name}`,
            label: namespace.displayName,
            items: [
              {
                type: 'text',
                data: {
                  content: `Failure pattern · ${item.title}. ${namespace.displayName}. ${namespace.intent}`.trim(),
                },
                description: item.title,
              },
            ],
          },
        ],
      });
      return;
    }
    const chromeButton = document.querySelector<HTMLButtonElement>(
      '[data-test-subj="AgentBuilderNavControlButton"], [data-test-subj="AgentBuilderNavControlButtonIcon"]'
    );
    chromeButton?.click();
  };

  const openRefineAutomation = (namespace: Namespace, automation: Automation) => {
    const message = `Refine this automation. Keep the change bounded to how it reads sources and writes Knowledge Indicators. Automation: ${automation.title}. ${automation.description}`;
    if (plugins.agentBuilder?.openChat) {
      plugins.agentBuilder.openChat({
        newConversation: true,
        initialMessage: message,
        autoSendInitialMessage: false,
        attachments: [
          {
            type: 'group',
            id: `ai-index-${namespace.name}`,
            label: namespace.displayName,
            items: [
              {
                type: 'text',
                data: {
                  content: `Automation · ${automation.title}. ${namespace.displayName}. ${namespace.intent}`.trim(),
                },
                description: automation.title,
              },
            ],
          },
        ],
      });
      return;
    }
    const chromeButton = document.querySelector<HTMLButtonElement>(
      '[data-test-subj="AgentBuilderNavControlButton"], [data-test-subj="AgentBuilderNavControlButtonIcon"]'
    );
    chromeButton?.click();
  };

  useEffect(() => {
    if (agentOpen && agent?.mode === 'create' && agent.phase === 'compose') {
      window.setTimeout(() => composerRef.current?.focus(), 50);
    }
  }, [agentOpen, agent?.mode, agent?.phase]);

  const startAgentStream = (namespace: Namespace, session: AgentSession) => {
    const draft = draftAutomation(namespace);
    const sourceLine =
      namespace.sources.length > 0
        ? `Inspecting sources: ${namespace.sources.map((source) => source.name).join(', ')}`
        : 'Inspecting attached sources';
    setAgent({ ...session, phase: 'streaming', toolLines: ['Reading AI index attachment'] });
    timers.current.push(
      window.setTimeout(() => {
        setAgent((current) =>
          current
            ? { ...current, toolLines: [...current.toolLines, sourceLine] }
            : current
        );
      }, 500)
    );
    timers.current.push(
      window.setTimeout(() => {
        setAgent((current) =>
          current
            ? {
                ...current,
                phase: 'confirm',
                draft,
                toolLines: [...current.toolLines, 'Drafted an extract automation'],
              }
            : current
        );
      }, 1100)
    );
  };

  const saveAndAttach = (namespace: Namespace) => {
    if (!agent?.draft) return;
    const produceEmpty = flags.nextRunEmpty || namespace.automations.length > 0;
    const created = produceEmpty ? [] : sampleIndicatorsFor(namespace);
    const automation: Automation = {
      ...agent.draft,
      hasRun: true,
      lastRunAt: relativeNow(),
    };
    const nextIndicators = [...namespace.indicators, ...created];
    const next: Namespace = {
      ...namespace,
      automations: [...namespace.automations, automation],
      indicators: nextIndicators,
      knowledge: statsFromIndicators(nextIndicators),
      updated: relativeNow(),
      lastSuccessfulRun: { name: automation.title, when: relativeNow() },
      tryQuestions:
        created.length > 0
          ? [
              {
                question: created[2]?.title ? `What is ${created[2].title.toLowerCase()}?` : created[0].title,
                hit: true,
                answer: Array.isArray(created[2]?.value)
                  ? created[2].value[0]
                  : String(created[2]?.value ?? created[0].value),
                indicatorId: (created[2] ?? created[0]).id,
              },
              { question: 'What is the capital of France?', hit: false },
            ]
          : namespace.tryQuestions,
    };
    replaceNamespace(next);
    setAgent((current) =>
      current ? { ...current, phase: 'added', created } : current
    );
    timers.current.push(
      window.setTimeout(() => {
        setAgent((current) => (current ? { ...current, phase: 'running' } : current));
      }, 500)
    );
    timers.current.push(
      window.setTimeout(() => {
        setAgent((current) =>
          current
            ? { ...current, phase: created.length > 0 ? 'result' : 'empty' }
            : current
        );
      }, 1300)
    );
  };

  const closeAgent = () => {
    clearTimers();
    setAgentOpen(false);
    setAgent(null);
  };

  const runQuestion = (namespace: Namespace) => {
    const asked = question.trim();
    if (!asked) return;
    const match = namespace.tryQuestions.find(
      (item) => item.question.toLowerCase() === asked.toLowerCase()
    );
    const fuzzy = namespace.tryQuestions.find((item) => {
      const tokens = asked.toLowerCase().split(/\s+/).filter((token) => token.length > 3);
      return tokens.some((token) => item.question.toLowerCase().includes(token));
    });
    const picked = match ?? fuzzy;
    if (picked?.hit && picked.indicatorId) {
      const indicator = namespace.indicators.find((item) => item.id === picked.indicatorId);
      if (indicator) {
        setQuestionResult({
          kind: 'hit',
          answer: picked.answer || indicator.description || indicator.content,
          indicator,
        });
        return;
      }
    }
    setQuestionResult({ kind: 'miss' });
  };

  const createIndexMenu: AppHeaderMenu = {
    primaryActionItem: {
      id: 'create-ai-index',
      label: 'Create AI index',
      iconType: 'plusInCircle',
      run: openCreate,
      testId: 'contextEngineCreateAiIndex',
    },
  };

  const renderCatalogActions = (namespace: Namespace) => {
    const suggestReason = suggestDisabledReason();
    const closeAnd = (action: () => void) => {
      closeCatalogActions();
      action();
    };
    return (
      <div
        className="contextEnginePrototype__catalogActions"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <EuiPopover
          button={
            <EuiButtonIcon
              iconType="boxesVertical"
              aria-label={`Actions for ${namespace.displayName}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setCatalogActionsOpen((current) =>
                  current === namespace.name ? null : namespace.name
                );
              }}
            />
          }
          isOpen={catalogActionsOpen === namespace.name}
          closePopover={closeCatalogActions}
          panelPaddingSize="none"
          anchorPosition="downRight"
        >
          <div onClick={(event) => event.stopPropagation()}>
            <EuiContextMenu
              initialPanelId={0}
              size="s"
              panels={[
                {
                  id: 0,
                  items: [
                    {
                      name: 'Open',
                      icon: 'arrowRight',
                      onClick: () => closeAnd(() => openDetail(namespace)),
                    },
                    {
                      name: 'Use in an agent',
                      icon: 'productAgent',
                      onClick: () => closeAnd(() => openUseInAgent(namespace)),
                    },
                    {
                      name: 'Create with AI Agent',
                      icon: 'productAgent',
                      disabled: Boolean(suggestReason),
                      toolTipContent: suggestReason ?? undefined,
                      onClick: () => closeAnd(() => openAgent(namespace, 'suggest')),
                    },
                    { isSeparator: true },
                    ...(namespace.indicators.length > 0
                      ? [
                          {
                            name: 'View Knowledge Indicators',
                            icon: 'documents',
                            onClick: () => closeAnd(() => openDetail(namespace, 'knowledge')),
                          },
                        ]
                      : []),
                    {
                      name: 'View raw docs in Discover',
                      icon: 'popout',
                      href: coreStart.http.basePath.prepend('/app/discover'),
                      target: '_blank',
                      onClick: () => closeCatalogActions(),
                    },
                    {
                      name: 'Copy backing index name',
                      icon: 'copyClipboard',
                      onClick: () => closeAnd(() => void copyBackingIndexName(namespace)),
                    },
                    { isSeparator: true },
                    {
                      name: 'Delete AI index',
                      icon: 'trash',
                      color: 'danger',
                      disabled: Boolean(namespace.managed),
                      toolTipContent: namespace.managed
                        ? 'The Elastic AI index is managed and cannot be deleted.'
                        : undefined,
                      onClick: () =>
                        closeAnd(() => {
                          if (!namespace.managed) setPendingDeleteIndex(namespace);
                        }),
                    },
                  ],
                },
              ]}
            />
          </div>
        </EuiPopover>
      </div>
    );
  };

  const renderCatalogItem = (
    namespace: Namespace,
    layout: 'card' | 'row',
    proto11Managed = false
  ) => {
    const open = () => openDetail(namespace);
    const pills = namespace.managed ? null : (
      <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow" className="contextEnginePrototype__countBadge">
            <span className="contextEnginePrototype__countPill">
              <EuiIcon type="document" size="m" />
              {namespace.sources.length} {namespace.sources.length === 1 ? 'source' : 'sources'}
            </span>
          </EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow" className="contextEnginePrototype__countBadge">
            <span className="contextEnginePrototype__countPill">
              <EuiIcon type="gear" size="m" />
              {namespace.automations.length}{' '}
              {namespace.automations.length === 1 ? 'automation' : 'automations'}
            </span>
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
    const nameLink = (
      <span className="contextEnginePrototype__indexObject">
        <EuiIcon type={TABLE_SPARKLES_TYPE} size="m" />
        <EuiLink
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            open();
          }}
        >
          {namespace.displayName}
        </EuiLink>
      </span>
    );

    if (layout === 'row') {
      return (
        <EuiPanel
          key={namespace.name}
          hasBorder
          paddingSize="none"
          className="contextEnginePrototype__namespaceRow"
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${namespace.displayName}`}
        >
          <div className="contextEnginePrototype__namespaceRowInner">
            <div className="contextEnginePrototype__namespaceRowMain">
              <div className="contextEnginePrototype__namespaceRowTitle">
                <span className="contextEnginePrototype__namespaceRowName">{nameLink}</span>
                <CatalogStateBadges namespace={namespace} />
              </div>
              <EuiText size="xs" color="subdued" className="contextEnginePrototype__namespaceSources">
                {sourceSummary(namespace)}
              </EuiText>
            </div>
            <div className="contextEnginePrototype__namespaceRowMeta">
              <div className="contextEnginePrototype__namespaceRowMetaCol">
                <span className="contextEnginePrototype__namespaceRowMetaLabel">
                  Knowledge Indicators
                </span>
                <span className="contextEnginePrototype__namespaceRowMetaValue">
                  {namespace.indicators.length}
                </span>
              </div>
              <div className="contextEnginePrototype__namespaceRowMetaCol">
                <span className="contextEnginePrototype__namespaceRowMetaLabel">Updated</span>
                <span className="contextEnginePrototype__namespaceRowMetaValue">
                  {namespace.updated}
                </span>
              </div>
            </div>
            {renderCatalogActions(namespace)}
          </div>
        </EuiPanel>
      );
    }

    return (
      <EuiFlexItem key={namespace.name}>
        <EuiPanel
          hasBorder
          grow={false}
          paddingSize="l"
          className="contextEnginePrototype__card"
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              open();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${namespace.displayName}`}
        >
          <div className="contextEnginePrototype__cardTop">
            <div className="contextEnginePrototype__cardHeading">
              <div className="contextEnginePrototype__cardName">
                <EuiTitle size="xs">
                  <h2>{proto11Managed ? namespace.name : namespace.displayName}</h2>
                </EuiTitle>
              </div>
              <CatalogStateBadges namespace={namespace} />
            </div>
            {proto11Managed ? null : renderCatalogActions(namespace)}
          </div>
          <EuiSpacer size="s" />
          <EuiText size="xs" color="subdued" className="contextEnginePrototype__cardDesc">
            <p>{namespace.intent || 'No description set.'}</p>
          </EuiText>
          {pills ? (
            <>
              <EuiSpacer size="s" />
              {pills}
              <EuiSpacer size="m" />
            </>
          ) : (
            <EuiSpacer size="s" />
          )}
          <div className="contextEnginePrototype__cardFooter">
            <EuiHorizontalRule margin="none" />
            <EuiSpacer size="s" />
            {proto11Managed ? (
              <EuiText size="s">
                <EuiLink
                  onClick={(event: React.MouseEvent) => {
                    event.stopPropagation();
                    open();
                  }}
                  data-test-subj="proto11ExploreManaged"
                >
                  Explore index
                </EuiLink>
              </EuiText>
            ) : (
              <EuiText size="xs" color="subdued" className="contextEnginePrototype__cardUpdated">
                <p>Updated {namespace.updated}</p>
              </EuiText>
            )}
          </div>
        </EuiPanel>
      </EuiFlexItem>
    );
  };

  const renderLanding = () => {
    const hasOwnIndex = visibleNamespaces.some((item) => !item.managed);
    const showGetStarted = !hasOwnIndex;
    const managed = visibleNamespaces.find((item) => item.managed);
    const catalog =
      filteredNamespaces.length === 0 ? null : filteredNamespaces.length === 1 ? (
        renderCatalogItem(filteredNamespaces[0], 'row')
      ) : (
        <EuiFlexGrid columns={3} gutterSize="l">
          {filteredNamespaces.map((namespace) => renderCatalogItem(namespace, 'card'))}
        </EuiFlexGrid>
      );
    const managedInset = managed ? (
      <div className="contextEnginePrototype__getStartedInset" aria-label="Elastic AI index">
        <div className="contextEnginePrototype__getStartedInsetMain">
          <div className="contextEnginePrototype__getStartedInsetTitle">
            <span className="contextEnginePrototype__getStartedInsetName">
              Elastic AI index is already running for you
            </span>
            <EuiBadge color="hollow" iconType="lock">
              Managed
            </EuiBadge>
            <EuiBadge color="success">Ready</EuiBadge>
          </div>
          <EuiText size="xs" color="subdued">
            <p className="contextEnginePrototype__getStartedInsetSub">
              Dashboards, Visualizations, Alerts and SLOs enabled
            </p>
          </EuiText>
        </div>
        <EuiButtonEmpty
          size="s"
          flush="both"
          iconType="arrowRight"
          iconSide="right"
          onClick={() => openDetail(managed)}
        >
          Explore Index
        </EuiButtonEmpty>
      </div>
    ) : null;

    if (proto11On) {
      const own = visibleNamespaces.filter((item) => !item.managed);
      return (
        <>
          <PageHeader
            title="Context"
            menu={createIndexMenu}
            badges={proto11HeaderBadges}
            sectionClassName="contextEnginePrototype__headerSection--quietCreate"
          />
          <PageBody>
            <Proto11Landing
              key={own.length === 0 ? 'hero' : 'compact'}
              variant={own.length === 0 ? 'hero' : 'compact'}
              indexGrid={
                <EuiFlexGrid columns={3} gutterSize="l" data-test-subj="proto11IndexGrid">
                  {managed ? renderCatalogItem(managed, 'card', true) : null}
                  {own.map((namespace) => renderCatalogItem(namespace, 'card'))}
                </EuiFlexGrid>
              }
              takenNames={namespaces.map((item) => item.name)}
              onCreateFromGoal={createFromGoal}
              onCreateEmpty={openCreate}
              onExploreSample={trySample}
            />
          </PageBody>
        </>
      );
    }

    return (
      <>
        <PageHeader
          title="Context"
          menu={createIndexMenu}
          badges={proto11HeaderBadges}
          sectionClassName={
            showGetStarted ? 'contextEnginePrototype__headerSection--quietCreate' : undefined
          }
        />
        <PageBody
          grow={showGetStarted}
          className={showGetStarted ? 'contextEnginePrototype__bodySection--center' : undefined}
        >
          <div
            className={`contextEnginePrototype__landing${
              showGetStarted ? ' contextEnginePrototype__landing--center' : ''
            }`}
          >
            {showGetStarted && managed ? (
              <div className="contextEnginePrototype__getStarted">
                <div className="contextEnginePrototype__getStartedContent">
                  <div className="contextEnginePrototype__getStartedCopy">
                    <h2 className="contextEnginePrototype__getStartedTitle">
                      Get started with Context
                    </h2>
                    <EuiText size="s" color="subdued">
                      <p className="contextEnginePrototype__getStartedBody">
                        You have an agent. Give it knowledge. An AI index is a live collection of
                        facts built from your data: connect your{' '}
                        <span className="contextEnginePrototype__getStartedNoun">sources</span> once,
                        and{' '}
                        <span className="contextEnginePrototype__getStartedNoun">automations</span>{' '}
                        keep extracting and refreshing the{' '}
                        <span className="contextEnginePrototype__getStartedNoun">
                          Knowledge Indicators
                        </span>{' '}
                        your agent retrieves, so it answers from knowledge instead of scanning raw
                        data every time. The model behind it is built in; there is nothing to
                        configure first.
                      </p>
                    </EuiText>
                    <EuiFlexGroup
                      className="contextEnginePrototype__getStartedActions"
                      gutterSize="s"
                      alignItems="center"
                      responsive={false}
                      wrap
                    >
                      <EuiFlexItem grow={false}>
                        <EuiButton fill iconType="plusInCircle" onClick={openCreate}>
                          Create AI index
                        </EuiButton>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButtonEmpty
                          href={DOCS_HREF}
                          target="_blank"
                          iconType="popout"
                          iconSide="right"
                          aria-label="Learn what an AI index is"
                        >
                          Learn what an AI index is
                        </EuiButtonEmpty>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </div>
                  <div className="contextEnginePrototype__getStartedArt">
                    {typeof (isDarkMode ? heroDark : heroLight) === 'string' ? (
                      <img src={isDarkMode ? heroDark : heroLight} alt="" width={340} />
                    ) : (
                      React.createElement(isDarkMode ? heroDark : heroLight, {
                        width: 340,
                        height: 'auto',
                        role: 'img',
                        'aria-hidden': true,
                      })
                    )}
                  </div>
                </div>
                {managedInset}
                <div className="contextEnginePrototype__getStartedFooter">
                  <span className="contextEnginePrototype__getStartedHelp">Need help?</span>{' '}
                  <EuiLink href={DOCS_HREF} target="_blank" external>
                    Read documentation
                  </EuiLink>
                </div>
              </div>
            ) : null}

            {hasOwnIndex ? (
              <>
                <EuiFlexGroup gutterSize="m" alignItems="flexEnd" wrap>
                  <EuiFlexItem grow={2}>
                    <EuiFieldSearch
                      compressed
                      fullWidth
                      placeholder="Search AI indices"
                      value={namespaceQuery}
                      onChange={(event) => setNamespaceQuery(event.target.value)}
                      aria-label="Search AI indices"
                    />
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiText size="s" color="subdued">
                  {filteredNamespaces.length === 0
                    ? 'No AI indices match your search.'
                    : indexCountLabel(filteredNamespaces.length)}
                </EuiText>
                {catalog}
              </>
            ) : null}
          </div>
        </PageBody>
      </>
    );
  };

  const renderCreate = () => (
      <>
        <PageHeader
          title="Create AI index"
          back={headerBack(CONTEXT_APP_HREF, 'Context', goLanding)}
          metadata={headerMeta(CREATE_DESCRIPTION)}
          badges={proto11HeaderBadges}
        />
        <PageBody>
          <div className="contextEnginePrototype__create">
            <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
              <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                <h2>Name</h2>
              </EuiTitle>
              <EuiSpacer size="s" />
              <EuiFieldText
                fullWidth
                placeholder="e.g. support-ticket-triage"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                aria-label="Name"
              />
              <EuiText
                size="xs"
                color="subdued"
                className="contextEnginePrototype__descriptionHelper"
              >
                <p>{NAME_HELPER}</p>
              </EuiText>
            </EuiPanel>
            <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
              <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                <h2>Description</h2>
              </EuiTitle>
              <EuiSpacer size="s" />
              <div className="contextEnginePrototype__descriptionField">
                <EuiTextArea
                  fullWidth
                  rows={3}
                  placeholder={DESCRIPTION_PLACEHOLDER}
                  value={createIntent}
                  onChange={(event) => setCreateIntent(event.target.value)}
                  aria-label="Description"
                />
                <EuiText
                  size="xs"
                  color="subdued"
                  className="contextEnginePrototype__descriptionHelper"
                >
                  <p>{DESCRIPTION_HELPER}</p>
                </EuiText>
              </div>
              {SHOW_MEMORY_TOGGLE ? (
                <>
                  <EuiSpacer size="m" />
                  <MemorySwitch checked={createMemoryEnabled} onChange={setCreateMemoryEnabled} />
                </>
              ) : null}
            </EuiPanel>
            <AgentTracesPanel
              traces={createTraces}
              onChange={setCreateTraces}
              improvementsEnabled={FEEDBACK_LOOP_ENABLED && flags.feedbackLoopEnabled}
              accordionId="context-engine-11-create-traces-esql"
            />
            <EuiFlexGroup
              justifyContent="flexEnd"
              alignItems="center"
              gutterSize="m"
              responsive={false}
              className="contextEnginePrototype__createFooter"
            >
              {createDisabledReason ? (
                <EuiFlexItem grow={false}>
                  <DisabledReason>{createDisabledReason}</DisabledReason>
                </EuiFlexItem>
              ) : null}
              <EuiFlexItem grow={false}>
                <EuiButton
                  fill
                  iconType="arrowRight"
                  iconSide="right"
                  isDisabled={Boolean(createDisabledReason)}
                  onClick={createNamespace}
                >
                  Create AI index
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </div>
        </PageBody>
      </>
    );

  const renderDetail = (namespace: Namespace) => {
    const state = indexState(namespace);
    const meta = namespace.proto11;
    const stateBadge: AppHeaderBadge =
      state === 'ready'
        ? {
            label: 'Ready',
            color: 'success',
          }
        : {
            label: 'Needs setup',
            color: 'warning',
            tooltip: 'No automations yet. Create one to start producing Knowledge Indicators.',
            onClick: goToAutomations,
            onClickAriaLabel: 'Scroll to Automations',
          };
    const badges: AppHeaderBadge[] = [
      ...(meta?.sample ? [{ label: 'Sample', color: 'hollow' } satisfies AppHeaderBadge] : []),
      ...(meta && state !== 'ready' ? [] : [stateBadge]),
    ];
    if (namespace.managed) {
      badges.push({ label: 'Managed', color: 'hollow' });
    }
    if (proto11HeaderBadges) badges.push(...proto11HeaderBadges);
    const hideKnowledgeTab = Boolean(meta) && namespace.indicators.length === 0;
    const sourcesWithIndicators = new Set(
      meta
        ? namespace.indicators.map(
            (indicator) => indicatorSourceGroup(indicator, namespace.sources, meta.agent).name
          )
        : []
    );
    const effectiveTab: DetailTab =
      hideKnowledgeTab && detailTab === 'knowledge' ? 'overview' : detailTab;
    const tabs: AppHeaderTab[] = [
      {
        id: 'overview',
        label: 'Overview',
        isSelected: effectiveTab === 'overview',
        onClick: () => setDetailTab('overview'),
      },
      ...(hideKnowledgeTab
        ? []
        : [
            {
              id: 'knowledge',
              label: 'Knowledge Indicators',
              isSelected: effectiveTab === 'knowledge',
              onClick: () => setDetailTab('knowledge'),
              ...(namespace.indicators.length > 0 ? { badge: namespace.indicators.length } : {}),
            } satisfies AppHeaderTab,
          ]),
      ...(showImprovementsTab
        ? [
            {
              id: 'improvements',
              label: 'Improvements',
              isSelected: effectiveTab === 'improvements',
              onClick: () => setDetailTab('improvements'),
              badge: openImprovementCount,
            } satisfies AppHeaderTab,
          ]
        : []),
    ];
    const suggestReason = suggestDisabledReason();
    const automationsLocked = namespace.sources.length === 0;
    const workflowsHref = coreStart.http.basePath.prepend('/app/workflows');
    const activeEditPanel: EditablePanel | null = editIntentOpen
      ? 'description'
      : tracesEditing
      ? 'traces'
      : sourcesEditing
      ? 'sources'
      : agentsEditing
      ? 'agents'
      : null;
    const anyEditing = activeEditPanel !== null;
    const sourcesListDirty =
      sourcesSignature(allDraftSources(sourcesDraft)) !== sourcesSignature(namespace.sources);
    const sourcesEsqlDirty = (() => {
      const draftQuery = sourcesDraft.esqlDraft.trim();
      if (sourcesDraft.editingEsqlId) {
        const original = sourcesDraft.esqlSources.find(
          (source) => source.id === sourcesDraft.editingEsqlId
        );
        return draftQuery !== (original?.subtitle || original?.name || '').trim();
      }
      return draftQuery.length > 0;
    })();
    const sourcesDirty = sourcesListDirty || sourcesEsqlDirty;
    const descriptionDirty =
      intentDraft.trim() !== namespace.intent ||
      (SHOW_MEMORY_TOGGLE && memoryDraft !== (namespace.memoryEnabled !== false));
    const tracesDirty =
      tracesSignature(tracesDraft) !== tracesSignature(namespace.traces ?? []);
    const connectedAgents = meta?.connectedAgents ?? [];
    const agentsDirty =
      agentsDraft.map((item) => item.name).join('\n') !==
      connectedAgents.map((item) => item.name).join('\n');
    const isPanelDirty = (panel: EditablePanel) => {
      if (panel === 'description') return descriptionDirty;
      if (panel === 'traces') return tracesDirty;
      if (panel === 'agents') return agentsDirty;
      return sourcesDirty;
    };
    const closeActiveEditor = () => {
      setEditIntentOpen(false);
      setTracesEditing(false);
      setAgentsEditing(false);
      setSourcesDraft(draftFromSources(namespace.sources));
      setSourcesEditing(false);
    };
    const openEditor = (panel: EditablePanel) => {
      if (panel === 'agents') {
        setAgentsDraft(connectedAgents);
        setAgentsEditing(true);
        return;
      }
      if (panel === 'description') {
        setIntentDraft(namespace.intent);
        setMemoryDraft(namespace.memoryEnabled !== false);
        setEditIntentOpen(true);
        return;
      }
      if (panel === 'traces') {
        setTracesDraft(namespace.traces ?? []);
        setTracesEditing(true);
        return;
      }
      setSourcesDraft(draftFromSources(namespace.sources));
      setSourcesEditing(true);
    };
    const requestEdit = (panel: EditablePanel) => {
      if (activeEditPanel === panel) return;
      if (activeEditPanel && isPanelDirty(activeEditPanel)) {
        setPendingPanelSwitch(panel);
        return;
      }
      closeActiveEditor();
      openEditor(panel);
    };
    requestEditRef.current = requestEdit;
    const cancelActiveEditor = () => {
      setPendingPanelSwitch(null);
      closeActiveEditor();
    };
    const saveDescription = () => {
      replaceNamespace({
        ...namespace,
        intent: intentDraft.trim(),
        ...(SHOW_MEMORY_TOGGLE ? { memoryEnabled: memoryDraft } : {}),
      });
      setPendingPanelSwitch(null);
      setEditIntentOpen(false);
    };
    const saveTraces = () => {
      replaceNamespace({ ...namespace, traces: tracesDraft });
      setPendingPanelSwitch(null);
      setTracesEditing(false);
    };
    const saveAgents = () => {
      updateProto11Meta(namespace.name, { connectedAgents: agentsDraft });
      setPendingPanelSwitch(null);
      setAgentsEditing(false);
    };
    const saveSourcesEditor = () => {
      replaceNamespace({
        ...namespace,
        sources: allDraftSources(sourcesDraft),
      });
      setPendingPanelSwitch(null);
      setSourcesEditing(false);
    };
    const headerEditButtons = (dirty: boolean, onSave: () => void) => (
      <>
        <EuiButtonEmpty size="s" onClick={cancelActiveEditor}>
          Cancel
        </EuiButtonEmpty>
        <EuiButton size="s" fill onClick={onSave} isDisabled={!dirty}>
          Save
        </EuiButton>
      </>
    );
    const panelEditLink = (onClick: () => void) => (
      <EuiButtonEmpty size="s" iconType="pencil" onClick={onClick}>
        Edit
      </EuiButtonEmpty>
    );
    const panelAddEmpty = (label: string, onClick: () => void) => (
      <EuiButtonEmpty size="s" onClick={onClick}>
        {label}
      </EuiButtonEmpty>
    );
    const panelAddFilled = (label: string, onClick: () => void) => (
      <EuiButton size="s" fill onClick={onClick}>
        {label}
      </EuiButton>
    );
    const canEditPanels = !namespace.managed;
    const connectAgentActions = () => {
      if (!canEditPanels) return undefined;
      if (agentsEditing) return headerEditButtons(agentsDirty, saveAgents);
      if (connectedAgents.length > 0) return panelEditLink(() => requestEdit('agents'));
      if (anyEditing) return panelAddEmpty('Connect an agent', () => requestEdit('agents'));
      const onlyCallToAction =
        Boolean(meta) &&
        !meta?.sample &&
        (meta?.phase === 'fullRun' || meta?.phase === 'complete') &&
        fixFlyoutFor === null;
      return onlyCallToAction ? (
        panelAddFilled('Connect an agent', () => requestEdit('agents'))
      ) : (
        <EuiButton size="s" onClick={() => requestEdit('agents')}>
          Connect an agent
        </EuiButton>
      );
    };
    const hasDescription = Boolean(namespace.intent);
    const hasTraces = (namespace.traces?.length ?? 0) > 0;
    const hasSources = namespace.sources.length > 0;
    const hasAutomations = namespace.automations.length > 0;
    const addAutomationButton = (emphasis: 'fill' | 'button' | 'empty') => (
      <EuiPopover
        button={
          emphasis === 'empty' ? (
            <EuiButtonEmpty
              size="s"
              iconType="arrowDown"
              iconSide="right"
              onClick={() => {
                setAutomationsMenuOpen(null);
                setAutomationsAddOpen((open) => !open);
              }}
            >
              Add automation
            </EuiButtonEmpty>
          ) : (
            <EuiButton
              size="s"
              fill={emphasis === 'fill'}
              iconType="arrowDown"
              iconSide="right"
              onClick={() => {
                setAutomationsMenuOpen(null);
                setAutomationsAddOpen((open) => !open);
              }}
            >
              Add automation
            </EuiButton>
          )
        }
        isOpen={automationsAddOpen}
        closePopover={() => setAutomationsAddOpen(false)}
        panelPaddingSize="none"
        anchorPosition="downCenter"
      >
        <EuiContextMenuPanel
          size="s"
          items={[
            <EuiContextMenuItem
              key="create-workflow"
              icon="workflowsApp"
              href={workflowsHref}
              target="_blank"
              onClick={() => setAutomationsAddOpen(false)}
            >
              Create workflow
            </EuiContextMenuItem>,
            <EuiContextMenuItem
              key="use-ai-agent"
              icon="productAgent"
              disabled={Boolean(suggestReason)}
              onClick={() => {
                setAutomationsAddOpen(false);
                openAgent(namespace, 'suggest');
              }}
            >
              Use AI Agent
            </EuiContextMenuItem>,
          ]}
        />
      </EuiPopover>
    );
    const retrieval =
      namespace.overviewRetrieval && !flags.feedbackLoopColdStart
        ? namespace.overviewRetrieval
        : undefined;
    const openImprovementsValue = retrieval
      ? showImprovementsTab
        ? openImprovementCount
        : retrieval.openImprovements
      : null;
    const hasUnmeasuredStat = !retrieval;
    const overviewStatsRow =
      state === 'ready' ? (
        <EuiPanel
          hasBorder
          paddingSize="none"
          className="contextEnginePrototype__panel"
          data-test-subj="contextEngineOverviewStats"
        >
          <div className="contextEnginePrototype__overviewStats">
            <OverviewStatCell label="Knowledge Indicators" value={String(namespace.indicators.length)} />
            <OverviewStatCell
              label="Retrieval hit rate"
              value={retrieval ? `${retrieval.hitRatePct}%` : 'No data'}
              tone={retrieval ? 'success' : 'muted'}
            />
            <OverviewStatCell
              label="Tokens saved vs baseline"
              value={retrieval ? `${retrieval.tokensSavedPct}%` : 'No data'}
              tone={retrieval ? 'success' : 'muted'}
            />
            <OverviewStatCell
              label="Median latency"
              value={retrieval ? `${retrieval.medianLatencyMs}ms` : 'No data'}
              tone={retrieval ? 'default' : 'muted'}
            />
            <OverviewStatCell
              label="Traces analyzed"
              value={retrieval ? retrieval.tracesAnalyzed.toLocaleString() : 'No data'}
              tone={retrieval ? 'default' : 'muted'}
            />
            <OverviewStatCell
              label="Open improvements"
              value={openImprovementsValue === null ? 'No data' : String(openImprovementsValue)}
              tone={
                openImprovementsValue === null
                  ? 'muted'
                  : openImprovementsValue > 0
                    ? 'danger'
                    : 'default'
              }
            />
          </div>
          {hasUnmeasuredStat ? (
            <EuiText size="xs" color="subdued" className="contextEnginePrototype__overviewStatsNote">
              <p>Retrieval stats appear once agents start retrieving from this index.</p>
            </EuiText>
          ) : null}
        </EuiPanel>
      ) : null;

    return (
      <>
        <PageHeader
          title={namespace.displayName}
          back={headerBack(CONTEXT_APP_HREF, 'Context', goLanding)}
          badges={badges}
          tabs={tabs}
        />
        <PageBody>
          {showImprovementsTab ? (
            <div hidden={effectiveTab !== 'improvements'}>
              <ImprovementsTab
                namespace={namespace}
                coldStart={flags.feedbackLoopColdStart}
                healthy={flags.feedbackLoopHealthy}
                onOpenCountChange={setOpenImprovementCount}
                onRefine={(item) => openRefineAgent(namespace, item)}
              />
            </div>
          ) : null}
          {effectiveTab === 'overview' ? (
            <div className="contextEnginePrototype__panels">
              {OVERVIEW_STATS_ENABLED ? overviewStatsRow : null}
              {meta?.sample ? (
                <Proto11SampleCallout
                  namespace={namespace}
                  onRemove={() => removeSample(namespace.name)}
                />
              ) : null}
              {meta ? (
                <Proto11RunCallout
                  namespace={namespace}
                  meta={meta}
                  runFilled={!anyEditing && fixFlyoutFor === null}
                  onRunAll={() => updateProto11Namespace(namespace.name, startFullRun)}
                  onAdjust={goToAutomations}
                />
              ) : null}
              {namespace.sources.length === 0 && !readyCalloutDismissed[namespace.name] ? (
                <ReadyCallout
                  onDismiss={() =>
                    setReadyCalloutDismissed((current) => ({
                      ...current,
                      [namespace.name]: true,
                    }))
                  }
                  memoryEnabled={SHOW_MEMORY_TOGGLE && namespace.memoryEnabled !== false}
                />
              ) : null}
              {NEXT_STEP_BANNER &&
              !automationsLocked &&
              namespace.automations.length === 0 &&
              !nextStepDismissed ? (
                <EuiPanel
                  color="primary"
                  hasBorder
                  paddingSize="l"
                  className="contextEnginePrototype__nextStep"
                >
                  <EuiButtonIcon
                    className="contextEnginePrototype__nextStepDismiss"
                    iconType="cross"
                    color="text"
                    aria-label="Dismiss"
                    onClick={() => setNextStepDismissed(true)}
                  />
                  <EuiFlexGroup alignItems="center" gutterSize="l" responsive={false}>
                    <EuiFlexItem grow={false} className="contextEnginePrototype__nextStepArt">
                      <img src={funnelSrc} alt="" width={120} />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiTitle size="xs">
                        <h2>Next: create an automation</h2>
                      </EuiTitle>
                      <EuiText size="s">
                        <p>
                          Automations read your sources and produce the Knowledge Indicators your
                          agent retrieves. Without one, this index stays empty.
                        </p>
                      </EuiText>
                      <EuiFlexGroup
                        gutterSize="s"
                        alignItems="center"
                        responsive={false}
                        className="contextEnginePrototype__nextStepActions"
                      >
                        <EuiFlexItem grow={false}>
                          <EuiButton
                            fill
                            size="s"
                            iconType="productAgent"
                            isDisabled={Boolean(suggestReason)}
                            onClick={() => openAgent(namespace, 'suggest')}
                          >
                            Create with AI Agent
                          </EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiButtonEmpty
                            size="s"
                            iconType="popout"
                            iconSide="right"
                            href={coreStart.http.basePath.prepend('/app/workflows')}
                            target="_blank"
                          >
                            Create workflow
                          </EuiButtonEmpty>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              ) : null}
              {TRY_QUESTION_ENABLED && namespace.indicators.length > 0 ? (
                <>
                  <EuiPanel hasBorder paddingSize="none" className="contextEnginePrototype__panel">
                    <div className="contextEnginePrototype__panelHeader">
                      <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                        <h2>Try a question</h2>
                      </EuiTitle>
                    </div>
                    <div className="contextEnginePrototype__panelBody">
                    <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                      <EuiFlexItem>
                        <EuiFieldText
                          fullWidth
                          placeholder={namespace.tryQuestions[0]?.question || 'Ask this AI index'}
                          value={question}
                          onChange={(event) => {
                            setQuestion(event.target.value);
                            setQuestionResult(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') runQuestion(namespace);
                          }}
                          aria-label="Try a question"
                        />
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButton fill onClick={() => runQuestion(namespace)} isDisabled={!question.trim()}>
                          Test
                        </EuiButton>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    {questionResult ? (
                      <div className="contextEnginePrototype__tryResult">
                        {questionResult.kind === 'hit' ? (
                          <>
                            <EuiText size="s">
                              <p>{questionResult.answer}</p>
                            </EuiText>
                            <EuiSpacer size="xs" />
                            <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false} wrap>
                              <EuiFlexItem grow={false}>
                                <EuiText size="s">
                                  <strong>{questionResult.indicator.title}</strong>
                                </EuiText>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false}>
                                <EuiBadge color={typeBadgeColor(questionResult.indicator.type)}>
                                  {typeLabel(questionResult.indicator.type)}
                                </EuiBadge>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false}>
                                <EuiText size="xs" color="subdued">
                                  {indicatorSourceLabel(questionResult.indicator)}
                                </EuiText>
                              </EuiFlexItem>
                            </EuiFlexGroup>
                          </>
                        ) : (
                          <EuiText size="s" color="subdued">
                            <p>No Knowledge Indicator covers this yet.</p>
                          </EuiText>
                        )}
                      </div>
                    ) : null}
                    <EuiSpacer size="s" />
                    <EuiText size="xs" color="subdued">
                      <p>{TRY_CAVEAT}</p>
                    </EuiText>
                    </div>
                  </EuiPanel>
                </>
              ) : null}

              <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
                <div className="contextEnginePrototype__panelHeader">
                  <div className="contextEnginePrototype__panelHeaderText">
                    <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                      <h2>Description</h2>
                    </EuiTitle>
                    {!editIntentOpen && !hasDescription ? (
                      <EuiText size="xs" color="subdued" className="contextEnginePrototype__panelDesc">
                        <p>{DESCRIPTION_EMPTY}</p>
                      </EuiText>
                    ) : null}
                  </div>
                  {canEditPanels ? (
                    <div className="contextEnginePrototype__panelActions">
                      {editIntentOpen
                        ? headerEditButtons(descriptionDirty, saveDescription)
                        : hasDescription
                          ? panelEditLink(() => requestEdit('description'))
                          : panelAddEmpty('+ Add description', () => requestEdit('description'))}
                    </div>
                  ) : null}
                </div>
                {editIntentOpen || hasDescription ? <EuiSpacer size="m" /> : null}
                {editIntentOpen ? (
                  <>
                    <EuiTextArea
                      fullWidth
                      rows={4}
                      placeholder={DESCRIPTION_PLACEHOLDER}
                      value={intentDraft}
                      onChange={(event) => setIntentDraft(event.target.value)}
                      aria-label="Description"
                    />
                    <EuiText
                      size="xs"
                      color="subdued"
                      className="contextEnginePrototype__descriptionHelper"
                    >
                      <p>{DESCRIPTION_HELPER}</p>
                    </EuiText>
                    {SHOW_MEMORY_TOGGLE ? (
                      <>
                        <EuiSpacer size="m" />
                        <MemorySwitch checked={memoryDraft} onChange={setMemoryDraft} />
                      </>
                    ) : null}
                  </>
                ) : namespace.intent ? (
                  <EuiText size="s">
                    <p>{namespace.intent}</p>
                  </EuiText>
                ) : null}
              </EuiPanel>
              <AgentTracesPanel
                traces={tracesEditing ? tracesDraft : namespace.traces ?? []}
                onChange={setTracesDraft}
                improvementsEnabled={FEEDBACK_LOOP_ENABLED && flags.feedbackLoopEnabled}
                accordionId="context-engine-11-detail-traces-esql"
                variant={tracesEditing ? 'editor' : 'view'}
                description={
                  meta?.sample
                    ? 'Not available on sample data.'
                    : tracesEditing
                    ? undefined
                    : hasTraces
                    ? null
                    : TRACES_EMPTY
                }
                actions={
                  !canEditPanels || meta?.sample
                    ? undefined
                    : tracesEditing
                      ? headerEditButtons(tracesDirty, saveTraces)
                      : hasTraces
                        ? panelEditLink(() => requestEdit('traces'))
                        : panelAddEmpty('+ Add traces', () => requestEdit('traces'))
                }
              />
              <EuiPanel
                hasBorder
                paddingSize="l"
                className="contextEnginePrototype__panel"
                panelRef={sourcesPanelRef}
              >
                <div className="contextEnginePrototype__panelHeader">
                  <div className="contextEnginePrototype__panelHeaderText">
                    <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                      <h2>Sources</h2>
                    </EuiTitle>
                    {sourcesEditing ? (
                      <EuiText size="xs" color="subdued" className="contextEnginePrototype__panelDesc">
                        <p>{SOURCES_SUBTITLE}</p>
                      </EuiText>
                    ) : !hasSources ? (
                      <EuiText size="xs" color="subdued" className="contextEnginePrototype__panelDesc">
                        <p>{SOURCES_EMPTY}</p>
                      </EuiText>
                    ) : null}
                  </div>
                  {canEditPanels ? (
                    <div className="contextEnginePrototype__panelActions">
                      {sourcesEditing
                        ? headerEditButtons(sourcesListDirty, saveSourcesEditor)
                        : hasSources
                          ? panelEditLink(() => requestEdit('sources'))
                          : anyEditing
                            ? panelAddEmpty('+ Add sources', () => requestEdit('sources'))
                            : panelAddFilled('+ Add sources', () => requestEdit('sources'))}
                    </div>
                  ) : null}
                </div>
                {sourcesEditing ? (
                  <>
                    <EuiSpacer size="m" />
                    <SourcesPicker
                      draft={sourcesDraft}
                      onChange={setSourcesDraft}
                      accordionId="context-engine-11-edit-esql"
                    />
                  </>
                ) : hasSources ? (
                  <>
                    <EuiSpacer size="m" />
                    {namespace.sources.map((source) => (
                      <div key={source.id} className="contextEnginePrototype__row">
                        <EuiIcon type={source.icon} size="m" />
                        <div className="contextEnginePrototype__rowMain">
                          <EuiText size="s">
                            <strong>
                              {source.typeLabel === 'ES|QL' && source.subtitle
                                ? source.subtitle
                                : source.name}
                            </strong>
                          </EuiText>
                          {meta && !sourcesWithIndicators.has(source.name) ? (
                            <EuiText
                              size="xs"
                              color={
                                sourceHasOutstandingRejections(meta, source.name)
                                  ? 'warning'
                                  : 'subdued'
                              }
                            >
                              <p>No Knowledge Indicators yet</p>
                            </EuiText>
                          ) : null}
                        </div>
                        <EuiBadge color="hollow">{sourceTypeLabel(source)}</EuiBadge>
                      </div>
                    ))}
                  </>
                ) : null}
              </EuiPanel>
              {automationsLocked ? (
                <EuiPanel
                  hasBorder
                  color="subdued"
                  paddingSize="l"
                  className="contextEnginePrototype__panel contextEnginePrototype__automationsLocked"
                  panelRef={automationsPanelRef}
                >
                  <div className="contextEnginePrototype__automationsLockedTitle">
                    <EuiIcon type="lock" size="m" color="subdued" aria-label="Locked" />
                    <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                      <h2>Automations</h2>
                    </EuiTitle>
                  </div>
                  <EuiText size="s" color="subdued" className="contextEnginePrototype__panelDesc">
                    <p>{AUTOMATIONS_LOCKED_MESSAGE}</p>
                  </EuiText>
                </EuiPanel>
              ) : (
                <EuiPanel
                  hasBorder
                  paddingSize="l"
                  className="contextEnginePrototype__panel"
                  panelRef={automationsPanelRef}
                >
                  <div className="contextEnginePrototype__panelHeader">
                    <div className="contextEnginePrototype__panelHeaderText">
                      <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                        <h2 className="contextEnginePrototype__automationsHeading">
                          Automations
                          {namespace.automations.length > 0 ? (
                            <EuiNotificationBadge color="subdued">
                              {namespace.automations.length}
                            </EuiNotificationBadge>
                          ) : null}
                        </h2>
                      </EuiTitle>
                      <EuiText
                        size={hasAutomations ? 's' : 'xs'}
                        color="subdued"
                        className="contextEnginePrototype__panelDesc"
                      >
                        <p>{AUTOMATIONS_EMPTY}</p>
                      </EuiText>
                    </div>
                    {canEditPanels ? (
                      <div className="contextEnginePrototype__panelActions">
                        {suggestReason ? <DisabledReason>{suggestReason}</DisabledReason> : null}
                        {addAutomationButton(
                          anyEditing ? 'empty' : hasAutomations ? 'button' : 'fill'
                        )}
                      </div>
                    ) : null}
                  </div>
                  {hasAutomations ? <EuiSpacer size="m" /> : null}
                  {hasAutomations ? (
                    namespace.automations.map((automation) => (
                      <div key={automation.id} className="contextEnginePrototype__automationCard">
                        <div className="contextEnginePrototype__automationCardTop">
                          <EuiTitle size="xs" className="contextEnginePrototype__automationCardTitle">
                            <h3>
                              {meta && automation.templateId ? (
                                <EuiIcon
                                  type="bolt"
                                  size="m"
                                  aria-hidden={true}
                                  className="contextEnginePrototype__automationTitleIcon"
                                />
                              ) : null}
                              {automation.title}
                            </h3>
                          </EuiTitle>
                          <div className="contextEnginePrototype__automationCardMeta">
                            {meta && automation.templateId ? (
                              <EuiBadge color={proto11StatusPill(automation, namespace).color}>
                                {proto11StatusPill(automation, namespace).label}
                              </EuiBadge>
                            ) : (
                              <EuiBadge color={automation.enabled ? 'success' : 'hollow'}>
                                {automation.enabled ? 'Enabled' : 'Disabled'}
                              </EuiBadge>
                            )}
                            <EuiPopover
                              button={
                                <EuiButtonEmpty
                                  size="s"
                                  iconType="arrowDown"
                                  iconSide="right"
                                  onClick={() => {
                                    setAutomationsAddOpen(false);
                                    setAutomationsMenuOpen((current) =>
                                      current === automation.id ? null : automation.id
                                    );
                                  }}
                                >
                                  Edit automation
                                </EuiButtonEmpty>
                              }
                              isOpen={automationsMenuOpen === automation.id}
                              closePopover={() => setAutomationsMenuOpen(null)}
                              panelPaddingSize="none"
                              anchorPosition="downRight"
                            >
                              <EuiContextMenuPanel
                                size="s"
                                items={[
                                  <EuiContextMenuItem
                                    key="refine"
                                    icon="productAgent"
                                    onClick={() => {
                                      setAutomationsMenuOpen(null);
                                      openRefineAutomation(namespace, automation);
                                    }}
                                  >
                                    Refine with agent
                                  </EuiContextMenuItem>,
                                  <EuiContextMenuItem
                                    key="edit-workflow"
                                    icon="popout"
                                    href={workflowsHref}
                                    target="_blank"
                                    onClick={() => setAutomationsMenuOpen(null)}
                                  >
                                    Edit workflow
                                  </EuiContextMenuItem>,
                                  <EuiContextMenuItem
                                    key="run-now"
                                    icon="play"
                                    onClick={() => {
                                      setAutomationsMenuOpen(null);
                                      replaceNamespace({
                                        ...namespace,
                                        automations: namespace.automations.map((item) =>
                                          item.id === automation.id
                                            ? { ...item, hasRun: true, lastRunAt: relativeNow() }
                                            : item
                                        ),
                                        lastSuccessfulRun: {
                                          name: automation.title,
                                          when: relativeNow(),
                                        },
                                        updated: relativeNow(),
                                      });
                                      coreStart.notifications.toasts.addSuccess(
                                        `Started ${automation.title}`
                                      );
                                    }}
                                  >
                                    Run now
                                  </EuiContextMenuItem>,
                                  <div
                                    key="divider"
                                    role="separator"
                                    className="contextEnginePrototype__menuDivider"
                                  />,
                                  <EuiContextMenuItem
                                    key="toggle"
                                    icon={automation.enabled ? 'pause' : 'playFilled'}
                                    color={automation.enabled ? 'danger' : undefined}
                                    onClick={() => {
                                      setAutomationsMenuOpen(null);
                                      replaceNamespace({
                                        ...namespace,
                                        automations: namespace.automations.map((item) =>
                                          item.id === automation.id
                                            ? { ...item, enabled: !item.enabled }
                                            : item
                                        ),
                                      });
                                    }}
                                  >
                                    {automation.enabled ? 'Disable' : 'Enable'}
                                  </EuiContextMenuItem>,
                                  <EuiContextMenuItem
                                    key="delete"
                                    icon="trash"
                                    color="danger"
                                    onClick={() => {
                                      setAutomationsMenuOpen(null);
                                      setPendingDelete({
                                        namespaceName: namespace.name,
                                        automation,
                                      });
                                    }}
                                  >
                                    Delete
                                  </EuiContextMenuItem>,
                                ]}
                              />
                            </EuiPopover>
                          </div>
                        </div>
                        <EuiText size="xs" color="subdued">
                          <p>
                            {meta && automation.templateId
                              ? proto11AddedLine(automation, namespace)
                              : automationAddedLine(automation)}
                          </p>
                        </EuiText>
                        {meta && automation.templateId === meta.runTemplates[0] ? (
                          <Proto11RejectedNotice
                            meta={meta}
                            onFix={() => setFixFlyoutFor(namespace.name)}
                          />
                        ) : null}
                        <EuiText size="s">
                          <p>{automation.description}</p>
                        </EuiText>
                        {meta && automation.derivation ? (
                          <EuiText size="xs" color="subdued">
                            <p>{automation.derivation}</p>
                          </EuiText>
                        ) : null}
                        <div className="contextEnginePrototype__automationIo">
                          <span className="contextEnginePrototype__automationIoLabel">Reads</span>
                          {automation.reads.length > 0 ? (
                            automation.reads.map((source) => (
                              <EuiBadge key={source} color="hollow">
                                {source}
                              </EuiBadge>
                            ))
                          ) : (
                            <EuiBadge color="hollow">No sources</EuiBadge>
                          )}
                          <EuiIcon type="arrowRight" size="s" color="subdued" />
                          <span className="contextEnginePrototype__automationIoLabel">Produces</span>
                          {meta && automation.producesCount === 0 && !automation.hasRun ? (
                            <EuiBadge color="hollow">No Knowledge Indicators yet</EuiBadge>
                          ) : (
                            <EuiBadge color="hollow">
                              {automation.producesCount}{' '}
                              {automation.producesCount === 1
                                ? 'Knowledge Indicator'
                                : 'Knowledge Indicators'}
                            </EuiBadge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : null}
                </EuiPanel>
              )}
              {meta ? (
                <Proto11ConnectedAgentsPanel
                  namespaceName={namespace.name}
                  agents={connectedAgents}
                  editing={agentsEditing}
                  draft={agentsDraft}
                  onDraftChange={setAgentsDraft}
                  agentBuilderHref={coreStart.http.basePath.prepend('/app/agent_builder')}
                  actions={connectAgentActions()}
                />
              ) : null}
            </div>
          ) : effectiveTab === 'knowledge' ? (
            <KnowledgeTab
              namespace={namespace}
              discoverHref={coreStart.http.basePath.prepend('/app/discover')}
              workflowsHref={coreStart.http.basePath.prepend('/app/workflows')}
              onOpenAutomation={setPreviewAutomation}
              onOpenSources={goToSources}
              onCreateAutomation={goToAutomations}
              onViewAutomation={() => {
                setDetailTab('overview');
                setPendingAutomationsScroll(true);
                if (namespace.automations.length === 1) {
                  setPreviewAutomation(namespace.automations[0]);
                }
              }}
              onReplaceIndicator={(next) => replaceKnowledgeIndicator(namespace.name, next)}
              sharedDestinationNote={flags.sharedDestinationKis}
              groupedBySource={proto11On}
              proto11={
                meta
                  ? {
                      sample: Boolean(meta.sample),
                      checkEnabled: true,
                      lookedAt: meta.lookedAt,
                      checkHidden: meta.checkHidden,
                      onLookedAt: (id) =>
                        updateProto11Meta(namespace.name, {
                          lookedAt: [...meta.lookedAt.filter((item) => item !== id), id],
                        }),
                      onHideCheck: () => updateProto11Meta(namespace.name, { checkHidden: true }),
                      testQuestion: (
                        <Proto11TestQuestion key={namespace.name} namespace={namespace} />
                      ),
                    }
                  : undefined
              }
            />
          ) : null}
        </PageBody>
        {meta && fixFlyoutFor === namespace.name ? (
          <Proto11FixFlyout
            namespace={namespace}
            meta={meta}
            onClose={() => setFixFlyoutFor(null)}
            onRerun={() => {
              setFixFlyoutFor(null);
              updateProto11Namespace(namespace.name, startRerun);
            }}
          />
        ) : null}
        {pendingPanelSwitch && activeEditPanel ? (
          <EuiConfirmModal
            title={`Discard changes to ${EDITABLE_PANEL_LABEL[activeEditPanel]}?`}
            onCancel={() => setPendingPanelSwitch(null)}
            onConfirm={() => {
              const next = pendingPanelSwitch;
              setPendingPanelSwitch(null);
              closeActiveEditor();
              openEditor(next);
            }}
            cancelButtonText="Keep editing"
            confirmButtonText="Discard"
            buttonColor="danger"
          />
        ) : null}
      </>
    );
  };

  const liveNamespace =
    activeNamespace && namespaces.find((item) => item.name === activeNamespace.name);

  const renderAgentFlyout = (namespace: Namespace) => {
    if (!agentOpen || !agent) return null;
    const canSend = agent.phase === 'compose' && agent.composer.trim().length > 0;
    return (
      <EuiFlyout
        ownFocus
        onClose={closeAgent}
        size="m"
        aria-labelledby="context-agent-flyout-title"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiTitle size="s">
            <h2 id="context-agent-flyout-title">AI Agent</h2>
          </EuiTitle>
          <EuiSpacer size="s" />
          <span className="contextEnginePrototype__agentChip">
            <EuiIcon type={TABLE_SPARKLES_TYPE} size="s" />
            <EuiText size="xs">
              <span>{namespace.displayName}</span>
            </EuiText>
          </span>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          {agent.sentMessage ? (
            <div className="contextEnginePrototype__agentUserTurn">
              <EuiText size="s">
                <p>{agent.sentMessage}</p>
              </EuiText>
              <div className="contextEnginePrototype__agentAttachChip">
                Added:{' '}
                <EuiIcon type="document" size="s" />
                AI index {namespace.displayName}
              </div>
            </div>
          ) : null}
          {agent.phase === 'compose' ? (
            namespace.sources.length === 0 ? (
              <EuiText size="s">
                <p>
                  Add a source to this AI index first.{' '}
                  <EuiLink
                    onClick={() => {
                      closeAgent();
                      setDetailTab('overview');
                      requestEditRef.current('sources');
                    }}
                  >
                    Open Sources
                  </EuiLink>
                </p>
              </EuiText>
            ) : (
              <div className="contextEnginePrototype__agentChips">
                {suggestionChipsFor(namespace).map((chip) => (
                  <EuiButton
                    key={chip}
                    size="s"
                    onClick={() =>
                      setAgent((current) => (current ? { ...current, composer: chip } : current))
                    }
                  >
                    {chip}
                  </EuiButton>
                ))}
              </div>
            )
          ) : null}
          {agent.phase === 'streaming' || agent.phase === 'confirm' ? (
            <>
              {agent.toolLines.map((line) => (
                <div key={line} className="contextEnginePrototype__toolCall">
                  <EuiLoadingSpinner size="s" />
                  <EuiText size="s" color="subdued">
                    {line}
                  </EuiText>
                </div>
              ))}
              {agent.phase === 'confirm' && agent.draft ? (
                <EuiPanel
                  hasBorder
                  paddingSize="m"
                  className="contextEnginePrototype__agentConfirmCard"
                >
                  <EuiTitle size="xs">
                    <h3>Save this automation?</h3>
                  </EuiTitle>
                  <EuiSpacer size="s" />
                  <EuiText size="s">
                    <p>{agent.draft.title}</p>
                  </EuiText>
                  <EuiSpacer size="m" />
                  <EuiFlexGroup justifyContent="flexEnd" gutterSize="s" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiButtonEmpty onClick={closeAgent}>Cancel</EuiButtonEmpty>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButton fill onClick={() => saveAndAttach(namespace)}>
                        Save and run
                      </EuiButton>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              ) : null}
            </>
          ) : null}
          {agent.phase === 'added' || agent.phase === 'running' || agent.phase === 'result' || agent.phase === 'empty' ? (
            <>
              <EuiText size="s">
                <p>
                  <strong>Added</strong> {agent.draft?.title}
                </p>
              </EuiText>
              <EuiSpacer />
              {agent.phase === 'running' ? (
                <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiLoadingSpinner size="m" />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiText size="s">Running once on a sample.</EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              ) : null}
              {agent.phase === 'result' ? (
                <>
                  <EuiText size="s">
                    <p>
                      Ran once on a sample. {agent.created.length} Knowledge Indicators created.
                    </p>
                  </EuiText>
                  <EuiSpacer size="s" />
                  {(['playbook', 'policy', 'faq', 'glossary', 'fact'] as KnowledgeType[]).map(
                    (type) => {
                    const example = agent.created.find((item) => item.type === type);
                    if (!example) return null;
                    return (
                      <EuiFlexGroup
                        key={example.id}
                        gutterSize="s"
                        alignItems="center"
                        responsive={false}
                        wrap
                      >
                        <EuiFlexItem>
                          <EuiText size="s">{example.title}</EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiBadge color={typeBadgeColor(example.type)}>
                            {typeLabel(example.type)}
                          </EuiBadge>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiText size="xs" color="subdued">
                            {indicatorSourceLabel(example)}
                          </EuiText>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    );
                    }
                  )}
                  <EuiSpacer size="s" />
                  <EuiLink
                    onClick={() => {
                      closeAgent();
                      openDetail(namespace, 'knowledge');
                    }}
                  >
                    View all in Knowledge Indicators
                  </EuiLink>
                </>
              ) : null}
              {agent.phase === 'empty' ? (
                <>
                  <EuiText size="s">
                    <p>The automation ran but produced no Knowledge Indicators.</p>
                  </EuiText>
                  <EuiSpacer size="s" />
                  <EuiButton
                    onClick={() => {
                      const retry: AgentSession = {
                        mode: 'suggest',
                        composer: 'The last run produced no Knowledge Indicators. Refine the automation.',
                        sentMessage: '',
                        phase: 'compose',
                        toolLines: [],
                        draft: null,
                        created: [],
                      };
                      setAgent(retry);
                    }}
                  >
                    Refine with the agent
                  </EuiButton>
                </>
              ) : null}
            </>
          ) : null}
        </EuiFlyoutBody>
        <EuiFlyoutFooter>
          {agent.phase === 'compose' ? (
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem>
                <EuiFieldText
                  inputRef={(el) => {
                    composerRef.current = el;
                  }}
                  fullWidth
                  value={agent.composer}
                  onChange={(event) =>
                    setAgent((current) =>
                      current ? { ...current, composer: event.target.value } : current
                    )
                  }
                  placeholder={
                    agent.mode === 'create'
                      ? 'Describe the automation you want.'
                      : SUGGEST_COMPOSER
                  }
                  aria-label="Message the agent"
                />
              </EuiFlexItem>
              {!canSend ? (
                <EuiFlexItem grow={false}>
                  <DisabledReason>Type something to send</DisabledReason>
                </EuiFlexItem>
              ) : null}
              <EuiFlexItem grow={false}>
                <EuiButton
                  fill
                  isDisabled={!canSend}
                  onClick={() => {
                    const sent = agent.composer.trim();
                    const next = { ...agent, sentMessage: sent, composer: '' };
                    setAgent(next);
                    startAgentStream(namespace, next);
                  }}
                >
                  Send
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : null}
          {agent.phase === 'result' || agent.phase === 'empty' ? (
            <EuiFlexGroup justifyContent="flexEnd">
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={closeAgent}>Close</EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : null}
        </EuiFlyoutFooter>
      </EuiFlyout>
    );
  };

  const renderPreview = () => {
    if (!previewAutomation) return null;
    const workflowsHref = coreStart.http.basePath.prepend('/app/workflows');
    const closePreview = () => setPreviewAutomation(null);
    return (
      <EuiFlyout
        ownFocus
        onClose={closePreview}
        size="l"
        aria-labelledby="workflow-preview-title"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiTitle size="s">
            <h2 id="workflow-preview-title">{previewAutomation.title}</h2>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            <p>{automationMetaLine(previewAutomation)}</p>
          </EuiText>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          <EuiTitle size="xs">
            <h3>What it does</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s">
            <ol className="contextEnginePrototype__whatItDoes">
              {previewAutomation.steps.map(renderAutomationStep)}
            </ol>
          </EuiText>
          <EuiSpacer />
          <EuiTitle size="xs">
            <h3>Key properties</h3>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s">
            <ul>
              {previewAutomation.properties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </EuiText>
          <EuiSpacer />
          <EuiAccordion
            id="workflow-definition"
            buttonContent="View definition"
            initialIsOpen={false}
          >
            <EuiSpacer size="s" />
            <div className="contextEnginePrototype__definition">
              <EuiCodeBlock
                language="yaml"
                fontSize="s"
                paddingSize="m"
                lineNumbers
                isCopyable
                overflowHeight={280}
              >
                {previewAutomation.yaml}
              </EuiCodeBlock>
            </div>
          </EuiAccordion>
          <EuiSpacer />
          <EuiText size="s" color="subdued">
            <p>Run this automation from the Workflows page.</p>
          </EuiText>
        </EuiFlyoutBody>
        <EuiFlyoutFooter>
          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={closePreview}>Close</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton iconType="popout" iconSide="right" href={workflowsHref} target="_blank">
                Open in Workflows
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlyoutFooter>
      </EuiFlyout>
    );
  };

  const screenContent = (() => {
    if (screen === 'create') return renderCreate();
    if (screen === 'detail' && liveNamespace) return renderDetail(liveNamespace);
    return renderLanding();
  })();

  return (
    <KibanaRenderContextProvider {...coreStart}>
      <EuiPageTemplate offset={0} grow className="contextEnginePrototype">
        {screenContent}
        <div className="contextEnginePrototype__demoState">
          <EuiText size="xs" color="subdued" className="contextEnginePrototype__demoStateLabel">
            Demo state
          </EuiText>
          <EuiSelect
            compressed
            options={[
              ...(proto11On ? [{ value: 'empty', text: 'Empty' }] : []),
              { value: 'learning', text: 'Learning' },
              { value: 'working', text: 'Working' },
            ]}
            value={!proto11On && flags.catalogState === 'empty' ? 'learning' : flags.catalogState}
            onChange={(event) => setDemoCatalogState(event.target.value as CatalogDemoState)}
            aria-label="Demo state"
          />
        </div>
        <div className="contextEnginePrototype__demoState contextEnginePrototype__demoState--proto11">
          <EuiText size="xs" color="subdued" className="contextEnginePrototype__demoStateLabel">
            Proto 11
          </EuiText>
          <EuiSelect
            compressed
            options={[
              { value: 'off', text: 'Off' },
              { value: 'on', text: 'On' },
            ]}
            value={flags.proto11Setup ? 'on' : 'off'}
            onChange={(event) => setDemoProto11Setup(event.target.value === 'on')}
            aria-label="Proto 11"
            data-test-subj="proto11Switcher"
          />
        </div>
        {liveNamespace ? renderAgentFlyout(liveNamespace) : null}
        {renderPreview()}
        {pendingDelete ? (
          <EuiConfirmModal
            title={`Do you want to remove the ${pendingDelete.automation.title} automation?`}
            onCancel={() => setPendingDelete(null)}
            onConfirm={confirmDeleteAutomation}
            cancelButtonText="Cancel"
            confirmButtonText="Remove"
            buttonColor="danger"
          />
        ) : null}
        {pendingDeleteIndex ? (
          <EuiConfirmModal
            title={`Delete ${pendingDeleteIndex.displayName}?`}
            onCancel={() => setPendingDeleteIndex(null)}
            onConfirm={confirmDeleteIndex}
            cancelButtonText="Cancel"
            confirmButtonText="Delete AI index"
            buttonColor="danger"
          >
            <EuiText>
              <p>This permanently deletes:</p>
              <ul>
                {pendingDeleteIndex.indicators.length > 0 ? (
                  <li>
                    {pendingDeleteIndex.indicators.length === 1
                      ? '1 Knowledge Indicator'
                      : `${pendingDeleteIndex.indicators.length} Knowledge Indicators`}
                  </li>
                ) : null}
                {pendingDeleteIndex.automations.length > 0 ? (
                  <li>
                    {pendingDeleteIndex.automations.length === 1
                      ? '1 automation'
                      : `${pendingDeleteIndex.automations.length} automations`}
                  </li>
                ) : null}
                <li>
                  the backing index{' '}
                  <EuiCode>
                    {backingIndexName(pendingDeleteIndex.name)}
                  </EuiCode>
                </li>
              </ul>
              <p>
                Connected agents will stop retrieving from this index. Your source data is not
                affected.
              </p>
            </EuiText>
          </EuiConfirmModal>
        ) : null}
        {useInAgentNamespace ? (
          <EuiFlyout
            ownFocus
            size="s"
            onClose={() => setUseInAgentNamespace(null)}
            aria-labelledby="context-engine-11-use-in-agent-title"
          >
            <EuiFlyoutHeader hasBorder>
              <EuiTitle size="s">
                <h2 id="context-engine-11-use-in-agent-title">
                  Connect {useInAgentNamespace.displayName} to your agent
                </h2>
              </EuiTitle>
            </EuiFlyoutHeader>
            <EuiFlyoutBody>
              {useInAgentNamespace.managed || integrationLabel(useInAgentNamespace) !== 'Not connected' ? (
                <EuiText>
                  <p>Elastic AI Agent retrieves from this index.</p>
                </EuiText>
              ) : (
                <EuiText>
                  <p>
                    Not connected yet. Enable {useInAgentNamespace.displayName} for Elastic AI Agent
                    in Agent Builder, then it can retrieve from this index in chat.
                  </p>
                </EuiText>
              )}
            </EuiFlyoutBody>
            <EuiFlyoutFooter>
              <EuiFlexGroup justifyContent="flexEnd" gutterSize="s">
                <EuiFlexItem grow={false}>
                  <EuiButtonEmpty onClick={() => setUseInAgentNamespace(null)}>Close</EuiButtonEmpty>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButton
                    fill
                    onClick={() => {
                      const namespace = useInAgentNamespace;
                      setUseInAgentNamespace(null);
                      if (plugins.agentBuilder?.openChat) {
                        plugins.agentBuilder.openChat({
                          newConversation: true,
                          initialMessage: '',
                          autoSendInitialMessage: false,
                          attachments: [
                            {
                              type: 'group',
                              id: `ai-index-${namespace.name}`,
                              label: namespace.displayName,
                              items: [
                                {
                                  type: 'text',
                                  data: {
                                    content:
                                      `AI index ${namespace.displayName}. ${namespace.intent}`.trim(),
                                  },
                                  description: namespace.displayName,
                                },
                              ],
                            },
                          ],
                        });
                        return;
                      }
                      document
                        .querySelector<HTMLButtonElement>(
                          '[data-test-subj="AgentBuilderNavControlButton"], [data-test-subj="AgentBuilderNavControlButtonIcon"]'
                        )
                        ?.click();
                    }}
                  >
                    {useInAgentNamespace.managed ||
                    integrationLabel(useInAgentNamespace) !== 'Not connected'
                      ? 'Open in chat'
                      : 'Enable in Agent Builder'}
                  </EuiButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlyoutFooter>
          </EuiFlyout>
        ) : null}
      </EuiPageTemplate>
    </KibanaRenderContextProvider>
  );
}

export const renderApp = (
  coreStart: CoreStart,
  plugins: AppPluginStartDependencies,
  { element }: Pick<AppMountParameters, 'element' | 'history'>
) => {
  ReactDOM.render(
    <ContextEngineApp coreStart={coreStart} plugins={plugins} />,
    element
  );
  return () => ReactDOM.unmountComponentAtNode(element);
};
