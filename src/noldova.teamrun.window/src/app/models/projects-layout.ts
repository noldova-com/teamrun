/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources";
import { ProjectsGroup } from "../enums/projects-group";

export class ProjectsLayout {
  public readonly collapsedProjects: readonly string[];
  public readonly pinnedConversations: readonly string[];
  public readonly projectOrder: readonly string[];
  public readonly conversationOrder: ReadonlyMap<string, readonly string[]>;
  public readonly collapsedGroups: readonly ProjectsGroup[];

  public constructor(collapsedProjects: readonly string[] = [], pinnedConversations: readonly string[] = [], projectOrder: readonly string[] = [],
    conversationOrder: ReadonlyMap<string, readonly string[]> = new Map(), collapsedGroups: readonly ProjectsGroup[] = []) {
    this.collapsedProjects = ProjectsLayout.distinct(collapsedProjects);
    this.pinnedConversations = ProjectsLayout.distinct(pinnedConversations);
    this.projectOrder = ProjectsLayout.distinct(projectOrder);
    const orders = [...conversationOrder].filter(([projectId]) => !String.isNullOrWhitespace(projectId));
    this.conversationOrder = new Map(orders.map(([projectId, ids]) => [projectId, ProjectsLayout.distinct(ids)]));
    this.collapsedGroups = [...new Set(collapsedGroups)];
  }

  public static fromJson(value: unknown): ProjectsLayout {
    if (!Object.isObject(value) || Array.isArray(value))
      return new ProjectsLayout();
    const record: Record<string, unknown> = { ...value };
    return new ProjectsLayout(ProjectsLayout.readIds(record[Resources.collapsedProjectsField]),
      ProjectsLayout.readIds(ProjectsLayout.fieldOf(record, Resources.pinnedChatsField, Resources.legacyPinnedChatsField)),
      ProjectsLayout.readIds(record[Resources.projectOrderField]),
      ProjectsLayout.readOrders(ProjectsLayout.fieldOf(record, Resources.chatOrderField, Resources.legacyChatOrderField)),
      ProjectsLayout.readGroups(record[Resources.collapsedGroupsField]));
  }

  private static fieldOf(record: Record<string, unknown>, name: string, legacyName: string): unknown {
    return name in record ? record[name] : record[legacyName];
  }

  private static readOrders(value: unknown): ReadonlyMap<string, readonly string[]> {
    if (!Object.isObject(value) || Array.isArray(value))
      return new Map();
    return new Map(Object.entries({ ...value }).map(([projectId, ids]) => [projectId, ProjectsLayout.readIds(ids)]));
  }

  private static readGroups(value: unknown): readonly ProjectsGroup[] {
    const groups: readonly string[] = Object.values(ProjectsGroup);
    return ProjectsLayout.readIds(value).filter((t): t is ProjectsGroup => groups.includes(t));
  }

  private static readIds(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter(t => Object.isString(t)) : [];
  }

  private static distinct(ids: readonly string[]): readonly string[] {
    return [...new Set(ids.filter(t => !String.isNullOrWhitespace(t)))];
  }

  public toJson(): JsonObject {
    return {
      [Resources.collapsedProjectsField]: [...this.collapsedProjects],
      [Resources.pinnedChatsField]: [...this.pinnedConversations],
      [Resources.projectOrderField]: [...this.projectOrder],
      [Resources.chatOrderField]: Object.fromEntries([...this.conversationOrder].map(([projectId, ids]) => [projectId, [...ids]])),
      [Resources.collapsedGroupsField]: [...this.collapsedGroups]
    };
  }

  public isPinned(conversationId: string): boolean {
    return this.pinnedConversations.includes(conversationId);
  }

  public togglePin(conversationId: string): ProjectsLayout {
    const pinned = this.isPinned(conversationId) ? this.pinnedConversations.filter(t => t !== conversationId) : [...this.pinnedConversations, conversationId];
    return this.copy(this.collapsedProjects, pinned);
  }

  public orderPins(order: readonly string[]): ProjectsLayout {
    const pinned = [...order.filter(t => this.isPinned(t)), ...this.pinnedConversations.filter(t => !order.includes(t))];
    return this.copy(this.collapsedProjects, pinned);
  }

  public orderProjects(order: readonly string[]): ProjectsLayout {
    return this.copy(this.collapsedProjects, this.pinnedConversations, order);
  }

  public conversationOrderOf(projectId: string): readonly string[] {
    return this.conversationOrder.get(projectId) ?? [];
  }

  public orderConversations(projectId: string, order: readonly string[]): ProjectsLayout {
    return this.copy(this.collapsedProjects, this.pinnedConversations, this.projectOrder, new Map(this.conversationOrder).set(projectId, order));
  }

  public isProjectCollapsed(projectId: string): boolean {
    return this.collapsedProjects.includes(projectId);
  }

  public toggleProject(projectId: string): ProjectsLayout {
    const collapsed = this.isProjectCollapsed(projectId) ? this.collapsedProjects.filter(t => t !== projectId) : [...this.collapsedProjects, projectId];
    return this.copy(collapsed);
  }

  public isGroupCollapsed(group: ProjectsGroup): boolean {
    return this.collapsedGroups.includes(group);
  }

  public withGroupCollapsed(group: ProjectsGroup, collapsed: boolean): ProjectsLayout {
    const others = this.collapsedGroups.filter(t => t !== group);
    return new ProjectsLayout(this.collapsedProjects, this.pinnedConversations, this.projectOrder, this.conversationOrder, collapsed ? [...others, group] : others);
  }

  private copy(collapsedProjects: readonly string[], pinnedConversations: readonly string[] = this.pinnedConversations,
    projectOrder: readonly string[] = this.projectOrder, conversationOrder: ReadonlyMap<string, readonly string[]> = this.conversationOrder): ProjectsLayout {
    return new ProjectsLayout(collapsedProjects, pinnedConversations, projectOrder, conversationOrder, this.collapsedGroups);
  }
}
