/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import {
  EuiButtonIcon,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiSpacer,
  EuiText,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { KibanaPageTemplate } from '@kbn/shared-ux-page-kibana-template';
import { i18n } from '@kbn/i18n';
import { AgentBuilderContextAgentsTable } from './context_agents_table';

export const AgentBuilderContext = () => {
  const { euiTheme } = useEuiTheme();
  const [showExplainer, setShowExplainer] = useState(true);

  return (
    <KibanaPageTemplate data-test-subj="agentBuilderContextPage">
      <KibanaPageTemplate.Header
        pageTitle={i18n.translate('xpack.agentBuilder.context.pageTitle', {
          defaultMessage: 'Context',
        })}
        description={i18n.translate('xpack.agentBuilder.context.pageDescription', {
          defaultMessage:
            'Status of Context retrieval per agent. Assign AI indices on each agent Settings tab; build and manage the indices themselves in the Context area.',
        })}
        css={css`
          background-color: ${euiTheme.colors.backgroundBasePlain};
          border-block-end: none;
        `}
      />
      <KibanaPageTemplate.Section>
        {showExplainer && (
          <>
            <EuiPanel
              hasBorder
              paddingSize="m"
              data-test-subj="agentBuilderContextExplainer"
              css={css`
                background-color: ${euiTheme.colors.backgroundBaseSubdued};
                border-radius: ${euiTheme.border.radius.medium};
              `}
            >
              <EuiFlexGroup
                alignItems="flexStart"
                gutterSize="m"
                responsive={false}
                justifyContent="spaceBetween"
              >
                <EuiFlexItem>
                  <EuiText size="s">
                    <p>
                      <strong>
                        {i18n.translate('xpack.agentBuilder.context.explainerLead', {
                          defaultMessage: 'What is this?',
                        })}
                      </strong>{' '}
                      {i18n.translate('xpack.agentBuilder.context.explainerBody', {
                        defaultMessage:
                          'Context gives your agents governed knowledge from AI indices, so they retrieve ranked facts instead of scanning raw data every turn. It runs background extraction, which uses tokens; that is why it is off by default on existing deployments and on by default for new ones. Configure Context and AI indices on each agent Settings tab.',
                      })}
                    </p>
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiButtonIcon
                    iconType="cross"
                    color="text"
                    aria-label={i18n.translate(
                      'xpack.agentBuilder.context.explainerDismissAria',
                      {
                        defaultMessage: 'Dismiss Context explainer',
                      }
                    )}
                    onClick={() => setShowExplainer(false)}
                    data-test-subj="agentBuilderContextExplainerDismiss"
                  />
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
            <EuiSpacer size="l" />
          </>
        )}
        <AgentBuilderContextAgentsTable />
      </KibanaPageTemplate.Section>
    </KibanaPageTemplate>
  );
};
