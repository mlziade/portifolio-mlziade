from django.urls import path
from .views import (
    TryoutConwaysView,
    stream_game_of_life,
    TryoutZllmView,
    generate_text_streaming_api,
    generate_text_api,
    TryoutZllmChatView,
    chat_with_zllm_api,
)

app_name = 'playground'

urlpatterns = [
    path('conways/', TryoutConwaysView.as_view(), name='tryout_conways'),
    path("conways/stream/", stream_game_of_life, name="stream"),
    path('zllm/', TryoutZllmView.as_view(), name='tryout_zllm'),
    # path('zllm/generate_text/', generate_text_api, name='generate_text'),
    path('zllm/generate_text_streaming/', generate_text_streaming_api, name='generate_text_streaming'),
    path('zllm/chat/', TryoutZllmChatView.as_view(), name='tryout_zllm_chat'),
    path('zllm/chat/chat_with_zllm/', chat_with_zllm_api, name='chat_with_zllm'),
]
