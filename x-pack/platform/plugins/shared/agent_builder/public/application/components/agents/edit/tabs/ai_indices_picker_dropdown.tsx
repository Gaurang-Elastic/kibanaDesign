/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  EuiCheckboxControl,
  EuiComboBox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import {
  AVAILABLE_AI_INDEXES,
  CREATE_AI_INDEX_OPTION_VALUE,
  formatAiIndexStatusMeta,
  isAiIndexReady,
  nonReadySelectedIndexTooltip,
  resolveAiIndex,
  resolveAiIndexName,
  sanitizePersistedAiIndexIds,
} from '../../../../utils/ai_indexes';

interface AiIndicesPickerDropdownProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onOpenIndex: (indexId: string) => void;
  onCreateIndex: () => void;
  disabled?: boolean;
  'data-test-subj'?: string;
}

type AiIndexComboOption = EuiComboBoxOptionOption<string>;

/** Distinct from selected pill keys so EuiComboBox keeps selected rows visible in the list. */
const optionListKey = (id: string) => `opt-${id}`;

export const AiIndicesPickerDropdown: React.FC<AiIndicesPickerDropdownProps> = ({
  selectedIds,
  onChange,
  onOpenIndex,
  onCreateIndex,
  disabled = false,
  'data-test-subj': dataTestSubj = 'agentSettingsAiIndexesComboBox',
}) => {
  const ids = useMemo(() => sanitizePersistedAiIndexIds(selectedIds), [selectedIds]);
  const selectedIdSet = useMemo(() => new Set(ids), [ids]);

  const options: AiIndexComboOption[] = useMemo(() => {
    const indexOptions = AVAILABLE_AI_INDEXES.map((index) => ({
      label: index.name,
      value: index.id,
      // Must differ from selectedOption keys so matching keeps these rows in the list.
      key: optionListKey(index.id),
      'data-test-subj': `agentSettingsAiIndexOption-${index.id}`,
    }));

    return [
      ...indexOptions,
      {
        label: i18n.translate('xpack.agentBuilder.agents.form.settings.createAiIndexOption', {
          defaultMessage: '+ Create new AI index',
        }),
        value: CREATE_AI_INDEX_OPTION_VALUE,
        key: CREATE_AI_INDEX_OPTION_VALUE,
        'data-test-subj': 'agentSettingsCreateAiIndexOption',
      },
    ];
  }, []);

  const selectedOptions: AiIndexComboOption[] = useMemo(
    () =>
      ids.map((id) => {
        const index = resolveAiIndex(id);
        const ready = isAiIndexReady(index);
        return {
          label: resolveAiIndexName(id),
          value: id,
          key: id,
          color: ready ? undefined : 'warning',
          toolTipContent: ready ? undefined : nonReadySelectedIndexTooltip,
          // Do not set onClick here: EuiComboBox drops the remove ✕ when onClick is set.
          // Chip-label open is handled via click capture below.
          'data-test-subj': `agentSettingsSelectedAiIndex-${id}`,
        };
      }),
    [ids]
  );

  const handleChange = useCallback(
    (nextOptions: AiIndexComboOption[]) => {
      const values = nextOptions.map((option) => String(option.value ?? option.label));
      if (values.includes(CREATE_AI_INDEX_OPTION_VALUE)) {
        onCreateIndex();
        return;
      }

      // Re-clicking a still-listed selected row appends a duplicate; treat that as deselect.
      const duplicateId = values.find((id, index) => values.indexOf(id) !== index);
      if (duplicateId) {
        onChange(sanitizePersistedAiIndexIds(values.filter((id) => id !== duplicateId)));
        return;
      }

      onChange(sanitizePersistedAiIndexIds(values));
    },
    [onChange, onCreateIndex]
  );

  const handleChipLabelClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Let the pill's remove control handle ✕ exclusively.
      if (
        target.closest(
          '.euiBadge__iconButton, .euiBadge__icon, [data-test-subj="comboBoxClearButton"]'
        )
      ) {
        return;
      }

      const pill = target.closest<HTMLElement>(
        '[data-test-subj^="agentSettingsSelectedAiIndex-"], [data-test-subj="euiComboBoxPill"]'
      );
      if (!pill) return;

      const testSubj = pill.getAttribute('data-test-subj') ?? '';
      let indexId = '';
      if (testSubj.startsWith('agentSettingsSelectedAiIndex-')) {
        indexId = testSubj.replace('agentSettingsSelectedAiIndex-', '');
      } else {
        const label = pill.textContent?.trim() ?? '';
        indexId = ids.find((id) => resolveAiIndexName(id) === label) ?? '';
      }
      if (!indexId) return;

      event.preventDefault();
      event.stopPropagation();
      onOpenIndex(indexId);
    },
    [disabled, ids, onOpenIndex]
  );

  return (
    // Capture chip-label clicks so open works without disabling EuiComboBox's remove ✕.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <div onClickCapture={handleChipLabelClickCapture}>
      <EuiComboBox
        fullWidth
        isDisabled={disabled}
        isClearable={!disabled}
        placeholder={i18n.translate(
          'xpack.agentBuilder.agents.form.settings.aiIndicesSelectPlaceholder',
          {
            defaultMessage: 'Select AI indices',
          }
        )}
        options={options}
        selectedOptions={selectedOptions}
        onChange={handleChange}
        rowHeight={48}
        renderOption={(option, _searchValue, contentClassName) => {
          if (option.value === CREATE_AI_INDEX_OPTION_VALUE) {
            return (
              <EuiText size="s" className={contentClassName}>
                <strong>{option.label}</strong>
              </EuiText>
            );
          }

          const indexId = String(option.value);
          const index = resolveAiIndex(indexId);
          const checked = selectedIdSet.has(indexId);

          return (
            <EuiFlexGroup
              gutterSize="s"
              alignItems="center"
              responsive={false}
              className={contentClassName}
            >
              <EuiFlexItem grow={false}>
                <EuiCheckboxControl
                  checked={checked}
                  disabled={disabled}
                  aria-hidden={true}
                  data-test-subj={`agentSettingsAiIndexCheckbox-${indexId}`}
                />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiText size="s">{option.label}</EuiText>
                {index && (
                  <EuiText size="xs" color="subdued">
                    {formatAiIndexStatusMeta(index)}
                  </EuiText>
                )}
              </EuiFlexItem>
            </EuiFlexGroup>
          );
        }}
        aria-label={i18n.translate('xpack.agentBuilder.agents.form.settings.aiIndicesAriaLabel', {
          defaultMessage: 'Additional AI indices selection',
        })}
        data-test-subj={dataTestSubj}
      />
    </div>
  );
};
