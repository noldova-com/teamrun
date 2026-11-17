/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { Project } from "./project.js";

export class ProjectListing {
  public readonly project: Project;
  public readonly folderMissing: boolean;

  public constructor(project: Project, folderMissing: boolean) {
    this.project = project;
    this.folderMissing = folderMissing;
  }

  public static fromJson(value: unknown, path?: string): ProjectListing {
    const reader = JsonReader.fromValue(value, path);
    const project = reader.readObject(Resources.projectField);
    return new ProjectListing(Project.fromJson(project.toJson(), project.path), reader.readBoolean(Resources.folderMissingField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.projectField]: this.project.toJson(),
      [Resources.folderMissingField]: this.folderMissing
    };
  }
}
