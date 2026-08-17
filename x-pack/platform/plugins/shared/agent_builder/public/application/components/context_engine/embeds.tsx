/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useMemo } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiCodeBlock,
  EuiDescriptionList,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiHorizontalRule,
  EuiPanel,
  EuiProgress,
  EuiSpacer,
  EuiStat,
  EuiSwitch,
  EuiText,
  EuiTitle,
} from '@elastic/eui';
import { SAMPLE_INDICES } from './constants';

export const IndexPicker: React.FC<{
  selectedIndexIds: string[];
  onToggleIndex: (indexId: string) => void;
  onAnalyzeSelected?: () => void;
  showAction?: boolean;
}> = ({ selectedIndexIds, onToggleIndex, onAnalyzeSelected, showAction = true }) => {
  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj="contextEngineIndexPicker">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s">
        <EuiFlexItem grow={false}>
          <EuiTitle size="xxxs">
            <h5>Select indices</h5>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="accent">{`${SAMPLE_INDICES.length} found`}</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      {SAMPLE_INDICES.map((index) => (
        <EuiPanel key={index.id} hasBorder={false} color="subdued" paddingSize="s">
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiSwitch
                compressed
                label={index.label}
              checked={selectedIndexIds.includes(index.id)}
              onChange={() => onToggleIndex(index.id)}
                showLabel={false}
              />
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiText size="s">
                <strong>{index.label}</strong>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">{`${index.docs} docs`}</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">{`${index.fields} fields`}</EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      ))}
      {showAction && onAnalyzeSelected ? (
        <>
          <EuiSpacer size="s" />
          <EuiFlexGroup justifyContent="flexEnd" gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiButton
                size="s"
                onClick={onAnalyzeSelected}
                disabled={selectedIndexIds.length === 0}
              >
                Analyze selected
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      ) : null}
    </EuiPanel>
  );
};

const SKILLS = [
  {
    id: 'get_context',
    title: 'get_context',
    description: 'Returns relevant Knowledge Indicators for any query.',
    confidence: 97,
  },
  {
    id: 'resolve_metric',
    title: 'resolve_metric',
    description: 'Resolves metric names to canonical expressions with sources.',
    confidence: 94,
  },
  {
    id: 'explain_field',
    title: 'explain_field',
    description: 'Returns definition, type, and values for a field.',
    confidence: 89,
  },
  {
    id: 'list_conventions',
    title: 'list_conventions',
    description: 'Lists naming and enum conventions used by your team.',
    confidence: 76,
  },
];

const confidenceColor = (confidence: number) => {
  if (confidence >= 90) return 'accent';
  if (confidence >= 80) return 'success';
  return 'warning';
};

export const SkillsList: React.FC<{
  onPublishAll: () => void;
  onReviewIndividually: () => void;
  showActions?: boolean;
}> = ({ onPublishAll, onReviewIndividually, showActions = true }) => {
  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj="contextEngineSkillsList">
      <EuiTitle size="xxxs">
        <h5>Skills to publish</h5>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGrid columns={1} gutterSize="s">
        {SKILLS.map((skill) => (
          <EuiFlexItem key={skill.id}>
            <EuiPanel color="subdued" paddingSize="s">
              <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" gutterSize="s">
                <EuiFlexItem>
                  <EuiText size="s">
                    <strong>{skill.title}</strong>
                  </EuiText>
                  <EuiText size="xs" color="subdued">
                    <p>{skill.description}</p>
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiBadge color={confidenceColor(skill.confidence)}>{`${skill.confidence}%`}</EuiBadge>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGrid>
      {showActions ? (
        <>
          <EuiSpacer size="s" />
          <EuiFlexGroup justifyContent="spaceBetween" gutterSize="s">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty size="s" onClick={onReviewIndividually}>
                Review individually
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton size="s" onClick={onPublishAll}>
                Publish all 4 skills
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      ) : null}
    </EuiPanel>
  );
};

export const ProgressBuild: React.FC = () => {
  const progressRows = useMemo(
    () => [
      { label: 'Field definitions', status: '182 extracted' },
      { label: 'Naming conventions', status: '34 patterns' },
      { label: 'Computed metrics', status: '28 metrics' },
      { label: 'Query patterns', status: '116 patterns' },
      { label: 'Publishing KI index', status: '247 KIs live' },
    ],
    []
  );

  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj="contextEngineProgressBuild">
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiTitle size="xxxs">
            <h5>Analyzing indices</h5>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiText size="xs" color="subdued">
            100%
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <EuiProgress value={100} max={100} size="m" />
      <EuiSpacer size="s" />
      {progressRows.map((item) => (
        <EuiFlexGroup key={item.label} justifyContent="spaceBetween" gutterSize="s" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiText size="s">
              <p>{item.label}</p>
            </EuiText>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiText size="s" color="subdued">
              <p>{item.status}</p>
            </EuiText>
          </EuiFlexItem>
        </EuiFlexGroup>
      ))}
    </EuiPanel>
  );
};

export const KIReview: React.FC<{ onConfirm: () => void }> = ({ onConfirm }) => {
  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj="contextEngineKiReview">
      <EuiTitle size="xxxs">
        <h5>Knowledge Indicator: review needed</h5>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiDescriptionList
        compressed
        type="column"
        listItems={[
          { title: 'Field', description: 'sales_records / arr' },
          { title: 'Current', description: 'Array (field type)' },
          { title: 'Proposed', description: 'Annual Recurring Revenue (USD)' },
          { title: 'Confidence', description: '62% - human review required' },
        ]}
      />
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="s">
        <EuiFlexItem grow={false}>
          <EuiButton size="s" onClick={onConfirm}>
            Confirm: ARR = Revenue
          </EuiButton>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="s">Skip</EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};

export const SetupSummary: React.FC = () => {
  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj="contextEngineSetupSummary">
      <EuiTitle size="xxxs">
        <h5>Context Engine live</h5>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGrid columns={3} gutterSize="s">
        <EuiFlexItem>
          <EuiStat title="247" description="Knowledge Indicators" titleSize="m" />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiStat title="4" description="Skills published" titleSize="m" />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiStat title="5" description="Indices indexed" titleSize="m" />
        </EuiFlexItem>
      </EuiFlexGrid>
      <EuiHorizontalRule margin="m" />
      <EuiFlexGroup gutterSize="s" wrap>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">Kibana agents</EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">Claude via MCP</EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">OpenAI tool spec</EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};

export const IntegrationConfig: React.FC = () => {
  return (
    <EuiPanel hasBorder paddingSize="m" data-test-subj="contextEngineIntegrationConfig">
      <EuiTitle size="xxxs">
        <h5>Connect: Claude via MCP</h5>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiFormRow label="Endpoint" display="columnCompressed">
        <EuiPanel color="subdued" paddingSize="s">
          <EuiText size="xs">
            <code>https://elastic.internal/context-engine/mcp</code>
          </EuiText>
        </EuiPanel>
      </EuiFormRow>
      <EuiCodeBlock language="json" isCopyable fontSize="s">
        {`{
  "mcpServers": {
    "context-engine": {
      "command": "npx",
      "args": ["@elastic/context-engine-mcp"],
      "env": {
        "CE_URL": "https://elastic.internal/context-engine/mcp",
        "CE_KEY": "ce_live_YOUR_KEY"
      }
    }
  }
}`}
      </EuiCodeBlock>
    </EuiPanel>
  );
};
