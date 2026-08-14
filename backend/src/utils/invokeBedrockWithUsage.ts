import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { getActiveBedrockModelId } from "./bedrockModelId.js";
import { recordLlmUsageAsync } from "../services/observability/llmUsage.service.js";
import { assertFeatureTokenQuota } from "../services/admin/featureTokenQuota.service.js";
import type { OrgControlFeature } from "../services/admin/orgControlFeatures.js";

const REGION =
  process.env.AWS_REGION?.trim() ||
  process.env.AWS_DEFAULT_REGION?.trim() ||
  "us-east-1";

const sharedClient = new BedrockRuntimeClient({ region: REGION });

export type InvokeBedrockAnthropicOptions = {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  modelId?: string;
  /** Optional client (e.g. agent-local). Defaults to a shared regional client. */
  client?: BedrockRuntimeClient;
  /** When set, enforce that feature's per-user token quota before invoking. */
  feature?: OrgControlFeature;
};

/**
 * Invoke Anthropic-on-Bedrock and record token usage for Observability.
 */
export async function invokeBedrockAnthropicText(
  options: InvokeBedrockAnthropicOptions,
): Promise<string> {
  if (options.feature) {
    await assertFeatureTokenQuota(options.feature);
  }
  const modelId = (options.modelId?.trim() || getActiveBedrockModelId()).trim();
  const maxTokens = options.maxTokens ?? 4096;
  const temperature = options.temperature ?? 0.3;
  const client = options.client ?? sharedClient;

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: [{ type: "text", text: options.prompt }] }],
  });

  const response = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    }),
  );

  const result = JSON.parse(new TextDecoder().decode(response.body)) as {
    content?: Array<{ text?: string }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };

  const inputTokens = Number(result.usage?.input_tokens) || 0;
  const outputTokens = Number(result.usage?.output_tokens) || 0;
  if (inputTokens > 0 || outputTokens > 0) {
    recordLlmUsageAsync({
      modelId,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      feature: options.feature ?? null,
    });
  }

  return result.content?.[0]?.text ?? "";
}
