"""
config.py – Centralised settings loaded from .env via Pydantic Settings.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ENV_FILE, ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM Provider ────────────────────────────────────────────────────────
    LLM_PROVIDER: str = Field(default="gemini", description="'gemini', 'openai', or 'anthropic'")

    # Gemini / Google
    GEMINI_API_KEYS: str = Field(
        default="",
        description="Comma-separated Gemini API keys for workload distribution & failover",
    )
    GEMINI_API_KEY: str = Field(default="", description="Google Gemini API key")
    GOOGLE_API_KEY: str = Field(default="", description="Google Gemini API key alias")
    GEMINI_MODEL: str = Field(default="gemini-3.5-flash", description="Gemini model name")

    # Groq (Ultra-fast failover / alternative provider)
    GROQ_API_KEY: str = Field(default="", description="Groq API key")
    GROQ_MODEL: str = Field(default="llama-3.3-70b-versatile", description="Groq model name")

    # OpenAI
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    OPENAI_MODEL: str = Field(default="gpt-4o", description="OpenAI model name")

    # Anthropic
    ANTHROPIC_API_KEY: str = Field(default="", description="Anthropic API key")
    ANTHROPIC_MODEL: str = Field(
        default="claude-3-5-sonnet-20241022", description="Anthropic model name"
    )

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_PATH: str = Field(default="analytics.db")

    # ── Agent ────────────────────────────────────────────────────────────────
    MAX_RETRY_COUNT: int = Field(default=3)
    SQL_ROW_LIMIT: int = Field(default=1000)

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)

    # ── CORS ─────────────────────────────────────────────────────────────────
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000")

    def get_llm(self, temperature: float = 0.0):
        """
        Returns the configured chat model based on LLM_PROVIDER.
        When provider is 'gemini', 'google', or 'groq':
        Uses ResilientLLMManager for round-robin multi-key load balancing,
        instant 429/quota failover across Gemini keys, and Groq fallback.
        """
        provider = self.LLM_PROVIDER.lower()

        if provider in ("gemini", "google", "groq"):
            from app.llm_manager import ResilientLLMManager

            # Collect all available Gemini keys
            gemini_keys: list[str] = []
            if self.GEMINI_API_KEYS:
                gemini_keys.extend([k.strip() for k in self.GEMINI_API_KEYS.split(",") if k.strip()])
            if self.GEMINI_API_KEY and self.GEMINI_API_KEY not in gemini_keys:
                gemini_keys.append(self.GEMINI_API_KEY)
            if self.GOOGLE_API_KEY and self.GOOGLE_API_KEY not in gemini_keys:
                gemini_keys.append(self.GOOGLE_API_KEY)

            return ResilientLLMManager(
                gemini_keys=gemini_keys,
                gemini_model=self.GEMINI_MODEL,
                groq_key=self.GROQ_API_KEY,
                groq_model=self.GROQ_MODEL,
                primary_provider=provider,
                temperature=temperature,
            )
        elif provider == "anthropic":
            from langchain_anthropic import ChatAnthropic

            return ChatAnthropic(
                model=self.ANTHROPIC_MODEL,
                api_key=self.ANTHROPIC_API_KEY,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=4096,
            )
        else:
            from langchain_openai import ChatOpenAI

            return ChatOpenAI(
                model=self.OPENAI_MODEL,
                api_key=self.OPENAI_API_KEY,  # type: ignore[arg-type]
                temperature=temperature,
            )


settings = Settings()
