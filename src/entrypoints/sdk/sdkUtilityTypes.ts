/**
 * SDK Utility Types — utility types that can't be expressed as Zod schemas.
 */

import type { ModelUsage } from './coreTypes.generated.js';

export type NonNullableUsage = {
  [K in keyof ModelUsage]: NonNullable<ModelUsage[K]>;
};
