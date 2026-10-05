/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiCodeBlock,
  EuiCopy,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTitle,
  EuiToolTip,
} from '@elastic/eui';

import { AGENT_BUILDER_AGENTS } from './proto11_data';
import type { ConnectedAgent, Proto11ConnectGuide } from './proto11_types';
import { TRACES_DOCS_HREF } from './traces_panel';

type OutsideTab = 'mcp' | 'api' | 'plugin';

const OUTSIDE_TABS: Array<{ id: OutsideTab; label: string }> = [
  { id: 'mcp', label: 'MCP' },
  { id: 'api', label: 'API' },
  { id: 'plugin', label: 'Claude Code plugin' },
];

const outsideSnippet = (
  tab: OutsideTab,
  namespaceName: string
): { intro: string; language: string; code: string } => {
  if (tab === 'mcp') {
    return {
      intro: `Add this server to any MCP client. Your agent gets the Context tools for ${namespaceName}.`,
      language: 'json',
      code: JSON.stringify(
        {
          mcpServers: {
            'elastic-context': {
              type: 'http',
              url: 'https://<your-kibana>/api/agent_builder/mcp',
              headers: { Authorization: 'ApiKey <your-api-key>' },
            },
          },
        },
        null,
        2
      ),
    };
  }
  if (tab === 'api') {
    return {
      intro:
        'Call the retrieve endpoint from your own code. It returns the Knowledge Indicators that answer the question.',
      language: 'bash',
      code: [
        `curl -X POST "https://<your-kibana>/api/context/ai_indices/${namespaceName}/_retrieve" \\`,
        '  -H "Authorization: ApiKey <your-api-key>" \\',
        '  -H "Content-Type: application/json" \\',
        '  -H "kbn-xsrf: true" \\',
        `  -d '{ "question": "<your question>" }'`,
      ].join('\n'),
    };
  }
  return {
    intro:
      'Install the plugin in Claude Code. It adds the Context tools and points them at this AI index.',
    language: 'bash',
    code: [
      'claude plugin install elastic-context',
      `export ELASTIC_CONTEXT_INDEX="${namespaceName}"`,
      'export KIBANA_URL="https://<your-kibana>"',
      'export KIBANA_API_KEY="<your-api-key>"',
    ].join('\n'),
  };
};

const AgentRow = ({
  agent,
  saved,
  agentBuilderHref,
  onRemove,
}: {
  agent: ConnectedAgent;
  saved: boolean;
  agentBuilderHref: string;
  onRemove?: () => void;
}) => (
  <div className="contextEnginePrototype__row" data-test-subj="proto11ConnectedAgentRow">
    <EuiIcon type="productAgent" size="m" aria-hidden={true} />
    <div className="contextEnginePrototype__rowMain">
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiText size="s">
            <strong>{agent.name}</strong>
          </EuiText>
        </EuiFlexItem>
        {agent.sample ? (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">Sample</EuiBadge>
          </EuiFlexItem>
        ) : null}
        {saved ? (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">Context tools active</EuiBadge>
          </EuiFlexItem>
        ) : null}
      </EuiFlexGroup>
      <EuiText size="xs" color="subdued">
        <p>
          {!saved
            ? 'Context tools are added when you save'
            : agent.lastRetrieval
            ? `Last retrieval: ${agent.lastRetrieval}`
            : 'No retrievals yet'}
        </p>
      </EuiText>
    </div>
    {onRemove ? (
      <EuiToolTip content={`Remove ${agent.name}`} disableScreenReaderOutput>
        <EuiButtonIcon iconType="cross" aria-label={`Remove ${agent.name}`} onClick={onRemove} />
      </EuiToolTip>
    ) : (
      <EuiLink href={agentBuilderHref} target="_blank">
        Open in Agent Builder
      </EuiLink>
    )}
  </div>
);

const PromptBlock = ({ prompt }: { prompt: string }) => (
  <div data-test-subj="proto11ConnectPrompt">
    <EuiText size="s">
      <p>Prompt to add to your agent</p>
    </EuiText>
    <EuiSpacer size="s" />
    <EuiCodeBlock language="markdown" fontSize="s" paddingSize="m">
      {prompt}
    </EuiCodeBlock>
    <EuiSpacer size="s" />
    <EuiCopy textToCopy={prompt}>
      {(copy) => (
        <EuiButtonEmpty
          size="s"
          iconType="copy"
          onClick={copy}
          data-test-subj="proto11ConnectPromptCopy"
        >
          Copy
        </EuiButtonEmpty>
      )}
    </EuiCopy>
  </div>
);

const PendingAgentRow = ({ name }: { name: string }) => (
  <div className="contextEnginePrototype__row" data-test-subj="proto11ConnectPendingRow">
    <EuiIcon type="productAgent" size="m" aria-hidden={true} />
    <div className="contextEnginePrototype__rowMain">
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiText size="s">
            <strong>{name}</strong>
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">Will use this index</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="xs" color="subdued">
        <p>{name} will retrieve from this index as soon as the first pass finishes.</p>
      </EuiText>
    </div>
  </div>
);

/** Proto 11 overview panel: which agents retrieve from this AI index, and how to connect more. */
export const Proto11ConnectedAgentsPanel = ({
  namespaceName,
  agents,
  editing,
  draft,
  onDraftChange,
  actions,
  agentBuilderHref,
  guide,
  onSaveGuide,
  onDismissGuide,
}: {
  namespaceName: string;
  agents: ConnectedAgent[];
  editing: boolean;
  draft: ConnectedAgent[];
  onDraftChange: (next: ConnectedAgent[]) => void;
  actions?: React.ReactNode;
  agentBuilderHref: string;
  guide?: Proto11ConnectGuide;
  onSaveGuide?: (agentName: string) => void;
  onDismissGuide?: () => void;
}) => {
  const [outside, setOutside] = useState(false);
  const [tab, setTab] = useState<OutsideTab>('mcp');
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState('');

  useEffect(() => {
    setOutside(false);
    setTab('mcp');
  }, [editing]);

  const savedNames = agents.map((agent) => agent.name);
  const available = AGENT_BUILDER_AGENTS.filter(
    (name) => !draft.some((agent) => agent.name === name)
  );
  const snippet = outsideSnippet(tab, namespaceName);
  const guideAgentName = guide?.mode === 'agent' ? guide.agentName ?? '' : picked;

  const renderGuide = () => {
    if (!guide) return null;
    if (guide.mode === 'agent' && guide.agentName) {
      return (
        <div data-test-subj="proto11ConnectGuide">
          <PendingAgentRow name={guide.agentName} />
          <EuiSpacer size="m" />
          <PromptBlock prompt={guide.prompt} />
          <EuiSpacer size="s" />
          <EuiLink
            href={agentBuilderHref}
            target="_blank"
            data-test-subj="proto11ConnectOpenBuilder"
          >
            Open in Agent Builder
          </EuiLink>
        </div>
      );
    }
    if (picking) {
      return (
        <div data-test-subj="proto11ConnectGuide">
          {picked ? <PendingAgentRow name={picked} /> : null}
          {picked ? <EuiSpacer size="m" /> : null}
          <EuiFormRow label="Agent Builder agent">
            <EuiSelect
              compressed
              hasNoInitialSelection
              options={AGENT_BUILDER_AGENTS.filter((name) => name !== picked).map((name) => ({
                value: name,
                text: name,
              }))}
              value=""
              onChange={(event) => {
                if (event.target.value) setPicked(event.target.value);
              }}
              data-test-subj="proto11ConnectAgentSelect"
            />
          </EuiFormRow>
          {picked ? (
            <>
              <EuiSpacer size="m" />
              <PromptBlock prompt={guide.prompt} />
            </>
          ) : null}
          <EuiSpacer size="s" />
          <EuiLink onClick={() => setPicking(false)}>Connection options</EuiLink>
        </div>
      );
    }
    return (
      <div data-test-subj="proto11ConnectGuide">
        <div data-test-subj="proto11ConnectOutside">
          <EuiTabs size="s">
            {OUTSIDE_TABS.map((item) => (
              <EuiTab
                key={item.id}
                isSelected={tab === item.id}
                onClick={() => setTab(item.id)}
                data-test-subj={`proto11ConnectTab-${item.id}`}
              >
                {item.label}
              </EuiTab>
            ))}
          </EuiTabs>
          <EuiSpacer size="m" />
          <EuiText size="s">
            <p>{snippet.intro}</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiCodeBlock language={snippet.language} fontSize="s" paddingSize="m" isCopyable>
            {snippet.code}
          </EuiCodeBlock>
          <EuiSpacer size="m" />
          <EuiText size="s">
            <p>
              Turn on tracing so Context can learn from this agent.{' '}
              <EuiLink href={TRACES_DOCS_HREF} target="_blank" external>
                Read the docs
              </EuiLink>
            </p>
          </EuiText>
        </div>
        <EuiSpacer size="m" />
        <PromptBlock prompt={guide.prompt} />
        <EuiSpacer size="s" />
        <EuiLink onClick={() => setPicking(true)} data-test-subj="proto11ConnectOrAgent">
          Or connect an agent on Elastic
        </EuiLink>
      </div>
    );
  };

  const renderEditor = () => {
    if (outside) {
      return (
        <div data-test-subj="proto11ConnectOutside">
          <EuiTabs size="s">
            {OUTSIDE_TABS.map((item) => (
              <EuiTab
                key={item.id}
                isSelected={tab === item.id}
                onClick={() => setTab(item.id)}
                data-test-subj={`proto11ConnectTab-${item.id}`}
              >
                {item.label}
              </EuiTab>
            ))}
          </EuiTabs>
          <EuiSpacer size="m" />
          <EuiText size="s">
            <p>{snippet.intro}</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiCodeBlock language={snippet.language} fontSize="s" paddingSize="m" isCopyable>
            {snippet.code}
          </EuiCodeBlock>
          <EuiSpacer size="m" />
          <EuiText size="s">
            <p>
              Turn on tracing so Context can learn from this agent.{' '}
              <EuiLink href={TRACES_DOCS_HREF} target="_blank" external>
                Read the docs
              </EuiLink>
            </p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiLink onClick={() => setOutside(false)}>Back to Agent Builder agents</EuiLink>
        </div>
      );
    }
    return (
      <>
        {draft.map((agent) => (
          <AgentRow
            key={agent.name}
            agent={agent}
            saved={savedNames.includes(agent.name)}
            agentBuilderHref={agentBuilderHref}
            onRemove={() => onDraftChange(draft.filter((item) => item.name !== agent.name))}
          />
        ))}
        <EuiSpacer size="m" />
        {available.length > 0 ? (
          <EuiFormRow label="Agent Builder agent">
            <EuiSelect
              compressed
              hasNoInitialSelection
              options={available.map((name) => ({ value: name, text: name }))}
              value=""
              onChange={(event) => {
                const { value } = event.target;
                if (value) onDraftChange([...draft, { name: value }]);
              }}
              data-test-subj="proto11ConnectAgentSelect"
            />
          </EuiFormRow>
        ) : (
          <EuiText size="s" color="subdued">
            <p>Every Agent Builder agent is connected.</p>
          </EuiText>
        )}
        <EuiSpacer size="s" />
        <EuiLink onClick={() => setOutside(true)} data-test-subj="proto11ConnectUseOutside">
          Use outside Elastic
        </EuiLink>
      </>
    );
  };

  return (
    <EuiPanel
      hasBorder
      paddingSize="l"
      className="contextEnginePrototype__panel"
      data-test-subj="proto11ConnectedAgents"
    >
      <div className="contextEnginePrototype__panelHeader">
        <div className="contextEnginePrototype__panelHeaderText">
          <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
            <h2>Connected agents</h2>
          </EuiTitle>
          <EuiText size="s" color="subdued" className="contextEnginePrototype__panelDesc">
            <p>Agents that retrieve from this AI index.</p>
          </EuiText>
        </div>
        {guide ? (
          <div className="contextEnginePrototype__panelActions">
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiLink onClick={onDismissGuide} data-test-subj="proto11ConnectLater">
                  Later
                </EuiLink>
              </EuiFlexItem>
              {guideAgentName ? (
                <EuiFlexItem grow={false}>
                  <EuiButton
                    size="s"
                    onClick={() => onSaveGuide?.(guideAgentName)}
                    data-test-subj="proto11ConnectGuideSave"
                  >
                    Save
                  </EuiButton>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
          </div>
        ) : actions ? (
          <div className="contextEnginePrototype__panelActions">{actions}</div>
        ) : null}
      </div>
      <EuiSpacer size="m" />
      {guide ? (
        renderGuide()
      ) : editing ? (
        renderEditor()
      ) : agents.length > 0 ? (
        agents.map((agent) => (
          <AgentRow key={agent.name} agent={agent} saved agentBuilderHref={agentBuilderHref} />
        ))
      ) : (
        <EuiText size="s" color="subdued">
          <p>No agents use this AI index yet.</p>
        </EuiText>
      )}
    </EuiPanel>
  );
};
