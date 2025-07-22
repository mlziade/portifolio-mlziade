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
                data=json.dumps(data, ensure_ascii=False).encode('utf-8'),
                stream=True,
                timeout=(30, 300)  # (connect timeout, read timeout)
            ) as response:
                response.raise_for_status()
                
                # Process each line from the ZLLM API with explicit UTF-8 decoding
                for raw_line in response.iter_lines(decode_unicode=False):
                    if raw_line:
                        try:
                            # Explicitly decode as UTF-8
                            line = raw_line.decode('utf-8', errors='strict').strip()
                            if not line:
                                continue
                                
                            # Parse the JSON response from ZLLM API
                            json_data = json.loads(line)
                            
                            # Handle done:false responses (streaming tokens)
                            if json_data.get('done') == False:
                                token_data = {
                                    'response': json_data.get('response', ''),
                                    'done': False,
                                    'model': json_data.get('model', ''),
                                    'created_at': json_data.get('created_at', '')
                                }
                                json_str = json.dumps(token_data, ensure_ascii=False)
                                yield f"data: {json_str}\n\n".encode('utf-8').decode('utf-8')
                            
                            # Handle done:true responses (completion with metadata)
                            elif json_data.get('done') == True:
                                completion_data = {
                                    'done': True,
                                    'done_reason': json_data.get('done_reason', 'stop'),
                                    'model': json_data.get('model', ''),
                                    'created_at': json_data.get('created_at', ''),
                                    'context': json_data.get('context', []),
                                    'total_duration': json_data.get('total_duration', 0),
                                    'load_duration': json_data.get('load_duration', 0),
                                    'prompt_eval_count': json_data.get('prompt_eval_count', 0),
                                    'prompt_eval_duration': json_data.get('prompt_eval_duration', 0),
                                    'eval_count': json_data.get('eval_count', 0),
                                    'eval_duration': json_data.get('eval_duration', 0)
                                }
                                json_str = json.dumps(completion_data, ensure_ascii=False)
                                yield f"data: {json_str}\n\n".encode('utf-8').decode('utf-8')
                            
                            else:
                                # Handle other response formats (fallback)
                                if line.startswith('data:'):
                                    yield f"{line}\n\n"
                                else:
                                    yield f"data: {line}\n\n"
                                    
                        except (json.JSONDecodeError, UnicodeDecodeError) as e:
                            print(f"Error processing streaming response: {e}")
                            
                            # Handle UTF-8 decode errors
                            if isinstance(e, UnicodeDecodeError):
                                try:
                                    # Try decoding with error handling
                                    line = raw_line.decode('utf-8', errors='replace')
                                    error_data = {
                                        'error': 'UTF-8 encoding error in API response',
                                        'debug_info': f'Invalid UTF-8 sequence: {str(e)}'
                                    }
                                    json_str = json.dumps(error_data, ensure_ascii=False)
                                    yield f"data: {json_str}\n\n".encode('utf-8').decode('utf-8')
                                    continue
                                except Exception:
                                    continue
                            
                            # Handle JSON decode errors
                            line_preview = line[:100] if len(line) > 100 else line
                            print(f"JSON decode error: {e}, line: {line_preview}")
                            
                            # Try to handle partial JSON or malformed responses
                            if line:
                                # Check if it might be a partial JSON response
                                if line.startswith('{') or line.startswith('"'):
                                    # Send as error to client for debugging
                                    error_data = {
                                        'error': f'Malformed JSON response from API: {line_preview}',
                                        'debug_info': 'The API returned invalid JSON format'
                                    }
                                    json_str = json.dumps(error_data, ensure_ascii=False)
                                    yield f"data: {json_str}\n\n".encode('utf-8').decode('utf-8')
                                else:
                                    # Treat as plain text if it doesn't look like JSON
                                    if line.startswith('data:'):
                                        yield f"{line}\n\n"
                                    else:
                                        yield f"data: {line}\n\n"
        except requests.exceptions.Timeout:
            print("ZLLM API timeout during streaming request")
            error_data = {'error': 'The service is taking too long to respond. Please try again.'}
            json_str = json.dumps(error_data, ensure_ascii=False)
            yield f"data: {json_str}\n\n".encode('utf-8').decode('utf-8')
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
            error_data = {'error': error_msg}
            json_str = json.dumps(error_data, ensure_ascii=False)
            yield f"data: {json_str}\n\n".encode('utf-8').decode('utf-8')
    
    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream; charset=utf-8')
    response['Cache-Control'] = 'no-cache'
    response['Content-Encoding'] = 'identity'
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
