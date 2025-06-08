
// Hamburger menu functionality
document.addEventListener('DOMContentLoaded', function() {
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  const sideNav = document.getElementById('sideNav');
  
  if (hamburgerMenu && sideNav) {
    // Toggle hamburger menu on click
    hamburgerMenu.addEventListener('click', function() {
      this.classList.toggle('change');
      sideNav.classList.toggle('open');
    });
    
    // Add keyboard navigation support for hamburger menu
    hamburgerMenu.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  }
});

// Cookie utility function for CSRF token
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Language switching function
function switchLanguage(language) {
  // Send AJAX request to switch language
  fetch('/switch-language/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': getCookie('csrftoken'),
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: 'language=' + encodeURIComponent(language)
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Reload the page to see the changes
      window.location.reload();
    } else {
      console.error('Language switch failed:', data.error);
    }
  })
  .catch(error => {
    console.error('Error switching language:', error);
    // Fallback: redirect with query parameter for backward compatibility
    window.location.href = window.location.pathname + '?lang=' + language;
  });
}

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/static/sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful');
      })
      .catch(function(error) {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// Make switchLanguage function globally available
window.switchLanguage = switchLanguage;