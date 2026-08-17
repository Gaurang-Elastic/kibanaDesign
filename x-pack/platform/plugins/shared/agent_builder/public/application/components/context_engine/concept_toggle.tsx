/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiButtonGroup } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useQueryState } from '../../hooks/use_query_state';
import type { ContextEngineConcept } from './types';

const options = [
  {
    id: '1',
    label: i18n.translate('xpack.agentBuilder.contextEngine.conceptToggle.optionConcept1', {
      defaultMessage: 'Concept 1',
    }),
  },
  {
    id: '2',
    label: i18n.translate('xpack.agentBuilder.contextEngine.conceptToggle.optionConcept2', {
      defaultMessage: 'Concept 2',
    }),
  },
];

const parseConcept = (value: ContextEngineConcept | null): ContextEngineConcept =>
  value === '2' ? '2' : '1';

export const useContextEngineConcept = (): [
  ContextEngineConcept,
  (concept: ContextEngineConcept) => void,
] => {
  const [concept, setConcept] = useQueryState<ContextEngineConcept>('concept', {
    defaultValue: '1',
    parse: parseConcept,
  });

  return [
    concept,
    (nextConcept) => {
      void setConcept(nextConcept, { historyMode: 'push' });
    },
  ];
};

export const ContextEngineConceptToggle: React.FC = () => {
  const [concept, setConcept] = useContextEngineConcept();

  return (
    <EuiButtonGroup
      legend={i18n.translate('xpack.agentBuilder.contextEngine.conceptToggle.legend', {
        defaultMessage: 'Context Engine concepts',
      })}
      options={options}
      idSelected={concept}
      onChange={(id) => setConcept(id as ContextEngineConcept)}
      buttonSize="s"
      isFullWidth={false}
      name="contextEngineConceptSelector"
      data-test-subj="contextEngineConceptToggle"
    />
  );
};
