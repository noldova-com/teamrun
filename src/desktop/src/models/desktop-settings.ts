/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class DesktopSettings {
  public readonly dataDirectory: string;
  public readonly productVersion: string;
  public readonly rendererIndexPath: string;
  public readonly iconPath: string;
  public readonly rendererUrl: string | null;
  public readonly screenshotPath: string | null;
  public readonly screenshotDelayMilliseconds: number;
  public readonly startView: string | null;

  public constructor(
    dataDirectory: string,
    productVersion: string,
    rendererIndexPath: string,
    iconPath: string,
    rendererUrl: string | null,
    screenshotPath: string | null,
    screenshotDelayMilliseconds: number,
    startView: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryParameterName);
    if (!isAbsolute(dataDirectory))
      throw new ArgumentException(Resources.dataDirectoryParameterName, Resources.dataDirectoryParameterName);
    ArgumentException.throwIfNullOrWhitespace(productVersion, Resources.productVersionParameterName);
    ArgumentException.throwIfNullOrWhitespace(rendererIndexPath, Resources.rendererIndexParameterName);
    ArgumentException.throwIfNullOrWhitespace(iconPath, Resources.iconParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(screenshotDelayMilliseconds, Resources.screenshotDelayParameterName);

    this.dataDirectory = dataDirectory;
    this.productVersion = productVersion;
    this.rendererIndexPath = rendererIndexPath;
    this.iconPath = iconPath;
    this.rendererUrl = rendererUrl;
    this.screenshotPath = screenshotPath;
    this.screenshotDelayMilliseconds = screenshotDelayMilliseconds;
    this.startView = startView;
  }

  public static fromEnvironment(
    environment: NodeJS.ProcessEnv,
    homeDirectory: string,
    moduleDirectory: string,
    productVersion: string,
    resourcesDirectory?: string): DesktopSettings {
    const dataDirectory = resolve(environment[Resources.dataDirectoryVariable] ?? join(homeDirectory, ...Resources.dataDirectorySegments));
    const defaultIndex = join(moduleDirectory, ...Resources.repositoryRootSegments, ...Resources.rendererIndexSegments);
    const rendererIndex = environment[Resources.rendererIndexVariable] ?? defaultIndex;
    const delay = environment[Resources.screenshotDelayVariable];

    return new DesktopSettings(
      dataDirectory,
      productVersion,
      resolve(rendererIndex),
      join(resourcesDirectory ?? join(moduleDirectory, ...Resources.repositoryRootSegments), ...Resources.iconSegments),
      environment[Resources.rendererUrlVariable] ?? null,
      environment[Resources.screenshotVariable] ?? null,
      Object.isUndefined(delay) ? Resources.defaultScreenshotDelay : Number(delay),
      environment[Resources.startViewVariable] ?? null);
  }

  public get usesDevelopmentServer(): boolean {
    return !Object.isNull(this.rendererUrl);
  }

  public get rendererOrigin(): string {
    return Object.isNull(this.rendererUrl) ? pathToFileURL(this.rendererIndexPath).href : new URL(this.rendererUrl).origin;
  }

  public get contentSecurityPolicy(): string {
    return this.usesDevelopmentServer ? Resources.developmentContentSecurityPolicy : Resources.productionContentSecurityPolicy;
  }
}
