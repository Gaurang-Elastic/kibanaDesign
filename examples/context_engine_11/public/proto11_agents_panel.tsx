/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with,
 * at your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCheckbox,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiFormRow,
  EuiLink,
  EuiPanel,
  EuiSelect,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import { AGENT_BUILDER_AGENTS } from './proto11_data';
import type { ConnectedAgent } from './proto11_types';

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

/** Read-only list of agents whose AI Indices include this index. */
export const Proto11UsedByPanel = ({
  namespaceName,
  agents,
  canAdd,
  onAdd,
  onOpenSettings,
}: {
  namespaceName: string;
  agents: ConnectedAgent[];
  canAdd: boolean;
  onAdd: () => void;
  onOpenSettings: (name: string) => void;
}) => {
  const [outside, setOutside] = useState(false);
  const [tab, setTab] = useState<OutsideTab>('mcp');
  const snippet = outsideSnippet(tab, namespaceName);

  return (
    <EuiPanel
      hasBorder
      paddingSize="l"
      className="contextEnginePrototype__panel"
      data-test-subj="proto11UsedBy"
    >
      <div className="contextEnginePrototype__panelHeader">
        <div className="contextEnginePrototype__panelHeaderText">
          <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
            <h2>Used by</h2>
          </EuiTitle>
        </div>
        {canAdd ? (
          <div className="contextEnginePrototype__panelActions">
            <EuiButtonEmpty size="s" onClick={onAdd} data-test-subj="proto11AddToAgent">
              Add to an agent
            </EuiButtonEmpty>
          </div>
        ) : null}
      </div>
      <EuiSpacer size="m" />
      {agents.length > 0 ? (
        agents.map((agent) => (
          <div
            key={agent.name}
            className="contextEnginePrototype__row"
            data-test-subj="proto11UsedByRow"
          >
            <div className="contextEnginePrototype__rowMain">
              <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false} wrap>
                <EuiFlexItem grow={false}>
                  <EuiText size="s">
                    <strong>{agent.name}</strong>
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  {agent.connectedNote ? (
                    <EuiText size="s" color="subdued">
                      <span>{agent.connectedNote}</span>
                    </EuiText>
                  ) : (
                    <EuiBadge color="hollow">Context tools active</EuiBadge>
                  )}
                </EuiFlexItem>
              </EuiFlexGroup>
            </div>
            <EuiLink
              color="subdued"
              onClick={() => onOpenSettings(agent.name)}
              data-test-subj="proto11OpenAgentSettings"
            >
              Open agent settings
            </EuiLink>
          </div>
        ))
      ) : (
        <>
          <EuiText size="s">
            <p>No agent uses this AI index yet.</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiLink
            color="subdued"
            onClick={() => setOutside((open) => !open)}
            data-test-subj="proto11UseOutside"
          >
            Use outside Elastic
          </EuiLink>
          {outside ? (
            <div data-test-subj="proto11OutsideSnippets">
              <EuiSpacer size="m" />
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
            </div>
          ) : null}
        </>
      )}
    </EuiPanel>
  );
};

/** Picker, then a mock Agent settings screen with this index already selected. */
export const Proto11AddAgentFlyout = ({
  indexLabel,
  taken,
  agentName,
  onChoose,
  onSave,
  onClose,
}: {
  indexLabel: string;
  taken: string[];
  agentName?: string;
  onChoose: (name: string) => void;
  onSave: (name: string) => void;
  onClose: () => void;
}) => {
  const available = AGENT_BUILDER_AGENTS.filter((name) => !taken.includes(name));
  const checkboxId = `proto11-agent-index-${(agentName ?? 'pick').replace(/[^a-z0-9]+/gi, '-')}`;

  return (
    <EuiFlyout
      ownFocus
      size="s"
      onClose={onClose}
      aria-label={agentName ? `${agentName} settings` : 'Add to an agent'}
      data-test-subj="proto11AddAgentFlyout"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2>{agentName ?? 'Add to an agent'}</h2>
        </EuiTitle>
        {agentName ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s" color="subdued">
              <p>Agent settings</p>
            </EuiText>
          </>
        ) : null}
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        {agentName ? (
          <div data-test-subj="proto11AgentSettings">
            <EuiText size="s">
              <strong>AI Indices</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiCheckbox id={checkboxId} label={indexLabel} checked onChange={() => undefined} />
          </div>
        ) : (
          <EuiFormRow label="Agents on Elastic" fullWidth>
            <EuiSelect
              fullWidth
              hasNoInitialSelection
              options={available.map((name) => ({ value: name, text: name }))}
              value=""
              disabled={available.length === 0}
              onChange={(event) => {
                if (event.target.value) onChoose(event.target.value);
              }}
              aria-label="Agents on Elastic"
              data-test-subj="proto11AgentPicker"
            />
          </EuiFormRow>
        )}
        {!agentName && available.length === 0 ? (
          <>
            <EuiSpacer size="s" />
            <EuiText size="s">
              <p>Every agent on Elastic is connected.</p>
            </EuiText>
          </>
        ) : null}
      </EuiFlyoutBody>
      {agentName ? (
        <EuiFlyoutFooter>
          <EuiFlexGroup justifyContent="flexEnd" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButton
                fill
                onClick={() => onSave(agentName)}
                data-test-subj="proto11AgentSettingsSave"
              >
                Save
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlyoutFooter>
      ) : null}
    </EuiFlyout>
  );
};
