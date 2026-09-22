/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Guid } from "@noldova/teamrun-foundation-core";
import { ServiceResponseInfo } from "@noldova/teamrun-foundation-services";
import { ErrorCode, type IRequestDispatcher, MethodName, type Request, Response, UpdateOperation } from "@noldova/teamrun-protocol";
import { EndpointKind, InstallationMember, InstallationRole, type InstallationRegistry, RuntimeServer, type IServerListener, TokenGenerator } from "@noldova/teamrun-runtime";

import { Resources } from "../resources.js";
import type { RendererCheckpoint } from "./renderer-checkpoint.js";

export class UpdatePeer implements IRequestDispatcher, IServerListener {
  private readonly registry: InstallationRegistry;
  private readonly checkpoints: RendererCheckpoint;
  private readonly closeWindow: () => void;
  private readonly monitorMilliseconds: number;
  private readonly server: RuntimeServer;
  private registration: InstallationMember;
  private operation: string | null = null;
  private monitor: NodeJS.Timeout | null = null;
  private closingRequest: string | null = null;
  private registered: boolean = false;
  private readonly token: string;

  public constructor(registry: InstallationRegistry, dataDirectory: string, version: string, checkpoints: RendererCheckpoint,
    closeWindow: () => void, monitorMilliseconds: number = Resources.updatePeerMonitorMilliseconds) {
    this.registry = registry;
    this.checkpoints = checkpoints;
    this.closeWindow = closeWindow;
    this.monitorMilliseconds = monitorMilliseconds;
    const token = new TokenGenerator().generate();
    this.registration = new InstallationMember(Guid.createVersion7().toString(), InstallationRole.Desktop, process.pid,
      dataDirectory, version, null, null);
    this.server = new RuntimeServer(EndpointKind.Tcp, Resources.updatePeerSocketName, token, this, this);
    this.token = token;
  }

  public get member(): InstallationMember {
    return this.registration;
  }

  public async start(): Promise<void> {
    this.registry.register(this.registration);
    this.registered = true;
    try {
      const endpoint = await this.server.start();
      this.registration = this.registration.withEndpoint(endpoint, this.token);
      this.registry.activate(this.registration);
    }
    catch (error) {
      await this.dispose();
      throw error;
    }
  }

  public async dispatch(request: Request): Promise<Response> {
    let operation: UpdateOperation;
    try {
      operation = UpdateOperation.fromJson(request.payload);
    }
    catch {
      return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.InvalidParams, Resources.updateControlUnknown));
    }
    try {
      switch (request.method) {
        case MethodName.DesktopPrepareUpdate: {
          if (!this.registry.isPreparing(operation.id) || (!Object.isNull(this.operation) && this.operation !== operation.id))
            return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Conflict, Resources.updatePreparationExpired));
          this.operation = operation.id;
          if (Object.isNull(this.monitor))
            this.monitor = setInterval(() => this.checkOwner(), this.monitorMilliseconds);
          if (!await this.checkpoints.prepare(operation.id)) {
            this.resume(operation.id);
            return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Conflict, Resources.updateWorkspaceNotReady));
          }
          return Response.success(request.id, null);
        }
        case MethodName.DesktopResumeUpdate:
          this.resume(operation.id);
          return Response.success(request.id, null);
        case MethodName.DesktopCloseForUpdate:
          if (this.operation !== operation.id || !this.checkpoints.isPrepared || !this.registry.isInstalling(operation.id))
            return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Conflict, Resources.updateWorkspaceNotReady));
          this.closingRequest = request.id;
          return Response.success(request.id, null);
        default:
          return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.UnknownMethod, Resources.updateControlUnknown));
      }
    }
    catch {
      if (this.operation === operation.id)
        this.resume(operation.id);
      return Response.failure(request.id, new ServiceResponseInfo(ErrorCode.Unavailable, Resources.updateWorkspaceNotReady));
    }
  }

  public onSessionCountChanged(_count: number): void {
    // Ownership follows the installation lease, not short-lived transport clients.
  }

  public onResponseSent(request: Request): void {
    if (!Object.isNull(this.closingRequest) && request.id === this.closingRequest && request.method === MethodName.DesktopCloseForUpdate) {
      this.closingRequest = null;
      this.closeWindow();
    }
  }

  public resume(id: string): void {
    if (this.operation !== id)
      return;
    if (!Object.isNull(this.monitor))
      clearInterval(this.monitor);
    this.monitor = null;
    this.operation = null;
    this.closingRequest = null;
    this.checkpoints.resume(id);
  }

  public async dispose(): Promise<void> {
    if (!Object.isNull(this.operation))
      this.resume(this.operation);
    await this.server.stop();
    if (this.registered) {
      this.registry.unregister(this.registration.id);
      this.registered = false;
    }
  }

  private checkOwner(): void {
    const id = this.operation;
    if (Object.isNull(id))
      return;
    try {
      if (this.registry.ownsUpdate(id))
        return;
    }
    catch {
      // An uncertain registry read cannot unfreeze a workspace while its coordinator may still own the gate.
      return;
    }
    this.resume(id);
  }
}
