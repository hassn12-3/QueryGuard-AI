"""
test_llm.py – Diagnostic test for multi-key distribution & Groq fallback.
Run with: backend\\.venv\\Scripts\\python backend\\test_llm.py
"""

import sys
import os

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(__file__))

from app.config import settings

def test():
    print("=" * 60)
    print("Testing Resilient Multi-Key LLM Configuration")
    print("=" * 60)
    print(f"Provider        : {settings.LLM_PROVIDER}")
    print(f"Gemini Keys     : {len(settings.GEMINI_API_KEYS.split(','))} configured")
    print(f"Gemini Model    : {settings.GEMINI_MODEL}")
    print(f"Groq Key        : {'Configured (' + settings.GROQ_MODEL + ')' if settings.GROQ_API_KEY else 'None'}")
    print("-" * 60)

    llm = settings.get_llm(temperature=0.0)
    print("Sending test prompt: 'Reply with EXACTLY: Multi-Key LLM is operational!'...")
    try:
        from langchain_core.messages import HumanMessage
        response = llm.invoke([HumanMessage(content="Reply with EXACTLY: Multi-Key LLM is operational!")])
        print("\n[SUCCESS] Response received:")
        print(f"-> {response.content.strip()}")
    except Exception as e:
        print(f"\n[ERROR] Test failed with: {e}")

if __name__ == "__main__":
    test()
