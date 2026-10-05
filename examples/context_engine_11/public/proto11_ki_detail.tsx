/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { css } from '@emotion/react';
import {
  EuiBadge,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiCode,
  EuiCodeBlock,
  EuiConfirmModal,
  EuiCopy,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFlyout,
  EuiFlyoutBody,
  EuiFlyoutFooter,
  EuiFlyoutHeader,
  EuiIcon,
  EuiLink,
  EuiSpacer,
  EuiTab,
  EuiTabs,
  EuiText,
  EuiTitle,
  EuiToolTip,
  useEuiTheme,
  useGeneratedHtmlId,
} from '@elastic/eui';

import {
  hydrateIndicator,
  indicatorSourceLabel,
  slugify,
  toIndicatorDocument,
  type HydratedKnowledgeIndicator,
  type KnowledgeIndicator,
} from './knowledge_indicators';
import type { Automation, NamespaceSource } from './namespace_data';
import { indicatorSourceGroup } from './proto11_data';
import { KiTypeBadge } from './proto11_ki_colors';

export type KiFeedbackMark = 'useful' | 'not';

const ASK_MESSAGE =
  'This Knowledge Indicator is wrong or incomplete. Update the automation that wrote it.';

const marks = new Map<string, KiFeedbackMark>();
let markSnapshot = new Map(marks);
const markListeners = new Set<() => void>();

const emitMarks = () => {
  markSnapshot = new Map(marks);
  markListeners.forEach((listener) => listener());
};

/** Records mock feedback so the row and the flyout share one badge. */
export const markKiFeedback = (id: string, mark: KiFeedbackMark) => {
  marks.set(id, mark);
  emitMarks();
};

const subscribeMarks = (listener: () => void) => {
  markListeners.add(listener);
  return () => {
    markListeners.delete(listener);
  };
};

export const useKiFeedback = (id: string): KiFeedbackMark | undefined =>
  useSyncExternalStore(
    subscribeMarks,
    () => markSnapshot.get(id),
    () => undefined
  );

export const kiFeedbackLabel = (mark: KiFeedbackMark): string =>
  mark === 'useful' ? 'Marked useful' : 'Marked not useful';

const FIELD_PATTERN = /@?[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)+/g;

const KiContent = ({ content }: { content: string }) => {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of content.matchAll(FIELD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(content.slice(cursor, index));
    const field = match[0];
    nodes.push(<EuiCode key={`${index}-${field}`}>{field}</EuiCode>);
    cursor = index + field.length;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));
  return (
    <EuiText
      size="s"
      css={css`
        white-space: pre-wrap;
      `}
    >
      <p>{nodes}</p>
    </EuiText>
  );
};

const SectionLabel = ({ children }: { children: string }) => {
  const { euiTheme } = useEuiTheme();
  return (
    <EuiText
      size="xs"
      css={css`
        font-weight: ${euiTheme.font.weight.semiBold};
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: ${euiTheme.colors.subduedText};
      `}
    >
      <p>{children}</p>
    </EuiText>
  );
};

const labelForKey = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const formatAttribute = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map((item) => formatAttribute(item)).join(', ');
  return 'No data';
};

const relatedId = (uri: string) => uri.replace(/^ki:\/\//, '');

const createdByAutomation = (
  indicator: KnowledgeIndicator,
  automations: Automation[]
): Automation | undefined => {
  const uri = indicator.governance.provenance.created_by.uri;
  if (!uri.startsWith('workflow://')) return undefined;
  const slug = uri.slice('workflow://'.length);
  return automations.find((automation) => slugify(automation.title) === slug);
};

const historyLabel = (
  version: number,
  currentVersion: number
): 'Created' | 'Re-run' | 'Superseded' => {
  if (version === 1) return 'Created';
  if (version === currentVersion) return 'Re-run';
  return 'Superseded';
};

const openAgentFallback = () => {
  document
    .querySelector<HTMLButtonElement>(
      '[data-test-subj="AgentBuilderNavControlButton"], [data-test-subj="AgentBuilderNavControlButtonIcon"]'
    )
    ?.click();
};

/** Structured Knowledge Indicator document. Replaces the raw JSON flyout. */
export const KiDetailFlyout = ({
  indicator,
  indicators,
  sample,
  discoverHref,
  automations = [],
  sources = [],
  agent,
  resolveIndicator,
  onOpenAutomation,
  onAskAgent,
  onDelete,
  onClose,
}: {
  indicator: KnowledgeIndicator;
  indicators: KnowledgeIndicator[];
  sample: boolean;
  discoverHref: string;
  automations?: Automation[];
  sources?: NamespaceSource[];
  agent?: string;
  resolveIndicator?: (id: string) => KnowledgeIndicator | undefined;
  onOpenAutomation?: (automation: Automation) => void;
  onAskAgent?: (indicator: KnowledgeIndicator, message: string) => void;
  onDelete?: (indicator: KnowledgeIndicator) => void;
  onClose: () => void;
}) => {
  const { euiTheme } = useEuiTheme();
  const titleId = useGeneratedHtmlId({ prefix: 'proto11KiDetail' });
  const deleteTitleId = useGeneratedHtmlId({ prefix: 'proto11KiDelete' });
  const [stack, setStack] = useState<string[]>([]);
  const [tab, setTab] = useState<'details' | 'json'>('details');
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setStack([]);
    setTab('details');
    setJsonExpanded(false);
    setConfirmDelete(false);
  }, [indicator.id]);

  const catalog = useMemo(() => {
    const map = new Map<string, KnowledgeIndicator>();
    indicators.forEach((item) => map.set(item.id, item));
    map.set(indicator.id, indicator);
    return map;
  }, [indicator, indicators]);

  const viewedId = stack[stack.length - 1] ?? indicator.id;
  const current = catalog.get(viewedId) ?? resolveIndicator?.(viewedId) ?? indicator;
  const feedback = useKiFeedback(current.id);
  const hydrated: HydratedKnowledgeIndicator = hydrateIndicator(current, automations);
  const source = indicatorSourceGroup(current, sources, agent);
  const automation = createdByAutomation(current, automations);
  const created = hydrated.versions.find((version) => version.version === 1);
  const expires = current.attributes?.expires_at;
  const exampleQuery =
    typeof current.attributes?.example_esql === 'string'
      ? current.attributes.example_esql
      : undefined;
  const attributeEntries = Object.entries(current.attributes ?? {}).filter(
    ([key]) => key !== 'example_esql'
  );
  const related = current.references
    .filter((reference) => reference.relation === 'relates_to')
    .map((reference) => relatedId(reference.uri))
    .map((id) => catalog.get(id) ?? resolveIndicator?.(id))
    .filter((item): item is KnowledgeIndicator => Boolean(item));
  const history = [...hydrated.versions].sort((a, b) => b.version - a.version);

  const ask = () => {
    if (onAskAgent) {
      onAskAgent(current, ASK_MESSAGE);
      return;
    }
    openAgentFallback();
  };

  return (
    <>
      <EuiFlyout
        ownFocus
        size="m"
        onClose={onClose}
        aria-labelledby={titleId}
        data-test-subj="proto11KiDetail"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
            {stack.length > 0 ? (
              <EuiFlexItem grow={false}>
                <EuiToolTip content="Back">
                  <EuiButtonIcon
                    iconType="arrowLeft"
                    aria-label="Back to the previous Knowledge Indicator"
                    onClick={() => setStack((prev) => prev.slice(0, -1))}
                    data-test-subj="proto11KiDetailBack"
                  />
                </EuiToolTip>
              </EuiFlexItem>
            ) : null}
            <EuiFlexItem>
              <EuiTitle size="s">
                <h2 id={titleId}>{current.title}</h2>
              </EuiTitle>
            </EuiFlexItem>
          </EuiFlexGroup>
          {current.description ? (
            <>
              <EuiSpacer size="xs" />
              <EuiText size="s" color="subdued">
                <p>{current.description}</p>
              </EuiText>
            </>
          ) : null}
          <EuiSpacer size="s" />
          <EuiFlexGroup gutterSize="xs" responsive={false} wrap alignItems="center">
            {sample ? (
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">Sample</EuiBadge>
              </EuiFlexItem>
            ) : null}
            <EuiFlexItem grow={false}>
              <KiTypeBadge type={current.type} />
            </EuiFlexItem>
            {feedback ? (
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow" data-test-subj="proto11KiFeedbackBadge">
                  {kiFeedbackLabel(feedback)}
                </EuiBadge>
              </EuiFlexItem>
            ) : null}
          </EuiFlexGroup>
          <EuiSpacer size="m" />
          <EuiTabs size="s">
            <EuiTab
              isSelected={tab === 'details'}
              onClick={() => setTab('details')}
              data-test-subj="proto11KiDetailTab-details"
            >
              Details
            </EuiTab>
            <EuiTab
              isSelected={tab === 'json'}
              onClick={() => setTab('json')}
              data-test-subj="proto11KiDetailTab-json"
            >
              JSON
            </EuiTab>
          </EuiTabs>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          {tab === 'json' ? (
            <>
              <EuiButtonEmpty
                size="s"
                onClick={() => setJsonExpanded((expanded) => !expanded)}
                data-test-subj="proto11KiJsonExpand"
              >
                {jsonExpanded ? 'Collapse' : 'Expand'}
              </EuiButtonEmpty>
              <EuiSpacer size="s" />
              <EuiCodeBlock
                language="json"
                fontSize="s"
                paddingSize="m"
                isCopyable
                overflowHeight={jsonExpanded ? undefined : 320}
              >
                {JSON.stringify(toIndicatorDocument(current), null, 2)}
              </EuiCodeBlock>
            </>
          ) : (
            <>
              <SectionLabel>Content</SectionLabel>
              <EuiSpacer size="s" />
              <KiContent content={current.content} />
              {exampleQuery ? (
                <>
                  <EuiSpacer size="l" />
                  <SectionLabel>Example query</SectionLabel>
                  <EuiSpacer size="s" />
                  <EuiCodeBlock
                    language="esql"
                    fontSize="s"
                    paddingSize="m"
                    data-test-subj="proto11KiExampleQuery"
                  >
                    {exampleQuery}
                  </EuiCodeBlock>
                  <EuiSpacer size="s" />
                  <EuiFlexGroup gutterSize="s" responsive={false} wrap>
                    <EuiFlexItem grow={false}>
                      <EuiCopy textToCopy={exampleQuery}>
                        {(copy) => (
                          <EuiButtonEmpty
                            size="s"
                            iconType="copy"
                            onClick={copy}
                            data-test-subj="proto11KiQueryCopy"
                          >
                            Copy
                          </EuiButtonEmpty>
                        )}
                      </EuiCopy>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiButtonEmpty
                        size="s"
                        iconType="popout"
                        iconSide="right"
                        href={discoverHref}
                        target="_blank"
                        data-test-subj="proto11KiOpenDiscover"
                      >
                        Open in Discover
                      </EuiButtonEmpty>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </>
              ) : null}
              {attributeEntries.length > 0 ? (
                <>
                  <EuiSpacer size="l" />
                  <SectionLabel>Attributes</SectionLabel>
                  <EuiSpacer size="s" />
                  <div
                    css={css`
                      display: grid;
                      grid-template-columns: minmax(${euiTheme.size.xxxl}, 180px) 1fr;
                      column-gap: ${euiTheme.size.m};
                      row-gap: ${euiTheme.size.s};
                      align-items: start;
                    `}
                  >
                    {attributeEntries.map(([key, value]) => (
                      <React.Fragment key={key}>
                        <EuiText size="s">
                          <p>{labelForKey(key)}</p>
                        </EuiText>
                        {key === 'tags' && isStringArray(value) ? (
                          <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
                            {value.map((tag) => (
                              <EuiFlexItem grow={false} key={tag}>
                                <EuiBadge color="hollow">{tag}</EuiBadge>
                              </EuiFlexItem>
                            ))}
                          </EuiFlexGroup>
                        ) : (
                          <EuiText size="s" color="subdued">
                            <p>{formatAttribute(value)}</p>
                          </EuiText>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              ) : null}
              <EuiSpacer size="l" />
              <SectionLabel>Where it came from</SectionLabel>
              <EuiSpacer size="s" />
              <div
                css={css`
                  display: grid;
                  grid-template-columns: minmax(${euiTheme.size.xxxl}, 180px) 1fr;
                  column-gap: ${euiTheme.size.m};
                  row-gap: ${euiTheme.size.s};
                  align-items: center;
                `}
              >
                <EuiText size="s">
                  <p>Source</p>
                </EuiText>
                <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false} wrap>
                  <EuiFlexItem grow={false}>
                    <EuiText size="s">
                      <p>{source.name || indicatorSourceLabel(current)}</p>
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="hollow">{source.kind}</EuiBadge>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiText size="s">
                  <p>Created by</p>
                </EuiText>
                {automation && onOpenAutomation ? (
                  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon type="bolt" size="m" aria-hidden={true} />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiLink
                        onClick={() => onOpenAutomation(automation)}
                        data-test-subj="proto11KiCreatedBy"
                      >
                        {automation.title}
                      </EuiLink>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                ) : (
                  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiIcon type="bolt" size="m" aria-hidden={true} />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s">
                        <p>{automation?.title ?? hydrated.extractedBy}</p>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                )}
                <EuiText size="s">
                  <p>Created</p>
                </EuiText>
                <EuiText size="s" color="subdued">
                  <p>{created?.when ?? 'No data'}</p>
                </EuiText>
                <EuiText size="s">
                  <p>Last verified</p>
                </EuiText>
                <EuiText size="s" color="subdued">
                  <p>Not verified</p>
                </EuiText>
                <EuiText size="s">
                  <p>Expires</p>
                </EuiText>
                <EuiText size="s" color="subdued">
                  <p>{typeof expires === 'string' ? expires : 'Does not expire'}</p>
                </EuiText>
              </div>
              {related.length > 0 ? (
                <>
                  <EuiSpacer size="l" />
                  <SectionLabel>Related Knowledge Indicators</SectionLabel>
                  <EuiSpacer size="s" />
                  <EuiFlexGroup gutterSize="xs" responsive={false} wrap>
                    {related.map((item) => (
                      <EuiFlexItem grow={false} key={item.id}>
                        <EuiBadge
                          color="hollow"
                          onClick={() =>
                            setStack((prev) => [
                              ...(prev.length > 0 ? prev : [indicator.id]),
                              item.id,
                            ])
                          }
                          onClickAriaLabel={`Open ${item.title}`}
                          data-test-subj="proto11KiRelated"
                        >
                          {item.title}
                        </EuiBadge>
                      </EuiFlexItem>
                    ))}
                  </EuiFlexGroup>
                </>
              ) : null}
              <EuiSpacer size="l" />
              <SectionLabel>History</SectionLabel>
              <EuiSpacer size="s" />
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: ${euiTheme.size.m};
                  border-left: ${euiTheme.border.thin};
                  padding-left: ${euiTheme.size.m};
                `}
                data-test-subj="proto11KiHistory"
              >
                {history.map((version) => {
                  const label = historyLabel(version.version, hydrated.currentVersion);
                  const superseded =
                    version.version === 1 && version.version !== hydrated.currentVersion;
                  return (
                    <div key={version.version}>
                      <EuiText size="s">
                        <p>
                          <strong>{label}</strong>
                          {superseded ? ', superseded by a later run' : null}
                        </p>
                      </EuiText>
                      <EuiText size="xs" color="subdued">
                        <p>
                          {automation?.title ?? version.source} · {version.when}
                        </p>
                      </EuiText>
                    </div>
                  );
                })}
              </div>
              <EuiSpacer size="l" />
              <SectionLabel>Was this useful?</SectionLabel>
              <EuiSpacer size="xs" />
              <EuiText size="xs" color="subdued">
                <p>Your feedback helps improve the automation that wrote this.</p>
              </EuiText>
              <EuiSpacer size="s" />
              <EuiFlexGroup gutterSize="s" responsive={false}>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Mark useful" disableScreenReaderOutput>
                    <EuiButtonIcon
                      iconType="thumbUp"
                      aria-label="Mark useful"
                      color={feedback === 'useful' ? 'primary' : 'text'}
                      onClick={() => markKiFeedback(current.id, 'useful')}
                      data-test-subj="proto11KiFeedbackUseful"
                    />
                  </EuiToolTip>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiToolTip content="Mark not useful" disableScreenReaderOutput>
                    <EuiButtonIcon
                      iconType="thumbDown"
                      aria-label="Mark not useful"
                      color={feedback === 'not' ? 'primary' : 'text'}
                      onClick={() => markKiFeedback(current.id, 'not')}
                      data-test-subj="proto11KiFeedbackNot"
                    />
                  </EuiToolTip>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
          )}
        </EuiFlyoutBody>
        <EuiFlyoutFooter>
          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                iconType="productAgent"
                onClick={ask}
                data-test-subj="proto11KiAskAgent"
              >
                Ask Elastic AI Agent to change this
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                color="danger"
                onClick={() => setConfirmDelete(true)}
                data-test-subj="proto11KiDelete"
              >
                Delete
              </EuiButtonEmpty>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlyoutFooter>
      </EuiFlyout>
      {confirmDelete ? (
        <EuiConfirmModal
          aria-labelledby={deleteTitleId}
          titleProps={{ id: deleteTitleId }}
          title="Delete this Knowledge Indicator?"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete?.(current);
            onClose();
          }}
          cancelButtonText="Cancel"
          confirmButtonText="Delete"
          buttonColor="danger"
          data-test-subj="proto11KiDeleteConfirm"
        >
          <p>The automation that wrote it can write it again on the next run.</p>
        </EuiConfirmModal>
      ) : null}
    </>
  );
};
