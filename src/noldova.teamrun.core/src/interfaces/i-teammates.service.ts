/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type { JsonObject } from "@noldova/context.json";
import type {
  ComposerDefaultSaveParams, DefaultTeammate, DefaultTeammateSetParams, ProviderModelList, Teammate, TeammateCreateParams, TeammateUpdateParams, TeammateIdParams
} from "@noldova/teamrun.protocol";

export interface ITeammatesService {
  listAsync(transaction?: SqlTransaction): Promise<readonly Teammate[]>;
  findAsync(teammateId: string, transaction?: SqlTransaction): Promise<Teammate | null>;
  createAsync(params: TeammateCreateParams): Promise<Teammate>;
  updateAsync(params: TeammateUpdateParams, checked?: Teammate | null): Promise<Teammate>;
  clearUnlistedAsync(providerId: string, list: ProviderModelList): Promise<readonly Teammate[]>;
  deleteAsync(params: TeammateIdParams): Promise<readonly string[]>;
  readDefaultAsync(transaction?: SqlTransaction): Promise<DefaultTeammate | null>;
  setDefaultAsync(params: DefaultTeammateSetParams, transaction?: SqlTransaction): Promise<DefaultTeammate | null>;
  moveProviderlessDefaultAsync(providerOf: (kind: string, transaction: SqlTransaction) => Promise<string | null>): Promise<DefaultTeammate | null>;
  readComposerDefaultAsync(transaction?: SqlTransaction): Promise<JsonObject | null>;
  saveComposerDefaultAsync(params: ComposerDefaultSaveParams): Promise<JsonObject>;
}
