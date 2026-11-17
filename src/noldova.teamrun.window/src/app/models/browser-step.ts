/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Resources as ProtocolResources } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { BrowserStepPhase } from "../enums/browser-step-phase";

export class BrowserStep {
  public readonly tool: string;
  public readonly input: JsonObject;
  public readonly url: string | null;
  public readonly elementName: string | null;
  public readonly isSecret: boolean;
  public readonly failureCode: string | null;
  public readonly failureModuleCode: string | null;
  public readonly storedPath: string | null;
  public readonly decisionNote: string | null;
  public readonly isAllowedWithoutAsking: boolean;

  private constructor(tool: string, payload: JsonObject) {
    const input = BrowserStep.objectOf(payload[ProtocolResources.servedInputField]);
    const page = BrowserStep.objectOf(payload[Resources.browserPageField]);
    const element = BrowserStep.objectOf(payload[Resources.browserElementField]);
    const failure = BrowserStep.objectOf(payload[ProtocolResources.failureField]);
    const permission = BrowserStep.objectOf(payload[ProtocolResources.permissionField]);
    this.tool = tool;
    this.input = input;
    this.url = BrowserStep.textOf(page[Resources.browserUrlField]);
    this.elementName = BrowserStep.textOf(element[Resources.browserNameField]);
    this.isSecret = element[Resources.browserIsSecretField] === true;
    this.failureCode = BrowserStep.textOf(failure[ProtocolResources.failureCodeField]);
    this.failureModuleCode = BrowserStep.textOf(failure[ProtocolResources.failureModuleCodeField]);
    this.storedPath = BrowserStep.textOf(payload[Resources.storedPathField]);
    this.decisionNote = BrowserStep.decisionNoteOf(permission);
    this.isAllowedWithoutAsking = Object.isNull(this.failureCode) && (Object.isUndefined(payload[ProtocolResources.permissionField])
      ? Resources.isBrowserReading(tool) : BrowserStep.isAllowedAtLowRisk(permission));
  }

  public get isStale(): boolean {
    return this.failureCode === Resources.staleFailureCode || this.failureModuleCode === Resources.browserStaleReferenceCode;
  }

  public get isDenied(): boolean {
    return this.failureCode === Resources.deniedFailureCode;
  }

  public get isRefusedSite(): boolean {
    return this.failureModuleCode === Resources.browserOriginRefusedCode;
  }

  public get pageUrl(): string | null {
    return BrowserStep.withoutScheme(this.url);
  }

  public static of(payload: JsonValue): BrowserStep | null {
    const fields = BrowserStep.objectOf(payload);
    const tool = fields[ProtocolResources.servedToolField];
    return Object.isString(tool) && tool.startsWith(Resources.browserToolPrefix) ? new BrowserStep(tool, fields) : null;
  }

  public title(phase: BrowserStepPhase, isDecisionShown: boolean = true): string {
    const name = Resources.formatBrowserElement(this.elementName);
    const denied = phase === BrowserStepPhase.Denied || this.isDenied;
    const shown = denied || this.isStale || !Object.isNull(this.failureCode) ? BrowserStepPhase.Failed : phase;
    const why = denied ? this.decisionNote ?? Resources.browserDeniedNote : this.isStale ? Resources.formatBrowserStaleNote(this.tool) : isDecisionShown ? this.decisionNote : null;
    switch (this.tool) {
      case Resources.browserNavigateTool:
        return this.navigateTitle(shown, why);
      case Resources.browserClickTool:
        return Resources.formatBrowserClicked(name, shown, why);
      case Resources.browserTypeTool:
        return Resources.formatBrowserTyped(name, this.isSecret, shown, why);
      case Resources.browserPressKeyTool:
        return Resources.formatBrowserPressed(BrowserStep.textOf(this.input[Resources.browserKeyField]) ?? String.empty, shown, why);
      default:
        return Resources.formatBrowserRead(this.tool, this.shownUrl, shown, why);
    }
  }

  public get shownUrl(): string | null {
    return this.pageUrl ?? BrowserStep.withoutScheme(BrowserStep.textOf(this.input[Resources.browserUrlField]));
  }

  public lineTitle(previousUrl: string | null): string {
    const words = Resources.browserLineReads.get(this.tool);
    if (Object.isUndefined(words)) {
      const title = this.title(BrowserStepPhase.Done, false);
      return `${title.charAt(0).toLowerCase()}${title.slice(1)}`;
    }
    const url = this.shownUrl === previousUrl ? null : this.shownUrl;
    return Resources.formatLowRiskRead(words, url, BrowserStep.textOf(this.input[Resources.browserTextField]));
  }

  private navigateTitle(phase: BrowserStepPhase, why: string | null): string {
    const action = BrowserStep.textOf(this.input[Resources.browserActionField]);
    if (!Object.isNull(action))
      return Resources.formatBrowserWent(action, phase, why);
    return this.isRefusedSite ? Resources.formatBrowserRefusedSite(BrowserStep.textOf(this.input[Resources.browserUrlField]) ?? String.empty)
      : Resources.formatBrowserOpened(this.shownUrl ?? String.empty, phase, why);
  }

  private static isAllowedAtLowRisk(permission: JsonObject): boolean {
    return permission[ProtocolResources.isAskedField] === false && permission[ProtocolResources.riskField] === Resources.browserLowRisk
      && Resources.browserAllowedDecisions.includes(BrowserStep.textOf(permission[ProtocolResources.decisionField]) ?? String.empty);
  }

  private static decisionNoteOf(permission: JsonObject): string | null {
    const decision = BrowserStep.textOf(permission[ProtocolResources.decisionField]) ?? String.empty;
    const note = Resources.browserDecisionNotes.get(decision);
    if (Object.isUndefined(note))
      return null;
    const isAllowed = Resources.browserAllowedDecisions.includes(decision);
    if (permission[ProtocolResources.isRememberedField] === true)
      return isAllowed ? Resources.browserAllowedEarlierNote : Resources.browserDeniedEarlierNote;
    if (permission[ProtocolResources.isAskedField] === true || !Resources.browserAnsweredDecisions.includes(decision))
      return note;
    if (!isAllowed)
      return Resources.browserDeniedUnaskedNote;
    return permission[ProtocolResources.riskField] === Resources.browserLowRisk ? Resources.browserLowRiskNote : Resources.browserModeAllowedNote;
  }

  private static withoutScheme(url: string | null): string | null {
    return Object.isNull(url) ? null : url.replace(Resources.browserSchemePattern, String.empty);
  }

  private static objectOf(value: JsonValue | undefined): JsonObject {
    return !Object.isUndefined(value) && BrowserStep.isJsonObject(value) ? value : {};
  }

  private static isJsonObject(value: JsonValue): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static textOf(value: JsonValue | undefined): string | null {
    return Object.isString(value) && !String.isNullOrWhitespace(value) ? value : null;
  }
}
