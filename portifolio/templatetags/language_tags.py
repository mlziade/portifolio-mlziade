from django import template
from django.utils.safestring import mark_safe
from urllib.parse import urlencode

register = template.Library()


@register.simple_tag(takes_context=True)
def hreflang_url(context, language):
    """
    Generate the hreflang URL for the current page in the specified language.
    
    Args:
        context: Template context
        language: Target language ('en' or 'pt-br')
    
    Returns:
        Absolute URL for the current page in the specified language
    """
    request = context['request']
    current_url = request.path
    
    # Build the URL with language parameter
    params = {'lang': language}
    query_string = urlencode(params)
    hreflang_url = f"{request.scheme}://{request.get_host()}{current_url}?{query_string}"
    
    return hreflang_url


@register.simple_tag(takes_context=True)
def generate_hreflang_tags(context):
    """
    Generate complete hreflang tags for the current page.
    
    Returns:
        Safe HTML string with hreflang link tags
    """
    request = context['request']
    current_url = request.path
    base_url = f"{request.scheme}://{request.get_host()}{current_url}"
    
    # Generate URLs for each language
    en_url = f"{base_url}?lang=en"
    pt_br_url = f"{base_url}?lang=pt-br"
    
    # Use English as x-default
    x_default_url = en_url
    
    hreflang_tags = f"""<link rel="alternate" hreflang="en" href="{en_url}">
  <link rel="alternate" hreflang="pt-BR" href="{pt_br_url}">
  <link rel="alternate" hreflang="x-default" href="{x_default_url}">"""
    
    return mark_safe(hreflang_tags)