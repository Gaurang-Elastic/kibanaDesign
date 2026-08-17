/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';

const features = [
  {
    icon: 'search',
    title: i18n.translate('xpack.agentBuilder.contextEngine.overview.feature.extract.title', {
      defaultMessage: 'Extracts automatically',
    }),
    description: i18n.translate(
      'xpack.agentBuilder.contextEngine.overview.feature.extract.description',
      {
        defaultMessage:
          'Reads your Elasticsearch indices and connected sources to build structured knowledge.',
      }
    ),
  },
  {
    icon: 'lock',
    title: i18n.translate('xpack.agentBuilder.contextEngine.overview.feature.governed.title', {
      defaultMessage: 'Governed by design',
    }),
    description: i18n.translate(
      'xpack.agentBuilder.contextEngine.overview.feature.governed.description',
      {
        defaultMessage:
          'Every Knowledge Indicator carries permission lineage from its source. RBAC-aware from day one.',
      }
    ),
  },
  {
    icon: 'bolt',
    title: i18n.translate('xpack.agentBuilder.contextEngine.overview.feature.smarter.title', {
      defaultMessage: 'Gets smarter with use',
    }),
    description: i18n.translate(
      'xpack.agentBuilder.contextEngine.overview.feature.smarter.description',
      {
        defaultMessage:
          'Agent traces surface gaps and trigger backfill. The context layer improves without manual intervention.',
      }
    ),
  },
];

export const ContextEngineOverview: React.FC<{ onBeginSetup: () => void }> = ({ onBeginSetup }) => {
  const { euiTheme } = useEuiTheme();

  const shellCss = css`
    width: 100%;
    max-width: 840px;
    margin: 0 auto;
    padding: ${euiTheme.size.l} ${euiTheme.size.xl} ${euiTheme.size.xxl};
    overflow-y: auto;
    height: 100%;
  `;

  return (
    <div css={shellCss} data-test-subj="contextEngineOverview">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="m">
            <h2>
              {i18n.translate('xpack.agentBuilder.contextEngine.overview.title', {
                defaultMessage: 'Context Engine',
              })}
            </h2>
          </EuiTitle>
          <EuiText color="subdued" size="s">
            <p>
              {i18n.translate('xpack.agentBuilder.contextEngine.overview.subtitle', {
                defaultMessage: 'Set up a shared knowledge layer for your AI agents',
              })}
            </p>
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiPanel hasBorder paddingSize="l">
        <EuiBadge color="accent">
          {i18n.translate('xpack.agentBuilder.contextEngine.overview.newBadge', {
            defaultMessage: 'NEW',
          })}
        </EuiBadge>
        <EuiSpacer size="s" />
        <EuiTitle size="s">
          <h3>
            {i18n.translate('xpack.agentBuilder.contextEngine.overview.headline', {
              defaultMessage: 'Your agents deserve a memory.',
            })}
          </h3>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiText size="s" color="subdued">
          <p>
            {i18n.translate('xpack.agentBuilder.contextEngine.overview.description', {
              defaultMessage:
                'The Context Engine extracts structured knowledge from your data, stores it as governed Knowledge Indicators, and serves it to any agent.',
            })}
          </p>
        </EuiText>
        <EuiSpacer size="l" />
        <EuiFlexGroup gutterSize="l">
          {features.map((feature) => (
            <EuiFlexItem key={feature.title}>
              <EuiPanel color="subdued" paddingSize="s">
                <EuiFlexGroup gutterSize="s" alignItems="flexStart">
                  <EuiFlexItem grow={false}>
                    <EuiIcon type={feature.icon} color="primary" />
                  </EuiFlexItem>
                  <EuiFlexItem>
                    <EuiText size="s">
                      <strong>{feature.title}</strong>
                    </EuiText>
                    <EuiText size="xs" color="subdued">
                      <p>{feature.description}</p>
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiPanel>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel hasBorder color="subdued" paddingSize="m">
        <EuiFlexGroup alignItems="center" justifyContent="spaceBetween">
          <EuiFlexItem>
            <EuiText size="s">
              <strong>
                {i18n.translate('xpack.agentBuilder.contextEngine.overview.cta.title', {
                  defaultMessage: 'Ready to build your knowledge layer?',
                })}
              </strong>
              <p>
                {i18n.translate('xpack.agentBuilder.contextEngine.overview.cta.description', {
                  defaultMessage:
                    'The setup agent will guide you through index selection, KI extraction, and skill publishing.',
                })}
              </p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton fill iconType="arrowRight" onClick={onBeginSetup}>
              {i18n.translate('xpack.agentBuilder.contextEngine.overview.cta.button', {
                defaultMessage: 'Begin setup',
              })}
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiPanel>
    </div>
  );
};
