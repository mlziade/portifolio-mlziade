"""
ZLLM (Zero-Latency Language Model) integration package.

This package contains the core logic and utilities for integrating
with the ZLLM API service.
"""

from .service import (
    get_zllm_token,
    make_zllm_request,
    generate_text_streaming,
    generate_text,
    chat_with_zllm
)

__all__ = [
    'get_zllm_token', 
    'make_zllm_request',
    'generate_text_streaming',
    'generate_text',
    'chat_with_zllm'
]
