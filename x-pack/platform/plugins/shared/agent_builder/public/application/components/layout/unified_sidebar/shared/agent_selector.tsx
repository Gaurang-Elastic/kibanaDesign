/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';
import { useLocation } from 'react-router-dom';
import useLocalStorage from 'react-use/lib/useLocalStorage';

import { i18n } from '@kbn/i18n';
import { agentBuilderDefaultAgentId, AgentType } from '@kbn/agent-builder-common';

import { useAgentBuilderAgents } from '../../../../hooks/agents/use_agents';
import { storageKeys } from '../../../../storage_keys';
import { useActiveSpaceId } from '../../../../context/active_space_context';
import { isContextEngineAgent } from '../../../../utils/is_context_engine_agent';
import { appPaths } from '../../../../utils/app_paths';
import { AgentSelectorDropdown } from '../../../common/agent_selector/agent_selector_dropdown';

const deletedAgentLabel = i18n.translate('xpack.agentBuilder.sidebar.agentSelector.deletedAgent', {
  defaultMessage: '(Deleted agent)',
});

const contextEngineAgentLabel = i18n.translate(
  'xpack.agentBuilder.sidebar.agentSelector.contextEngineAgent',
  {
    defaultMessage: 'Context Engine Agent',
  }
);

const CONTEXT_ENGINE_AGENT_ID = 'context-engine-agent';
const contextEngineAgentDescription = i18n.translate(
  'xpack.agentBuilder.sidebar.agentSelector.contextEngineAgentDescription',
  {
    defaultMessage:
      'Guided setup flow for creating a shared knowledge layer and publishing Context Engine skills.',
  }
);

interface AgentSelectorProps {
  agentId: string;
  getNavigationPath: (newAgentId: string) => string;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({ agentId, getNavigationPath }) => {
  const { agents, isLoading } = useAgentBuilderAgents();
  const navigate = useNavigate();
  const { search } = useLocation();
  const spaceId = useActiveSpaceId();
  const [, setStoredAgentId] = useLocalStorage<string>(storageKeys.getAgentIdKey(spaceId));
  const queryParams = new URLSearchParams(search);
  const isContextEngineSelected = queryParams.get('ce_agent') === '1';

  const agentsWithContextEngine = useMemo(() => {
    const hasContextEngineAgent = agents.some((agent) => isContextEngineAgent({ agentId: agent.id }));
    if (hasContextEngineAgent) {
      return agents;
    }

    return [
      ...agents,
      {
        id: CONTEXT_ENGINE_AGENT_ID,
        type: AgentType.chat,
        name: contextEngineAgentLabel,
        description: contextEngineAgentDescription,
        readonly: true,
        configuration: {
          tools: [],
        },
      },
    ];
  }, [agents]);

  const contextEngineMode = isContextEngineAgent({ agentId, search }) || isContextEngineSelected;
  const currentAgent = contextEngineMode
    ? agentsWithContextEngine.find((a) => a.id === CONTEXT_ENGINE_AGENT_ID)
    : agentsWithContextEngine.find((a) => a.id === agentId);
  const fallbackLabel =
    !isLoading && !currentAgent
      ? isContextEngineAgent({ agentId, search })
        ? contextEngineAgentLabel
        : deletedAgentLabel
      : undefined;

  const handleAgentChange = useCallback(
    (newAgentId: string) => {
      if (newAgentId === CONTEXT_ENGINE_AGENT_ID) {
        setStoredAgentId(agentBuilderDefaultAgentId);
        navigate(
          `${appPaths.agent.overview({
            agentId: agentBuilderDefaultAgentId,
          })}?concept=1&ce_setup=1&ce_agent=1`
        );
        return;
      }
      setStoredAgentId(newAgentId);
      navigate(getNavigationPath(newAgentId));
    },
    [navigate, setStoredAgentId, getNavigationPath]
  );

  return (
    <AgentSelectorDropdown
      agents={agentsWithContextEngine}
      selectedAgent={currentAgent}
      onAgentChange={handleAgentChange}
      anchorPosition="downLeft"
      fallbackLabel={fallbackLabel}
    />
  );
};
