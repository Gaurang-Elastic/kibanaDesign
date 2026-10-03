/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { BehaviorSubject } from 'rxjs';

/** Deprioritised for the first release (Aug 28 2026). Not deleted; expected to return post-launch. */
export const AGENT_MONITORING_ENABLED = false;

/** Mock backend flags for M3 setup (inference availability, catastrophic errors). */
export interface DemoFlags {
  hasInference: boolean;
  forceSetupError: boolean;
}

export const demoFlags$ = new BehaviorSubject<DemoFlags>({
  hasInference: true,
  forceSetupError: false,
});

export const setDemoHasInference = (hasInference: boolean) => {
  if (demoFlags$.value.hasInference === hasInference) return;
  demoFlags$.next({ ...demoFlags$.value, hasInference });
};

export const setDemoForceSetupError = (forceSetupError: boolean) => {
  if (demoFlags$.value.forceSetupError === forceSetupError) return;
  demoFlags$.next({ ...demoFlags$.value, forceSetupError });
};
