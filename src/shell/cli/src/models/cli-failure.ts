/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { type Failure, FailureCode } from "@noldova/teamrun-shell-protocol";
import {
  BuildMismatchException,
  ConnectionException,
  DeclarationsFormatException,
  LaunchException,
  NoRuntimeException,
  PreShellDataFoundException,
  RuntimeHandoverException,
  UpdateInProgressException,
  WorkInProgressException
} from "@noldova/teamrun-shell-runtime";

import { ExitCode } from "../enums/exit-code.js";
import { CliCommandException } from "../exceptions/cli-command.exception.js";
import { ModuleNotActiveException } from "../exceptions/module-not-active.exception.js";
import { UsageException } from "../exceptions/usage.exception.js";
import { Resources } from "../resources.js";

export class CliFailure {
  public readonly exitCode: ExitCode;
  public readonly code: string;
  public readonly message: string;
  public readonly details: JsonObject | null;

  public constructor(exitCode: ExitCode, code: string, message: string, details: JsonObject | null = null) {
    this.exitCode = exitCode;
    this.code = code;
    this.message = message;
    this.details = details;
  }

  public static fromFailure(failure: Failure): CliFailure {
    if (failure.code === FailureCode.Updating)
      return new CliFailure(ExitCode.Updating, failure.code, failure.message);
    if (failure.code === FailureCode.Unauthorized)
      return new CliFailure(ExitCode.DataDirectoryUnusable, failure.code, Resources.formatDataDirectoryUnusable(failure.message));
    const isStopped = failure.code === FailureCode.Cancelled || failure.code === FailureCode.DeadlineExceeded;
    return new CliFailure(isStopped ? ExitCode.Stopped : ExitCode.Failed, failure.code, failure.message, failure.details ?? null);
  }

  public static fromError(error: unknown): CliFailure {
    if (error instanceof UsageException)
      return new CliFailure(ExitCode.Usage, Resources.usageCode, error.message);
    if (error instanceof NoRuntimeException)
      return new CliFailure(ExitCode.NoRuntime, Resources.noRuntimeCode, error.message);
    if (error instanceof BuildMismatchException || error instanceof RuntimeHandoverException)
      return new CliFailure(ExitCode.BuildMismatch, Resources.buildMismatchCode, error.message, error.handover.toJson());
    if (error instanceof WorkInProgressException)
      return new CliFailure(ExitCode.BuildMismatch, FailureCode.Conflict, error.message, error.work.toJson());
    if (error instanceof UpdateInProgressException)
      return new CliFailure(ExitCode.Updating, FailureCode.Updating, error.message);
    if (error instanceof PreShellDataFoundException)
      return new CliFailure(ExitCode.DataDirectoryUnusable, FailureCode.PreShellData, error.message, error.data.toJson());
    if (error instanceof ConnectionException)
      return CliFailure.fromConnection(error);
    if (error instanceof LaunchException || error instanceof DeclarationsFormatException)
      return new CliFailure(ExitCode.Failed, Resources.failedCode, error.message);
    if (error instanceof ModuleNotActiveException)
      return new CliFailure(ExitCode.ModuleNotActive, Resources.moduleNotActiveCode, error.message, error.toJson());
    if (error instanceof CliCommandException)
      return new CliFailure(ExitCode.Failed, error.code, error.message, error.details);
    if (CliFailure.isUnusableDirectory(error))
      return new CliFailure(ExitCode.DataDirectoryUnusable, Resources.dataDirectoryUnusableCode, Resources.formatDataDirectoryUnusable((error as Error).message));
    throw error;
  }

  private static fromConnection(error: ConnectionException): CliFailure {
    const failure = error.failure;
    return Object.isNull(failure) ? new CliFailure(ExitCode.Failed, FailureCode.Unavailable, error.message) : CliFailure.fromFailure(failure);
  }

  private static isUnusableDirectory(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    return Object.isString(code) && Resources.unusableDirectoryErrorCodes.includes(code);
  }

  public toJson(): JsonObject {
    return Object.isNull(this.details) ? { code: this.code, message: this.message } : { code: this.code, message: this.message, details: this.details };
  }
}
