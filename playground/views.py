from django.shortcuts import render
from django.shortcuts import redirect
from django.views import View
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

import requests
import json
import os
from dotenv import load_dotenv

from rest_framework.decorators import api_view, throttle_classes
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response

# Load environment variables from the .env file
load_dotenv()

class TryoutConwaysView(View):
    def get(self, request):
        return render(request, f'conways.html')

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

    if cell_state == False:     
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

# This implementation of a streaming game of life generations endpoint is based on my own implementation of the game of life in python.
# https://github.com/mlziade/GameOfLifeConway/
@csrf_exempt
def stream_game_of_life(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST method is allowed'}, status=405)
                            
    def event_stream(initial_grid: list[tuple[int, int]]):
        # The grid is a set of cells, with the key being a tuple of the x and y position of the cell
        # The middle of the grid is at (0, 0)
        grid: set[tuple[int, int]] = set()

        # Add the initial grid to the grid set
        for cell in initial_grid:
            grid.add((cell[0], cell[1]))

        # Start the game loop (limit to a maximum of generations)
        # This is to avoid infinite loops
        # The frontend can restart the game at any time from the last state
        for _ in range(50):

            # If the grid is empty, break the loop
            if len(grid) == 0:
                yield f"data: {json.dumps([])}\n\n"
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

            # Stream the grid to the client
            yield f"data: {json.dumps(list(grid))}\n\n"

    # Parse the JSON data from request body
    data = json.loads(request.body)
    
    # Get the initial grid (array of tuples) from the request
    initial_alive_cells = data.get('alive_cells')

    if not initial_alive_cells:
        return JsonResponse({'error': 'Initial grid is required'}, status=400)

    response = StreamingHttpResponse(event_stream(initial_alive_cells), content_type='text/event-stream')
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

# Authenticates with ZLLM and returns the token.
def get_zllm_token():
    ZLLM_BASE_URL = os.getenv("ZLLM_BASE_URL")
    ZLLM_API_KEY = os.getenv("ZLLM_API_KEY")

    headers = {'Content-Type': 'application/json'}
    data = {'api_key': ZLLM_API_KEY}
    try:
        response = requests.post(
            url=f"{ZLLM_BASE_URL}/auth",
            headers=headers, 
            data=json.dumps(data)
        )

        response.raise_for_status()
        return response.json()['token']
    except requests.exceptions.RequestException as e:
        print(f"Error authenticating with ZLLM: {e}")
        return None

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
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    
    if not prompt:
        return JsonResponse({'error': 'Prompt is required'}, status=400)
    
    # Authenticate with ZLLM and get the token
    token = get_zllm_token()
    if not token:
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
        response = requests.post(
            url=f"{ZLLM_BASE_URL}/generate",
            headers=headers,
            data=json.dumps(data)
        )
    
        response.raise_for_status()
        return JsonResponse(response.json())
    except requests.exceptions.RequestException as e:
        return JsonResponse({'error': str(e)}, status=500)