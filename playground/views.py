from django.shortcuts import render
from django.shortcuts import redirect
from django.views import View
from django.http import JsonResponse


import requests
import json
import os
from dotenv import load_dotenv

from rest_framework.decorators import api_view, throttle_classes
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response

# Load environment variables from the .env file
load_dotenv()

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