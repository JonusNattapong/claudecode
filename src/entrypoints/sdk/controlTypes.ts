/**
 * SDK Control Types — TypeScript types for the control protocol.
 *
 * These are the concrete types exported from the control protocol.
 * The schemas live in controlSchemas.ts for runtime validation.
 *
 * Used by SDK builders (e.g., Python SDK) to communicate with the CLI process.
 * SDK consumers should use coreTypes.ts instead.
 */

/**
 * A control request sent from an SDK consumer to the CLI process.
 */
export type SDKControlRequest = {
  type: 'control_request';
  request_id: string;
  request: {
    subtype: string;
    [key: string]: unknown;
  };
};

/**
 * A control response sent from the CLI process back to the SDK consumer.
 */
export type SDKControlResponse = {
  type: 'control_response';
  response: {
    subtype: 'success' | 'error';
    request_id: string;
    [key: string]: unknown;
  };
};
