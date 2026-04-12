/* eslint-disable */
// @ts-nocheck

import { Route as rootRoute } from './routes/__root'
import { Route as VoxelImport } from './routes/voxel'
import { Route as SettingsImport } from './routes/settings'
import { Route as OptimizationImport } from './routes/optimization'
import { Route as HistoryImport } from './routes/history'
import { Route as GeometryImport } from './routes/geometry'
import { Route as BacktestImport } from './routes/backtest'
import { Route as AnalyticsImport } from './routes/analytics'
import { Route as IndexImport } from './routes/index'

const VoxelRoute = VoxelImport.update({
  id: '/voxel',
  path: '/voxel',
  getParentRoute: () => rootRoute,
})

const SettingsRoute = SettingsImport.update({
  id: '/settings',
  path: '/settings',
  getParentRoute: () => rootRoute,
})

const OptimizationRoute = OptimizationImport.update({
  id: '/optimization',
  path: '/optimization',
  getParentRoute: () => rootRoute,
})

const HistoryRoute = HistoryImport.update({
  id: '/history',
  path: '/history',
  getParentRoute: () => rootRoute,
})

const GeometryRoute = GeometryImport.update({
  id: '/geometry',
  path: '/geometry',
  getParentRoute: () => rootRoute,
})

const BacktestRoute = BacktestImport.update({
  id: '/backtest',
  path: '/backtest',
  getParentRoute: () => rootRoute,
})

const AnalyticsRoute = AnalyticsImport.update({
  id: '/analytics',
  path: '/analytics',
  getParentRoute: () => rootRoute,
})

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
})

export const routeTree = rootRoute.addChildren([
  IndexRoute,
  AnalyticsRoute,
  BacktestRoute,
  GeometryRoute,
  HistoryRoute,
  OptimizationRoute,
  VoxelRoute,
  SettingsRoute,
])
