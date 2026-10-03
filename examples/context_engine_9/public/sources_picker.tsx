/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiAccordion,
  EuiBadge,
  EuiButton,
  EuiButtonIcon,
  EuiCheckbox,
  EuiComboBox,
  EuiFieldSearch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiIcon,
  EuiLink,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTextArea,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';

import confluenceLogo from './assets/confluence.svg';
import gmailLogo from './assets/gmail.svg';
import salesforceLogo from './assets/salesforce.svg';
import type { NamespaceSource } from './namespace_data';

export type SourceTab = 'elasticsearch' | 'connectors';

export interface CatalogConnector {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
}

export interface SourcesDraft {
  tab: SourceTab;
  connectorIds: string[];
  indexSources: NamespaceSource[];
  esqlSources: NamespaceSource[];
  esqlDraft: string;
  editingEsqlId?: string;
}

const ESQL_PLACEHOLDER =
  "Start typing ES|QL, or describe what you're looking for in a // comment, then press ⌘J to generate the query";

const ESQL_MIN_HEIGHT = 152;

const INDEX_OPTIONS: EuiComboBoxOptionOption[] = [
  { label: 'kibana_sample_data_logs' },
  { label: 'logs-nginx' },
  { label: 'logs-system.syslog' },
  { label: 'metrics-system.cpu' },
  { label: 'filebeat-*' },
  { label: 'support-tickets' },
  { label: 'confluence-pages' },
  { label: 'zendesk-tickets*' },
  { label: 'confluence-policies*' },
  { label: 'pagerduty-incidents' },
  { label: 'slack-incidents' },
];

const CONNECTORS: CatalogConnector[] = [
  { id: 'gtest', name: 'gtest', subtitle: 'Google Drive', icon: 'logoGoogleG' },
  { id: 'gmail', name: 'Gmail', subtitle: 'Mail and labels', icon: gmailLogo },
  { id: 'google-drive', name: 'Google Drive', subtitle: 'Shared drives', icon: 'logoGoogleG' },
  { id: 'slack', name: 'Slack', subtitle: 'Channels and messages', icon: 'logoSlack' },
  { id: 'github', name: 'GitHub', subtitle: 'Repos, issues, and PRs', icon: 'logoGithub' },
  { id: 'confluence', name: 'Confluence', subtitle: 'Spaces and pages', icon: confluenceLogo },
  { id: 'zendesk', name: 'Zendesk', subtitle: 'Support tickets', icon: 'plugs' },
  { id: 'pagerduty', name: 'PagerDuty', subtitle: 'Incidents and services', icon: 'bell' },
  { id: 'sharepoint', name: 'SharePoint', subtitle: 'Sites and libraries', icon: 'logoWindows' },
  { id: 'salesforce', name: 'Salesforce', subtitle: 'Accounts and opportunities', icon: salesforceLogo },
];

const sourceFromConnector = (source: CatalogConnector): NamespaceSource => ({
  id: source.id,
  name: source.name,
  subtitle: source.subtitle,
  typeLabel: 'Connector',
  icon: source.icon,
});

const esqlFromIndex = (name: string): NamespaceSource => {
  const query = `FROM ${name}`;
  return {
    id: `esql-${name}`,
    name: query,
    subtitle: query,
    typeLabel: 'ES|QL',
    icon: 'visVega',
  };
};

export const emptySourcesDraft = (): SourcesDraft => ({
  tab: 'elasticsearch',
  connectorIds: [],
  indexSources: [],
  esqlSources: [],
  esqlDraft: '',
});

export const draftFromSources = (sources: NamespaceSource[]): SourcesDraft => {
  const connectorIds: string[] = [];
  const indexSources: NamespaceSource[] = [];
  const esqlSources: NamespaceSource[] = [];
  const connectorIdSet = new Set(CONNECTORS.map((item) => item.id));
  sources.forEach((source) => {
    if (source.typeLabel === 'ES|QL') {
      esqlSources.push(source);
      return;
    }
    if (connectorIdSet.has(source.id) || source.typeLabel === 'Connector') {
      connectorIds.push(source.id);
      return;
    }
    indexSources.push(source);
  });
  return {
    tab: 'elasticsearch',
    connectorIds,
    indexSources,
    esqlSources,
    esqlDraft: '',
  };
};

export const allDraftSources = (draft: SourcesDraft): NamespaceSource[] => [
  ...draft.indexSources,
  ...draft.esqlSources,
  ...CONNECTORS.filter((source) => draft.connectorIds.includes(source.id)).map(sourceFromConnector),
];

export const sourcesSignature = (sources: NamespaceSource[]) =>
  [...sources]
    .map((source) => `${source.id}\0${source.name}\0${source.typeLabel}`)
    .sort()
    .join('\n');

const selectedBadge = (source: NamespaceSource) => {
  if (source.typeLabel === 'ES|QL') return 'ES|QL';
  if (source.typeLabel === 'Connector') return 'Connector';
  if (source.typeLabel === 'Managed') return 'Managed';
  return 'ES|QL';
};

const DisabledReason = ({ children }: { children: React.ReactNode }) => (
  <EuiText size="s" color="subdued" className="contextEnginePrototype__disabledReason">
    {children}
  </EuiText>
);

const TabCount = ({ count }: { count: number }) =>
  count > 0 ? <EuiBadge color="hollow">{count}</EuiBadge> : null;

export const SourcesPicker = ({
  draft,
  onChange,
  accordionId,
}: {
  draft: SourcesDraft;
  onChange: (next: SourcesDraft) => void;
  accordionId: string;
}) => {
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [connectorQuery, setConnectorQuery] = useState('');
  const [esqlOpen, setEsqlOpen] = useState(false);
  const selected = allDraftSources(draft);
  const selectedNames = new Set(selected.map((source) => source.name));
  const selectedIds = new Set(selected.map((source) => source.id));
  const elasticsearchCount = draft.indexSources.length + draft.esqlSources.length;

  const markAdded = (id: string) => {
    setJustAddedId(id);
    window.setTimeout(() => {
      setJustAddedId((current) => (current === id ? null : current));
    }, 600);
  };

  const addIndex = (label: string) => {
    const name = label.trim();
    if (!name) return;
    const next = esqlFromIndex(name);
    if (selectedNames.has(next.name) || selectedIds.has(next.id)) return;
    onChange({ ...draft, esqlSources: [...draft.esqlSources, next] });
    markAdded(next.id);
  };

  const addEsql = () => {
    const query = draft.esqlDraft.trim();
    if (!query) return;
    const editingId = draft.editingEsqlId;
    const id = editingId ?? `esql-${Date.now()}`;
    const next: NamespaceSource = {
      id,
      name: query,
      subtitle: query,
      typeLabel: 'ES|QL',
      icon: 'visVega',
    };
    const esqlSources = editingId
      ? draft.esqlSources.map((item) => (item.id === editingId ? next : item))
      : [...draft.esqlSources, next];
    onChange({
      ...draft,
      esqlDraft: '',
      editingEsqlId: undefined,
      esqlSources,
    });
    markAdded(id);
  };

  const editEsql = (source: NamespaceSource) => {
    onChange({
      ...draft,
      tab: 'elasticsearch',
      esqlDraft: source.subtitle || source.name,
      editingEsqlId: source.id,
    });
    setEsqlOpen(true);
  };

  const removeSource = (id: string) => {
    onChange({
      ...draft,
      indexSources: draft.indexSources.filter((item) => item.id !== id),
      esqlSources: draft.esqlSources.filter((item) => item.id !== id),
      connectorIds: draft.connectorIds.filter((item) => item !== id),
    });
  };

  const toggleConnector = (id: string, checked: boolean) => {
    if (checked) {
      if (draft.connectorIds.includes(id)) return;
      onChange({
        ...draft,
        connectorIds: [...draft.connectorIds, id],
      });
      markAdded(id);
      return;
    }
    removeSource(id);
  };

  const query = connectorQuery.trim().toLowerCase();
  const visibleConnectors = CONNECTORS.filter((source) => {
    if (!query) return true;
    return (
      source.name.toLowerCase().includes(query) || source.subtitle.toLowerCase().includes(query)
    );
  });

  const indexOptions = INDEX_OPTIONS.filter((option) => !selectedNames.has(`FROM ${option.label}`));

  return (
    <div className="contextEnginePrototype__sourcesInner">
      <EuiTabs size="s">
        <EuiTab
          isSelected={draft.tab === 'elasticsearch'}
          onClick={() => onChange({ ...draft, tab: 'elasticsearch' })}
        >
          <span className="contextEnginePrototype__sourceTab">
            <EuiIcon type="database" size="s" />
            Elasticsearch data
            <TabCount count={elasticsearchCount} />
          </span>
        </EuiTab>
        <EuiTab
          isSelected={draft.tab === 'connectors'}
          onClick={() => onChange({ ...draft, tab: 'connectors' })}
        >
          <span className="contextEnginePrototype__sourceTab">
            <EuiIcon type="plugs" size="s" />
            Connectors
            <TabCount count={draft.connectorIds.length} />
          </span>
        </EuiTab>
      </EuiTabs>
      <EuiSpacer size="m" />
      {draft.tab === 'elasticsearch' ? (
        <>
          <EuiFormRow
            label="Index, data stream or alias"
            fullWidth
            helpText="Start typing to search, then select a match from the list."
          >
            <EuiComboBox
              fullWidth
              placeholder="e.g. logs-nginx"
              options={indexOptions}
              selectedOptions={[]}
              singleSelection={{ asPlainText: true }}
              onChange={(options) => {
                const picked = options[0]?.label;
                if (picked) addIndex(picked);
              }}
              onCreateOption={(value) => addIndex(value)}
              isClearable={false}
            />
          </EuiFormRow>
          <EuiSpacer size="m" />
          <EuiAccordion
            id={accordionId}
            buttonContent="Advanced: ES|QL"
            paddingSize="m"
            forceState={esqlOpen ? 'open' : 'closed'}
            onToggle={(isOpen) => setEsqlOpen(isOpen)}
          >
            <EuiTextArea
              fullWidth
              rows={6}
              resize="vertical"
              style={{ minHeight: ESQL_MIN_HEIGHT }}
              value={draft.esqlDraft}
              onChange={(event) => onChange({ ...draft, esqlDraft: event.target.value })}
              placeholder={ESQL_PLACEHOLDER}
              aria-label="ES|QL query"
            />
            <EuiSpacer size="m" />
            <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButton size="s" isDisabled={!draft.esqlDraft.trim()} onClick={addEsql}>
                  Add ES|QL source
                </EuiButton>
              </EuiFlexItem>
              {!draft.esqlDraft.trim() ? (
                <EuiFlexItem grow={false}>
                  <DisabledReason>Write a query to add it</DisabledReason>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
          </EuiAccordion>
        </>
      ) : (
        <>
          <EuiFieldSearch
            fullWidth
            placeholder="Search connectors"
            value={connectorQuery}
            onChange={(event) => setConnectorQuery(event.target.value)}
            aria-label="Search connectors"
          />
          <EuiSpacer size="s" />
          {visibleConnectors.length === 0 ? (
            <EuiText size="s" color="subdued">
              <p>No connectors match.</p>
            </EuiText>
          ) : (
            <div className="contextEnginePrototype__connectorList">
              {visibleConnectors.map((source) => {
                const checked = draft.connectorIds.includes(source.id);
                return (
                  <div key={source.id} className="contextEnginePrototype__connectorRow">
                    <EuiCheckbox
                      id={`context-engine-9-connector-${source.id}`}
                      checked={checked}
                      onChange={(event) => toggleConnector(source.id, event.target.checked)}
                      label={
                        <span className="contextEnginePrototype__connectorLabel">
                          <EuiIcon type={source.icon} size="m" />
                          <span>{source.name}</span>
                        </span>
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
          <EuiSpacer size="s" />
          <EuiLink href="#create-connector" onClick={(event) => event.preventDefault()}>
            + Create connector
          </EuiLink>
        </>
      )}
      <EuiSpacer size="m" />
      <EuiText size="s">
        <strong>Selected sources ({selected.length})</strong>
      </EuiText>
      <EuiSpacer size="s" />
      {selected.length === 0 ? (
        <EuiText size="s" color="subdued">
          <p>None yet.</p>
        </EuiText>
      ) : (
        <div className="contextEnginePrototype__selectedSources">
          {selected.map((source) => (
            <div
              key={source.id}
              className={`contextEnginePrototype__sourceChip${
                justAddedId === source.id ? ' contextEnginePrototype__selectedSource--enter' : ''
              }`}
            >
              <EuiIcon type={source.icon} size="m" />
              <div
                className={
                  source.typeLabel === 'ES|QL'
                    ? 'contextEnginePrototype__sourceChipName'
                    : 'contextEnginePrototype__selectedSourceMain'
                }
              >
                <EuiText size="s" className="contextEnginePrototype__selectedSourceName">
                  {source.subtitle && source.typeLabel === 'ES|QL' ? source.subtitle : source.name}
                </EuiText>
              </div>
              <EuiBadge color="hollow">{selectedBadge(source)}</EuiBadge>
              {source.typeLabel === 'ES|QL' ? (
                <EuiButtonIcon
                  iconType="pencil"
                  aria-label={`Edit ${source.name}`}
                  onClick={() => editEsql(source)}
                />
              ) : null}
              <EuiButtonIcon
                iconType="cross"
                aria-label={`Remove ${source.name}`}
                onClick={() => removeSource(source.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
