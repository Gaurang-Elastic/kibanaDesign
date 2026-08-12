/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { BehaviorSubject } from 'rxjs';

/** Mock current user for guided-setup Variant A (admin vs non-admin). */
export interface DemoCurrentUser {
  isAdmin: boolean;
}

export const currentUser$ = new BehaviorSubject<DemoCurrentUser>({ isAdmin: true });

export const setCurrentUserAdmin = (isAdmin: boolean) => {
  if (currentUser$.value.isAdmin === isAdmin) return;
  currentUser$.next({ isAdmin });
};
