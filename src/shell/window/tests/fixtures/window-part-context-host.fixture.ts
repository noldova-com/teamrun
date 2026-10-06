/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { type NotificationPost, QualifiedName, type SettingChange, SettingEntry, type SettingScope } from "@noldova/teamrun-shell-protocol";

import type { IWindowPartHost } from "../../src/app/interfaces/i-window-part-host";
import type { MenuItem } from "../../src/app/models/menu-item";
import type { ViewBadge } from "../../src/app/models/view-badge";

export class WindowPartContextHostFixture implements IWindowPartHost {
  public readonly calls: string[] = [];
  public isNotificationHeld: boolean = true;
  public readonly listeners: Set<(name: string, payload: JsonValue) => void> = new Set();
  public readonly registered: Set<string> = new Set(["notes.taken"]);
  public readonly settingListeners: Set<(change: SettingChange) => void> = new Set();
  public readonly dynamicGroups: Set<string> = new Set(["notes.recent"]);
  public readonly providers: Map<string, (context: JsonObject) => readonly MenuItem[]> = new Map();

  public requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    this.calls.push(`request ${method}`);
    return Promise.resolve({ method, payload });
  }

  public onEvent(listener: (name: string, payload: JsonValue) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public openDocument(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    this.calls.push(`open ${moduleId} ${name} ${instance} ${title}${isPreview ? " as a preview" : ""}`);
  }

  public keepDocument(moduleId: string, name: string, instance: string): void {
    this.calls.push(`keep ${moduleId} ${name} ${instance}`);
  }

  public log(moduleId: string, message: string): void {
    this.calls.push(`log ${moduleId} ${message}`);
  }

  public openLinkAsync(url: string): Promise<void> {
    this.calls.push(`openLink ${url}`);
    return Promise.resolve();
  }

  public showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void> {
    this.calls.push(`show ${name} ${instance ?? "-"} ${title ?? "-"}`);
    return Promise.resolve();
  }

  public isCommandRegistered(name: string): boolean {
    return this.registered.has(name);
  }

  public declaresDynamicMenuGroup(moduleId: string, group: string): boolean {
    return moduleId === "notes" && this.dynamicGroups.has(group);
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void {
    this.providers.set(group, provider);
    return () => this.providers.delete(group);
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    this.calls.push(`run ${name}`);
    return Promise.resolve({ name, commandArguments });
  }

  public postNotificationAsync(post: NotificationPost): Promise<string> {
    this.calls.push(`post ${post.title}`);
    return Promise.resolve(String(this.calls.length));
  }

  public updateNotificationAsync(id: string, post: NotificationPost): Promise<boolean> {
    this.calls.push(`update ${id} ${post.title}`);
    return Promise.resolve(this.isNotificationHeld);
  }

  public dismissNotification(id: string): void {
    this.calls.push(`dismiss ${id}`);
  }

  public readSetting(name: string): JsonValue | undefined {
    return name === "notes.missing" ? undefined : `${name} value`;
  }

  public readSettingAsync(name: string, scope: SettingScope | null): Promise<SettingEntry> {
    this.calls.push(`read ${name} ${scope?.id ?? "app"}`);
    return Promise.resolve(new SettingEntry(QualifiedName.parse(name), `${name} at ${scope?.id ?? "app"}`, scope !== null));
  }

  public writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void> {
    this.calls.push(`write ${name} ${JSON.stringify(value)} ${scope?.id ?? "app"}`);
    return Promise.resolve();
  }

  public resetSettingAsync(name: string, scope: SettingScope | null): Promise<void> {
    this.calls.push(`reset ${name} ${scope?.id ?? "app"}`);
    return Promise.resolve();
  }

  public onSettingChanged(listener: (change: SettingChange) => void): () => void {
    this.settingListeners.add(listener);
    return () => this.settingListeners.delete(listener);
  }

  public changeSetting(change: SettingChange): void {
    for (const listener of this.settingListeners)
      listener(change);
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.calls.push(`badge ${view} ${badge?.count ?? "dot"} ${badge?.description ?? "none"}`);
  }

  public setTabWorking(tabKey: string, isWorking: boolean): void {
    this.calls.push(`working ${tabKey} ${isWorking}`);
  }

  public refresh(): void {
    this.calls.push("refresh");
  }

  public publish(name: string, payload: JsonValue): void {
    for (const listener of this.listeners)
      listener(name, payload);
  }
}
