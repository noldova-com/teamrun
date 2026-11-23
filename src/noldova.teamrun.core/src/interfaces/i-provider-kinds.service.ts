/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  PlanUsage,
  PlanUsageParams,
  ProviderKind,
  ProviderKindParams,
  ProviderKindInstallation,
  ProviderListModelsParams,
  ProviderModelList,
  ProviderTool
} from "@noldova/teamrun.protocol";

export interface IProviderKindsService {
  list(): readonly ProviderKind[];
  listAsync(): Promise<readonly ProviderKind[]>;
  listModelsAsync(params: ProviderListModelsParams): Promise<readonly string[]>;
  modelCatalogAsync(params: ProviderListModelsParams): Promise<ProviderModelList>;
  listInstallations(): Promise<readonly ProviderKindInstallation[]>;
  checkInstallationsAsync(): Promise<readonly ProviderKindInstallation[]>;
  listTools(): Promise<readonly ProviderTool[]>;
  install(params: ProviderKindParams): Promise<ProviderKindInstallation>;
  isInstalling(kind: string): boolean;
  cancelInstall(params: ProviderKindParams): void;
  readPlanUsageAsync(params: PlanUsageParams): Promise<PlanUsage | null>;
}
