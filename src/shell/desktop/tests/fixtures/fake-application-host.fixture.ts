/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IApplicationHost } from "@noldova/teamrun-shell-desktop";

import type { FakeDockHost } from "./fake-dock-host.fixture.js";
import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeApplicationHost implements IApplicationHost {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private readonly hasLock: boolean;
  private readonly readiness: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public readonly calls: string[] = [];
  public readonly isPackaged: boolean;
  public systemLanguages: string[] = ["en-US"];
  public isInApplications: boolean = true;
  public dock: FakeDockHost | undefined = undefined;

  public constructor(hasLock: boolean, isPackaged: boolean) {
    this.hasLock = hasLock;
    this.isPackaged = isPackaged;
  }

  public isInApplicationsFolder(): boolean {
    return this.isInApplications;
  }

  public setName(name: string): void {
    this.calls.push(`setName ${name}`);
  }

  public setVersion(version: string): void {
    this.calls.push(`setVersion ${version}`);
  }

  public setAppUserModelId(id: string): void {
    this.calls.push(`setAppUserModelId ${id}`);
  }

  public setDesktopName(name: string): void {
    this.calls.push(`setDesktopName ${name}`);
  }

  public setPath(name: string, path: string): void {
    this.calls.push(`setPath ${name} ${path}`);
  }

  public requestSingleInstanceLock(): boolean {
    this.calls.push("requestSingleInstanceLock");
    return this.hasLock;
  }

  public getPreferredSystemLanguages(): string[] {
    return this.systemLanguages;
  }

  public enableSandbox(): void {
    this.calls.push("enableSandbox");
  }

  public quit(): void {
    const event = new FakePreventableEvent();
    this.listeners.emit("before-quit", event);
    this.calls.push(event.isPrevented ? "quit prevented" : "quit");
  }

  public relaunch(): void {
    this.calls.push("relaunch");
  }

  public exit(exitCode: number): void {
    this.calls.push(`exit ${exitCode}`);
  }

  public whenReady(): Promise<unknown> {
    return this.readiness.promise;
  }

  public on(event: string, listener: (event: FakePreventableEvent) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public async becomeReadyAsync(): Promise<void> {
    this.readiness.resolve();
    await this.readiness.promise;
    await Promise.resolve();
  }

  public emit(event: string): void {
    this.listeners.emit(event);
  }

  public count(event: string): number {
    return this.listeners.count(event);
  }
}
