/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Project, ProjectIdParams, ProjectOpenParams } from "@noldova/teamrun-protocol";

export interface IProjectsService {
  list(): readonly Project[];
  find(projectId: string): Project | null;
  open(params: ProjectOpenParams): Project;
  forget(params: ProjectIdParams): void;
}
