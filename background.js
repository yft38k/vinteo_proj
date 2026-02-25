const SERVER_URL = 'http://localhost:3000';

// Ajoute le token de session aux requêtes vers /api/images et /api/text
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    const token = localStorage.getItem('vinteo_session_token');
    if (token) {
      const headers = details.requestHeaders.filter(h => h.name.toLowerCase() !== 'authorization');
      headers.push({ name: 'Authorization', value: `Bearer ${token}` });
      return { requestHeaders: headers };
    }
    return {};
  },
  {
    urls: [
      `${SERVER_URL}/api/images*`,
      `${SERVER_URL}/api/text*`
    ]
  },
  ['blocking', 'requestHeaders']
);
