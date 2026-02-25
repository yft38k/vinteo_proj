const SERVER_URL = 'http://localhost:3000';

const authScreen   = document.getElementById('auth-screen');
const loggedScreen = document.getElementById('logged-screen');
const authStatus   = document.getElementById('auth-status');
const logoutStatus = document.getElementById('logout-status');
const verifySection = document.getElementById('verify-section');
const userNameEl   = document.getElementById('user-name');

function showStatus(el, message, type) {
  el.textContent = message;
  el.className = `status ${type}`;
}

function showAuthScreen() {
  authScreen.style.display = 'block';
  loggedScreen.style.display = 'none';
}

function showLoggedScreen(username) {
  authScreen.style.display = 'none';
  loggedScreen.style.display = 'block';
  userNameEl.textContent = username;
}

// Vérifie si une session existe déjà
async function checkExistingSession() {
  const token = localStorage.getItem('vinteo_session_token');
  if (!token) {
    showAuthScreen();
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL}/check-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.authenticated) {
      showLoggedScreen(data.username);
    } else {
      localStorage.removeItem('vinteo_session_token');
      localStorage.removeItem('vinteo_username');
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }
}

// Envoi du code de vérification
document.getElementById('btn-send-code').addEventListener('click', async () => {
  const discordId = document.getElementById('discord-id').value.trim();
  if (!discordId) {
    showStatus(authStatus, 'Veuillez entrer votre Discord ID.', 'error');
    return;
  }

  const btn = document.getElementById('btn-send-code');
  btn.disabled = true;
  showStatus(authStatus, 'Envoi du code...', 'info');

  try {
    const res = await fetch(`${SERVER_URL}/send-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId })
    });
    const data = await res.json();

    if (data.success) {
      showStatus(authStatus, `✅ Code envoyé par DM à ${data.username} !`, 'success');
      verifySection.style.display = 'block';
    } else {
      showStatus(authStatus, `❌ ${data.error}`, 'error');
    }
  } catch (err) {
    showStatus(authStatus, `❌ Erreur: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});

// Vérification du code
document.getElementById('btn-verify').addEventListener('click', async () => {
  const discordId = document.getElementById('discord-id').value.trim();
  const code = document.getElementById('verify-code').value.trim();

  if (!discordId || !code) {
    showStatus(authStatus, 'Veuillez entrer votre Discord ID et le code reçu.', 'error');
    return;
  }

  const btn = document.getElementById('btn-verify');
  btn.disabled = true;
  showStatus(authStatus, 'Vérification...', 'info');

  try {
    const res = await fetch(`${SERVER_URL}/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, code })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('vinteo_session_token', data.token);
      localStorage.setItem('vinteo_username', data.username);
      showStatus(authStatus, `✅ Connecté en tant que ${data.username} !`, 'success');
      setTimeout(() => showLoggedScreen(data.username), 800);
    } else {
      showStatus(authStatus, `❌ ${data.error}`, 'error');
    }
  } catch (err) {
    showStatus(authStatus, `❌ Erreur: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});

// Déconnexion
document.getElementById('btn-logout').addEventListener('click', async () => {
  const token = localStorage.getItem('vinteo_session_token');

  try {
    await fetch(`${SERVER_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
  } catch {
    // Ignore errors on logout
  }

  localStorage.removeItem('vinteo_session_token');
  localStorage.removeItem('vinteo_username');
  document.getElementById('discord-id').value = '';
  document.getElementById('verify-code').value = '';
  verifySection.style.display = 'none';
  showStatus(authStatus, '', '');
  showAuthScreen();
});

// Initialisation
checkExistingSession();
