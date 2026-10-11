from time import sleep
from typing import TypeVar

from litellm import completion
from litellm.exceptions import APIConnectionError, InternalServerError, RateLimitError, ServiceUnavailableError
from pydantic import BaseModel

# OpenRouter model, served by Cerebras (see .claude/skills/cerebras). LiteLLM needs the
# "openrouter/" prefix to route the request to OpenRouter.
MODEL = "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
# The free model can take close to a minute to answer.
TIMEOUT_SECONDS = 120
# The free model is sometimes briefly overloaded, so such transient errors are retried.
RETRIES = 2
RETRY_DELAY_SECONDS = 2
TRANSIENT_ERRORS = (ServiceUnavailableError, RateLimitError, APIConnectionError, InternalServerError)

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)


class LlmError(Exception):
    """The model could not be reached or did not return a usable response."""


class LlmNotConfiguredError(LlmError):
    """No API key is configured."""


class LlmClient:
    """Calls the LLM with Structured Outputs. Tests replace it with a fake."""

    def __init__(self, api_key: str | None) -> None:
        self.api_key = api_key

    def complete(self, messages: list[dict[str, str]], response_model: type[ResponseModel]) -> ResponseModel:
        if not self.api_key:
            raise LlmNotConfiguredError("OPENROUTER_API_KEY is not set")
        try:
            response = self._call(messages, response_model)
            return response_model.model_validate_json(response.choices[0].message.content)
        except Exception as error:
            raise LlmError(f"LLM request failed: {type(error).__name__}") from error

    def _call(self, messages: list[dict[str, str]], response_model: type[BaseModel]):
        for attempt in range(RETRIES + 1):
            try:
                return completion(
                    model=MODEL,
                    messages=messages,
                    response_format=response_model,
                    reasoning_effort="low",
                    extra_body=EXTRA_BODY,
                    api_key=self.api_key,
                    timeout=TIMEOUT_SECONDS,
                )
            except TRANSIENT_ERRORS:
                if attempt == RETRIES:
                    raise
                sleep(RETRY_DELAY_SECONDS * (attempt + 1))
