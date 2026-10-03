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
  EuiBadge,
  EuiBasicTable,
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiCheckbox,
  EuiCode,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiFormRow,
  EuiHealth,
  EuiIcon,
  EuiLink,
  EuiPanel,
  EuiRadio,
  EuiSpacer,
  EuiStat,
  EuiText,
  EuiTitle,
  type EuiBasicTableColumn,
} from '@elastic/eui';

import {
  AGENT_CHANGE_OBJECT_LABELS,
  AGENT_CHANGE_OPS,
  DEFAULT_AGENT_CHANGE_PERMISSIONS,
  SIGNAL_TYPE_META,
  SIGNAL_TYPE_ORDER,
  formatSignalSourceLine,
  improvementChangeLabel,
  signalCountsByType,
  signalDistinctByType,
  signalsByIds,
  sourceNamedInFix,
  totalSignalOccurrences,
  type AgentChangeObject,
  type AgentChangePermissions,
  type ImprovementChange,
  type IndexSignal,
  type SignalInternalType,
} from './improvement_signals';
import {
  formatAppliedAgo,
  improvementsForNamespace,
  lastSeenRank,
  namespaceStartsUnanalysed,
  namespaceTraceCount,
  signalsForNamespace,
  traceForId,
  type OverviewImprovement,
} from './improvements_data';
import type { Namespace } from './namespace_data';

type ImprovementStatus = 'open' | 'applied' | 'dismissed';
type ImprovementGroup = ImprovementStatus;
type ImprovementOutcome = 'measuring' | 'improved' | 'unchanged';
type SignalFilter =
  | { mode: 'all' }
  | { mode: 'type'; type: SignalInternalType }
  | { mode: 'ids'; ids: string[] };
type SignalWindow = '7d' | '30d' | 'lastN';
type ImprovementSchedule = 'daily' | 'weekly' | 'manual';

const ImprovementChangeChips = ({ changes }: { changes?: ImprovementChange[] }) => (
  <EuiFlexGroup
    gutterSize="xs"
    wrap
    responsive={false}
    className="contextEnginePrototype__improvementChanges"
  >
    {(changes ?? []).map((change, index) => (
      <EuiFlexItem grow={false} key={`${change.operation}-${change.objectType}-${index}`}>
        <span
          className={`contextEnginePrototype__improvementChangeChip${
            change.destructive ? ' contextEnginePrototype__improvementChangeChip--destructive' : ''
          }`}
        >
          {improvementChangeLabel(change)}
        </span>
      </EuiFlexItem>
    ))}
  </EuiFlexGroup>
);

export const ImprovementsTab = ({
  namespace,
  coldStart: coldStartFlag,
  healthy: healthyFlag,
  onOpenCountChange,
  onRefine,
}: {
  namespace: Namespace;
  coldStart?: boolean;
  healthy?: boolean;
  onOpenCountChange?: (count: number) => void;
  onRefine?: (item: OverviewImprovement) => void;
}) => {
  const tracesAnalysed = coldStartFlag ? 0 : namespaceTraceCount(namespace);
  const catalogImprovements = useMemo(
    () => improvementsForNamespace(namespace),
    [namespace.name]
  );
  const indexSignals = useMemo(() => {
    if (tracesAnalysed === 0 || healthyFlag) return [];
    return signalsForNamespace(namespace);
  }, [namespace.name, tracesAnalysed, healthyFlag]);

  const [improvementsAnalysedByIndex, setImprovementsAnalysedByIndex] = useState<
    Record<string, boolean>
  >({});
  const [analysingIndexName, setAnalysingIndexName] = useState<string | null>(null);
  const [improvementStatusById, setImprovementStatusById] = useState<
    Record<string, ImprovementStatus>
  >({});
  const [improvementPendingById, setImprovementPendingById] = useState<
    Record<string, ImprovementStatus>
  >({});
  const [improvementDepartingIds, setImprovementDepartingIds] = useState<string[]>([]);
  const [improvementAppliedAtById, setImprovementAppliedAtById] = useState<Record<string, number>>(
    {}
  );
  const [improvementDismissedAtById, setImprovementDismissedAtById] = useState<
    Record<string, number>
  >({});
  const [improvementOutcomeById, setImprovementOutcomeById] = useState<
    Record<string, ImprovementOutcome>
  >({});
  const [signalFilter, setSignalFilter] = useState<SignalFilter>({ mode: 'all' });
  const [highlightedSignalIds, setHighlightedSignalIds] = useState<string[]>([]);
  const [highlightedImprovementId, setHighlightedImprovementId] = useState<string | null>(null);
  const [expandedImprovementId, setExpandedImprovementId] = useState<string | null>(null);
  const [selectedSignalTraceId, setSelectedSignalTraceId] = useState<string | null>(null);
  const [evidenceImprovementId, setEvidenceImprovementId] = useState<string | null>(null);
  const [configureFlyoutOpen, setConfigureFlyoutOpen] = useState(false);
  const [reviewAllOpen, setReviewAllOpen] = useState(false);
  const [reviewSelectedIds, setReviewSelectedIds] = useState<string[]>([]);
  const [appliedGroupOpen, setAppliedGroupOpen] = useState(false);
  const [dismissedGroupOpen, setDismissedGroupOpen] = useState(false);
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const [improvementSchedule, setImprovementSchedule] = useState<ImprovementSchedule>('daily');
  const [signalWindow, setSignalWindow] = useState<SignalWindow>('7d');
  const [signalWindowN, setSignalWindowN] = useState('20');
  const [agentMayChange, setAgentMayChange] = useState<AgentChangePermissions>(
    DEFAULT_AGENT_CHANGE_PERMISSIONS
  );
  const [runNowNotice, setRunNowNotice] = useState<string | null>(null);

  const improvementsAnalysed =
    improvementsAnalysedByIndex[namespace.name] ?? !namespaceStartsUnanalysed(namespace);
  const isAnalysingThisIndex = analysingIndexName === namespace.name;
  const namespaceImprovements =
    tracesAnalysed > 0 && improvementsAnalysed ? catalogImprovements : [];

  const improvementStatus = (id: string): ImprovementStatus =>
    improvementStatusById[id] ?? 'open';
  const improvementGroup = (id: string): ImprovementGroup => {
    if (improvementPendingById[id]) return 'open';
    const status = improvementStatus(id);
    if (status === 'applied' || status === 'dismissed') return status;
    return 'open';
  };

  const openImprovements = namespaceImprovements
    .filter((item) => improvementGroup(item.id) === 'open')
    .sort((a, b) => b.casesCount - a.casesCount || lastSeenRank(a.lastSeen) - lastSeenRank(b.lastSeen));
  const appliedImprovements = namespaceImprovements
    .filter((item) => improvementGroup(item.id) === 'applied')
    .sort(
      (a, b) => (improvementAppliedAtById[b.id] ?? 0) - (improvementAppliedAtById[a.id] ?? 0)
    );
  const dismissedImprovements = namespaceImprovements
    .filter((item) => improvementGroup(item.id) === 'dismissed')
    .sort(
      (a, b) =>
        (improvementDismissedAtById[b.id] ?? 0) - (improvementDismissedAtById[a.id] ?? 0)
    );
  const openImprovementsCount = openImprovements.length;

  useEffect(() => {
    onOpenCountChange?.(openImprovementsCount);
  }, [openImprovementsCount, namespace.name, onOpenCountChange]);

  useEffect(() => {
    setExpandedImprovementId(null);
    setSignalsExpanded(namespaceImprovements.length === 0);
  }, [namespace.name, namespaceImprovements.length]);

  const signalCounts = signalCountsByType(indexSignals);
  const signalDistinct = signalDistinctByType(indexSignals);
  const signalOccurrenceTotal = totalSignalOccurrences(indexSignals);
  const signalWindowLabel =
    signalWindow === '30d' ? '30 days' : signalWindow === 'lastN' ? `${signalWindowN} signals` : '7 days';
  const filteredSignals =
    signalFilter.mode === 'type'
      ? indexSignals.filter((signal) => signal.type === signalFilter.type)
      : signalFilter.mode === 'ids'
        ? signalsByIds(indexSignals, signalFilter.ids)
        : indexSignals;
  const evidenceImprovement =
    namespaceImprovements.find((item) => item.id === evidenceImprovementId) ?? null;
  const evidenceSignals = evidenceImprovement
    ? indexSignals.filter((signal) => (evidenceImprovement.signalIds ?? []).includes(signal.id))
    : [];
  const selectedSignalTrace = selectedSignalTraceId
    ? traceForId(selectedSignalTraceId)
    : null;
  const openReviewItems = namespaceImprovements.filter(
    (item) => improvementStatus(item.id) === 'open' && !improvementPendingById[item.id]
  );
  const reviewSelectedCount = reviewSelectedIds.filter((id) =>
    openReviewItems.some((item) => item.id === id)
  ).length;
  const anotherGroupExpanded = appliedGroupOpen || dismissedGroupOpen;
  const signalsColdStart = tracesAnalysed === 0;
  const signalsEmptyDetected = tracesAnalysed > 0 && indexSignals.length === 0;

  const focusSignals = (ids: string[]) => {
    setSignalsExpanded(true);
    setSignalFilter({ mode: 'ids', ids });
    setHighlightedSignalIds(ids);
    setHighlightedImprovementId(null);
    window.requestAnimationFrame(() => {
      document
        .getElementById('context-engine-11-signals')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const focusImprovement = (id: string) => {
    setHighlightedImprovementId(id);
    setExpandedImprovementId(id);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`context-engine-11-improvement-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const toggleTypeFilter = (type: SignalInternalType) => {
    setHighlightedImprovementId(null);
    setHighlightedSignalIds([]);
    setSignalFilter((current) => {
      if (current.mode === 'type' && current.type === type) return { mode: 'all' };
      return { mode: 'type', type };
    });
  };

  const improvementForSignal = (signalId: string) =>
    namespaceImprovements.find((item) => (item.signalIds ?? []).includes(signalId)) ?? null;

  const settleImprovement = (id: string) => {
    window.setTimeout(() => {
      setImprovementDepartingIds((current) =>
        current.includes(id) ? current : [...current, id]
      );
    }, 1200);
    window.setTimeout(() => {
      setImprovementPendingById((current) => {
        if (!current[id]) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      setImprovementDepartingIds((current) => current.filter((item) => item !== id));
    }, 1500);
  };

  const approveImprovement = (id: string) => {
    if (improvementStatus(id) !== 'open' || improvementPendingById[id]) return;
    const catalogIndex = catalogImprovements.findIndex((item) => item.id === id);
    const willDrop = catalogIndex % 2 === 0;
    setImprovementStatusById((current) => ({ ...current, [id]: 'applied' }));
    setImprovementPendingById((current) => ({ ...current, [id]: 'applied' }));
    setImprovementAppliedAtById((current) => ({ ...current, [id]: Date.now() }));
    setImprovementOutcomeById((current) => ({ ...current, [id]: 'measuring' }));
    settleImprovement(id);
    window.setTimeout(() => {
      setImprovementOutcomeById((current) => {
        if (current[id] !== 'measuring') return current;
        return { ...current, [id]: willDrop ? 'improved' : 'unchanged' };
      });
    }, 4000);
  };

  const dismissImprovement = (id: string) => {
    if (improvementStatus(id) !== 'open' || improvementPendingById[id]) return;
    setImprovementStatusById((current) => ({ ...current, [id]: 'dismissed' }));
    setImprovementPendingById((current) => ({ ...current, [id]: 'dismissed' }));
    setImprovementDismissedAtById((current) => ({ ...current, [id]: Date.now() }));
    settleImprovement(id);
  };

  const undoDismissImprovement = (id: string) => {
    if (improvementStatus(id) !== 'dismissed') return;
    setImprovementStatusById((current) => ({ ...current, [id]: 'open' }));
    setImprovementPendingById((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setImprovementDepartingIds((current) => current.filter((item) => item !== id));
    setImprovementDismissedAtById((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const proposeAnotherFix = (id: string) => {
    setImprovementStatusById((current) => ({ ...current, [id]: 'open' }));
    setImprovementPendingById((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setImprovementOutcomeById((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setImprovementAppliedAtById((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const analyseSignals = () => {
    if (isAnalysingThisIndex) return;
    setAnalysingIndexName(namespace.name);
    window.setTimeout(() => {
      setImprovementsAnalysedByIndex((current) => ({ ...current, [namespace.name]: true }));
      setAnalysingIndexName(null);
    }, 2400);
  };

  const openReviewAll = () => {
    const prechecked = openReviewItems
      .filter((item) => !(item.changes ?? []).some((change) => change.destructive))
      .map((item) => item.id);
    setReviewSelectedIds(prechecked);
    setReviewAllOpen(true);
  };

  const applyReviewedImprovements = () => {
    const ids = reviewSelectedIds.filter((id) =>
      openReviewItems.some((item) => item.id === id)
    );
    if (ids.length === 0) return;
    setReviewAllOpen(false);
    ids.forEach((id) => approveImprovement(id));
  };

  const analyseDisabledReason = signalsColdStart
    ? 'No signals yet. Signals appear once agents start using this index and traces come in.'
    : indexSignals.length === 0
      ? `No signals to analyze in the last ${signalWindowLabel}.`
      : null;

  const analyseAction = (
    <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
      <EuiFlexItem grow={false}>
        <EuiButton size="s" onClick={() => setConfigureFlyoutOpen(true)}>
          Configure
        </EuiButton>
      </EuiFlexItem>
      <EuiFlexItem grow={false}>
        <EuiButton
          fill
          size="s"
          isLoading={isAnalysingThisIndex}
          disabled={Boolean(analyseDisabledReason) || isAnalysingThisIndex}
          onClick={analyseSignals}
          data-test-subj="contextEngineAnalyzeSignals"
        >
          Analyze and propose fixes
        </EuiButton>
      </EuiFlexItem>
    </EuiFlexGroup>
  );

  const signalResultFor = (item: IndexSignal) => {
    if (!improvementsAnalysed) return { kind: 'pending' as const };
    const linked = improvementForSignal(item.id);
    if (linked) return { kind: 'improvement' as const, improvement: linked };
    if (item.analyzed === false) return { kind: 'pending' as const };
    return { kind: 'none' as const };
  };

  const signalsNotYetAnalyzed = indexSignals.filter(
    (item) => signalResultFor(item).kind === 'pending'
  ).length;
  const signalsSummary = signalsColdStart
    ? 'No signals yet'
    : signalsEmptyDetected
      ? `No issues detected in the last ${signalWindowLabel}`
      : `${indexSignals.length} distinct across ${signalOccurrenceTotal} occurrence${
          signalOccurrenceTotal === 1 ? '' : 's'
        } · updated hourly${
          signalsNotYetAnalyzed > 0
            ? ` · ${signalsNotYetAnalyzed} not yet analyzed`
            : ''
        }`;

  const signalTableColumns: Array<EuiBasicTableColumn<IndexSignal>> = [
    {
      field: 'label',
      name: 'Signal',
      render: (_label: string, item: IndexSignal) => (
        <>
          <EuiText size="s">{item.label}</EuiText>
          <EuiText size="xs" className="contextEnginePrototype__signalInternal">
            {item.type}
          </EuiText>
        </>
      ),
    },
    {
      field: 'whatHappened',
      name: 'What happened',
      truncateText: true,
    },
    {
      field: 'occurrences',
      name: 'Occurrences',
      width: '130px',
    },
    {
      field: 'lastSeen',
      name: 'Last seen',
      width: '140px',
    },
    {
      name: 'Result',
      render: (item: IndexSignal) => {
        const result = signalResultFor(item);
        if (result.kind === 'improvement') {
          return (
            <EuiLink
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                focusImprovement(result.improvement.id);
              }}
            >
              {result.improvement.title}
            </EuiLink>
          );
        }
        return (
          <EuiText size="s" color="subdued">
            {result.kind === 'pending' ? 'Not yet analyzed' : 'No fix proposed'}
          </EuiText>
        );
      },
    },
    {
      name: '',
      width: '36px',
      align: 'right',
      render: () => (
        <EuiIcon
          type="arrowRight"
          size="s"
          color="subdued"
          className="contextEnginePrototype__signalRowChevron"
        />
      ),
    },
  ];

  const measuredOutcome = (item: OverviewImprovement) => {
    const linkedType =
      (item.signalIds ?? [])
        .map((id) => indexSignals.find((signal) => signal.id === id))
        .find((signal): signal is IndexSignal => Boolean(signal))?.type ?? 'esql_error';
    const before = signalCounts[linkedType];
    const after = Math.max(1, Math.round(before * 0.14));
    return {
      strip: SIGNAL_TYPE_META[linkedType].strip,
      source: sourceNamedInFix(item.proposedFix),
      before,
      after,
    };
  };

  const renderAppliedOutcome = (item: OverviewImprovement) => {
    const outcome = improvementOutcomeById[item.id] ?? 'measuring';
    const appliedAt = improvementAppliedAtById[item.id];
    const relative = appliedAt ? formatAppliedAgo(appliedAt) : 'just now';
    if (outcome === 'measuring') {
      return (
        <EuiText size="s" color="subdued">
          Applied {relative} · measuring effect
        </EuiText>
      );
    }
    const measured = measuredOutcome(item);
    if (outcome === 'improved') {
      return (
        <EuiText size="s" color="success">
          <strong>
            {measured.strip} on {measured.source} down from {measured.before} to {measured.after}{' '}
            since applied
          </strong>
        </EuiText>
      );
    }
    return (
      <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
        <EuiFlexItem grow={false}>
          <EuiText
            size="s"
            className="contextEnginePrototype__improvementOutcome--unchanged"
          >
            {measured.strip} on {measured.source} unchanged since applied
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty size="xs" flush="both" onClick={() => proposeAnotherFix(item.id)}>
            Propose another fix
          </EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  };

  const renderImprovementRow = (item: OverviewImprovement, group: ImprovementGroup) => {
    const status = improvementStatus(item.id);
    const pending = improvementPendingById[item.id];
    const showDismissed = group === 'dismissed' || pending === 'dismissed';
    const showApplied = group === 'applied' || pending === 'applied';
    const showActions = group === 'open' && status === 'open' && !pending;
    const sourceSignals = signalsByIds(indexSignals, item.signalIds ?? []);
    const sourceLine = formatSignalSourceLine(sourceSignals);
    const isExpanded = expandedImprovementId === item.id;
    const chipLine = (item.changes ?? []).map((change) => improvementChangeLabel(change)).join(' · ');
    const rowClass = [
      'contextEnginePrototype__improvementRow',
      isExpanded ? 'contextEnginePrototype__improvementRow--expanded' : '',
      showApplied && improvementOutcomeById[item.id] === 'improved'
        ? 'contextEnginePrototype__improvementRow--applied'
        : '',
      showApplied && improvementOutcomeById[item.id] === 'measuring'
        ? 'contextEnginePrototype__improvementRow--measuring'
        : '',
      showApplied && improvementOutcomeById[item.id] === 'unchanged'
        ? 'contextEnginePrototype__improvementRow--unchanged'
        : '',
      showDismissed ? 'contextEnginePrototype__improvementRow--dismissed' : '',
      improvementDepartingIds.includes(item.id)
        ? 'contextEnginePrototype__improvementRow--departing'
        : '',
      highlightedImprovementId === item.id
        ? 'contextEnginePrototype__improvementRow--highlight'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div key={item.id} id={`context-engine-11-improvement-${item.id}`} className={rowClass}>
        <button
          type="button"
          className="contextEnginePrototype__improvementRowHeader"
          aria-expanded={isExpanded}
          onClick={() =>
            setExpandedImprovementId((current) => (current === item.id ? null : item.id))
          }
        >
          <EuiIcon type={isExpanded ? 'arrowDown' : 'arrowRight'} size="s" />
          <span className="contextEnginePrototype__improvementRowMain">
            <span className="contextEnginePrototype__improvementRowTitle">{item.title}</span>
            {chipLine ? (
              <span className="contextEnginePrototype__improvementRowSub">{chipLine}</span>
            ) : null}
          </span>
          <span className="contextEnginePrototype__improvementMeta">
            {item.casesCount} cases · last seen {item.lastSeen}
          </span>
        </button>
        {isExpanded ? (
          <div className="contextEnginePrototype__improvementDetails">
            {sourceSignals.length > 0 ? (
              <EuiLink
                className="contextEnginePrototype__improvementSourceLink"
                onClick={(event) => {
                  event.preventDefault();
                  focusSignals(item.signalIds ?? []);
                }}
              >
                {sourceLine}
              </EuiLink>
            ) : null}
            <EuiText size="s" color="subdued">
              {item.description}
            </EuiText>
            {!showDismissed ? (
              <div className="contextEnginePrototype__improvementFix">
                <EuiText size="s">
                  <strong>Proposed fix:</strong> {item.proposedFix}
                </EuiText>
              </div>
            ) : null}
            {showApplied ? renderAppliedOutcome(item) : null}
          </div>
        ) : null}
        <div
          className="contextEnginePrototype__improvementActions"
          onClick={(event) => event.stopPropagation()}
        >
          {showActions ? (
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false} wrap>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty size="s" flush="both" onClick={() => approveImprovement(item.id)}>
                  Approve fix
                </EuiButtonEmpty>
              </EuiFlexItem>
              {isExpanded ? (
                <>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      flush="both"
                      iconType="productAgent"
                      onClick={() => onRefine?.(item)}
                    >
                      Refine with agent
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButtonEmpty
                      size="s"
                      flush="both"
                      iconSide="right"
                      iconType="arrowRight"
                      onClick={() => setEvidenceImprovementId(item.id)}
                    >
                      View evidence
                    </EuiButtonEmpty>
                  </EuiFlexItem>
                </>
              ) : null}
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty size="s" color="text" onClick={() => dismissImprovement(item.id)}>
                  Dismiss
                </EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>
          ) : null}
          {showDismissed ? (
            <EuiButtonEmpty size="xs" flush="both" onClick={() => undoDismissImprovement(item.id)}>
              Undo
            </EuiButtonEmpty>
          ) : null}
        </div>
      </div>
    );
  };

  const renderGroupToggle = (
    label: string,
    count: number,
    expanded: boolean,
    onToggle: () => void
  ) => (
    <button
      type="button"
      className="contextEnginePrototype__improvementGroupToggle"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <EuiIcon type={expanded ? 'arrowDown' : 'arrowRight'} size="s" />
      <span>
        {label} · {count}
      </span>
    </button>
  );

  return (
    <div className="contextEnginePrototype__panels">
      <EuiPanel
        hasBorder
        paddingSize="none"
        className="contextEnginePrototype__panel"
        id="context-engine-11-improvements"
        data-test-subj="contextEngineImprovements"
      >
        <div className="contextEnginePrototype__panelHeader">
          <div className="contextEnginePrototype__panelHeaderText">
            <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs" className="contextEnginePrototype__panelTitle">
                  <h2>Improvements</h2>
                </EuiTitle>
              </EuiFlexItem>
              {tracesAnalysed > 0 && improvementsAnalysed ? (
                <EuiFlexItem grow={false}>
                  <EuiBadge
                    color="accent"
                    className="contextEnginePrototype__improvementsOpenBadge"
                  >
                    {openImprovementsCount} open
                  </EuiBadge>
                </EuiFlexItem>
              ) : null}
            </EuiFlexGroup>
            <EuiText size="s" color="subdued" className="contextEnginePrototype__panelDesc">
              Approving a fix applies it. Nothing changes without you.
            </EuiText>
          </div>
          {improvementsAnalysed && openReviewItems.length > 0 ? (
            <div className="contextEnginePrototype__panelActions">
              <EuiButton
                size="s"
                onClick={openReviewAll}
                data-test-subj="contextEngineReviewAllImprovements"
              >
                Review all
              </EuiButton>
            </div>
          ) : null}
        </div>
        <div className="contextEnginePrototype__panelBody">
          {tracesAnalysed === 0 ? (
            <EuiText size="s">Improvements are proposed from signals. None yet.</EuiText>
          ) : !improvementsAnalysed ? (
            <EuiText size="s">No fixes proposed yet. Analyze your signals to get suggestions.</EuiText>
          ) : (
            <div className="contextEnginePrototype__improvementsGroups">
              {openImprovements.length === 0 &&
              (appliedImprovements.length > 0 || dismissedImprovements.length > 0) ? (
                <EuiText size="s" color="subdued">
                  Nothing to review right now. New improvements appear when signals are analyzed.
                </EuiText>
              ) : null}
              {openImprovements.length > 0 ? (
                <div className="contextEnginePrototype__improvementGroup">
                  {anotherGroupExpanded ? (
                    <>
                      <div className="contextEnginePrototype__improvementGroupLabel">
                        Open · {openImprovements.length}
                      </div>
                      <EuiSpacer size="s" />
                    </>
                  ) : null}
                  <div className="contextEnginePrototype__improvementsList">
                    {openImprovements.map((item) => renderImprovementRow(item, 'open'))}
                  </div>
                </div>
              ) : null}
              {appliedImprovements.length > 0 ? (
                <div className="contextEnginePrototype__improvementGroup">
                  {renderGroupToggle(
                    'Applied',
                    appliedImprovements.length,
                    appliedGroupOpen,
                    () => setAppliedGroupOpen((current) => !current)
                  )}
                  {appliedGroupOpen ? (
                    <>
                      <EuiSpacer size="s" />
                      <div className="contextEnginePrototype__improvementsList">
                        {appliedImprovements.map((item) => renderImprovementRow(item, 'applied'))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              {dismissedImprovements.length > 0 ? (
                <div className="contextEnginePrototype__improvementGroup">
                  {renderGroupToggle(
                    'Dismissed',
                    dismissedImprovements.length,
                    dismissedGroupOpen,
                    () => setDismissedGroupOpen((current) => !current)
                  )}
                  {dismissedGroupOpen ? (
                    <>
                      <EuiSpacer size="s" />
                      <div className="contextEnginePrototype__improvementsList">
                        {dismissedImprovements.map((item) =>
                          renderImprovementRow(item, 'dismissed')
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </EuiPanel>

      <EuiPanel
        hasBorder
        paddingSize="none"
        className="contextEnginePrototype__panel"
        id="context-engine-11-signals"
        data-test-subj="contextEngineSignals"
      >
        <div className="contextEnginePrototype__signalsHeader">
          <button
            type="button"
            className="contextEnginePrototype__signalsToggle"
            aria-expanded={signalsExpanded}
            onClick={() => setSignalsExpanded((current) => !current)}
          >
            <EuiIcon type={signalsExpanded ? 'arrowDown' : 'arrowRight'} size="s" />
            <span className="contextEnginePrototype__signalsToggleCopy">
              <span className="contextEnginePrototype__signalsToggleTitle">Signals</span>
              <span className="contextEnginePrototype__signalsToggleSummary">
                · {signalsSummary}
              </span>
            </span>
          </button>
          <div
            className="contextEnginePrototype__panelActions"
            onClick={(event) => event.stopPropagation()}
          >
            {analyseAction}
          </div>
        </div>
        {signalsExpanded ? (
          <div className="contextEnginePrototype__panelBody">
            {signalsColdStart ? (
              <EuiText size="s">
                No signals yet. Signals appear once agents start using this index and traces come in.
              </EuiText>
            ) : signalsEmptyDetected ? null : (
              <>
                <div className="contextEnginePrototype__signalStrip">
                  {SIGNAL_TYPE_ORDER.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`contextEnginePrototype__signalStripItem${
                        signalFilter.mode === 'type' && signalFilter.type === type
                          ? ' contextEnginePrototype__signalStripItem--selected'
                          : ''
                      }`}
                      onClick={() => toggleTypeFilter(type)}
                    >
                      <EuiText size="s">
                        <strong>
                          {`${SIGNAL_TYPE_META[type].strip} · ${signalDistinct[type]} signal${
                            signalDistinct[type] === 1 ? '' : 's'
                          } · ${signalCounts[type]} occurrence${
                            signalCounts[type] === 1 ? '' : 's'
                          }`}
                        </strong>
                      </EuiText>
                    </button>
                  ))}
                </div>
                {signalFilter.mode !== 'all' ? (
                  <>
                    <EuiSpacer size="s" />
                    <EuiText size="xs" color="subdued">
                      {`Showing ${filteredSignals.length} of ${indexSignals.length} signals`}
                    </EuiText>
                  </>
                ) : null}
                <EuiSpacer size="m" />
                <EuiBasicTable
                  items={filteredSignals}
                  columns={signalTableColumns}
                  rowProps={(item) => ({
                    className: `contextEnginePrototype__signalTableRow${
                      highlightedSignalIds.includes(item.id)
                        ? ' contextEnginePrototype__signalTableRow--highlight'
                        : ''
                    }`,
                    onClick: () => setSelectedSignalTraceId(item.traceId),
                  })}
                  noItemsMessage="No signals match this filter."
                />
              </>
            )}
          </div>
        ) : null}
      </EuiPanel>

      {evidenceImprovement ? (
        <EuiFlyout
          ownFocus
          size="m"
          onClose={() => setEvidenceImprovementId(null)}
          aria-labelledby="context-engine-11-improvement-flyout-title"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="s">
              <h2 id="context-engine-11-improvement-flyout-title">{evidenceImprovement.title}</h2>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Improvement · found in agent traces
            </EuiText>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            <EuiCallOut title="What we found" color="primary" size="s">
              <p>{evidenceImprovement.findingDetail}</p>
            </EuiCallOut>
            <EuiSpacer size="m" />
            <div className="contextEnginePrototype__improvementFix">
              <EuiText size="s">
                <strong>Proposed fix:</strong> {evidenceImprovement.proposedFix}
              </EuiText>
            </div>
            <EuiSpacer size="s" />
            <ImprovementChangeChips changes={evidenceImprovement.changes} />
            <EuiSpacer size="m" />
            <EuiText size="xs">
              <strong>Signals</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <div className="contextEnginePrototype__signalEvidenceList">
              {evidenceSignals.map((signal) => (
                <button
                  key={signal.id}
                  type="button"
                  className="contextEnginePrototype__signalEvidenceRow"
                  onClick={() => setSelectedSignalTraceId(signal.traceId)}
                >
                  <EuiText size="s">
                    <strong>{signal.label}</strong>
                    {' · '}
                    {signal.whatHappened}
                  </EuiText>
                  <EuiText size="xs" color="subdued">
                    {signal.occurrences} occurrences · last seen {signal.lastSeen}
                  </EuiText>
                </button>
              ))}
            </div>
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiFlexGroup justifyContent="spaceBetween" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={() => setEvidenceImprovementId(null)}>Close</EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                {improvementStatus(evidenceImprovement.id) === 'open' &&
                !improvementPendingById[evidenceImprovement.id] ? (
                  <EuiButton
                    fill
                    onClick={() => {
                      const id = evidenceImprovement.id;
                      setEvidenceImprovementId(null);
                      approveImprovement(id);
                    }}
                  >
                    Approve fix
                  </EuiButton>
                ) : null}
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlyoutFooter>
        </EuiFlyout>
      ) : null}

      {selectedSignalTrace ? (
        <EuiFlyout
          ownFocus
          size="m"
          onClose={() => setSelectedSignalTraceId(null)}
          aria-labelledby="context-engine-11-signal-trace-title"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="s">
              <h2 id="context-engine-11-signal-trace-title">Trace</h2>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiHealth color={selectedSignalTrace.status === 'error' ? 'danger' : 'success'}>
              <EuiCode>{selectedSignalTrace.id}</EuiCode>
            </EuiHealth>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            <EuiText size="s" color="subdued">
              {selectedSignalTrace.agent} · {selectedSignalTrace.model} ·{' '}
              {selectedSignalTrace.taskType} · {selectedSignalTrace.timestamp}
            </EuiText>
            <EuiSpacer size="m" />
            <EuiPanel hasBorder paddingSize="s">
              <EuiStat title={selectedSignalTrace.duration} description="Duration" titleSize="s" />
            </EuiPanel>
            <EuiSpacer size="m" />
            <EuiPanel hasBorder paddingSize="m">
              <EuiText size="xs" color="subdued">
                <strong>User request</strong>
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiText size="s">{selectedSignalTrace.userRequest}</EuiText>
            </EuiPanel>
            <EuiSpacer size="s" />
            <EuiPanel hasBorder paddingSize="m">
              <EuiText size="xs" color="subdued">
                <strong>Final response</strong>
              </EuiText>
              <EuiSpacer size="xs" />
              <EuiText size="s">{selectedSignalTrace.finalResponse}</EuiText>
            </EuiPanel>
            <EuiSpacer size="m" />
            <EuiPanel hasBorder paddingSize="m">
              <EuiTitle size="xs">
                <h3>Span waterfall</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              {selectedSignalTrace.spans.map((span) => (
                <div key={span.id}>
                  <div
                    className="contextEnginePrototype__amSpan"
                    style={{ paddingLeft: span.depth * 16 }}
                  >
                    <div className="contextEnginePrototype__amSpanMeta">
                      <EuiBadge color={span.error ? 'danger' : 'hollow'}>{span.kind}</EuiBadge>
                      <EuiText size="s">
                        <strong>{span.name}</strong>
                        {span.error ? ' · error' : ''}
                      </EuiText>
                      {span.kind !== 'retrieval' && span.meta ? (
                        <EuiText size="xs" color="subdued">
                          {span.meta}
                        </EuiText>
                      ) : null}
                    </div>
                    <div className="contextEnginePrototype__amSpanTrack">
                      <div
                        className={`contextEnginePrototype__amSpanBar contextEnginePrototype__amSpanBar--${
                          span.error ? 'error' : span.kind
                        }`}
                        style={{ left: `${span.startPct}%`, width: `${span.widthPct}%` }}
                      />
                    </div>
                    <EuiText size="xs" className="contextEnginePrototype__amSpanDur">
                      {span.duration}
                    </EuiText>
                  </div>
                  {span.kind === 'retrieval' && span.meta ? (
                    <div
                      className="contextEnginePrototype__retrievalAnnotation"
                      style={{ marginLeft: span.depth * 16 }}
                    >
                      <EuiCallOut color="warning" size="s" title="Retrieval miss">
                        <p>{span.meta}</p>
                      </EuiCallOut>
                    </div>
                  ) : null}
                </div>
              ))}
            </EuiPanel>
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiButtonEmpty onClick={() => setSelectedSignalTraceId(null)}>Close</EuiButtonEmpty>
          </EuiFlyoutFooter>
        </EuiFlyout>
      ) : null}

      {reviewAllOpen ? (
        <EuiFlyout
          ownFocus
          size="m"
          onClose={() => setReviewAllOpen(false)}
          aria-labelledby="context-engine-11-review-all-title"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="s">
              <h2 id="context-engine-11-review-all-title">Review all</h2>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText size="s" color="subdued">
              Choose which open improvements to apply. Destructive changes stay unchecked.
            </EuiText>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            {openReviewItems.map((item) => {
              const checked = reviewSelectedIds.includes(item.id);
              const hasDestructive = (item.changes ?? []).some((change) => change.destructive);
              return (
                <div key={item.id} className="contextEnginePrototype__reviewAllRow">
                  <EuiCheckbox
                    id={`review-improvement-${item.id}`}
                    checked={checked}
                    onChange={() => {
                      setReviewSelectedIds((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id]
                      );
                    }}
                    label={
                      <div>
                        <EuiText size="s">
                          <strong>{item.title}</strong>
                        </EuiText>
                        <EuiSpacer size="xs" />
                        <ImprovementChangeChips changes={item.changes} />
                        {hasDestructive ? (
                          <>
                            <EuiSpacer size="xs" />
                            <EuiText size="xs" color="warning">
                              Includes a destructive change.
                            </EuiText>
                          </>
                        ) : null}
                      </div>
                    }
                  />
                </div>
              );
            })}
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiFlexGroup justifyContent="spaceBetween" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty onClick={() => setReviewAllOpen(false)}>Cancel</EuiButtonEmpty>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  fill
                  disabled={reviewSelectedCount === 0}
                  onClick={applyReviewedImprovements}
                >
                  Apply {reviewSelectedCount} {reviewSelectedCount === 1 ? 'change' : 'changes'}
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlyoutFooter>
        </EuiFlyout>
      ) : null}

      {configureFlyoutOpen ? (
        <EuiFlyout
          ownFocus
          size="m"
          onClose={() => {
            setConfigureFlyoutOpen(false);
            setRunNowNotice(null);
          }}
          aria-labelledby="context-engine-11-configure-title"
        >
          <EuiFlyoutHeader hasBorder>
            <EuiTitle size="s">
              <h2 id="context-engine-11-configure-title">Configure improvements</h2>
            </EuiTitle>
            <EuiSpacer size="xs" />
            <EuiText size="s" color="subdued">
              How often the improvement agent runs, which signals it considers, and what it may
              change.
            </EuiText>
          </EuiFlyoutHeader>
          <EuiFlyoutBody>
            <EuiText size="xs">
              <strong>Schedule</strong>
            </EuiText>
            <EuiSpacer size="s" />
            <EuiRadio
              id="improvement-schedule-daily"
              label="Daily"
              checked={improvementSchedule === 'daily'}
              onChange={() => setImprovementSchedule('daily')}
            />
            <EuiSpacer size="xs" />
            <EuiRadio
              id="improvement-schedule-weekly"
              label="Weekly"
              checked={improvementSchedule === 'weekly'}
              onChange={() => setImprovementSchedule('weekly')}
            />
            <EuiSpacer size="xs" />
            <EuiRadio
              id="improvement-schedule-manual"
              label="Manual only"
              checked={improvementSchedule === 'manual'}
              onChange={() => setImprovementSchedule('manual')}
            />
            <EuiSpacer size="l" />
            <EuiText size="xs">
              <strong>Signal window</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Windowing keeps the agent from being overwhelmed by too much context.
            </EuiText>
            <EuiSpacer size="s" />
            <EuiRadio
              id="signal-window-7d"
              label="Last 7 days"
              checked={signalWindow === '7d'}
              onChange={() => setSignalWindow('7d')}
            />
            <EuiSpacer size="xs" />
            <EuiRadio
              id="signal-window-30d"
              label="Last 30 days"
              checked={signalWindow === '30d'}
              onChange={() => setSignalWindow('30d')}
            />
            <EuiSpacer size="xs" />
            <EuiRadio
              id="signal-window-lastn"
              label="Last N signals"
              checked={signalWindow === 'lastN'}
              onChange={() => setSignalWindow('lastN')}
            />
            {signalWindow === 'lastN' ? (
              <>
                <EuiSpacer size="s" />
                <EuiFormRow label="Number of signals">
                  <EuiFieldText
                    value={signalWindowN}
                    onChange={(event) => setSignalWindowN(event.target.value)}
                    compressed
                  />
                </EuiFormRow>
              </>
            ) : null}
            <EuiSpacer size="l" />
            <EuiText size="xs">
              <strong>What the agent may change</strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiText size="xs" color="subdued">
              Broader permissions let the agent fix more on its own, but it can also change things
              you rely on.
            </EuiText>
            <EuiSpacer size="s" />
            {(Object.keys(AGENT_CHANGE_OBJECT_LABELS) as AgentChangeObject[]).map((objectKey) => (
              <div key={objectKey} className="contextEnginePrototype__configurePermGroup">
                <EuiText size="s">
                  <strong>{AGENT_CHANGE_OBJECT_LABELS[objectKey]}</strong>
                </EuiText>
                <EuiSpacer size="xs" />
                <EuiFlexGroup gutterSize="m" responsive={false} wrap>
                  {AGENT_CHANGE_OPS.map((op) => (
                    <EuiFlexItem grow={false} key={op}>
                      <EuiCheckbox
                        id={`agent-may-${objectKey}-${op}`}
                        label={op.charAt(0).toUpperCase() + op.slice(1)}
                        checked={agentMayChange[objectKey][op]}
                        onChange={() =>
                          setAgentMayChange((current) => ({
                            ...current,
                            [objectKey]: {
                              ...current[objectKey],
                              [op]: !current[objectKey][op],
                            },
                          }))
                        }
                      />
                    </EuiFlexItem>
                  ))}
                </EuiFlexGroup>
              </div>
            ))}
            <EuiSpacer size="l" />
            <EuiButton
              fill
              onClick={() =>
                setRunNowNotice('Started. Proposed fixes will appear in Improvements.')
              }
            >
              Run now
            </EuiButton>
            {runNowNotice ? (
              <>
                <EuiSpacer size="s" />
                <EuiText size="s" color="subdued">
                  {runNowNotice}
                </EuiText>
              </>
            ) : null}
          </EuiFlyoutBody>
          <EuiFlyoutFooter>
            <EuiButtonEmpty
              onClick={() => {
                setConfigureFlyoutOpen(false);
                setRunNowNotice(null);
              }}
            >
              Close
            </EuiButtonEmpty>
          </EuiFlyoutFooter>
        </EuiFlyout>
      ) : null}
    </div>
  );
};
