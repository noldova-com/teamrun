/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { OwnMcpServer, OwnMcpServerState, Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { ConfigurationUnreadableException } from "../../exceptions/configuration-unreadable.exception.js";
import { Resources } from "../../resources.js";
import { ConfigurationText } from "../configuration-text.js";
import { PersonInstructions } from "../person-instructions.js";

export class ClaudeMcpServers {
  public static async listInAsync(file: string): Promise<readonly OwnMcpServer[]> {
    const { user, projects } = await ClaudeMcpServers.readAsync(file);
    const names = [...Object.keys(user), ...Object.values(projects).flatMap(t => Object.keys(ClaudeMcpServers.serversOfProject(t)))];
    return [...new Set(names)].filter(t => t !== ProtocolResources.mcpServerName).map(t => new OwnMcpServer(t, OwnMcpServerState.Configured));
  }

  public static async readInAsync(file: string, folder: string, environment: Readonly<Record<string, string | undefined>>): Promise<Record<string, McpServerConfig>> {
    const { user, projects } = await ClaudeMcpServers.readAsync(file);
    const entries = { ...user, ...ClaudeMcpServers.serversOfProject(projects[ClaudeMcpServers.projectKeyOf(folder)]) };
    const variables = { ...environment, [ProtocolResources.senderTokenVariable]: undefined };
    return Object.fromEntries(Object.entries(entries).filter(([name, server]) => name !== ProtocolResources.mcpServerName && ClaudeMcpServers.isRecord(server))
      .map(([name, server]) => [name, ClaudeMcpServers.configOf(server as Record<string, unknown>, variables)]));
  }

  public static async projectServerNamesAsync(file: string, folder: string): Promise<readonly string[]> {
    const { projects } = await ClaudeMcpServers.readAsync(file);
    const names: string[] = [];
    const off: string[] = [];
    for (let current = realpathSync(folder); ; current = dirname(current)) {
      const path = join(current, Resources.claudeProjectMcpFile);
      const text = await ConfigurationText.readAsync(path, t => Resources.formatOwnMcpConfigUnreadable(t), t => Resources.formatOwnMcpConfigTooLarge(t));
      if (!Object.isNull(text))
        names.push(...Object.keys(ClaudeMcpServers.serversOfProject(ClaudeMcpServers.parsed(text, path))));
      const project = projects[current.replaceAll(Resources.windowsFolderSeparator, Resources.claudeProjectKeySeparator)];
      const disabled = ClaudeMcpServers.isRecord(project) ? project[Resources.claudeDisabledMcpJsonField] : null;
      if (Array.isArray(disabled))
        off.push(...disabled.filter(t => Object.isString(t)));
      if (dirname(current) === current)
        return [...new Set(names)].filter(t => !off.includes(t));
    }
  }

  public static async trustsAsync(file: string, folder: string): Promise<boolean> {
    const { projects } = await ClaudeMcpServers.readAsync(file);
    for (let current = realpathSync(folder); ; current = dirname(current)) {
      const project = projects[current.replaceAll(Resources.windowsFolderSeparator, Resources.claudeProjectKeySeparator)];
      if (ClaudeMcpServers.isRecord(project) && project[Resources.claudeTrustAcceptedField] === true)
        return true;
      if (dirname(current) === current)
        return false;
    }
  }

  private static async readAsync(file: string): Promise<{ readonly user: Record<string, unknown>; readonly projects: Record<string, unknown> }> {
    const text = await ConfigurationText.readAsync(file, t => Resources.formatOwnMcpConfigUnreadable(t), t => Resources.formatOwnMcpConfigTooLarge(t));
    if (Object.isNull(text))
      return { user: {}, projects: {} };
    try {
      const reader = JsonReader.parse(text);
      return {
        user: reader.hasField(Resources.claudeMcpServersField) ? reader.readObject(Resources.claudeMcpServersField).toJson() : {},
        projects: reader.hasField(Resources.claudeProjectsField) ? reader.readObject(Resources.claudeProjectsField).toJson() : {}
      };
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatOwnMcpConfigUnreadable(file), error);
    }
  }

  private static parsed(text: string, file: string): unknown {
    try {
      const value: unknown = JSON.parse(text);
      return value;
    }
    catch (error) {
      throw new ConfigurationUnreadableException(Resources.formatOwnMcpConfigUnreadable(file), error);
    }
  }

  private static serversOfProject(project: unknown): Record<string, unknown> {
    const servers = ClaudeMcpServers.isRecord(project) ? project[Resources.claudeMcpServersField] : null;
    return ClaudeMcpServers.isRecord(servers) ? servers : {};
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && !Object.isNull(value) && !Array.isArray(value);
  }

  private static projectKeyOf(folder: string): string {
    return ClaudeMcpServers.mainRootOf(PersonInstructions.repositoryRoot(realpathSync(folder))).replaceAll(Resources.windowsFolderSeparator, Resources.claudeProjectKeySeparator);
  }

  private static mainRootOf(root: string): string {
    const marker = join(root, Resources.gitDirectoryName);
    if (statSync(marker, { throwIfNoEntry: false })?.isFile() !== true)
      return root;
    const pointer = Resources.gitDirectoryLine.exec(readFileSync(marker, Resources.utf8Encoding));
    const listed = Object.isNull(pointer) ? null : join(resolve(root, pointer[1]!), Resources.gitCommonDirectoryFile);
    if (Object.isNull(listed) || !existsSync(listed))
      return root;
    const common = resolve(dirname(listed), readFileSync(listed, Resources.utf8Encoding).trim());
    return basename(common) === Resources.gitDirectoryName ? dirname(common) : root;
  }

  private static configOf(server: Record<string, unknown>, variables: Readonly<Record<string, string | undefined>>): McpServerConfig {
    const expanded = Object.fromEntries(Object.entries(server).map(([field, value]) =>
      [field, Resources.claudeExpandedServerFields.includes(field) ? ClaudeMcpServers.expand(value, variables) : value]));
    return (typeof expanded[Resources.claudeCommandField] === "string"
      ? { ...expanded, [Resources.claudeEnvironmentField]: { ...expanded[Resources.claudeEnvironmentField] as Record<string, string> | undefined, [ProtocolResources.senderTokenVariable]: String.empty } }
      : expanded) as McpServerConfig;
  }

  private static expand(value: unknown, variables: Readonly<Record<string, string | undefined>>): unknown {
    if (typeof value === "string")
      return value.replace(Resources.claudeVariableReference, (reference, content: string) => {
        const [name, fallback] = content.split(Resources.claudeVariableFallback, 2);
        return variables[name!] ?? fallback ?? reference;
      });
    if (Array.isArray(value))
      return value.map(t => ClaudeMcpServers.expand(t, variables));
    return ClaudeMcpServers.isRecord(value) ? Object.fromEntries(Object.entries(value).map(([name, t]) => [name, ClaudeMcpServers.expand(t, variables)])) : value;
  }
}
