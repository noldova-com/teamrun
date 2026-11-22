/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IDepartmentRow {
  readonly id: string;
  readonly organizationId: string;
  readonly parentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
