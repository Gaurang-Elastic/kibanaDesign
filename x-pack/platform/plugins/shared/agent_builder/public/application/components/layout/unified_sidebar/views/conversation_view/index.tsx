/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiPanel,
  EuiSpacer,
  EuiText,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';

import { i18n } from '@kbn/i18n';
import { agentBuilderDefaultAgentId, AGENT_BUILDER_UI_EBT } from '@kbn/agent-builder-common';
import { getEbtProps } from '@kbn/ebt-click';
import { appPaths } from '../../../../../utils/app_paths';
import {
  getAgentIdFromPath,
  getAgentSettingsNavItems,
  getConversationIdFromPath,
} from '../../../../../route_config';
import { useRouteAccessConfig } from '../../../../../hooks/use_route_access_config';
import { useNavigation } from '../../../../../hooks/use_navigation';
import { useValidateAgentId } from '../../../../../hooks/agents/use_validate_agent_id';
import { useAgentBuilderAgents } from '../../../../../hooks/agents/use_agents';
import { useAgentBuilderAgentById } from '../../../../../hooks/agents/use_agent_by_id';
import { useLastAgentId } from '../../../../../hooks/use_last_agent_id';
import { useConversationList } from '../../../../../hooks/use_conversation_list';
import { useStreamingContext } from '../../../../../context/streaming/streaming_context';
import { isContextEngineAgent } from '../../../../../utils/is_context_engine_agent';
import { SidebarNavList } from '../../shared/sidebar_nav_list';

import { ConversationFooter } from './conversation_footer';
import { ConversationList } from './conversation_list';
import { ConversationSearchModal } from '../../../../conversations/conversation_search_modal';

const customizeLabel = i18n.translate('xpack.agentBuilder.sidebar.conversation.customize', {
  defaultMessage: 'Customize',
});

const newLabel = i18n.translate('xpack.agentBuilder.sidebar.conversation.new', {
  defaultMessage: 'New',
});

const searchLabel = i18n.translate('xpack.agentBuilder.sidebar.conversation.search', {
  defaultMessage: 'Search',
});

const searchChatsAriaLabel = i18n.translate('xpack.agentBuilder.sidebar.conversation.searchChats', {
  defaultMessage: 'Search chats',
});

const chatsLabel = i18n.translate('xpack.agentBuilder.sidebar.conversation.chats', {
  defaultMessage: 'Chats',
});

const conversationListScrollRegionLabel = i18n.translate(
  'xpack.agentBuilder.sidebar.conversation.conversationListScrollRegion',
  {
    defaultMessage: 'Conversation list',
  }
);

export const ConversationSidebarView: React.FC = () => {
  const { pathname, search } = useLocation();
  const agentId = getAgentIdFromPath(pathname) ?? agentBuilderDefaultAgentId;
  const conversationId = getConversationIdFromPath(pathname);
  const { euiTheme } = useEuiTheme();
  const { navigateToAgentBuilderUrl } = useNavigation();
  const validateAgentId = useValidateAgentId();
  const { isFetched: isAgentsFetched } = useAgentBuilderAgents();
  const { agent } = useAgentBuilderAgentById(agentId);
  const lastAgentId = useLastAgentId();
  const routeAccessConfig = useRouteAccessConfig();

  const { conversations = [] } = useConversationList({ agentId });
  const hasConversations = conversations.length > 0;
  const { removeAllErrors, removeError } = useStreamingContext();

  const isNewConversationRoute =
    conversationId === 'new' || pathname === appPaths.agent.root({ agentId });

  const contextEngineMode = isContextEngineAgent({ agentId, agentName: agent?.name, search });
  const overviewPath = appPaths.agent.overview({ agentId });
  const isConversationRoute = Boolean(conversationId) || pathname === appPaths.agent.root({ agentId });

  const navItems = useMemo(() => {
    const baseItems = getAgentSettingsNavItems(agentId, routeAccessConfig);
    if (!contextEngineMode) {
      return baseItems;
    }
    return baseItems.map((item) => ({
      ...item,
      path: `${item.path}?concept=1&ce_setup=1`,
    }));
  }, [agentId, routeAccessConfig, contextEngineMode]);

  const isActive = (path: string) =>
    pathname === path.split('?')[0] ||
    (contextEngineMode && isConversationRoute && path.split('?')[0] === overviewPath);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const sectionLabelCss = useMemo(
    () => css`
      padding: ${euiTheme.size.xs} ${euiTheme.size.s};
    `,
    [euiTheme]
  );

  useEffect(() => {
    // Once agents have loaded, redirect to the last valid agent if the current agent ID
    // is not recognised — but only when there is no conversation ID in the URL (new
    // conversation route). Existing conversations for a deleted agent are intentionally
    // shown read-only with the input disabled.

    // We also check that lastAgentId itself is valid before redirecting: if local storage
    // holds a stale/invalid ID too, navigating to it would trigger this effect again and
    // cause an infinite redirect loop.
    const shouldTreatAsNewConversation = !conversationId || conversationId === 'new';
    if (
      isAgentsFetched &&
      shouldTreatAsNewConversation &&
      !validateAgentId(agentId) &&
      validateAgentId(lastAgentId)
    ) {
      navigateToAgentBuilderUrl(appPaths.agent.root({ agentId: lastAgentId }));
    }
  }, [
    isAgentsFetched,
    conversationId,
    agentId,
    lastAgentId,
    validateAgentId,
    navigateToAgentBuilderUrl,
  ]);

  const handlePressNewConversation = () => {
    removeAllErrors();
    const currentParams = new URLSearchParams(search);
    const shouldKeepContextEngineSelection =
      contextEngineMode || currentParams.get('ce_agent') === '1';
    if (shouldKeepContextEngineSelection) {
      navigateToAgentBuilderUrl(appPaths.agent.conversations.new({ agentId }), {
        concept: currentParams.get('concept') ?? '1',
        ce_agent: '1',
      });
      return;
    }
    navigateToAgentBuilderUrl(appPaths.agent.conversations.new({ agentId }));
  };

  const handleConversationItemClick = (clickedConversationId: string) => {
    removeError(clickedConversationId);
  };

  return (
    <EuiFlexGroup
      direction="column"
      gutterSize="none"
      responsive={false}
      data-test-subj="agentBuilderSidebar-conversation"
      className="eui-fullHeight"
    >
      <EuiHorizontalRule margin="none" />

      <EuiFlexItem grow className="eui-fullHeight">
        <EuiFlexGroup
          direction="column"
          gutterSize="none"
          responsive={false}
          className="eui-fullHeight"
        >
          <EuiFlexItem grow className="eui-fullHeight">
            <EuiPanel
              grow
              hasBorder={false}
              hasShadow={false}
              paddingSize="m"
              className="eui-fullHeight"
            >
              <EuiFlexGroup
                direction="column"
                gutterSize="none"
                responsive={false}
                className="eui-fullHeight"
              >
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued" css={sectionLabelCss}>
                    {customizeLabel}
                  </EuiText>
                  <EuiSpacer size="xs" />
                  <SidebarNavList items={navItems} isActive={isActive} />
                </EuiFlexItem>

                <EuiFlexItem grow={false}>
                  <EuiSpacer size="m" />
                </EuiFlexItem>

                <EuiFlexItem grow className="eui-fullHeight">
                  <EuiFlexGroup
                    direction="column"
                    gutterSize="none"
                    responsive={false}
                    className="eui-fullHeight"
                  >
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs" color="subdued" css={sectionLabelCss}>
                        {chatsLabel}
                      </EuiText>
                      <EuiSpacer size="s" />
                    </EuiFlexItem>

                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup gutterSize="s" responsive={false} alignItems="flexStart">
                        <EuiFlexItem grow>
                          <EuiButton
                            fullWidth
                            iconType="plus"
                            size="s"
                            color="text"
                            onClick={handlePressNewConversation}
                            data-test-subj="agentBuilderSidebarNewConversationButton"
                            {...getEbtProps({
                              element: AGENT_BUILDER_UI_EBT.element.sidebar,
                              action:
                                AGENT_BUILDER_UI_EBT.action.conversationList.CONVERSATION_START,
                            })}
                          >
                            {newLabel}
                          </EuiButton>
                        </EuiFlexItem>
                        <EuiFlexItem grow>
                          <EuiButton
                            fullWidth
                            iconType="search"
                            size="s"
                            color="text"
                            aria-label={searchChatsAriaLabel}
                            onClick={() => setIsSearchModalOpen(true)}
                            disabled={!hasConversations}
                            data-test-subj="agentBuilderSidebarSearchChatsButton"
                            {...getEbtProps({
                              element: AGENT_BUILDER_UI_EBT.element.sidebar,
                              action:
                                AGENT_BUILDER_UI_EBT.action.conversationList.CONVERSATION_SEARCH,
                            })}
                          >
                            {searchLabel}
                          </EuiButton>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>

                    <EuiFlexItem grow={false}>
                      <EuiSpacer size="m" />
                    </EuiFlexItem>

                    <EuiFlexItem
                      grow
                      tabIndex={0}
                      role="region"
                      aria-label={conversationListScrollRegionLabel}
                      className="eui-yScroll"
                    >
                      <ConversationList
                        agentId={agentId}
                        currentConversationId={conversationId}
                        isNewConversationRoute={isNewConversationRoute}
                        onItemClick={handleConversationItemClick}
                      />
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <ConversationFooter />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>

      {isSearchModalOpen && (
        <ConversationSearchModal
          agentId={agentId}
          currentConversationId={conversationId}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectConversation={(id) => {
            removeError(id);
            navigateToAgentBuilderUrl(
              appPaths.agent.conversations.byId({ agentId, conversationId: id })
            );
            setIsSearchModalOpen(false);
          }}
        />
      )}
    </EuiFlexGroup>
  );
};
