import { intro, outro, text } from '@clack/prompts';
import axios from 'axios';
import chalk from 'chalk';
import {
  ChatCompletionRequestMessage,
  Configuration as OpenAiApiConfiguration,
  OpenAIApi
} from 'openai';

import {
  CONFIG_MODES,
  DEFAULT_MODEL_TOKEN_LIMIT,
  getConfig
} from './commands/config';
import { tokenCount } from './utils/tokenCount';
import { GenerateCommitMessageErrorEnum } from './generateCommitMessageFromGitDiff';
import { execa } from 'execa';

const config = getConfig();

let maxTokens = config?.OCO_OPENAI_MAX_TOKENS;
let basePath = config?.OCO_OPENAI_BASE_PATH;
let apiKey = config?.OCO_OPENAI_API_KEY;

const [command, mode] = process.argv.slice(2);

const MODEL = config?.OCO_MODEL || 'gpt-3.5-turbo';

class OpenAi {
  private openAiApiConfiguration = new OpenAiApiConfiguration({
    apiKey: apiKey
  });
  private openAI!: OpenAIApi;

  constructor() {
    if (basePath) {
      this.openAiApiConfiguration.basePath = basePath;
    }
    this.openAI = new OpenAIApi(this.openAiApiConfiguration);
  }

  public generateCommitMessage = async (
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> => {
    const params = {
      model: MODEL,
      messages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: maxTokens || 500
    };
    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content) + 4)
        .reduce((a, b) => a + b, 0);

      if (REQUEST_TOKENS > DEFAULT_MODEL_TOKEN_LIMIT - maxTokens) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      return Buffer.from(
        (
          await text({ message: JSON.stringify(params.messages[3].content) })
        ).toString(),
        'base64'
      ).toString();
    } catch (error) {
      outro(`${chalk.red('✖')} ${JSON.stringify(params)}`);

      const err = error as Error;
      outro(`${chalk.red('✖')} ${err?.message || err}`);

      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError?.message) outro(openAiError.message);
        outro(
          'For help look into README https://github.com/di-sukharev/opencommit#setup'
        );
      }

      throw err;
    }
  };
}

export const getOpenCommitLatestVersion = async (): Promise<
  string | undefined
> => {
  try {
    const { stdout } = await execa('npm', ['view', 'opencommit', 'version']);
    return stdout;
  } catch (_) {
    outro('Error while getting the latest version of opencommit');
    return undefined;
  }
};

export const api = new OpenAi();
