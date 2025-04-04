from django.urls import path
from .views import (
    TryoutZllmView,
    generate_text
)

app_name = 'playground'

urlpatterns = [
    path('zllm/', TryoutZllmView.as_view(), name='tryout_zllm'),
    path('zllm/generate_text/', generate_text, name='generate_text'),
]
