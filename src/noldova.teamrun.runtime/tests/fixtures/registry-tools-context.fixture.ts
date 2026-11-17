/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  type IModuleLog,
  type IToolDescriptor,
  type IToolEndpoint,
  type IToolHandler,
  type IToolsContext,
  PermissionCenter,
  Registration,
  ToolDescriptor,
  ToolRegistry,
  type ToolSession
} from "@noldova/desktop.runtime";
import type { JsonObject } from "@noldova/context.json";

export class RegistryToolsContext implements IToolsContext {
  public readonly center: PermissionCenter;
  public readonly registry: ToolRegistry;
  public readonly declared: readonly string[];
  public readonly sessions: ToolSession[] = [];
  public sessionStopListeners: number = 0;
  private readonly moduleId: string;
  private readonly log: IModuleLog;
  private readonly sessionOpened: PromiseWithResolvers<ToolSession> = Promise.withResolvers<ToolSession>();

  public constructor(moduleId: string, log: IModuleLog, declared: readonly string[] = RegistryToolsContext.readDeclared(),
    center: PermissionCenter = new PermissionCenter(moduleId)) {
    this.center = center;
    this.registry = new ToolRegistry(undefined, undefined, center);
    this.moduleId = moduleId;
    this.log = log;
    this.declared = declared;
  }

  public get isStopped(): boolean {
    return this.registry.isStopped;
  }

  public register(descriptor: IToolDescriptor, handler: IToolHandler): Registration {
    return this.registry.register(this.moduleId, new ToolDescriptor(descriptor, this.declared), handler, this.declared, this.log);
  }

  public openSession(scope: string, bindings: JsonObject): ToolSession {
    const session = this.registry.openSession(scope, bindings);
    this.sessions.push(session);
    this.sessionOpened.resolve(session);
    return session;
  }

  public whenSessionOpens(): Promise<ToolSession> {
    return this.sessionOpened.promise;
  }

  public onSessionEnded(listener: (session: string) => void): Registration {
    return this.registry.onSessionEnded(listener, this.log);
  }

  public stopSession(session: string, reason: string): void {
    this.registry.stopSession(this.moduleId, session, reason);
  }

  public onSessionStopped(listener: (session: string, reason: string) => void): Registration {
    const registration = this.registry.onSessionStopped(listener, this.log);
    this.sessionStopListeners++;
    return new Registration(() => {
      this.sessionStopListeners--;
      registration[Symbol.dispose]();
    });
  }

  public stopAll(reason: string): void {
    this.registry.stopAll(reason);
  }

  public resumeAll(): void {
    this.registry.resumeAll(this.moduleId);
  }

  public onStopped(listener: (reason: string) => void): Registration {
    return this.registry.onStopped(listener, this.log);
  }

  public onResumed(listener: () => void): Registration {
    return this.registry.onResumed(listener, this.log);
  }

  public openEndpointAsync(): Promise<IToolEndpoint> {
    return Promise.reject(new Error("TeamRun's runtime part opens no tool endpoint."));
  }

  private static readDeclared(): readonly string[] {
    const declaration = JSON.parse(readFileSync(fileURLToPath(import.meta.resolve("@noldova/teamrun/module.json")), "utf8")) as
      { contributes: { tools: readonly string[] } };
    return declaration.contributes.tools;
  }
}
