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

# Load environment variables from the .env file
load_dotenv()

class TryoutConwaysView(View):
    def get(self, request):
        return render(request, 'conways.html')

def check_cell(x_pos: int, y_pos: int, cell_state: bool, grid: set[tuple[int, int]]) -> bool:    
    # Count neighbors
    total = 0
    for i in range(-1, 2):
        for j in range(-1, 2):
            if i == 0 and j == 0:
                continue  # Skip the cell itself
            neighbor_pos = (x_pos + i, y_pos + j)
            if neighbor_pos in grid:
                total += 1

    if not cell_state:
        # Dead cell with exactly 3 neighbors becomes alive
        if total == 3:
            return True
        # Otherwise remains dead
        return False
    
    else:  # Cell is alive
        # Live cell with 2 or 3 neighbors survives
        if total == 2 or total == 3:
            return True
        # Otherwise dies
        return False

# This implementation of a chunked game of life generations endpoint is based on my own implementation of the game of life in python.
# https://github.com/mlziade/GameOfLifeConway/
@csrf_exempt
def stream_game_of_life(request):
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

    # The grid is a set of cells, with the key being a tuple of the x and y position of the cell
    # The middle of the grid is at (0, 0)
    grid: set[tuple[int, int]] = set()

    # Add the initial grid to the grid set
    for cell in initial_alive_cells:
        grid.add((cell[0], cell[1]))

    # Generate all generations and collect them
    generations = []
    
    # Start the game loop (limit to a maximum of 1000 generations)
    # This is to avoid infinite loops
    for generation in range(1000):
        # If the grid is empty, break the loop
        if len(grid) == 0:
            generations.append([])
            break

        # Create a set to store the cells that have already been checked
        # So we don't check the same cell multiple times
        checked_cells = set()

        # Create a auxiliary grid
        aux_grid = set()

        # Iterate over the alive cells and its 8 neighbors
        for cell in grid:
            for i in range(-1, 2):
                for j in range(-1, 2):
                    # Current cell position being checked
                    current_cell_pos = (cell[0] + i, cell[1] + j)

                    # Check if the current cell position is already checked
                    # If it is, skip it
                    if current_cell_pos in checked_cells:
                        continue
                    else:
                        # Check the current cell
                        new_state = check_cell(
                            x_pos = current_cell_pos[0],
                            y_pos = current_cell_pos[1],
                            cell_state = current_cell_pos in grid, # False if the cell is not in the grid
                            grid = grid,
                        )

                        # If it is alive, add the current cell to the auxiliary grid,
                        if new_state:
                            aux_grid.add(current_cell_pos)

                        # Add the current cell to the checked cells set
                        checked_cells.add(current_cell_pos)

        # Update the grid with the new state
        grid = aux_grid

        # Add the current generation to our list
        generations.append(list(grid))

        # Check for oscillators or still lifes by comparing with previous generations
        if generation > 10:  # Only check after a few generations
            # Check if current state matches any of the last 10 states (for oscillators)
            current_state = set(grid)
            for i in range(1, min(11, generation + 1)):
                if i < len(generations) and set(generations[generation - i]) == current_state:
                    # Found a cycle, stop generating
                    break
    
    # Split generations into chunks of 1000
    chunk_size = 1000
    response_data = {
        'total_generations': len(generations),
        'chunk_size': chunk_size,
        'generations': generations[:chunk_size]  # First chunk
    }
    
    return JsonResponse(response_data)

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
                for line in response.iter_lines():
                    if line:
                        # Forward the SSE data
                        yield f"{line.decode('utf-8')}\n\n"
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
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')

        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'
        return render(request, f'zllm_{lang}.html', {'current_lang': lang})

class TryoutZllmChatView(View):
    def get(self, request):
        # Access the correct template based on the language
        # For example: home_pt-br.html or home_en.html
        lang = request.GET.get('lang')

        # Defaults to pt-br if no language or a invalid language is provided
        if lang not in ['pt-br', 'en']:
            lang = 'pt-br'
        return render(request, f'zllm_chat_{lang}.html', {'current_lang': lang})

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