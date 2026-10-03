/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import type { CoreStart } from '@kbn/core/public';

import { AdminMenuNavControl } from './admin_menu';

/** Registers the single prototype "admin" header menu (Demo controls live inside). */
export const registerAdminMenu = (core: CoreStart) => {
  // Chrome Next replaced navControls.registerRight with the user menu slot.
  core.chrome.controls.userMenu.set(
    <AdminMenuNavControl
      editProfileUrl={core.http.basePath.prepend('/security/account')}
      logoutUrl={core.http.basePath.prepend('/logout')}
    />
  );
};
