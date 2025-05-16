import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "@/shared/api"
import { ApiHandler } from ".."
import { MessageParam } from "@anthropic-ai/sdk/resources/index.mjs"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { LLMServiceInterface, ServiceProvider, ServiceType } from "@salesforce/vscode-service-provider"
import { convertToOpenAiMessages } from "../transform/openai-format"
import OpenAI from "openai"
import { convertToR1Format } from "../transform/r1-format"

const EXTENSION_ID = "com.salesforce.salesforce-vscode-vibing"
const PROMPT_ID = "12345-67890-12345-98765"

export class SalesforceExternalHandler implements ApiHandler {
	private options: ApiHandlerOptions
	salesforceApiKey: string | undefined
	modelId: string
	coreLLMService!: LLMServiceInterface

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.salesforceApiKey = options.salesforceApiKey
		this.modelId = "gpt-4o"
		this.loadLLMService()
	}

	private async loadLLMService() {
		const coreLLMService: LLMServiceInterface = await ServiceProvider.getService(ServiceType.LLMService, EXTENSION_ID)
		this.coreLLMService = coreLLMService
	}
	async *createMessage(systemPrompt: string, messages: MessageParam[]): ApiStream {
		try {
			// @ts-ignore
			const apiCLient = this.coreLLMService.getExternalModelApiClient()

			let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
				{ role: "system", content: systemPrompt },
				...convertToOpenAiMessages(messages),
			]
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])

			const modelRequest = {
				promptId: PROMPT_ID,
				commandSource: "Chat",
				messages: openAiMessages,
				maxTokens: 4000,
				stream: true,
			}
			// @ts-ignore
			const modelConfig = this.coreLLMService.getExternalModelConfig()
			const stream = await apiCLient.generate(modelRequest, [modelConfig])

			for await (const chunk of stream.chunks) {
				// const delta = chunk.choices[0]?.delta
				// const generation = chunk.data.generations[0];
				const text = chunk?.generatedText
				if (text) {
					yield {
						type: "text",
						text: text,
					}
				}

				// if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				//     yield {
				//         type: "reasoning",
				//         reasoning: (delta.reasoning_content as string | undefined) || "",
				//     }
				// }

				// if (chunk.usage) {
				//     yield {
				//         type: "usage",
				//         inputTokens: chunk.usage.prompt_tokens || 0,
				//         outputTokens: chunk.usage.completion_tokens || 0,
				//     }
				// }
			}
		} catch (error) {
			console.error(error)
		}
	}
	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.modelId,
			info: openAiModelInfoSaneDefaults,
		}
	}
}
