import { config as baseConfig } from "./base.js";

/**
 * Shared ESLint config for Node.js services and scripts.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [...baseConfig];
