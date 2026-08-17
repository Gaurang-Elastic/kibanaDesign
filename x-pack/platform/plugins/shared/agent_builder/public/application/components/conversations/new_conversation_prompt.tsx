/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiBadge,
  EuiButtonEmpty,
  EuiButton,
  EuiCheckbox,
  EuiFlexGroup,
  EuiFlexGrid,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiIcon,
  EuiPanel,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import { ConversationInput } from './conversation_input/conversation_input';
import {
  conversationElementPaddingStyles,
  conversationElementWidthStyles,
} from './conversation.styles';
import { useConversationContext } from '../../context/conversation/conversation_context';
import { useAgentId } from '../../hooks/use_conversation';
import { useAgentBuilderAgentById } from '../../hooks/agents/use_agent_by_id';
import { isContextEngineAgent } from '../../utils/is_context_engine_agent';
import { appPaths } from '../../utils/app_paths';
import { useNavigation } from '../../hooks/use_navigation';
import { ContextEngineChat } from '../context_engine';

const titleStyles = css`
  font-weight: 400;
`;

export const NewConversationPrompt: React.FC<{}> = () => {
  const { euiTheme } = useEuiTheme();
  const { isEmbeddedContext } = useConversationContext();
  const agentId = useAgentId();
  const { navigateToAgentBuilderUrl } = useNavigation();
  const { search } = useLocation();
  const { agent } = useAgentBuilderAgentById(agentId);
  const searchParams = new URLSearchParams(search);
  const contextEngineMode = isContextEngineAgent({ agentId, agentName: agent?.name, search });
  const showContextEngineIntro = searchParams.get('ce_agent') === '1' && !contextEngineMode;
  const [showLetsGoResponse, setShowLetsGoResponse] = React.useState(false);

  const centerFlexItemStyles = css`
    justify-content: center;
    align-items: center;
    gap: ${euiTheme.size.base};
  `;

  const inputPaddingStyles = css`
    padding-bottom: ${euiTheme.size.base};
  `;

  const contextEngineIntroPanelStyles = css`
    width: 100%;
    max-width: 820px;
  `;

  const starterChipsRowStyles = css`
    width: 100%;
    max-width: 820px;
  `;

  const starterChipStyles = css`
    border: ${euiTheme.border.thin};
    border-radius: 9999px;
    background: ${euiTheme.colors.emptyShade};
    color: ${euiTheme.colors.textParagraph};
    min-height: 30px;
    padding: 0 ${euiTheme.size.base};
    line-height: 30px;

    &:hover,
    &:focus {
      background: ${euiTheme.colors.emptyShade};
      color: ${euiTheme.colors.textParagraph};
      text-decoration: none;
    }

    .euiButtonEmpty__content {
      gap: 0;
      font-weight: ${euiTheme.font.weight.medium};
    }
  `;

  const mockedResponseShellStyles = css`
    width: 100%;
    max-width: 820px;
  `;

  const mockedResponseHeaderStyles = css`
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: ${euiTheme.font.weight.bold};
    color: ${euiTheme.colors.primaryText};
  `;

  const mockedResponseCardStyles = css`
    border: ${euiTheme.border.thin};
    border-radius: ${euiTheme.border.radius.medium};
    overflow: hidden;
  `;

  const mockedSectionTitleStyles = css`
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: ${euiTheme.font.weight.bold};
    color: ${euiTheme.colors.subduedText};
  `;

  const startConversationFromChip = (starterMessage: string) => {
    const currentParams = new URLSearchParams(search);
    const nextParams: Record<string, string> = {};

    const concept = currentParams.get('concept');
    if (concept) {
      nextParams.concept = concept;
    }

    if (currentParams.get('ce_agent') === '1') {
      nextParams.ce_agent = '1';
    }

    navigateToAgentBuilderUrl(
      appPaths.agent.conversations.new({ agentId }),
      nextParams,
      {
        initialMessage: starterMessage,
        autoSendInitialMessage: true,
      }
    );
  };

  const mockedIndices = [
    { id: 'sales_records', label: 'sales_records', docs: '1.2M docs', fields: '38 fields', type: 'Time series', checked: true },
    { id: 'product_catalog', label: 'product_catalog', docs: '84K docs', fields: '22 fields', type: 'Key-value', checked: true },
    { id: 'customer_profiles', label: 'customer_profiles', docs: '640K docs', fields: '31 fields', type: 'Key-value', checked: true },
    { id: 'support_tickets', label: 'support_tickets', docs: '210K docs', fields: '18 fields', type: 'Text search', checked: false },
    { id: 'web_analytics', label: 'web_analytics', docs: '4.1M docs', fields: '44 fields', type: 'Time series', checked: false },
  ];

  const mockedConnectors = ['Salesforce', 'Slack', 'Confluence', 'Drive', 'Notion', 'GitHub', 'Jira', 'S3'];
  const [selectedMockedIndexIds, setSelectedMockedIndexIds] = React.useState<string[]>(
    mockedIndices.filter((index) => index.checked).map((index) => index.id)
  );

  const toggleMockedIndexSelection = (indexId: string) => {
    setSelectedMockedIndexIds((previous) =>
      previous.includes(indexId) ? previous.filter((id) => id !== indexId) : [...previous, indexId]
    );
  };

  return contextEngineMode ? (
    <ContextEngineChat />
  ) : (
    <EuiFlexGroup
      responsive={false}
      alignItems="center"
      direction="column"
      justifyContent="center"
      gutterSize="l"
      css={conversationElementWidthStyles}
      data-test-subj="agentBuilderWelcomePage"
    >
      <EuiFlexItem grow={isEmbeddedContext ? true : false} css={centerFlexItemStyles}>
        <EuiTitle size="m" css={titleStyles}>
          <h2>
            {i18n.translate('xpack.agentBuilder.conversations.newConversationPrompt', {
              defaultMessage: 'How can I help you?',
            })}
          </h2>
        </EuiTitle>
      </EuiFlexItem>
      {showContextEngineIntro ? (
        <EuiFlexItem
          grow={false}
          css={[conversationElementPaddingStyles, contextEngineIntroPanelStyles]}
        >
          <EuiPanel color="subdued" paddingSize="m" hasShadow={false}>
            <EuiText size="s">
              <p>
                {i18n.translate(
                  'xpack.agentBuilder.conversations.contextEngineIntro.greetingMessage',
                  {
                    defaultMessage:
                      "Hi Gaurang. I'm the Context Engine setup agent. I'll guide you through building a governed knowledge layer for your Elasticsearch data.",
                  }
                )}
              </p>
              <p>
                {i18n.translate('xpack.agentBuilder.conversations.contextEngineIntro.planLabel', {
                  defaultMessage: "Here's the plan:",
                })}
              </p>
              <ol>
                <li>
                  {i18n.translate(
                    'xpack.agentBuilder.conversations.contextEngineIntro.stepOneMessage',
                    {
                      defaultMessage: 'Pick your data sources (indices + connectors)',
                    }
                  )}
                </li>
                <li>
                  {i18n.translate(
                    'xpack.agentBuilder.conversations.contextEngineIntro.stepTwoMessage',
                    {
                      defaultMessage:
                        "I'll sample and extract field semantics, formats, and relationships",
                    }
                  )}
                </li>
                <li>
                  {i18n.translate(
                    'xpack.agentBuilder.conversations.contextEngineIntro.stepThreeMessage',
                    {
                      defaultMessage: "We'll publish one skill per source",
                    }
                  )}
                </li>
                <li>
                  {i18n.translate(
                    'xpack.agentBuilder.conversations.contextEngineIntro.stepFourMessage',
                    {
                      defaultMessage: 'Then connect everything to your agent',
                    }
                  )}
                </li>
              </ol>
            </EuiText>
          </EuiPanel>
        </EuiFlexItem>
      ) : null}
      {showContextEngineIntro ? (
        <EuiFlexItem grow={false} css={[conversationElementPaddingStyles, starterChipsRowStyles]}>
          <EuiFlexGroup gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                size="s"
                onClick={() => setShowLetsGoResponse(true)}
                css={starterChipStyles}
              >
                {i18n.translate('xpack.agentBuilder.conversations.contextEngineIntro.letsGoButton', {
                  defaultMessage: "Let's go",
                })}
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                size="s"
                onClick={() =>
                  startConversationFromChip(
                    i18n.translate(
                      'xpack.agentBuilder.conversations.contextEngineIntro.layersPrompt',
                      {
                        defaultMessage: 'Tell me more about the layers',
                      }
                    )
                  )
                }
                css={starterChipStyles}
              >
                {i18n.translate('xpack.agentBuilder.conversations.contextEngineIntro.layersButton', {
                  defaultMessage: 'Tell me more about the layers',
                })}
              </EuiButtonEmpty>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      ) : null}
      {showContextEngineIntro && showLetsGoResponse ? (
        <EuiFlexItem grow={false} css={[conversationElementPaddingStyles, mockedResponseShellStyles]}>
          <EuiFlexGroup direction="column" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiIcon type="layers" color="primary" />
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" css={mockedResponseHeaderStyles}>
                    CONTEXT ENGINE
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="s">
                <p>
                  {i18n.translate(
                    'xpack.agentBuilder.conversations.contextEngineIntro.discoveryResponse',
                    {
                      defaultMessage:
                        'I scanned your Elasticsearch cluster and found 5 index candidates. You can also connect external sources below.',
                    }
                  )}
                </p>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiPanel color="plain" paddingSize="none" css={mockedResponseCardStyles}>
                <EuiPanel color="subdued" hasBorder={false} paddingSize="s">
                  <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiText size="xs" css={mockedSectionTitleStyles}>
                        ELASTICSEARCH INDICES
                      </EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiBadge color="primary">{selectedMockedIndexIds.length}</EuiBadge>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
                {mockedIndices.map((index, idx) => (
                  <React.Fragment key={index.id}>
                    {idx > 0 ? <EuiHorizontalRule margin="none" /> : null}
                    <EuiPanel color="plain" hasBorder={false} paddingSize="s">
                      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
                        <EuiFlexItem grow={false}>
                          <EuiCheckbox
                            id={`context-engine-${index.id}`}
                            checked={selectedMockedIndexIds.includes(index.id)}
                            onChange={() => toggleMockedIndexSelection(index.id)}
                            label=""
                          />
                        </EuiFlexItem>
                        <EuiFlexItem>
                          <EuiText size="s">
                            <strong>{index.label}</strong>
                          </EuiText>
                          <EuiText size="xs" color="subdued">
                            <p>{`${index.docs}   ${index.fields}`}</p>
                          </EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiBadge color="hollow">{index.type}</EuiBadge>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiPanel>
                  </React.Fragment>
                ))}
                <EuiHorizontalRule margin="none" />
                <EuiPanel color="subdued" hasBorder={false} paddingSize="s">
                  <EuiText size="xs" css={mockedSectionTitleStyles}>
                    EXTERNAL CONNECTORS
                  </EuiText>
                </EuiPanel>
                <EuiPanel color="plain" hasBorder={false} paddingSize="s">
                  <EuiFlexGrid columns={4} gutterSize="s">
                    {mockedConnectors.map((connector) => (
                      <EuiFlexItem key={connector}>
                        <EuiPanel hasBorder paddingSize="s" color="subdued">
                          <EuiText size="s" textAlign="center">
                            <p>{connector}</p>
                          </EuiText>
                        </EuiPanel>
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGrid>
                  <EuiButton fill fullWidth size="s">
                    {i18n.translate(
                      'xpack.agentBuilder.conversations.contextEngineIntro.connectSources',
                      {
                        defaultMessage: 'Connect {count} sources →',
                        values: {
                          count: selectedMockedIndexIds.length,
                        },
                      }
                    )}
                  </EuiButton>
                </EuiPanel>
              </EuiPanel>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
      ) : null}
      <EuiFlexItem
        grow={false}
        css={[conversationElementWidthStyles, conversationElementPaddingStyles, inputPaddingStyles]}
      >
        <ConversationInput />
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
