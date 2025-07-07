from django.shortcuts import render
from django.views import View
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

import requests
import json
import os
import time
from dotenv import load_dotenv

from rest_framework.decorators import api_view, throttle_classes
from rest_framework.throttling import AnonRateThrottle
from portifolio.language_utils import get_current_language, get_template_name, get_language_context
from .game_of_life.engine import play_game_of_life

# Load environment variables from the .env file
load_dotenv()

### Conway's Game of Life Views and Functions ###
class TryoutConwaysView(View):
    def get(self, request):
        return render(request, 'conways.html')

@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def stream_game_of_life(request):
    """
    API controller for Game of Life endpoint - handles HTTP request/response logic.
    
    Accepts POST requests with JSON data containing 'alive_cells' - an array of [x, y] coordinates
    representing the initial alive cells. Returns up to 1000 generations or until the pattern
    stabilizes/dies out.
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    # Parse the JSON data from request body
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data'}, status=400)
    
    # Get the initial grid (array of tuples) from the request
    initial_alive_cells = data.get('alive_cells')

    if not initial_alive_cells:
        return JsonResponse({'error': 'Initial grid is required'}, status=400)

    # Validate input format
    try:
        # Ensure each cell is a valid coordinate pair
        validated_cells = [(int(cell[0]), int(cell[1])) for cell in initial_alive_cells]
    except (ValueError, TypeError, IndexError):
        return JsonResponse({'error': 'Invalid cell coordinates format'}, status=400)

    # Run the game logic
    generations = play_game_of_life(validated_cells)
    
    # Split generations into chunks of 1000
    chunk_size = 1000
    response_data = {
        'total_generations': len(generations),
        'chunk_size': chunk_size,
        'generations': generations[:chunk_size]  # First chunk
    }
    
    return JsonResponse(response_data)
    
### ZLLM Related Views and Functions ###

# Retry decorator for API calls
def retry_api_call(max_retries=3, backoff_factor=1):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except requests.exceptions.RequestException as e:
                    if attempt == max_retries - 1:  # Last attempt
                        raise e
                    
                    # Check if it's a server error (5xx) that might be transient
                    if hasattr(e, 'response') and e.response is not None:
                        status_code = e.response.status_code
                        if status_code < 500:  # Don't retry client errors (4xx)
                            raise e
                    
                    wait_time = backoff_factor * (2 ** attempt)
                    print(f"ZLLM API attempt {attempt + 1} failed: {e}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
            
            return None
        return wrapper
    return decorator

# Authenticates with ZLLM and returns the token.
@retry_api_call(max_retries=2, backoff_factor=0.5)
def get_zllm_token():
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL")
    ZLLM_API_KEY = os.getenv("ZLLM_API_KEY")

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
        print(f"Error authenticating with ZLLM: {e}")
        return None

@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def generate_text_streaming(request):
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
    token = get_zllm_token()
    if not token:
        print("Failed to authenticate with ZLLM")
        return JsonResponse({'error': 'Failed to authenticate with ZLLM'}, status=500)
    
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL")
    ZLLM_MODEL_NAME = os.getenv("ZLLM_MODEL_NAME")

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
                # Forward each chunk from the API to the client
                for line in response.iter_lines(decode_unicode=False):
                    if line:
                        # Ensure proper SSE formatting and flush immediately
                        decoded_line = line.decode('utf-8')
                        if not decoded_line.startswith('data:'):
                            decoded_line = f"data: {decoded_line}"
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

class TryoutZllmView(View):
    def get(self, request):
        # Get language from middleware (session/cookie based)
        template_name = get_template_name('zllm', request)
        context = get_language_context(request)
        return render(request, template_name, context)

class TryoutZllmChatView(View):
    def get(self, request):
        # Get language from middleware (session/cookie based)
        template_name = get_template_name('zllm_chat', request)
        context = get_language_context(request)
        return render(request, template_name, context)

@retry_api_call(max_retries=3, backoff_factor=1)
def make_zllm_request(url, headers, data):
    response = requests.post(
        url=url,
        headers=headers,
        data=json.dumps(data),
        timeout=(30, 300)  # (connect timeout, read timeout)
    )
    response.raise_for_status()
    return response

@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def generate_text(request):
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
    token = get_zllm_token()
    if not token:
        print("Failed to authenticate with ZLLM")  # Log authentication failure
        return JsonResponse({'error': 'Failed to authenticate with ZLLM'}, status=500)
    
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL")
    ZLLM_MODEL_NAME = os.getenv("ZLLM_MODEL_NAME")

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
            if status_code == 502:
                return JsonResponse({'error': 'The AI service is temporarily unavailable. Please try again in a moment.'}, status=502)
            elif status_code >= 500:
                return JsonResponse({'error': 'The AI service is experiencing issues. Please try again later.'}, status=status_code)
            else:
                return JsonResponse({'error': f'Request failed: {str(e)}'}, status=status_code)
        else:
            return JsonResponse({'error': 'Unable to connect to the AI service. Please check your connection and try again.'}, status=503)
    
@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def chat_with_zllm(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
    
    # Parse the JSON data from request body
    try:
        data = json.loads(request.body)
        prompt = data.get('prompt')
        messages = data.get('messages', [])
    except json.JSONDecodeError:
        print("Error decoding JSON")
    
    if not prompt:
        print("Prompt is missing")
        return JsonResponse({'error': 'Prompt is required'}, status=400)
    
    # Authenticate with ZLLM and get the token
    token = get_zllm_token()
    if not token:
        print("Failed to authenticate with ZLLM")
        return JsonResponse({'error': 'Failed to authenticate with ZLLM'}, status=500)
    
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL")
    ZLLM_MODEL_NAME = os.getenv("ZLLM_MODEL_NAME")

    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }

    # Read the system prompt from file
    try:
        # Use os.path to construct the correct path relative to this file
        prompt_file_path = os.path.join(os.path.dirname(__file__), "zllm_chat_system_prompt.txt")
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
            if status_code == 502:
                return JsonResponse({'error': 'The AI service is temporarily unavailable. Please try again in a moment.'}, status=502)
            elif status_code >= 500:
                return JsonResponse({'error': 'The AI service is experiencing issues. Please try again later.'}, status=status_code)
            else:
                return JsonResponse({'error': f'Request failed: {str(e)}'}, status=status_code)
        else:
            return JsonResponse({'error': 'Unable to connect to the AI service. Please check your connection and try again.'}, status=503)