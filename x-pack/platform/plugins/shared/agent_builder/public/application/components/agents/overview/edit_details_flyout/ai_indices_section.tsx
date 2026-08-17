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
  EuiLink,
  EuiPanel,
  EuiSpacer,
  EuiSwitch,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { labels } from '../../../../utils/i18n';
import { useNavigation } from '../../../../hooks/use_navigation';
import { appPaths } from '../../../../utils/app_paths';
import {
  AVAILABLE_AI_INDEXES,
  DEFAULT_AI_INDEXES,
  formatDefaultAiIndexLabel,
  sanitizePersistedAiIndexIds,
} from '../../../../utils/ai_indexes';
import { AiIndicesPickerDropdown } from '../../edit/tabs/ai_indices_picker_dropdown';
import type { EditDetailsFormData } from './types';

export const AiIndicesSection: React.FC = () => {
  const { control, formState } = useFormContext<EditDetailsFormData>();
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
  const pickerDimmed = !contextEnabled;

  const dimStyles = css`
    opacity: ${pickerDimmed ? 0.55 : 1};
    pointer-events: ${contextEnabled ? 'auto' : 'none'};
  `;

  return (
    <EuiPanel hasBorder paddingSize="l" data-test-subj="editDetailsAiIndicesSection">
      <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
        <EuiFlexItem grow>
          <EuiTitle size="xxs">
            <h4>
              {i18n.translate('xpack.agentBuilder.agents.form.settings.aiIndicesTitle', {
                defaultMessage: 'AI Indices',
              })}
            </h4>
          </EuiTitle>
          <EuiSpacer size="xs" />
          <EuiText size="s" color="subdued">
            {i18n.translate('xpack.agentBuilder.overview.editDetails.aiIndicesDescription', {
              defaultMessage:
                'Choose which AI indices this agent retrieves from. Default indices are always included and cannot be removed. Not affected by Elastic capabilities; retrieval is configured only here.',
            })}
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
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
                  onChange={(event) => onChange(event.target.checked)}
                  data-test-subj="editDetailsContextEnabledSwitch"
                />
              );
            }}
          />
        </EuiFlexItem>
      </EuiFlexGroup>

      {!contextEnabled && (
        <>
          <EuiSpacer size="m" />
          <EuiText size="s" color="subdued" data-test-subj="editDetailsContextOffMessage">
            {i18n.translate('xpack.agentBuilder.agents.form.settings.contextOffMessage', {
              defaultMessage:
                'Context is off for this agent. Selections are kept and apply when turned back on.',
            })}
          </EuiText>
        </>
      )}

      <EuiSpacer size="m" />

      <div css={dimStyles} data-test-subj="editDetailsAiIndicesPicker">
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
                      data-test-subj={`editDetailsDefaultAiIndex-${index.id}`}
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
            <EuiText size="s" data-test-subj="editDetailsAiIndicesEmptyState">
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
                  data-test-subj="editDetailsAiIndexesComboBox"
                />
              )}
            />
          )}
        </EuiFormRow>
      </div>

      {!hasDeploymentIndices && (
        <>
          <EuiSpacer size="xs" />
          <EuiText size="xs" color="subdued">
            <EuiLink href={contextPageHref}>
              {i18n.translate('xpack.agentBuilder.agents.form.settings.openContextPageLink', {
                defaultMessage: 'Open Context',
              })}
            </EuiLink>
          </EuiText>
        </>
      )}
    </EuiPanel>
  );
};
