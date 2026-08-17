/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback } from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiIcon,
  EuiLink,
  EuiSpacer,
  EuiSwitch,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import type { Control, FormState } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';
import { labels } from '../../../../utils/i18n';
import { useNavigation } from '../../../../hooks/use_navigation';
import { appPaths } from '../../../../utils/app_paths';
import type { AgentFormData } from '../agent_form';
import {
  AVAILABLE_AI_INDEXES,
  DEFAULT_AI_INDEXES,
  formatDefaultAiIndexLabel,
  sanitizePersistedAiIndexIds,
} from '../../../../utils/ai_indexes';
import { AiIndicesPickerDropdown } from './ai_indices_picker_dropdown';

interface AiIndicesSettingsSectionProps {
  control: Control<AgentFormData>;
  formState: FormState<AgentFormData>;
  isFormDisabled: boolean;
}

const formFlexColumnStyles = css`
  min-width: 0;
`;

export const AiIndicesSettingsSection: React.FC<AiIndicesSettingsSectionProps> = ({
  control,
  formState,
  isFormDisabled,
}) => {
  const { euiTheme } = useEuiTheme();
  const { createAgentBuilderUrl, navigateToAgentBuilderUrl } = useNavigation();
  const contextEnabled = useWatch({ control, name: 'configuration.context_enabled' }) ?? true;

  const contextPageHref = createAgentBuilderUrl(appPaths.manage.context);
  const createAiIndexHref = createAgentBuilderUrl(appPaths.manage.context, { create: '1' });

  const openIndexInContext = useCallback(
    (indexId: string) => {
      navigateToAgentBuilderUrl(appPaths.manage.context, { index: indexId });
    },
    [navigateToAgentBuilderUrl]
  );

  const hasDeploymentIndices = AVAILABLE_AI_INDEXES.length > 0;
  const pickerDimmed = !contextEnabled || isFormDisabled;

  const dimStyles = css`
    opacity: ${pickerDimmed ? 0.55 : 1};
    pointer-events: ${contextEnabled ? 'auto' : 'none'};
  `;

  return (
    <EuiFlexGroup
      direction="row"
      gutterSize="xl"
      alignItems="flexStart"
      aria-labelledby="ai-indices-section-title"
    >
      <EuiFlexItem grow={1}>
        <EuiFlexGroup direction="column" gutterSize="s" alignItems="flexStart">
          <EuiFlexGroup direction="row" gutterSize="s" alignItems="center" responsive={false}>
            <EuiIcon type="indexMapping" aria-hidden={true} />
            <EuiTitle size="xs">
              <h2 id="ai-indices-section-title">
                {i18n.translate('xpack.agentBuilder.agents.form.settings.aiIndicesTitle', {
                  defaultMessage: 'AI Indices',
                })}
              </h2>
            </EuiTitle>
          </EuiFlexGroup>
          <EuiText size="s" color="subdued">
            {i18n.translate('xpack.agentBuilder.agents.form.settings.aiIndicesDescription', {
              defaultMessage:
                'Choose which AI indices this agent retrieves from. Default indices are always included and cannot be removed.',
            })}
          </EuiText>
          <EuiText size="s" color="subdued">
            {i18n.translate('xpack.agentBuilder.agents.form.settings.aiIndicesDecoupling', {
              defaultMessage:
                'Not affected by Elastic capabilities; retrieval is configured only here.',
            })}
          </EuiText>
        </EuiFlexGroup>
      </EuiFlexItem>

      <EuiFlexItem grow={2} css={formFlexColumnStyles}>
        <Controller
          name="configuration.context_enabled"
          control={control}
          render={({ field: { value, onChange } }) => {
            const isOn = value ?? true;
            return (
              <EuiSwitch
                label={
                  isOn
                    ? i18n.translate(
                        'xpack.agentBuilder.agents.form.settings.contextSwitchLabelOn',
                        {
                          defaultMessage: 'Context: On',
                        }
                      )
                    : i18n.translate(
                        'xpack.agentBuilder.agents.form.settings.contextSwitchLabelOff',
                        {
                          defaultMessage: 'Context: Off',
                        }
                      )
                }
                checked={isOn}
                disabled={isFormDisabled}
                onChange={(event) => onChange(event.target.checked)}
                data-test-subj="agentSettingsContextEnabledSwitch"
              />
            );
          }}
        />

        {!contextEnabled && (
          <>
            <EuiSpacer size="m" />
            <EuiText size="s" color="subdued" data-test-subj="agentSettingsContextOffMessage">
              {i18n.translate('xpack.agentBuilder.agents.form.settings.contextOffMessage', {
                defaultMessage:
                  'Context is off for this agent. Selections are kept and apply when turned back on.',
              })}
            </EuiText>
          </>
        )}

        <EuiSpacer size="m" />

        <div css={dimStyles} data-test-subj="agentSettingsAiIndicesPicker">
          <EuiFormRow
            fullWidth
            label={i18n.translate('xpack.agentBuilder.agents.form.settings.defaultAiIndicesLabel', {
              defaultMessage: 'Default indices',
            })}
          >
            <EuiFlexGroup direction="column" gutterSize="xs">
              <EuiFlexItem grow={false}>
                <EuiFlexGroup gutterSize="s" wrap responsive={false}>
                  {DEFAULT_AI_INDEXES.map((index) => (
                    <EuiFlexItem grow={false} key={index.id}>
                      <EuiBadge
                        color="hollow"
                        data-test-subj={`agentSettingsDefaultAiIndex-${index.id}`}
                      >
                        {formatDefaultAiIndexLabel(index.name)}
                      </EuiBadge>
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  {i18n.translate('xpack.agentBuilder.agents.form.settings.defaultAiIndicesHint', {
                    defaultMessage: 'Registered by your solution; applies to every agent.',
                  })}
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFormRow>

          <EuiFormRow
            fullWidth
            label={i18n.translate(
              'xpack.agentBuilder.agents.form.settings.additionalAiIndicesLabel',
              {
                defaultMessage: 'Additional indices',
              }
            )}
            labelAppend={
              <EuiText size="xs" color="subdued">
                {labels.common.optional}
              </EuiText>
            }
            isInvalid={!!formState.errors.configuration?.ai_index_ids}
            error={formState.errors.configuration?.ai_index_ids?.message}
          >
            {!hasDeploymentIndices ? (
              <EuiText size="s" data-test-subj="agentSettingsAiIndicesEmptyState">
                <FormattedMessage
                  id="xpack.agentBuilder.agents.form.settings.aiIndicesEmptyState"
                  defaultMessage="No AI indices yet. {createLink}"
                  values={{
                    createLink: (
                      <EuiLink href={createAiIndexHref}>
                        {i18n.translate(
                          'xpack.agentBuilder.agents.form.settings.aiIndicesEmptyCreateLink',
                          {
                            defaultMessage: 'Create one in Context ›',
                          }
                        )}
                      </EuiLink>
                    ),
                  }}
                />
              </EuiText>
            ) : (
              <Controller
                name="configuration.ai_index_ids"
                control={control}
                render={({ field }) => (
                  <AiIndicesPickerDropdown
                    selectedIds={sanitizePersistedAiIndexIds(field.value)}
                    onChange={field.onChange}
                    onOpenIndex={openIndexInContext}
                    onCreateIndex={() =>
                      navigateToAgentBuilderUrl(appPaths.manage.context, { create: '1' })
                    }
                    disabled={pickerDimmed}
                  />
                )}
              />
            )}
          </EuiFormRow>
        </div>

        {!hasDeploymentIndices && (
          <EuiText size="xs" color="subdued" css={{ marginTop: euiTheme.size.xs }}>
            <EuiLink href={contextPageHref}>
              {i18n.translate('xpack.agentBuilder.agents.form.settings.openContextPageLink', {
                defaultMessage: 'Open Context',
              })}
            </EuiLink>
          </EuiText>
        )}
      </EuiFlexItem>
    </EuiFlexGroup>
  );
};
