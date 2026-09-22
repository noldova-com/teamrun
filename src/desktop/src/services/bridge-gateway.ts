/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, join } from "node:path";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { AppUpdateCommand, ErrorCode, type Event, MethodName, Project, Request, Response, UpdateCheckpointResult } from "@noldova/teamrun-protocol";

import type { IBridgeHandlers } from "../interfaces/i-bridge-handlers.js";
import type { IBridgeHost } from "../interfaces/i-bridge-host.js";
import type { IEventForwarder } from "../interfaces/i-event-forwarder.js";
import type { DesktopInfo } from "../models/desktop-info.js";
import type { SenderInfo } from "../models/sender-info.js";
import { Resources } from "../resources.js";
import type { RuntimeConnection } from "./runtime-connection.js";
import type { SenderPolicy } from "./sender-policy.js";
import type { UpdateService } from "./update.service.js";
import { RendererCheckpoint } from "./renderer-checkpoint.js";

export class BridgeGateway implements IBridgeHandlers, IEventForwarder {
  private readonly policy: SenderPolicy;
  private readonly connection: RuntimeConnection;
  private readonly host: IBridgeHost;
  private readonly info: DesktopInfo;
  private readonly updates: UpdateService;
  private readonly checkpoints: RendererCheckpoint;

  public constructor(policy: SenderPolicy, connection: RuntimeConnection, host: IBridgeHost, info: DesktopInfo, updates: UpdateService,
    checkpoints: RendererCheckpoint = new RendererCheckpoint(host)) {
    this.policy = policy;
    this.connection = connection;
    this.host = host;
    this.info = info;
    this.updates = updates;
    this.checkpoints = checkpoints;
  }

  public async invoke(sender: SenderInfo, request: unknown): Promise<JsonValue> {
    if (!this.policy.isTrusted(sender))
      return Response.failure(null, new ServiceResponseInfo(ErrorCode.Unauthorized, Resources.untrustedSender)).toJson();

    let parsed: Request;
    try {
      parsed = Request.fromJson(request);
    }
    catch (error) {
      return Response.failure(null, new ServiceResponseInfo(ErrorCode.InvalidParams, BridgeGateway.describe(error))).toJson();
    }

    if (this.checkpoints.isFrozen)
      return Response.failure(parsed.id, new ServiceResponseInfo(ErrorCode.Unavailable, Resources.checkpointBusy)).toJson();

    return (await this.forwardRequest(parsed)).toJson();
  }

  public async openExternal(sender: SenderInfo, url: unknown): Promise<boolean> {
    if (!this.policy.isTrusted(sender) || !Object.isString(url))
      return false;

    let parsed: URL;
    try {
      parsed = new URL(url);
    }
    catch {
      return false;
    }
    if (parsed.protocol !== Resources.httpProtocol && parsed.protocol !== Resources.httpsProtocol)
      return false;

    await this.host.openExternal(parsed.href);
    return true;
  }

  public pickDirectory(sender: SenderInfo): Promise<string | null> {
    return this.policy.isTrusted(sender) ? this.host.pickDirectory() : Promise.resolve(null);
  }

  public describe(sender: SenderInfo): Promise<JsonValue> {
    return Promise.resolve(this.policy.isTrusted(sender) ? this.info.toJson() : null);
  }

  public async update(sender: SenderInfo, command: unknown): Promise<JsonValue> {
    if (!this.policy.isTrusted(sender))
      return null;
    const parsed = Object.values(AppUpdateCommand).find(t => t === command);
    return Object.isUndefined(parsed) ? null : (await this.updates.execute(parsed)).toJson();
  }

  public async checkpoint(sender: SenderInfo, result: unknown): Promise<boolean> {
    if (!this.policy.isTrusted(sender))
      return false;
    try {
      return this.checkpoints.acknowledge(sender.windowId, UpdateCheckpointResult.fromJson(result));
    }
    catch {
      return false;
    }
  }

  public setTitleBar(sender: SenderInfo, color: unknown, symbolColor: unknown): Promise<boolean> {
    if (!this.policy.isTrusted(sender) || !BridgeGateway.isColor(color) || !BridgeGateway.isColor(symbolColor))
      return Promise.resolve(false);

    this.host.setTitleBar(color, symbolColor);
    return Promise.resolve(true);
  }

  public async readImage(sender: SenderInfo, path: unknown): Promise<string | null> {
    if (!this.policy.isTrusted(sender) || !Object.isString(path) || !isAbsolute(path))
      return null;
    const mediaType = Resources.imageMediaTypes[extname(path).toLowerCase()];
    if (Object.isUndefined(mediaType))
      return null;
    try {
      const target = await realpath(path);
      if (!(await this.isInsideTheImageStore(target)) && !(await this.isInsideAProject(target)))
        return null;
      await using file = await open(target, Resources.imageReadMode);
      const info = await file.stat();
      if (!info.isFile() || info.size > Resources.maximumImageBytes)
        return null;
      const buffer = Buffer.alloc(info.size + 1);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const read = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead);
        if (read.bytesRead === 0)
          break;
        bytesRead += read.bytesRead;
      }
      if (bytesRead > info.size || await realpath(target) !== target)
        return null;
      return `${Resources.dataUrlPrefix}${mediaType}${Resources.base64DataUrlSeparator}${buffer.subarray(0, bytesRead).toString(Resources.base64Encoding)}`;
    }
    catch {
      return null;
    }
  }

  private async isInsideTheImageStore(target: string): Promise<boolean> {
    return await BridgeGateway.isUnderExisting(join(this.info.dataDirectory, Resources.imagesDirectoryName), target)
      || await BridgeGateway.isUnderExisting(join(this.info.dataDirectory, Resources.attachmentsDirectoryName), target);
  }

  private static async isUnderExisting(root: string, target: string): Promise<boolean> {
    try {
      return BridgeGateway.isUnder(await realpath(root), target);
    }
    catch {
      return false;
    }
  }

  private static isUnder(root: string, target: string): boolean {
    const path = relative(resolve(root), target);
    return !String.isNullOrWhitespace(path) && !path.startsWith(Resources.parentDirectory) && !isAbsolute(path);
  }

  private async isInsideAProject(target: string): Promise<boolean> {
    const response = await this.connection.call(new Request(Resources.projectListRequestId, MethodName.ProjectList, null));
    if (!Object.isNull(response.info) || !Array.isArray(response.payload))
      return false;

    for (const value of response.payload)
      if (await BridgeGateway.isUnderExisting(Project.fromJson(value).rootPath, target))
        return true;
    return false;
  }

  public forward(event: Event): void {
    this.host.broadcast(Resources.eventChannel, event.toJson());
  }

  private async forwardRequest(request: Request): Promise<Response> {
    try {
      const response = await this.connection.call(request);
      return Object.isNull(response.info) ? Response.success(request.id, response.payload) : Response.failure(request.id, response.info);
    }
    catch (error) {
      return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Unavailable, Resources.formatRuntimeFailure(BridgeGateway.describe(error))));
    }
  }

  private static isColor(value: unknown): value is string {
    return Object.isString(value) && Resources.colorPattern.test(value);
  }

  private static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
