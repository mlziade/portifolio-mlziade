from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
import json

from rest_framework.decorators import api_view, throttle_classes
from rest_framework.throttling import AnonRateThrottle
from portifolio.language_utils import get_current_language, get_template_name, get_language_context
from .game_of_life.engine import play_game_of_life
from .zllm.service import generate_text_streaming, generate_text, chat_with_zllm

# Load environment variables from the .env file (handled in engine modules)

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

@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def generate_text_streaming_api(request):
    """
    REST API controller for streaming text generation.
    
    This is a thin controller that delegates to the ZLLM engine
    while handling API-specific concerns like rate limiting.
    """
    return generate_text_streaming(request)

@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def generate_text_api(request):
    """
    REST API controller for text generation.
    
    This is a thin controller that delegates to the ZLLM engine
    while handling API-specific concerns like rate limiting.
    """
    return generate_text(request)

@api_view(['POST'])
@throttle_classes([AnonRateThrottle])
def chat_with_zllm_api(request):
    """
    REST API controller for ZLLM chat.
    
    This is a thin controller that delegates to the ZLLM engine
    while handling API-specific concerns like rate limiting.
    """
    return chat_with_zllm(request)