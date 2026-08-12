/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { AppMountParameters, CoreSetup, CoreStart, Plugin } from '@kbn/core/public';

import type { AppPluginStartDependencies } from './ai_agent';
import { registerAdminMenu } from './register_admin_menu';

export class ContextEngineExampleFivePlugin implements Plugin {
  public setup(core: CoreSetup<AppPluginStartDependencies>) {
    core.application.register({
      id: 'contextEngineExample5',
      title: 'Context',
      euiIconType: 'memory',
      order: 4504,
      keywords: ['context', 'ai context', 'ai index', 'namespaces'],
      visibleIn: ['globalSearch', 'projectSideNav'],
      async mount(params: AppMountParameters) {
        const [coreStart, plugins] = await core.getStartServices();
        const { renderApp } = await import('./app');
        return renderApp(coreStart, plugins, params);
      },
    });
  }

  public start(core: CoreStart) {
    // One header control only: the "admin" menu. Demo controls live inside it.
    // Never register a standalone DEMO select in the header.
    registerAdminMenu(core);
  }

  public stop() {}
}
