/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  EuiAccordion,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiCodeBlock,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from '@elastic/eui';

import {
  hydrateIndicator,
  KNOWLEDGE_TYPE_ORDER,
  toIndicatorDocument,
  typeBadgeColor,
  typeFilterLabel,
  typeLabel,
  type HydratedKnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import { backingIndexName, type Automation, type Namespace } from './namespace_data';

/** Future KI detail flyout ticket. Off so this tab matches the build. */
const KI_DETAIL_FLYOUT = false;

const KiDetailFlyout = ({
  flyout,
  currentView,
  namespace,
  onClose,
  onOpenAutomation,
  onOpenSources,
  onReplaceIndicator,
  setViewedVersion,
}: {
  flyout: HydratedKnowledgeIndicator;
  currentView: number;
  namespace: Namespace;
  onClose: () => void;
  onOpenAutomation: (title: string) => void;
  onOpenSources: () => void;
  onReplaceIndicator: (indicator: HydratedKnowledgeIndicator) => void;
  setViewedVersion: (version: number) => void;
}) => {
  const setCurrentVersion = (indicator: HydratedKnowledgeIndicator, version: number) => {
    onReplaceIndicator({ ...indicator, currentVersion: version });
    setViewedVersion(version);
  };

  const createEditVersion = (indicator: HydratedKnowledgeIndicator) => {
    const nextVersion = indicator.currentVersion + 1;
    onReplaceIndicator({
      ...indicator,
      currentVersion: nextVersion,
      versions: [
        {
          version: nextVersion,
          summary: 'Edited',
          source: 'Manual edit',
          when: 'just now',
        },
        ...indicator.versions,
      ],
    });
    setViewedVersion(nextVersion);
  };

  return (
    <EuiFlyout
      ownFocus
      size="m"
      onClose={onClose}
      aria-labelledby="context-engine-9-ki-flyout-title"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id="context-engine-9-ki-flyout-title">{flyout.title}</h2>
        </EuiTitle>
        <EuiSpacer size="s" />
        <EuiFlexGroup gutterSize="xs" responsive={false} wrap alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiBadge color={typeBadgeColor(flyout.type)}>{typeLabel(flyout.type)}</EuiBadge>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{flyout.source}</EuiBadge>
          </EuiFlexItem>
          {flyout.tags.map((tag) => (
            <EuiFlexItem grow={false} key={tag}>
              <EuiBadge color="hollow">{tag}</EuiBadge>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <div className="contextEnginePrototype__kiVersionRow">
          <EuiFlexGroup responsive={false} gutterSize="s" alignItems="center" wrap>
            {[...flyout.versions]
              .sort((a, b) => b.version - a.version)
              .map((version) => {
                const isCurrent = version.version === flyout.currentVersion;
                const isSelected = version.version === currentView;
                return (
                  <EuiFlexItem grow={false} key={version.version}>
                    {isSelected ? (
                      <EuiText size="s">
                        <strong>
                          v{version.version}
                          {isCurrent ? ' · current' : ''}
                        </strong>
                      </EuiText>
                    ) : (
                      <EuiLink onClick={() => setViewedVersion(version.version)}>
                        v{version.version}
                        {isCurrent ? ' · current' : ''}
                      </EuiLink>
                    )}
                  </EuiFlexItem>
                );
              })}
          </EuiFlexGroup>
          <EuiText size="xs" color="subdued">
            Editing creates a new version; agents always retrieve the current version.
          </EuiText>
        </div>
        <EuiSpacer size="m" />
        <EuiPanel paddingSize="m" color="subdued" hasBorder={false}>
          <EuiText size="xs" color="subdued">
            <strong>VALUE</strong>
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiText size="s" style={{ whiteSpace: 'pre-wrap' }}>
            {flyout.value}
          </EuiText>
        </EuiPanel>
        <EuiSpacer size="m" />
        <EuiText size="xs" color="subdued">
          <strong>DESCRIPTION</strong>
        </EuiText>
        <EuiSpacer size="xs" />
        <EuiText size="s">{flyout.description}</EuiText>
        <EuiSpacer size="m" />
        <div className="contextEnginePrototype__kiProvenance">
          <EuiText size="xs" color="subdued">
            Extracted by{' '}
            <EuiLink onClick={() => onOpenAutomation(flyout.extractedBy)}>
              <strong>{flyout.extractedBy}</strong>
            </EuiLink>
            {' · '}
            from{' '}
            <EuiLink onClick={onOpenSources}>
              <strong>{flyout.source}</strong>
            </EuiLink>
          </EuiText>
          <EuiText size="xs" color="subdued">
            Used by: <strong>{namespace.displayName}</strong>
          </EuiText>
          <EuiText size="xs" color="subdued">
            {flyout.confidence}% confidence · Evidence: {flyout.evidenceCount} docs
          </EuiText>
          <EuiText size="xs" color="subdued">
            {flyout.access}
          </EuiText>
        </div>
        <EuiSpacer size="m" />
        <EuiButton size="s" iconType="pencil" onClick={() => createEditVersion(flyout)}>
          Edit (creates v{flyout.currentVersion + 1})
        </EuiButton>
        <EuiSpacer size="l" />
        <EuiText size="xs" color="subdued">
          <strong>VERSION HISTORY</strong>
        </EuiText>
        <EuiSpacer size="s" />
        <div className="contextEnginePrototype__kiHistoryList">
          {[...flyout.versions]
            .sort((a, b) => b.version - a.version)
            .map((version) => {
              const isCurrent = version.version === flyout.currentVersion;
              return (
                <button
                  key={version.version}
                  type="button"
                  className={`contextEnginePrototype__kiHistoryItem${
                    isCurrent ? ' contextEnginePrototype__kiHistoryItem--current' : ''
                  }`}
                  onClick={() => {
                    if (!isCurrent) setCurrentVersion(flyout, version.version);
                  }}
                >
                  <EuiBadge color="hollow">v{version.version}</EuiBadge>
                  <span className="contextEnginePrototype__kiHistoryMeta">
                    <strong>{version.summary}</strong>
                    <span>
                      {version.source} · {version.when}
                    </span>
                  </span>
                  {isCurrent ? (
                    <EuiBadge color="success">Current</EuiBadge>
                  ) : (
                    <span className="contextEnginePrototype__kiHistoryAction">Set current</span>
                  )}
                </button>
              );
            })}
        </div>
      </EuiFlyoutBody>
      <EuiFlyoutFooter>
        <EuiButtonEmpty onClick={onClose}>Close</EuiButtonEmpty>
      </EuiFlyoutFooter>
    </EuiFlyout>
  );
};

export const KnowledgeTab = ({
  namespace,
  discoverHref,
  workflowsHref: _workflowsHref,
  onOpenAutomation,
  onOpenSources,
  onCreateAutomation: _onCreateAutomation,
  onViewAutomation: _onViewAutomation,
  onReplaceIndicator,
  sharedDestinationNote = false,
}: {
  namespace: Namespace;
  discoverHref: string;
  workflowsHref: string;
  onOpenAutomation: (automation: Automation) => void;
  onOpenSources: () => void;
  onCreateAutomation: () => void;
  onViewAutomation: () => void;
  onReplaceIndicator: (indicator: HydratedKnowledgeIndicator) => void;
  sharedDestinationNote?: boolean;
}) => {
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewedVersion, setViewedVersion] = useState<number | null>(null);

  useEffect(() => {
    setTypeFilter('all');
    setOpenId(null);
    setViewedVersion(null);
  }, [namespace.name]);

  const hydrated = useMemo(
    () => namespace.indicators.map((indicator) => hydrateIndicator(indicator, namespace.automations)),
    [namespace.automations, namespace.indicators]
  );
  const typeCounts = useMemo(() => {
    const counts = {} as Record<KnowledgeType, number>;
    hydrated.forEach((indicator) => {
      counts[indicator.type] = (counts[indicator.type] ?? 0) + 1;
    });
    return counts;
  }, [hydrated]);

  const filtered = hydrated.filter((indicator) => {
    if (typeFilter !== 'all' && indicator.type !== typeFilter) return false;
    return true;
  });

  const flyout = hydrated.find((item) => item.id === openId) ?? null;
  const currentView = viewedVersion ?? flyout?.currentVersion ?? 1;

  const presentTypes = KNOWLEDGE_TYPE_ORDER.filter((type) => (typeCounts[type] ?? 0) > 0);
  const typeGroupOptions = [
    { id: 'all', label: `All (${hydrated.length})` },
    ...presentTypes.map((type) => ({
      id: type,
      label: `${typeFilterLabel(type)} (${typeCounts[type]})`,
    })),
  ];

  const closeFlyout = () => {
    setOpenId(null);
    setViewedVersion(null);
  };

  const openAutomation = (title: string) => {
    const automation = namespace.automations.find((item) => item.title === title);
    if (!automation) return;
    closeFlyout();
    onOpenAutomation(automation);
  };

  const openSources = () => {
    closeFlyout();
    onOpenSources();
  };

  const count = hydrated.length;
  const countNoun = count === 1 ? 'Knowledge Indicator' : 'Knowledge Indicators';

  return (
    <>
      <EuiText size="s" color="subdued" className="contextEnginePrototype__kiSubtitleWrap">
        <p className="contextEnginePrototype__kiSubtitle">The knowledge your agents retrieve.</p>
      </EuiText>
      <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
        <div className="contextEnginePrototype__kiLockup">
          <EuiText size="s">
            <p className="contextEnginePrototype__kiCountLine">
              {count} <strong>{countNoun}</strong> in{' '}
              <EuiLink href={discoverHref} target="_blank">
                {backingIndexName(namespace.name)}
              </EuiLink>
            </p>
          </EuiText>
          <EuiButtonEmpty iconType="popout" iconSide="right" href={discoverHref} target="_blank">
            View raw docs in Discover
          </EuiButtonEmpty>
        </div>
        <EuiSpacer size="m" />

        {hydrated.length === 0 ? (
          <div className="contextEnginePrototype__kiEmpty">
            <EuiIcon type="document" size="l" color="subdued" />
            <EuiText size="s" color="subdued">
              <p>No Knowledge Indicators found</p>
            </EuiText>
          </div>
        ) : (
          <div className="contextEnginePrototype__panelBody">
            {sharedDestinationNote ? (
              <EuiText size="s" color="subdued" className="contextEnginePrototype__kiSharedNote">
                <p>
                  Some of these may come from another AI index sharing this destination. Check the
                  source column to confirm.
                </p>
              </EuiText>
            ) : null}
            <EuiButtonGroup
              legend="Filter by type"
              type="single"
              color="text"
              buttonSize="compressed"
              options={typeGroupOptions}
              idSelected={typeFilter}
              onChange={(id) => setTypeFilter(id as KnowledgeType | 'all')}
            />
            <div className="contextEnginePrototype__kiTabList">
              {filtered.length === 0 ? (
                <EuiText size="s" color="subdued">
                  <p>No Knowledge Indicators match this filter.</p>
                </EuiText>
              ) : (
                filtered.map((indicator) => (
                  <EuiAccordion
                    key={indicator.id}
                    id={`ki-json-${indicator.id}`}
                    className="contextEnginePrototype__kiAccordion"
                    arrowDisplay="left"
                    buttonContent={
                      <span className="contextEnginePrototype__kiTabListMain">
                        <span className="contextEnginePrototype__kiTabListTitle">
                          {indicator.title}
                        </span>
                        <span className="contextEnginePrototype__kiTabListSub">
                          {typeLabel(indicator.type)}
                        </span>
                      </span>
                    }
                    paddingSize="m"
                  >
                    <EuiCodeBlock
                      language="json"
                      fontSize="s"
                      paddingSize="m"
                      isCopyable
                      overflowHeight={320}
                    >
                      {JSON.stringify(toIndicatorDocument(indicator), null, 2)}
                    </EuiCodeBlock>
                  </EuiAccordion>
                ))
              )}
            </div>
          </div>
        )}

        {KI_DETAIL_FLYOUT && flyout ? (
          <KiDetailFlyout
            flyout={flyout}
            currentView={currentView}
            namespace={namespace}
            onClose={closeFlyout}
            onOpenAutomation={openAutomation}
            onOpenSources={openSources}
            onReplaceIndicator={onReplaceIndicator}
            setViewedVersion={setViewedVersion}
          />
        ) : null}
      </EuiPanel>
    </>
  );
};
