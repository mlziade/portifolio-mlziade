"""
ZLLM engine implementation.

This module contains the core logic for ZLLM API integration,
including authentication, request handling, and response processing.
"""

import requests
import json
import os
from django.http import JsonResponse, StreamingHttpResponse


def get_zllm_token():
    """
    Authenticates with ZLLM and returns the access token.
    
    Returns:
        str: Authentication token if successful
        
    Raises:
        ValueError: If required environment variables are missing
        requests.exceptions.RequestException: If authentication request fails
    """
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL", None)
    ZLLM_API_KEY = os.getenv("ZLLM_API_KEY", None)

    if not ZLLM_BASE_URL:
        raise ValueError("ZLLM_BASE_URL environment variable is not set")
    
    if not ZLLM_API_KEY:
        raise ValueError("ZLLM_API_KEY environment variable is not set")

    headers = {'Content-Type': 'application/json'}
    data = {'api_key': ZLLM_API_KEY}
    
    try:
        response = requests.post(
            url=f"{ZLLM_BASE_URL}/auth",
            headers=headers, 
            data=json.dumps(data),
            timeout=(30, 300)  # (connect timeout, read timeout)
        )

        response.raise_for_status()
        return response.json()['token']
    except requests.exceptions.RequestException as e:
        print(f"Error during ZLLM authentication: {e}")
        return e


def make_zllm_request(url, headers, data):
    """
    Makes a request to the ZLLM API with retry logic.
    
    Args:
        url: API endpoint URL
        headers: Request headers
        data: Request payload
        
    Returns:
        requests.Response: API response
    """
    response = requests.post(
        url=url,
        headers=headers,
        data=json.dumps(data),
        timeout=(30, 300)  # (connect timeout, read timeout)
    )
    response.raise_for_status()
    return response


def generate_text_streaming(request):
    """
    HTTP controller for streaming text generation endpoint.
    
    Handles streaming text generation requests and returns Server-Sent Events.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    # Parse the JSON data from request body
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt')
    except json.JSONDecodeError:
        print("Error decoding JSON")
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    if not prompt:
        print("Prompt is missing")
        return JsonResponse({'error': 'Prompt is required'}, status=400)
    
    # Authenticate with ZLLM and get the token
    try:
        token = get_zllm_token()
    except ValueError as e:
        print(f"Configuration error: {e}")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)
    except requests.exceptions.RequestException as e:
        print(f"Authentication request failed: {e}")
        return JsonResponse({'error': 'Failed to authenticate with ZLLM service'}, status=500)
    
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL", None)
    ZLLM_MODEL_NAME = os.getenv("ZLLM_MODEL_NAME", None)

    if not ZLLM_BASE_URL:
        print("ZLLM_BASE_URL environment variable is not set")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)
    
    if not ZLLM_MODEL_NAME:
        print("ZLLM_MODEL_NAME environment variable is not set")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # Prepare the data for the request
    data = {
        'prompt': prompt,
        'model': ZLLM_MODEL_NAME,
    }

    def event_stream():
        try:
            # Use requests to make a streaming request with timeout
            with requests.post(
                url=f"{ZLLM_BASE_URL}/llm/generate/streaming",
                headers=headers,
                data=json.dumps(data),
                stream=True,
                timeout=(30, 300)  # (connect timeout, read timeout)
            ) as response:
                response.raise_for_status()
                first_message = True
                # Forward each chunk from the API to the client
                for line in response.iter_lines(decode_unicode=False):
                    if line:
                        # Ensure proper SSE formatting and flush immediately
                        decoded_line = line.decode('utf-8')
                        if not decoded_line.startswith('data:'):
                            decoded_line = f"data: {decoded_line}"
                        
                        # Check for memory error in the first message
                        if first_message:
                            try:
                                # Extract JSON content from SSE data
                                content = decoded_line[5:].strip() if decoded_line.startswith('data:') else decoded_line
                                parsed_data = json.loads(content)
                                if 'error' in parsed_data and parsed_data['error'] == 'model requires more system memory':
                                    yield f"data: {json.dumps({'error': 'The AI model requires more system memory to process your request. Please try again later or contact support.'})}\n\n"
                                    return
                            except json.JSONDecodeError:
                                # If it's not JSON, continue with normal processing
                                pass
                            first_message = False
                        
                        yield f"{decoded_line}\n\n"
        except requests.exceptions.Timeout:
            print("ZLLM API timeout during streaming request")
            yield f"data: {json.dumps({'error': 'The service is taking too long to respond. Please try again.'})}\n\n"
        except requests.exceptions.RequestException as e:
            print(f"Error during ZLLM streaming request: {e}")
            if hasattr(e, 'response') and e.response is not None:
                status_code = e.response.status_code
                if status_code == 502:
                    error_msg = 'The AI service is temporarily unavailable. Please try again in a moment.'
                elif status_code >= 500:
                    error_msg = 'The AI service is experiencing issues. Please try again later.'
                else:
                    error_msg = f'Request failed: {str(e)}'
            else:
                error_msg = 'Unable to connect to the AI service. Please check your connection and try again.'
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
    
    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    return response


def generate_text(request):
    """
    HTTP controller for single text generation endpoint.
    
    Handles non-streaming text generation requests.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    # Parse the JSON data from request body
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt')
    except json.JSONDecodeError:
        print("Error decoding JSON")  # Log JSON decoding error
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    if not prompt:
        print("Prompt is missing")  # Log missing prompt
        return JsonResponse({'error': 'Prompt is required'}, status=400)
    
    # Authenticate with ZLLM and get the token
    try:
        token = get_zllm_token()
    except ValueError as e:
        print(f"Configuration error: {e}")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)
    except requests.exceptions.RequestException as e:
        print(f"Authentication request failed: {e}")
        return JsonResponse({'error': 'Failed to authenticate with ZLLM service'}, status=500)
    
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL", None)
    ZLLM_MODEL_NAME = os.getenv("ZLLM_MODEL_NAME", None)

    if not ZLLM_BASE_URL:
        print("ZLLM_BASE_URL environment variable is not set")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)
    
    if not ZLLM_MODEL_NAME:
        print("ZLLM_MODEL_NAME environment variable is not set")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # Prepare the data for the request
    data = {
        'prompt': prompt,
        'model': ZLLM_MODEL_NAME,
    }

    try:
        response = make_zllm_request(
            url=f"{ZLLM_BASE_URL}/llm/generate",
            headers=headers,
            data=data
        )
        return JsonResponse(response.json())
    except requests.exceptions.Timeout:
        print("ZLLM API timeout")
        return JsonResponse({'error': 'The service is taking too long to respond. Please try again.'}, status=408)
    except requests.exceptions.RequestException as e:
        print(f"Error during ZLLM request: {e}")
        if hasattr(e, 'response') and e.response is not None:
            status_code = e.response.status_code
            try:
                # Check if it's a memory error in the response body
                response_data = e.response.json()
                if 'error' in response_data and response_data['error'] == 'model requires more system memory':
                    return JsonResponse({'error': 'The AI model requires more system memory to process your request. Please try again later or contact support.'}, status=503)
            except (json.JSONDecodeError, ValueError):
                # If we can't parse the response, continue with normal error handling
                pass
            
            if status_code == 502:
                return JsonResponse({'error': 'The AI service is temporarily unavailable. Please try again in a moment.'}, status=502)
            elif status_code >= 500:
                return JsonResponse({'error': 'The AI service is experiencing issues. Please try again later.'}, status=status_code)
            else:
                return JsonResponse({'error': f'Request failed: {str(e)}'}, status=status_code)
        else:
            return JsonResponse({'error': 'Unable to connect to the AI service. Please check your connection and try again.'}, status=503)


def chat_with_zllm(request):
    """
    HTTP controller for chat endpoint with system prompt integration.
    
    Handles chat requests with conversation history and system prompts.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    # Parse the JSON data from request body
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt')
        messages = data.get('messages', [])
    except json.JSONDecodeError:
        print("Error decoding JSON")
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    if not prompt:
        print("Prompt is missing")
        return JsonResponse({'error': 'Prompt is required'}, status=400)
    
    # Authenticate with ZLLM and get the token
    try:
        token = get_zllm_token()
    except ValueError as e:
        print(f"Configuration error: {e}")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)
    except requests.exceptions.RequestException as e:
        print(f"Authentication request failed: {e}")
        return JsonResponse({'error': 'Failed to authenticate with ZLLM service'}, status=500)
    
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL", None)
    ZLLM_MODEL_NAME = os.getenv("ZLLM_MODEL_NAME", None)

    if not ZLLM_BASE_URL:
        print("ZLLM_BASE_URL environment variable is not set")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)
    
    if not ZLLM_MODEL_NAME:
        print("ZLLM_MODEL_NAME environment variable is not set")
        return JsonResponse({'error': 'ZLLM configuration is incomplete'}, status=500)

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # Read the system prompt from file
    try:
        # Use os.path to construct the correct path relative to the playground directory
        prompt_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "zllm_chat_system_prompt.txt")
        with open(prompt_file_path, "r", encoding="utf-8") as file:
            system_prompt = file.read().strip()
    except FileNotFoundError:
        print(f"System prompt file not found at {prompt_file_path}")
        return JsonResponse({'error': 'System prompt file not found'}, status=500)
    except Exception as e:
        print(f"Error reading system prompt file: {e}")
        return JsonResponse({'error': 'Error reading system prompt file'}, status=500)

    # Add the system message to the messages list
    system_message = {
        'role': 'system',
        'content': system_prompt
    }    
    messages.insert(0, system_message)

    # Add the user message to the messages list
    user_message = {
        'role': 'user',
        'content': prompt
    }
    messages.append(user_message)

    # Prepare the data for the request
    data = {
        'messages': messages,
        'model': ZLLM_MODEL_NAME,
    }

    try:
        response = make_zllm_request(
            url=f"{ZLLM_BASE_URL}/llm/chat",
            headers=headers,
            data=data
        )
        response_data = response.json()
        return JsonResponse({'response': response_data.get('response', '')})
    except requests.exceptions.Timeout:
        print("ZLLM API timeout during chat request")
        return JsonResponse({'error': 'The service is taking too long to respond. Please try again.'}, status=408)
    except requests.exceptions.RequestException as e:
        print(f"Error during ZLLM request: {e}")
        if hasattr(e, 'response') and e.response is not None:
            status_code = e.response.status_code
            try:
                # Check if it's a memory error in the response body
                response_data = e.response.json()
                if 'error' in response_data and response_data['error'] == 'model requires more system memory':
                    return JsonResponse({'error': 'The AI model requires more system memory to process your request. Please try again later or contact support.'}, status=503)
            except (json.JSONDecodeError, ValueError):
                # If we can't parse the response, continue with normal error handling
                pass
            
            if status_code == 502:
                return JsonResponse({'error': 'The AI service is temporarily unavailable. Please try again in a moment.'}, status=502)
            elif status_code >= 500:
                return JsonResponse({'error': 'The AI service is experiencing issues. Please try again later.'}, status=status_code)
            else:
                return JsonResponse({'error': f'Request failed: {str(e)}'}, status=status_code)
        else:
            return JsonResponse({'error': 'Unable to connect to the AI service. Please check your connection and try again.'}, status=503)
