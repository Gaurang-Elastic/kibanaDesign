/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import { EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiText, EuiTextArea } from '@elastic/eui';
import { AI_AGENT_ICON } from './ai_agent';

export interface AutomationTweakInputProps {
  placeholder: string;
  buttonLabel?: string;
  hint?: string;
  isSubmitting?: boolean;
  onSubmit: (text: string) => void | Promise<void>;
  className?: string;
  /** Escalation into the AI Agent sidebar (agent icon, not sparkles). */
  onContinueInAgent?: (typedText: string) => void;
}

const DEFAULT_HINT =
  'Plain words, no YAML. The automation is adjusted and the sample reruns; results above update.';

/**
 * Plain-text tweak control (not a chat). User describes a change; parent applies it
 * to content above. No transcript, no YAML on this surface.
 */
export function AutomationTweakInput({
  placeholder,
  buttonLabel = 'Update automation',
  hint = DEFAULT_HINT,
  isSubmitting = false,
  onSubmit,
  className,
  onContinueInAgent,
}: AutomationTweakInputProps) {
  const [text, setText] = useState('');
  const canSubmit = text.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const value = text.trim();
    setText('');
    await Promise.resolve(onSubmit(value));
  };

  return (
    <div
      className={`contextEnginePrototype__automationTweak${className ? ` ${className}` : ''}`}
    >
      {/* Border on a plain wrapper so EuiFlexGroup gutter margins cannot indent the control. */}
      <div className="contextEnginePrototype__automationTweakRow">
        <EuiFlexGroup
          alignItems="flexStart"
          gutterSize="s"
          responsive={false}
          className="contextEnginePrototype__automationTweakRowInner contextEnginePrototype__controlWithAction"
        >
          <EuiFlexItem grow={true}>
            <EuiTextArea
              fullWidth
              compressed
              resize="vertical"
              rows={2}
              disabled={isSubmitting}
              placeholder={placeholder}
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-label={placeholder}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false} className="contextEnginePrototype__automationTweakAction">
            <EuiButton
              fill
              size="s"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {buttonLabel}
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
      <EuiText size="xs" color="subdued" className="contextEnginePrototype__automationTweakHint">
        {hint}
      </EuiText>
      {onContinueInAgent ? (
        <EuiButtonEmpty
          size="xs"
          flush="left"
          iconType={AI_AGENT_ICON}
          iconSide="left"
          className="contextEnginePrototype__automationTweakEscalate"
          onClick={() => {
            const value = text.trim();
            setText('');
            onContinueInAgent(value);
          }}
        >
          Needs more back and forth? Continue in AI Agent ›
        </EuiButtonEmpty>
      ) : null}
    </div>
  );
}
