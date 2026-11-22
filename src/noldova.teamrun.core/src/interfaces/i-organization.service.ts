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
  Department, DepartmentCreateParams, DepartmentIdParams, DepartmentMemberSetParams, DepartmentMoveParams, DepartmentUpdateParams, NodeType, NodeTypeCreateParams,
  NodeTypeIdParams, NodeTypeUpdateParams, Organization, OrganizationCreateParams, OrganizationIdParams, OrganizationLayoutSaveParams, OrganizationUpdateParams, TeammatePlaceParams
} from "@noldova/teamrun.protocol";

export interface IOrganizationService {
  listAsync(transaction?: SqlTransaction): Promise<readonly Organization[]>;
  findAsync(organizationId: string, transaction?: SqlTransaction): Promise<Organization | null>;
  createOrganizationAsync(params: OrganizationCreateParams): Promise<Organization>;
  updateOrganizationAsync(params: OrganizationUpdateParams): Promise<Organization>;
  deleteOrganizationAsync(params: OrganizationIdParams): Promise<void>;
  createAsync(params: DepartmentCreateParams): Promise<Department>;
  updateAsync(params: DepartmentUpdateParams): Promise<Department>;
  moveAsync(params: DepartmentMoveParams): Promise<Department>;
  deleteAsync(params: DepartmentIdParams): Promise<void>;
  setMemberAsync(params: DepartmentMemberSetParams): Promise<void>;
  createNodeTypeAsync(params: NodeTypeCreateParams): Promise<NodeType>;
  updateNodeTypeAsync(params: NodeTypeUpdateParams): Promise<NodeType>;
  deleteNodeTypeAsync(params: NodeTypeIdParams): Promise<void>;
  placeAsync(params: TeammatePlaceParams): Promise<void>;
  readLayoutAsync(params: OrganizationIdParams, transaction?: SqlTransaction): Promise<JsonObject | null>;
  saveLayoutAsync(params: OrganizationLayoutSaveParams): Promise<JsonObject>;
  removeTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<readonly string[]>;
}
