/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useEffect, useState } from 'react';
import {
  EuiContextMenuItem,
  EuiHorizontalRule,
  EuiIcon,
  EuiText,
} from '@elastic/eui';

import { currentUser$, setCurrentUserAdmin } from './current_user';
import { resetMonitoringData } from './agent_monitoring_state';
import {
  demoFlags$,
  setDemoForceSetupError,
  setDemoHasInference,
} from './demo_flags';

/**
 * Demo-only section injected into the Kibana account (admin) menu.
 * Nothing from this module renders as a standalone header control.
 */
export const DemoControlsMenuSection = ({
  closePopover,
}: {
  closePopover?: () => void;
}) => {
  const [isAdmin, setIsAdmin] = useState(currentUser$.value.isAdmin);
  const [hasInference, setHasInference] = useState(demoFlags$.value.hasInference);
  const [forceSetupError, setForceSetupError] = useState(demoFlags$.value.forceSetupError);

  useEffect(() => {
    const userSub = currentUser$.subscribe((user) => setIsAdmin(user.isAdmin));
    const flagsSub = demoFlags$.subscribe((flags) => {
      setHasInference(flags.hasInference);
      setForceSetupError(flags.forceSetupError);
    });
    return () => {
      userSub.unsubscribe();
      flagsSub.unsubscribe();
    };
  }, []);

  const selectRole = (next: boolean) => {
    setCurrentUserAdmin(next);
    closePopover?.();
  };

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
        onClick={() => selectRole(true)}
        data-test-subj="contextEngineDemoRoleAdmin"
      >
        Admin
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon={!isAdmin ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => selectRole(false)}
        data-test-subj="contextEngineDemoRoleNonAdmin"
      >
        Non-admin
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon={hasInference ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setDemoHasInference(!hasInference);
          closePopover?.();
        }}
        data-test-subj="contextEngineDemoHasInference"
      >
        LLM / inference installed
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon={forceSetupError ? <EuiIcon type="check" size="m" /> : 'empty'}
        onClick={() => {
          setDemoForceSetupError(!forceSetupError);
          closePopover?.();
        }}
        data-test-subj="contextEngineDemoForceSetupError"
      >
        Force generate / full-run error
      </EuiContextMenuItem>
      <EuiContextMenuItem
        icon="empty"
        onClick={() => {
          resetMonitoringData();
          closePopover?.();
        }}
        data-test-subj="contextEngineDemoResetMonitoring"
      >
        Reset monitoring data
      </EuiContextMenuItem>
    </div>
  );
};
