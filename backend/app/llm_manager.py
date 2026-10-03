"""
app/llm_manager.py – Resilient Multi-Key & Multi-Provider LLM Manager.

Features:
1. Workload Distribution: Round-robin across multiple Gemini API keys.
2. Automatic Key Shift: If a Gemini key hits rate-limit (429/ResourceExhausted/Quota),
   it immediately shifts to the next key.
3. Cross-Provider Failover: If all Gemini keys are exhausted or fail,
   it seamlessly falls back to Groq (or vice-versa).
4. Drop-in LangChain Compatibility: Exposes an .invoke(messages) interface
   returning standard AIMessage(content=...).
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, List, Optional
import httpx
from langchain_core.messages import AIMessage, BaseMessage

logger = logging.getLogger("app.llm_manager")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [LLM] %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class ResilientLLMManager:
    """
    Manages multiple Gemini API keys and Groq fallback.
    Distributes workload and handles automatic rate-limit failover.
    """

    _shared_key_index: int = 0
    _shared_lock = threading.Lock()
    _shared_key_cooldowns: dict[str, float] = {}  # key -> cooldown_until_timestamp

    def __init__(
        self,
        gemini_keys: List[str],
        gemini_model: str = "gemini-3.5-flash",
        groq_key: str = "",
        groq_model: str = "openai/gpt-oss-120b",
        primary_provider: str = "gemini",
        temperature: float = 0.0,
    ) -> None:
        self.gemini_keys = [k.strip() for k in gemini_keys if k and k.strip()]
        self.gemini_model = gemini_model
        self.groq_key = groq_key.strip()
        self.groq_model = groq_model
        self.primary_provider = primary_provider.lower()
        self.temperature = temperature

        logger.debug(
            f"LLM Manager configured | Primary: {self.primary_provider} | "
            f"Gemini Keys: {len(self.gemini_keys)} | Gemini Model: {self.gemini_model} | "
            f"Groq Fallback: {'Enabled (' + self.groq_model + ')' if self.groq_key else 'Disabled'}"
        )

    def _get_next_gemini_key(self) -> tuple[int, str]:
        """Gets next available Gemini key in round-robin order, skipping active cooldowns if possible."""
        with ResilientLLMManager._shared_lock:
            if not self.gemini_keys:
                raise ValueError("No Gemini API keys configured.")

            now = time.time()
            total_keys = len(self.gemini_keys)

            # Try to find a key not on cooldown
            for offset in range(total_keys):
                candidate_idx = (ResilientLLMManager._shared_key_index + offset) % total_keys
                candidate_key = self.gemini_keys[candidate_idx]
                cooldown_until = ResilientLLMManager._shared_key_cooldowns.get(candidate_key, 0)
                if now >= cooldown_until:
                    ResilientLLMManager._shared_key_index = (candidate_idx + 1) % total_keys
                    return candidate_idx, candidate_key

            # All keys are in cooldown; pick the one whose cooldown expires earliest
            best_idx = 0
            best_key = self.gemini_keys[0]
            earliest = float("inf")
            for idx, key in enumerate(self.gemini_keys):
                cd = ResilientLLMManager._shared_key_cooldowns.get(key, 0)
                if cd < earliest:
                    earliest = cd
                    best_idx = idx
                    best_key = key

            ResilientLLMManager._shared_key_index = (best_idx + 1) % total_keys
            return best_idx, best_key

    def _mark_key_rate_limited(self, key: str, cooldown_seconds: float = 60.0) -> None:
        """Puts a key on cooldown due to rate limit."""
        with ResilientLLMManager._shared_lock:
            ResilientLLMManager._shared_key_cooldowns[key] = time.time() + cooldown_seconds
            # Mask key for privacy
            masked = key[:6] + "..." + key[-4:] if len(key) > 10 else "***"
            logger.warning(f"Key {masked} placed on cooldown for {cooldown_seconds}s due to rate limit.")

    def _is_rate_limit_error(self, err: Exception) -> bool:
        """Determines if an exception corresponds to rate limit, quota exhaustion, or 429."""
        msg = str(err).lower()
        err_type = type(err).__name__.lower()
        return any(
            x in msg or x in err_type
            for x in (
                "429",
                "resourceexhausted",
                "resource_exhausted",
                "quota",
                "rate limit",
                "ratelimit",
                "too many requests",
                "exhausted",
                "overloaded",
                "exceeded",
            )
        )

    def _call_gemini(self, key: str, messages: Any) -> AIMessage:
        """Calls Google Gemini using langchain_google_genai with a specific API key."""
        from langchain_google_genai import ChatGoogleGenerativeAI

        model = self.gemini_model or "gemini-3.5-flash"

        chat = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=key,
            temperature=self.temperature,
            max_retries=1,
        )
        resp = chat.invoke(messages)
        content = resp.content

        # Unpack list response structure into clean text string
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict) and "text" in item:
                    parts.append(str(item["text"]))
                elif isinstance(item, str):
                    parts.append(item)
                elif hasattr(item, "text"):
                    parts.append(str(getattr(item, "text")))
                else:
                    parts.append(str(item))
            content = "\n".join(parts)
        elif not isinstance(content, str):
            content = str(content)

        return AIMessage(content=content)

    def _call_groq(self, messages: Any) -> AIMessage:
        """Calls Groq API via standard OpenAI-compatible HTTP completions endpoint."""
        if not self.groq_key:
            raise ValueError("Groq API key is not configured.")

        # Convert LangChain messages to standard dict format
        formatted: list[dict[str, str]] = []
        for m in messages:
            if hasattr(m, "content"):
                m_type = getattr(m, "type", "user")
                role = "user"
                if m_type == "system":
                    role = "system"
                elif m_type in ("ai", "assistant"):
                    role = "assistant"
                formatted.append({"role": role, "content": str(m.content)})
            elif isinstance(m, dict):
                formatted.append({"role": m.get("role", "user"), "content": str(m.get("content", ""))})
            else:
                formatted.append({"role": "user", "content": str(m)})

        payload = {
            "model": self.groq_model,
            "messages": formatted,
            "temperature": self.temperature,
        }
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Groq API error ({resp.status_code}): {resp.text}"
                )

            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return AIMessage(content=content)

    def invoke(self, messages: Any, **kwargs: Any) -> AIMessage:
        """
        Executes prompt with automatic multi-key rotation and multi-provider failover.
        """
        # If primary provider is groq, try groq first
        if self.primary_provider == "groq" and self.groq_key:
            try:
                return self._call_groq(messages)
            except Exception as e:
                logger.warning(f"Primary Groq call failed ({e}). Shifting to Gemini pool...")

        # If primary is gemini (or groq failed), try Gemini keys
        last_exception: Optional[Exception] = None
        attempted_keys = 0
        total_gemini = len(self.gemini_keys)

        while attempted_keys < total_gemini:
            key_idx, key = self._get_next_gemini_key()
            attempted_keys += 1
            masked = key[:6] + "..." + key[-4:] if len(key) > 10 else "***"

            try:
                logger.info(f"Dispatching query to Gemini (Key #{key_idx + 1}: {masked})...")
                result = self._call_gemini(key, messages)
                return result
            except Exception as e:
                last_exception = e
                if self._is_rate_limit_error(e):
                    logger.warning(
                        f"⚠️ Rate limit / quota hit on Gemini Key #{key_idx + 1} ({masked}): {e}. "
                        f"Automatically shifting to next key..."
                    )
                    self._mark_key_rate_limited(key, cooldown_seconds=90.0)
                else:
                    logger.warning(f"Error on Gemini Key #{key_idx + 1} ({masked}): {e}. Shifting to next key...")

        # If all Gemini keys failed / hit limits, failover to Groq
        if self.groq_key:
            logger.info(
                f"⚡ All Gemini keys exhausted or failed. Automatically shifting workload to Groq ({self.groq_model})..."
            )
            try:
                result = self._call_groq(messages)
                logger.info("Successfully received response from Groq fallback!")
                return result
            except Exception as groq_err:
                logger.error(f"Groq fallback also failed: {groq_err}")
                raise RuntimeError(
                    f"All Gemini keys and Groq fallback failed. Last Gemini error: {last_exception}. Groq error: {groq_err}"
                ) from groq_err

        # No Groq available and all Gemini keys failed
        raise RuntimeError(
            f"All {total_gemini} Gemini API keys failed or hit limits. Last error: {last_exception}"
        ) from last_exception
