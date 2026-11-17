/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type { JsonObject } from "@noldova/context.json";
import type { Project, ProjectIdParams, ProjectListing, ProjectOpenParams, ProjectsLayoutSaveParams } from "@noldova/teamrun.protocol";

import type { FolderState } from "../enums/folder-state.js";

export interface IProjectsService {
  listProjectsAsync(transaction?: SqlTransaction): Promise<readonly Project[]>;
  listAsync(): Promise<readonly ProjectListing[]>;
  checkFolderAsync(path: string, projectId: string | null): Promise<FolderState>;
  checkLinkedFolderAsync(path: string): Promise<FolderState>;
  findAsync(projectId: string, transaction?: SqlTransaction): Promise<Project | null>;
  openAsync(params: ProjectOpenParams, transaction?: SqlTransaction): Promise<Project>;
  forgetAsync(params: ProjectIdParams, transaction?: SqlTransaction): Promise<readonly string[]>;
  readLayoutAsync(transaction?: SqlTransaction): Promise<JsonObject | null>;
  saveLayoutAsync(params: ProjectsLayoutSaveParams): Promise<JsonObject>;
}
