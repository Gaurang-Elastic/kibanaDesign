/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { i18n } from '@kbn/i18n';
import { AgentBuilderContext } from '../components/context/context';
import { useBreadcrumb } from '../hooks/use_breadcrumbs';
import { appPaths } from '../utils/app_paths';

export const AgentBuilderContextPage = () => {
  useBreadcrumb([
    {
      text: i18n.translate('xpack.agentBuilder.context.breadcrumb', {
        defaultMessage: 'Context',
      }),
      path: appPaths.manage.context,
    },
  ]);

  return <AgentBuilderContext />;
};
