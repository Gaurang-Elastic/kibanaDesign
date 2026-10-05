/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EuiAccordion,
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiButtonGroup,
  EuiCard,
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
  slugify,
  toIndicatorDocument,
  typeBadgeColor,
  typeFilterLabel,
  typeLabel,
  type HydratedKnowledgeIndicator,
  type KnowledgeIndicator,
  type KnowledgeType,
} from './knowledge_indicators';
import { backingIndexName, type Automation, type Namespace } from './namespace_data';
import { indicatorSourceGroup } from './proto11_data';
import {
  KiDetailFlyout as Proto11KiDetailFlyout,
  kiFeedbackLabel,
  useKiFeedback,
} from './proto11_ki_detail';

const CHECK_TARGET = 3;

export interface Proto11KnowledgeProps {
  sample: boolean;
  /** Check a few applies to indices Proto 11 created. */
  checkEnabled: boolean;
  lookedAt: string[];
  checkHidden: boolean;
  onLookedAt: (id: string) => void;
  onHideCheck: () => void;
  /** Rendered first, above Check a few. */
  testQuestion?: React.ReactNode;
}

interface SourceGroup {
  name: string;
  kind: string;
  icon: string;
  items: HydratedKnowledgeIndicator[];
}

const groupIcon = (kind: string, sourceIcon?: string) => {
  if (sourceIcon) return sourceIcon;
  if (kind === 'Agent traces') return 'apmTrace';
  if (kind === 'Connector') return 'documents';
  return 'database';
};

const groupBySource = (
  indicators: HydratedKnowledgeIndicator[],
  namespace: Namespace
): SourceGroup[] => {
  const groups = new Map<string, SourceGroup>();
  indicators.forEach((indicator) => {
    const { name, kind } = indicatorSourceGroup(
      indicator,
      namespace.sources,
      namespace.proto11?.agent
    );
    const existing = groups.get(name);
    if (existing) {
      existing.items.push(indicator);
      return;
    }
    const source = namespace.sources.find((item) => item.name === name);
    groups.set(name, { name, kind, icon: groupIcon(kind, source?.icon), items: [indicator] });
  });
  const order = namespace.sources.map((source) => source.name);
  const rank = (name: string) => {
    const index = order.indexOf(name);
    return index === -1 ? order.length : index;
  };
  return Array.from(groups.values()).sort((a, b) => rank(a.name) - rank(b.name));
};

/** One KI from each source, topped up to three when there are fewer sources. */
const checkPicks = (groups: SourceGroup[]): HydratedKnowledgeIndicator[] => {
  const picks = groups.slice(0, CHECK_TARGET).map((group) => group.items[0]);
  for (let depth = 1; picks.length < CHECK_TARGET; depth += 1) {
    const before = picks.length;
    groups.forEach((group) => {
      if (picks.length < CHECK_TARGET && group.items[depth]) picks.push(group.items[depth]);
    });
    if (picks.length === before) break;
  }
  return picks;
};

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
      aria-labelledby="context-engine-11-ki-flyout-title"
    >
      <EuiFlyoutHeader hasBorder>
        <EuiTitle size="s">
          <h2 id="context-engine-11-ki-flyout-title">{flyout.title}</h2>
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

const KiAccordionRow = ({
  indicator,
  proto11,
  open,
  onToggle,
  onOpen,
}: {
  indicator: HydratedKnowledgeIndicator;
  proto11: boolean;
  open: boolean;
  onToggle: (isOpen: boolean) => void;
  onOpen: () => void;
}) => {
  const feedback = useKiFeedback(indicator.id);
  return (
    <EuiAccordion
      id={`ki-json-${indicator.id}`}
      className="contextEnginePrototype__kiAccordion"
      arrowDisplay="left"
      {...(proto11
        ? {
            'data-ki-row': indicator.id,
            forceState: open ? ('open' as const) : ('closed' as const),
            onToggle,
          }
        : {})}
      buttonContent={
        <span className="contextEnginePrototype__kiTabListMain">
          <span className="contextEnginePrototype__kiTabListTitle">{indicator.title}</span>
          <span className="contextEnginePrototype__kiTabListSub">{typeLabel(indicator.type)}</span>
          {feedback ? (
            <EuiBadge color="hollow" data-test-subj="proto11KiRowFeedback">
              {kiFeedbackLabel(feedback)}
            </EuiBadge>
          ) : null}
        </span>
      }
      paddingSize="m"
    >
      {proto11 ? (
        <div data-test-subj="proto11KiRowPreview">
          <EuiText size="s">
            <p>{indicator.description || indicator.content.split('\n')[0]}</p>
          </EuiText>
          <EuiSpacer size="xs" />
          <EuiText size="xs" color="subdued">
            <p>{indicator.source}</p>
          </EuiText>
          <EuiSpacer size="s" />
          <EuiLink onClick={onOpen} data-test-subj="proto11KiOpen">
            Open
          </EuiLink>
        </div>
      ) : (
        <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable overflowHeight={320}>
          {JSON.stringify(toIndicatorDocument(indicator), null, 2)}
        </EuiCodeBlock>
      )}
    </EuiAccordion>
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
  onAskAboutIndicator,
  onDeleteIndicator,
  sharedDestinationNote = false,
  groupedBySource = false,
  proto11,
}: {
  namespace: Namespace;
  discoverHref: string;
  workflowsHref: string;
  onOpenAutomation: (automation: Automation) => void;
  onOpenSources: () => void;
  onCreateAutomation: () => void;
  onViewAutomation: () => void;
  onReplaceIndicator: (indicator: HydratedKnowledgeIndicator) => void;
  onAskAboutIndicator?: (indicator: KnowledgeIndicator, message: string) => void;
  onDeleteIndicator?: (indicator: KnowledgeIndicator) => void;
  sharedDestinationNote?: boolean;
  groupedBySource?: boolean;
  proto11?: Proto11KnowledgeProps;
}) => {
  const [typeFilter, setTypeFilter] = useState<KnowledgeType | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [viewedVersion, setViewedVersion] = useState<number | null>(null);
  const [openRows, setOpenRows] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTypeFilter('all');
    setOpenId(null);
    setViewedVersion(null);
    setOpenRows([]);
  }, [namespace.name]);

  const hydrated = useMemo(
    () =>
      namespace.indicators.map((indicator) => hydrateIndicator(indicator, namespace.automations)),
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

  const allGroups = groupedBySource || proto11 ? groupBySource(hydrated, namespace) : [];
  const picks = proto11?.checkEnabled ? checkPicks(allGroups) : [];
  const lookedAtCount = picks.filter((pick) => proto11?.lookedAt.includes(pick.id)).length;
  const showCheck =
    Boolean(proto11?.checkEnabled) &&
    !proto11?.checkHidden &&
    picks.length > 0 &&
    lookedAtCount < Math.min(CHECK_TARGET, picks.length);

  const setRowOpen = (id: string, isOpen: boolean) => {
    setOpenRows((current) =>
      isOpen
        ? [...current.filter((item) => item !== id), id]
        : current.filter((item) => item !== id)
    );
    if (isOpen && proto11 && !proto11.lookedAt.includes(id)) proto11.onLookedAt(id);
  };

  const openIndicator = (id: string) => {
    if (proto11 && !proto11.lookedAt.includes(id)) proto11.onLookedAt(id);
    setOpenId(id);
  };

  const renderRow = (indicator: HydratedKnowledgeIndicator) => (
    <KiAccordionRow
      key={indicator.id}
      indicator={indicator}
      proto11={Boolean(proto11)}
      open={openRows.includes(indicator.id)}
      onToggle={(isOpen) => setRowOpen(indicator.id, isOpen)}
      onOpen={() => openIndicator(indicator.id)}
    />
  );

  const filteredGroups = allGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((indicator) => filtered.includes(indicator)),
    }))
    .filter((group) => group.items.length > 0);

  const renderList = () => {
    if (filtered.length === 0) {
      return (
        <EuiText size="s" color="subdued">
          <p>No Knowledge Indicators match this filter.</p>
        </EuiText>
      );
    }
    if (!groupedBySource) return filtered.map(renderRow);
    return filteredGroups.map((group) => (
      <EuiAccordion
        key={group.name}
        id={`ki-group-${slugify(group.name)}`}
        initialIsOpen
        className="contextEnginePrototype__kiGroup"
        buttonContent={
          <span className="contextEnginePrototype__kiGroupHead">
            <EuiIcon type={group.icon} size="m" aria-hidden={true} />
            <strong>{group.name}</strong>
            <EuiBadge color="default">{group.kind}</EuiBadge>
            <EuiBadge color="hollow">{group.items.length}</EuiBadge>
          </span>
        }
        paddingSize="none"
      >
        <div className="contextEnginePrototype__kiGroupBody">{group.items.map(renderRow)}</div>
      </EuiAccordion>
    ));
  };

  return (
    <>
      <EuiText size="s" color="subdued" className="contextEnginePrototype__kiSubtitleWrap">
        <p className="contextEnginePrototype__kiSubtitle">The knowledge your agents retrieve.</p>
      </EuiText>
      <div className="contextEnginePrototype__panels">
        {proto11?.testQuestion}
        {showCheck && proto11 ? (
          <EuiPanel
            hasBorder
            paddingSize="l"
            className="contextEnginePrototype__panel"
            data-test-subj="proto11CheckAFew"
          >
            <div className="contextEnginePrototype__panelHeader">
              <div className="contextEnginePrototype__panelHeaderText">
                <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                      <h2>Check a few</h2>
                    </EuiTitle>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="hollow">
                      {lookedAtCount} of {Math.min(CHECK_TARGET, picks.length)} looked at
                    </EuiBadge>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiText size="xs" color="subdued" className="contextEnginePrototype__panelDesc">
                  <p>One from each source. You do not need to review everything.</p>
                </EuiText>
              </div>
              <div className="contextEnginePrototype__panelActions">
                <EuiButtonEmpty size="s" onClick={proto11.onHideCheck}>
                  Hide
                </EuiButtonEmpty>
              </div>
            </div>
            <EuiSpacer size="m" />
            <EuiFlexGroup gutterSize="m" responsive={false}>
              {picks.map((pick) => {
                const group = indicatorSourceGroup(
                  pick,
                  namespace.sources,
                  namespace.proto11?.agent
                );
                const looked = proto11.lookedAt.includes(pick.id);
                return (
                  <EuiFlexItem key={pick.id}>
                    <EuiCard
                      textAlign="left"
                      paddingSize="m"
                      hasBorder
                      titleElement="h3"
                      titleSize="xs"
                      title={pick.title}
                      description={group.name}
                      onClick={() => openIndicator(pick.id)}
                      footer={
                        <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
                          <EuiFlexItem grow={false}>
                            <EuiBadge color={typeBadgeColor(pick.type)}>
                              {typeLabel(pick.type)}
                            </EuiBadge>
                          </EuiFlexItem>
                          {looked ? (
                            <EuiFlexItem grow={false}>
                              <EuiBadge color="hollow" iconType="eye">
                                Looked at
                              </EuiBadge>
                            </EuiFlexItem>
                          ) : null}
                        </EuiFlexGroup>
                      }
                    />
                  </EuiFlexItem>
                );
              })}
            </EuiFlexGroup>
          </EuiPanel>
        ) : null}
        <EuiPanel hasBorder paddingSize="l" className="contextEnginePrototype__panel">
          <div className="contextEnginePrototype__kiLockup">
            <EuiText size="s">
              <p className="contextEnginePrototype__kiCountLine">
                {count} {proto11?.sample ? 'sample ' : null}
                <strong>{countNoun}</strong> in{' '}
                <EuiLink href={discoverHref} target="_blank">
                  {backingIndexName(namespace.name)}
                </EuiLink>
                {proto11?.sample ? (
                  <>
                    {' '}
                    <EuiBadge color="hollow">Sample</EuiBadge>
                  </>
                ) : null}
              </p>
            </EuiText>
            <EuiButtonEmpty iconType="popout" iconSide="right" href={discoverHref} target="_blank">
              View raw docs in Discover
            </EuiButtonEmpty>
          </div>
          <EuiSpacer size="m" />

          {hydrated.length === 0 ? (
            <div className="contextEnginePrototype__kiEmpty">
              <EuiIcon type="document" size="l" color="subdued" aria-hidden={true} />
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
              <div className="contextEnginePrototype__kiTabList" ref={listRef}>
                {renderList()}
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
          {proto11 && flyout && !KI_DETAIL_FLYOUT ? (
            <Proto11KiDetailFlyout
              indicator={flyout}
              indicators={namespace.indicators}
              sample={proto11.sample}
              discoverHref={discoverHref}
              automations={namespace.automations}
              sources={namespace.sources}
              agent={namespace.proto11?.agent}
              onOpenAutomation={(automation) => {
                closeFlyout();
                onOpenAutomation(automation);
              }}
              onAskAgent={onAskAboutIndicator}
              onDelete={(item) => {
                onDeleteIndicator?.(item);
                closeFlyout();
              }}
              onClose={closeFlyout}
            />
          ) : null}
        </EuiPanel>
      </div>
    </>
  );
};
