/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  EuiBadge,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiPanel,
  EuiSpacer,
  EuiText,
  EuiTitle,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import { CONTEXT_ENGINE_SETUP_PARAM, SAMPLE_INDICES } from './constants';
import { IndexPicker, ProgressBuild, SetupSummary, SkillsList } from './embeds';
import { setContextEngineSkillsPublished } from '../../utils/context_engine_state';

export const ContextEngineChat: React.FC<{ autoStart?: boolean }> = ({ autoStart = false }) => {
  const { euiTheme } = useEuiTheme();
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [selectedIndexIds, setSelectedIndexIds] = useState<string[]>(() =>
    SAMPLE_INDICES.map((index) => index.id)
  );

  const shellCss = css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  `;

  const scrollRegionCss = css`
    flex: 1;
    overflow-y: auto;
    padding: ${euiTheme.size.l} ${euiTheme.size.xl};
  `;

  const isSetupQueryEnabled = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(CONTEXT_ENGINE_SETUP_PARAM) === '1';
  }, []);

  useEffect(() => {
    if (autoStart || isSetupQueryEnabled) {
      setHasStarted(true);
      setCurrentStep(0);
    }
  }, [autoStart, isSetupQueryEnabled]);

  const stepLabel = i18n.translate('xpack.agentBuilder.contextEngine.chat.stepLabel', {
    defaultMessage: 'Step {current} of 3',
    values: {
      current: currentStep + 1,
    },
  });

  const toggleIndexSelection = (indexId: string) => {
    setSelectedIndexIds((previous) =>
      previous.includes(indexId)
        ? previous.filter((id) => id !== indexId)
        : [...previous, indexId]
    );
  };

  return (
    <div css={shellCss} data-test-subj="contextEngineChat">
      <div css={scrollRegionCss}>
        <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiTitle size="s">
              <h3>
                {isPublished
                  ? i18n.translate('xpack.agentBuilder.contextEngine.chat.completedTitle', {
                      defaultMessage: 'Context engine setup completed.',
                    })
                  : i18n.translate('xpack.agentBuilder.contextEngine.chat.title', {
                      defaultMessage: 'Context Engine setup',
                    })}
              </h3>
            </EuiTitle>
          </EuiFlexItem>
          {hasStarted && currentStep < 2 ? (
            <EuiFlexItem grow={false}>
              <EuiBadge color="hollow">{stepLabel}</EuiBadge>
            </EuiFlexItem>
          ) : null}
        </EuiFlexGroup>

        <EuiSpacer size="m" />

        {!hasStarted ? (
          <EuiPanel hasBorder paddingSize="m">
            <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h4>
                    {i18n.translate('xpack.agentBuilder.contextEngine.chat.nextStepsTitle', {
                      defaultMessage: 'Setup journey',
                    })}
                  </h4>
                </EuiTitle>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">
                  {i18n.translate('xpack.agentBuilder.contextEngine.chat.nextStepsDuration', {
                    defaultMessage: 'About 5 minutes',
                  })}
                </EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="m" />
            <EuiFlexGroup gutterSize="m">
              <EuiFlexItem>
                <EuiPanel color="subdued" paddingSize="s">
                  <EuiFlexGroup gutterSize="s" alignItems="flexStart">
                    <EuiFlexItem grow={false}>
                      <EuiPanel paddingSize="s" color="plain" hasBorder>
                        <EuiIcon type="database" color="primary" />
                      </EuiPanel>
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs">
                        <strong>
                          {i18n.translate('xpack.agentBuilder.contextEngine.chat.nextSteps.card1.title', {
                            defaultMessage: '1. Select indices',
                          })}
                        </strong>
                        <p>
                          {i18n.translate(
                            'xpack.agentBuilder.contextEngine.chat.nextSteps.card1.description',
                            {
                              defaultMessage: 'Pick the Elasticsearch sources to analyze.',
                            }
                          )}
                        </p>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiPanel color="subdued" paddingSize="s">
                  <EuiFlexGroup gutterSize="s" alignItems="flexStart">
                    <EuiFlexItem grow={false}>
                      <EuiPanel paddingSize="s" color="plain" hasBorder>
                        <EuiIcon type="visBarVertical" color="primary" />
                      </EuiPanel>
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs">
                        <strong>
                          {i18n.translate('xpack.agentBuilder.contextEngine.chat.nextSteps.card2.title', {
                            defaultMessage: '2. Review KIs + skills',
                          })}
                        </strong>
                        <p>
                          {i18n.translate(
                            'xpack.agentBuilder.contextEngine.chat.nextSteps.card2.description',
                            {
                              defaultMessage: 'Inspect extracted indicators and generated skills.',
                            }
                          )}
                        </p>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiPanel color="subdued" paddingSize="s">
                  <EuiFlexGroup gutterSize="s" alignItems="flexStart">
                    <EuiFlexItem grow={false}>
                      <EuiPanel paddingSize="s" color="plain" hasBorder>
                        <EuiIcon type="check" color="primary" />
                      </EuiPanel>
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiText size="xs">
                        <strong>
                          {i18n.translate('xpack.agentBuilder.contextEngine.chat.nextSteps.card3.title', {
                            defaultMessage: '3. Confirm + publish',
                          })}
                        </strong>
                        <p>
                          {i18n.translate(
                            'xpack.agentBuilder.contextEngine.chat.nextSteps.card3.description',
                            {
                              defaultMessage: 'Approve definitions and activate Context Engine.',
                            }
                          )}
                        </p>
                      </EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiPanel>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="m" />
            <EuiButton
              onClick={() => {
                setHasStarted(true);
                setCurrentStep(0);
              }}
              fill
            >
              {i18n.translate('xpack.agentBuilder.contextEngine.chat.startButton', {
                defaultMessage: 'Begin setup',
              })}
            </EuiButton>
          </EuiPanel>
        ) : (
          <EuiPanel hasBorder paddingSize="m">
            {currentStep === 0 ? (
              <>
                <EuiText size="s">
                  <p>
                    {i18n.translate('xpack.agentBuilder.contextEngine.chat.step1.description', {
                      defaultMessage:
                        "Choose which indices to analyze. You can include all sources now and refine later.",
                    })}
                  </p>
                </EuiText>
                <EuiSpacer size="m" />
                <IndexPicker
                  selectedIndexIds={selectedIndexIds}
                  onToggleIndex={toggleIndexSelection}
                  showAction={false}
                />
                <EuiSpacer size="m" />
                <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiText size="xs" color="subdued">
                      {i18n.translate('xpack.agentBuilder.contextEngine.chat.step1.selectionCount', {
                        defaultMessage: '{count} selected',
                        values: { count: selectedIndexIds.length },
                      })}
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton
                      fill
                      disabled={selectedIndexIds.length === 0}
                      onClick={() => setCurrentStep(1)}
                    >
                      {i18n.translate('xpack.agentBuilder.contextEngine.chat.step1.primaryAction', {
                        defaultMessage: 'Analyze selected indices',
                      })}
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </>
            ) : null}

            {currentStep === 1 ? (
              <>
                <EuiText size="s">
                  <p>
                    {i18n.translate('xpack.agentBuilder.contextEngine.chat.step2.description', {
                      defaultMessage:
                        "Analyzing selected indices to extract field definitions, naming conventions, computed metrics, and query patterns.",
                    })}
                  </p>
                </EuiText>
                <EuiSpacer size="m" />
                <ProgressBuild />
                <EuiSpacer size="m" />
                <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
                  <EuiFlexItem grow={false}>
                    <EuiButton onClick={() => setCurrentStep(0)}>
                      {i18n.translate('xpack.agentBuilder.contextEngine.chat.backAction', {
                        defaultMessage: 'Back',
                      })}
                    </EuiButton>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiButton fill onClick={() => setCurrentStep(2)}>
                      {i18n.translate('xpack.agentBuilder.contextEngine.chat.step2.primaryAction', {
                        defaultMessage: 'Continue to skills',
                      })}
                    </EuiButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                {isPublished ? (
                  <>
                    <EuiText size="s">
                      <p>
                        {i18n.translate('xpack.agentBuilder.contextEngine.chat.publishedMessage', {
                          defaultMessage:
                            "Updated. The Context Engine is now live with your confirmed definitions. Here's a summary of what's been published:",
                        })}
                      </p>
                    </EuiText>
                    <EuiSpacer size="m" />
                    <SetupSummary />
                  </>
                ) : (
                  <>
                    <EuiText size="s">
                      <p>
                        {i18n.translate('xpack.agentBuilder.contextEngine.chat.step3.description', {
                          defaultMessage:
                            'Knowledge indicators are ready. Review the generated skills and choose how to publish.',
                        })}
                      </p>
                    </EuiText>
                    <EuiSpacer size="m" />
                    <SkillsList
                      showActions={false}
                      onPublishAll={() => {
                        setIsPublished(true);
                        setContextEngineSkillsPublished(true);
                      }}
                      onReviewIndividually={() => undefined}
                    />
                    <EuiSpacer size="m" />
                    <EuiFlexGroup justifyContent="spaceBetween" alignItems="center" responsive={false}>
                      <EuiFlexItem grow={false}>
                        <EuiButton onClick={() => setCurrentStep(1)}>
                          {i18n.translate('xpack.agentBuilder.contextEngine.chat.backAction', {
                            defaultMessage: 'Back',
                          })}
                        </EuiButton>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButton
                          fill
                          color="primary"
                          onClick={() => {
                            setIsPublished(true);
                            setContextEngineSkillsPublished(true);
                          }}
                        >
                          {i18n.translate('xpack.agentBuilder.contextEngine.chat.step3.publishAction', {
                            defaultMessage: 'Publish all 4 skills',
                          })}
                        </EuiButton>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </>
                )}
              </>
            ) : null}
          </EuiPanel>
        )}
      </div>
    </div>
  );
};
