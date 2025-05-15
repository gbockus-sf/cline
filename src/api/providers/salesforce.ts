import { ApiHandlerOptions, ModelInfo, openAiModelInfoSaneDefaults } from "@/shared/api";
import { ApiHandler } from "..";
import { MessageParam } from "@anthropic-ai/sdk/resources/index.mjs";
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream";
import { LLMServiceInterface, ServiceProvider, ServiceType } from "@salesforce/vscode-service-provider";
import { convertToOpenAiMessages } from "../transform/openai-format";
import OpenAI from "openai";

const EXTENSION_ID = 'com.salesforce.salesforce-vscode-vibing';
const PROMPT_ID = '12345-67890-12345-98765';

export class SalesforceHandler implements ApiHandler {
    private options: ApiHandlerOptions
    salesforceApiKey: string | undefined;
    modelId: string;
    coreLLMService!: LLMServiceInterface;

	constructor(options: ApiHandlerOptions) {
		this.options = options;
        this.salesforceApiKey = options.salesforceApiKey;
        this.modelId = 'gpt-4o'
        this.loadLLMService();
	}

    private async loadLLMService() {
        const coreLLMService: LLMServiceInterface = await ServiceProvider.getService(ServiceType.LLMService, EXTENSION_ID);
        this.coreLLMService = coreLLMService;
    }
    async *createMessage(systemPrompt: string, messages: MessageParam[]): ApiStream {
        try {
        // @ts-ignore
        const apiCLient = this.coreLLMService.getApiClient();
    
        let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
            // @ts-ignore
            // { role: "user", content: messages[0].content[0].text}
			// ...convertToOpenAiMessages(messages),
		];
        for (const message of messages) {
            // @ts-ignore
            openAiMessages.push({ role: message.role, content: message.content[0].text});
        }

        const promptString = JSON.stringify(openAiMessages);
        const stream = await apiCLient.getChatStream({
                prompt: promptString,
                max_tokens: 2000,
                parameters: {
                  command_source: 'Chat'
                }
              }, PROMPT_ID);

              for await (const chunk of stream) {
                // const delta = chunk.choices[0]?.delta
                const generation = chunk.data.generations[0];
                if (generation?.text) {
                    yield {
                        type: "text",
                        text: generation.text,
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
            console.error(error);
        }
    }
    getModel(): { id: string; info: ModelInfo; } {
        return {
			id: this.modelId,
			info: openAiModelInfoSaneDefaults,
		}
    }


}

