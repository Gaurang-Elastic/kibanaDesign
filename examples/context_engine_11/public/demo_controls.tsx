/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useState } from 'react';
import { EuiContextMenuItem, EuiHorizontalRule, EuiIcon, EuiText } from '@elastic/eui';

import { currentUser$, setCurrentUserAdmin } from './current_user';
import {
  FEEDBACK_LOOP_ENABLED,
  demoFlags$,
  setDemoCatalogState,
  setDemoFeedbackLoopColdStart,
  setDemoFeedbackLoopEnabled,
  setDemoFeedbackLoopHealthy,
  setDemoNextRunEmpty,
  setDemoSharedDestinationKis,
  setDemoSkillUnavailable,
  type CatalogDemoState,
} from './demo_flags';

const CATALOG_STATES: Array<{ id: CatalogDemoState; label: string; proto11Only?: boolean }> = [
  { id: 'empty', label: 'Empty', proto11Only: true },
  { id: 'learning', label: 'Learning' },
  { id: 'working', label: 'Working' },
];

export const DemoControlsMenuSection = ({
  closePopover,
}: {
  closePopover?: () => void;
}) => {
  const [isAdmin, setIsAdmin] = useState(currentUser$.value.isAdmin);
  const [flags, setFlags] = useState(demoFlags$.value);

  useEffect(() => {
    const userSub = currentUser$.subscribe((user) => setIsAdmin(user.isAdmin));
    const flagsSub = demoFlags$.subscribe(setFlags);
    return () => {
      userSub.unsubscribe();
      flagsSub.unsubscribe();
    };
  }, []);

  const catalogState =
    !flags.proto11Setup && flags.catalogState === 'empty' ? 'learning' : flags.catalogState;

  return (
    <div data-test-subj="contextEngineDemoControls">
      <EuiHorizontalRule margin="none" />
      <div className="contextEnginePrototype__demoControlsHeader">
        <EuiText size="xs" color="subdued">
          <strong>Demo controls</strong>
        </EuiText>
      </div>
      <EuiContextMenuItem
        icon={isAdmin ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setCurrentUserAdmin(true);
          closePopover?.();
        }}
      >
        Admin
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon={!isAdmin ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setCurrentUserAdmin(false);
          closePopover?.();
        }}
      >
        Non-admin
      </EuiContextMenuItem>
      {CATALOG_STATES.filter((state) => flags.proto11Setup || !state.proto11Only).map((state) => (
        <EuiContextMenuItem
          key={state.id}
          icon={
            catalogState === state.id ? (
              <EuiIcon type="check" size="m" aria-hidden={true} />
            ) : (
              'empty'
            )
          }
          onClick={() => {
            setDemoCatalogState(state.id);
            closePopover?.();
          }}
        >
          {state.label}
        </EuiContextMenuItem>
      ))}
      <EuiContextMenuItem
        icon={flags.skillUnavailable ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setDemoSkillUnavailable(!flags.skillUnavailable);
          closePopover?.();
        }}
      >
        Automation skill unavailable
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon={flags.nextRunEmpty ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setDemoNextRunEmpty(!flags.nextRunEmpty);
          closePopover?.();
        }}
      >
        Next sample run produces nothing
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon={flags.sharedDestinationKis ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setDemoSharedDestinationKis(!flags.sharedDestinationKis);
          closePopover?.();
        }}
      >
        Shared destination KIs
      </EuiContextMenuItem>
      {FEEDBACK_LOOP_ENABLED ? (
        <>
          <EuiContextMenuItem
            icon={flags.feedbackLoopEnabled ? <EuiIcon type="check" size="m" /> : 'empty'}
            onClick={() => {
              setDemoFeedbackLoopEnabled(!flags.feedbackLoopEnabled);
              closePopover?.();
            }}
          >
            Feedback loop
          </EuiContextMenuItem>
          <EuiContextMenuItem
            icon={flags.feedbackLoopColdStart ? <EuiIcon type="check" size="m" /> : 'empty'}
            onClick={() => {
              setDemoFeedbackLoopColdStart(!flags.feedbackLoopColdStart);
              closePopover?.();
            }}
          >
            No traces yet
          </EuiContextMenuItem>
          <EuiContextMenuItem
            icon={flags.feedbackLoopHealthy ? <EuiIcon type="check" size="m" /> : 'empty'}
            onClick={() => {
              setDemoFeedbackLoopHealthy(!flags.feedbackLoopHealthy);
              closePopover?.();
            }}
          >
            No issues detected
          </EuiContextMenuItem>
        </>
      ) : null}
    </div>
  );
};
