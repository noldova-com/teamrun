/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode, type SettingScope } from "@noldova/desktop.protocol";
import { FileSaveOutcome } from "@noldova/desktop.window";
import { AttachmentShare, type ErrorCode, type EventName, type MethodName } from "@noldova/teamrun.protocol";

import { RecordingWindowPartContext } from "./recording-window-part-context.fixture";

export class FakeWindowPartContext extends RecordingWindowPartContext {
  private readonly handlers: Map<string, (parameters: JsonValue) => JsonValue | Promise<JsonValue>> = new Map();
  private readonly listeners: Map<string, Set<(payload: JsonValue) => void>> = new Map();
  private readonly settings: Map<string, JsonValue> = new Map();
  private readonly settingListeners: Map<string, Set<(value: JsonValue, scope: SettingScope | null, isSet: boolean) => void>> = new Map();
  private settingFailure: string | null = null;

  public readonly requests: { readonly method: string; readonly parameters: JsonValue }[] = [];
  public readonly savedFiles: { readonly name: string; readonly bytes: Uint8Array }[] = [];
  public saveOutcome: FileSaveOutcome = FileSaveOutcome.Saved;

  public get methods(): readonly string[] {
    return this.requests.map(t => t.method);
  }

  public get events(): readonly string[] {
    return [...this.listeners.entries()].filter(([, listeners]) => listeners.size > 0).map(([name]) => name);
  }

  public get watchedSettings(): readonly string[] {
    return [...this.settingListeners.entries()].filter(([, listeners]) => listeners.size > 0).map(([name]) => name);
  }

  public static qualify(name: string): string {
    return `teamrun.${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }

  public answer(method: MethodName, handler: (parameters: JsonValue) => JsonValue | Promise<JsonValue>): this {
    this.handlers.set(FakeWindowPartContext.qualify(method), handler);
    return this;
  }

  public answerModule(method: string, handler: (parameters: JsonValue) => JsonValue | Promise<JsonValue>): this {
    this.handlers.set(method, handler);
    return this;
  }

  public fail(method: MethodName, message: string): this {
    return this.answer(method, () => {
      throw new Error(message);
    });
  }

  public disconnect(method: MethodName, message: string): this {
    return this.answer(method, () => {
      throw Object.assign(new Error(message), { code: FailureCode.Disconnected });
    });
  }

  public refuse(method: MethodName, code: ErrorCode, message: string, ...ids: readonly string[]): this {
    return this.answer(method, () => {
      throw Object.assign(new Error(message), { code, details: { error: code, arguments: [...ids] } });
    });
  }

  public share(address: string): JsonValue {
    const grant = (this.fileAddresses.size + 1).toString(16).padStart(32, "0");
    this.fileAddresses.set(grant, address);
    return new AttachmentShare(grant).toJson();
  }

  public count(method: MethodName): number {
    return this.methods.filter(t => t === FakeWindowPartContext.qualify(method)).length;
  }

  public parametersOf(method: MethodName): JsonValue | undefined {
    return this.requests.find(t => t.method === FakeWindowPartContext.qualify(method))?.parameters;
  }

  public emit(event: EventName, payload: JsonValue): void {
    this.emitModule(FakeWindowPartContext.qualify(event), payload);
  }

  public emitModule(event: string, payload: JsonValue): void {
    for (const listener of this.listeners.get(event) ?? [])
      listener(payload);
  }

  public failSettings(message: string): this {
    this.settingFailure = message;
    return this;
  }

  public changeSetting(name: string, value: JsonValue): void {
    this.settings.set(name, value);
    for (const listener of this.settingListeners.get(name) ?? [])
      listener(value, null, true);
  }

  public override async requestAsync(method: string, parameters: JsonValue): Promise<JsonValue> {
    this.requests.push({ method, parameters });
    const handler = this.handlers.get(method);
    if (Object.isUndefined(handler))
      throw new Error(`No answer scripted for ${method}`);
    return handler(parameters);
  }

  public override onEvent(event: string, listener: (payload: JsonValue) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    this.listeners.set(event, listeners.add(listener));
    return () => {
      listeners.delete(listener);
    };
  }

  public override saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome> {
    this.savedFiles.push({ name, bytes });
    return Promise.resolve(this.saveOutcome);
  }

  public override readSetting(name: string): JsonValue | undefined {
    return this.settings.get(name);
  }

  public override async writeSettingAsync(name: string, value: JsonValue): Promise<void> {
    if (!Object.isNull(this.settingFailure))
      throw new Error(this.settingFailure);
    this.changeSetting(name, value);
  }

  public override onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void): () => void {
    const listeners = this.settingListeners.get(name) ?? new Set();
    this.settingListeners.set(name, listeners.add(listener));
    return () => {
      listeners.delete(listener);
    };
  }
}
