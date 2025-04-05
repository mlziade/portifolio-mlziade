from django.urls import path
from .views import (
    TryoutConwaysView,
    stream_game_of_life,
    TryoutZllmView,
    generate_text,
)

app_name = 'playground'

urlpatterns = [
    path('conways/', TryoutConwaysView.as_view(), name='tryout_conways'),
    path("conways/stream/", stream_game_of_life, name="stream"),
    path('zllm/', TryoutZllmView.as_view(), name='tryout_zllm'),
    path('zllm/generate_text/', generate_text, name='generate_text'),
]
