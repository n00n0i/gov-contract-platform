"""
LLM Service - Interface to various language models
"""
import httpx
from typing import Dict, Any, Optional, AsyncGenerator
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class LLMService:
    """Service for interacting with LLMs"""
    
    async def generate(
        self,
        model: str,
        prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stream: bool = False,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate text from LLM
        
        Args:
            model: Model identifier (gpt-4, claude-3, llama3.1, etc.)
            prompt: The prompt to send
            temperature: Creativity (0.0-1.0)
            max_tokens: Max output length
            stream: Whether to stream response
            api_key: Optional API key
            base_url: Optional custom endpoint
        """
        # Route to appropriate provider
        if model.startswith("gpt-") or model == "openai":
            return await self._call_openai(model, prompt, temperature, max_tokens, api_key)
        elif model.startswith("claude"):
            return await self._call_anthropic(model, prompt, temperature, max_tokens, api_key)
        elif model in ["local", "ollama", "llama3.1", "mistral", "nomic-embed-text"]:
            return await self._call_ollama(model, prompt, temperature, max_tokens, base_url)
        elif model == "typhoon":
            return await self._call_typhoon(model, prompt, temperature, max_tokens, api_key)
        else:
            # Default to Ollama for local models
            return await self._call_ollama(model, prompt, temperature, max_tokens, base_url)
    
    async def _call_openai(
        self,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int,
        api_key: Optional[str]
    ) -> Dict[str, Any]:
        """Call OpenAI API"""
        headers = {
            "Authorization": f"Bearer {api_key or settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=120.0
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "text": result["choices"][0]["message"]["content"],
                "token_usage": {
                    "input": result["usage"]["prompt_tokens"],
                    "output": result["usage"]["completion_tokens"]
                },
                "model": result.get("model", model)
            }
    
    async def _call_anthropic(
        self,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int,
        api_key: Optional[str]
    ) -> Dict[str, Any]:
        """Call Anthropic Claude API"""
        headers = {
            "x-api-key": api_key or settings.ANTHROPIC_API_KEY,
            "Content-Type": "application/json"
        }
        
        data = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=data,
                timeout=120.0
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "text": result["content"][0]["text"],
                "token_usage": {
                    "input": result["usage"]["input_tokens"],
                    "output": result["usage"]["output_tokens"]
                },
                "model": result.get("model", model)
            }
    
    async def _call_ollama(
        self,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int,
        base_url: Optional[str]
    ) -> Dict[str, Any]:
        """Call Ollama local API"""
        url = f"{base_url or settings.OLLAMA_URL or 'http://localhost:11434'}/api/generate"
        
        data = {
            "model": model if model not in ["local"] else "llama3.1",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=data,
                timeout=300.0
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "text": result["response"],
                "token_usage": {
                    "input": result.get("prompt_eval_count", 0),
                    "output": result.get("eval_count", 0)
                },
                "model": model,
                "eval_duration": result.get("eval_duration")
            }
    
    async def _call_typhoon(
        self,
        model: str,
        prompt: str,
        temperature: float,
        max_tokens: int,
        api_key: Optional[str]
    ) -> Dict[str, Any]:
        """Call Typhoon (SCB 10X) API"""
        headers = {
            "Authorization": f"Bearer {api_key or settings.TYPHOON_API_KEY}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "typhoon-v1.5x-70b-instruct",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 0.9
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.opentyphoon.ai/v1/chat/completions",
                headers=headers,
                json=data,
                timeout=120.0
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "text": result["choices"][0]["message"]["content"],
                "token_usage": {
                    "input": result["usage"]["prompt_tokens"],
                    "output": result["usage"]["completion_tokens"]
                },
                "model": result.get("model", "typhoon")
            }
    
    async def list_models(self, provider: str = "ollama") -> list:
        """List available models from provider"""
        if provider == "ollama":
            url = f"{settings.OLLAMA_URL or 'http://localhost:11434'}/api/tags"
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, timeout=10.0)
                    response.raise_for_status()
                    data = response.json()
                    return [m["name"] for m in data.get("models", [])]
            except Exception as e:
                logger.error(f"Failed to list Ollama models: {e}")
                return []
        
        return []
