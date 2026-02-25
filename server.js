const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1474894755656896593";
const IMAGE_BOT_ID = process.env.IMAGE_BOT_ID || "1433976859741126678";
const TEXT_BOT_ID = process.env.TEXT_BOT_ID || "1458637793076187186";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_API_URL = "https://discord.com/api/v10";

if (!DISCORD_TOKEN) {
  console.error("❌ ERREUR: DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Route: Récupère le dernier message du bot IMAGE et sa dernière image
app.get('/api/images', async (req, res) => {
  try {
    console.log('🔍 Recherche du dernier message du bot IMAGE...');
    console.log(`   Channel ID: ${DISCORD_CHANNEL_ID}`);
    console.log(`   Image Bot ID: ${IMAGE_BOT_ID}`);
    
    let allMessages = [];
    let lastMessageId = null;
    const limit = 100;

    const headers = {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    for (let iteration = 0; iteration < 10; iteration++) {
      let url = `${DISCORD_API_URL}/channels/${DISCORD_CHANNEL_ID}/messages?limit=${limit}`;
      
      if (lastMessageId) {
        url += `&before=${lastMessageId}`;
      }
      
      console.log(`\n   📥 Batch ${iteration + 1}...`);
      
      try {
        const response = await axios.get(url, {
          headers: headers,
          timeout: 5000
        });

        const messages = response.data;
        
        if (!messages || messages.length === 0) {
          console.log(`   ✓ Fin atteinte`);
          break;
        }

        const botMessages = messages.filter(msg => msg.author.id === IMAGE_BOT_ID);
        console.log(`   📨 ${botMessages.length}/${messages.length} messages du bot IMAGE`);
        
        allMessages = allMessages.concat(botMessages);

        lastMessageId = messages[messages.length - 1].id;
        
        if (allMessages.length >= 1000) {
          console.log(`   ⚠️ Limite de 1000 messages atteinte`);
          break;
        }

      } catch (error) {
        console.error(`   ❌ Erreur batch:`, error.message);
        if (error.response?.status === 401) {
          throw new Error("❌ Token Discord invalide");
        }
        throw error;
      }
    }

    console.log(`\n   📊 Total: ${allMessages.length} messages du bot IMAGE`);

    if (allMessages.length === 0) {
      console.log('   ❌ Aucun message du bot IMAGE trouvé');
      return res.json({ 
        success: false, 
        message: "Aucun message du bot IMAGE trouvé" 
      });
    }

    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const latestMessage = allMessages[0];

    console.log(`\n   📌 Dernier message: ${latestMessage.id}`);
    console.log(`   ⏰ Date: ${latestMessage.timestamp}`);

    const imageUrls = extractImageUrls(latestMessage.content);
    console.log(`   🔗 URLs trouvées dans le contenu: ${imageUrls.length}`);
    
    if (latestMessage.embeds && latestMessage.embeds.length > 0) {
      console.log(`   📦 Embeds: ${latestMessage.embeds.length}`);
      latestMessage.embeds.forEach(embed => {
        if (embed.image && embed.image.url) {
          imageUrls.push(embed.image.url);
        }
        if (embed.thumbnail && embed.thumbnail.url) {
          imageUrls.push(embed.thumbnail.url);
        }
      });
    }

    if (latestMessage.attachments && latestMessage.attachments.length > 0) {
      console.log(`   📎 Attachments: ${latestMessage.attachments.length}`);
      latestMessage.attachments.forEach(att => {
        imageUrls.push(att.url);
      });
    }

    console.log(`   🎯 Total URLs: ${imageUrls.length}`);

    if (imageUrls.length === 0) {
      console.log('   ❌ Aucune image trouvée');
      return res.json({ 
        success: false, 
        message: "Aucune image trouvée" 
      });
    }

    const lastImageUrl = imageUrls[imageUrls.length - 1];
    console.log(`   📸 Dernière image sélectionnée`);

    console.log('\n   ⬇️ Téléchargement de l\'image...');
    const images = await downloadImages([lastImageUrl]);
    
    if (images.length === 0) {
      console.log('   ❌ Erreur téléchargement');
      throw new Error("Erreur téléchargement");
    }

    console.log(`   ✅ Image téléchargée (${images[0].filename})`);

    console.log('\n   ✅ SUCCÈS!\n');

    res.json({ 
      success: true, 
      messageId: latestMessage.id,
      count: 1,
      images: images
    });

  } catch (error) {
    console.error('\n   ❌ ERREUR COMPLÈTE:', error.message);
    console.error(error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route: Récupère le dernier message TEXTE du bot
app.get('/api/text', async (req, res) => {
  try {
    console.log('🔍 Recherche du dernier message du bot TEXTE...');
    console.log(`   Channel ID: ${DISCORD_CHANNEL_ID}`);
    console.log(`   Text Bot ID: ${TEXT_BOT_ID}`);
    
    let allMessages = [];
    let lastMessageId = null;
    const limit = 100;

    const headers = {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    for (let iteration = 0; iteration < 10; iteration++) {
      let url = `${DISCORD_API_URL}/channels/${DISCORD_CHANNEL_ID}/messages?limit=${limit}`;
      
      if (lastMessageId) {
        url += `&before=${lastMessageId}`;
      }
      
      console.log(`\n   📥 Batch ${iteration + 1}...`);
      
      try {
        const response = await axios.get(url, {
          headers: headers,
          timeout: 5000
        });

        const messages = response.data;
        
        if (!messages || messages.length === 0) {
          console.log(`   ✓ Fin atteinte`);
          break;
        }

        const botMessages = messages.filter(msg => msg.author.id === TEXT_BOT_ID);
        console.log(`   📨 ${botMessages.length}/${messages.length} messages du bot TEXTE`);
        
        allMessages = allMessages.concat(botMessages);

        lastMessageId = messages[messages.length - 1].id;
        
        if (allMessages.length >= 1000) {
          console.log(`   ⚠️ Limite de 1000 messages atteinte`);
          break;
        }

      } catch (error) {
        console.error(`   ❌ Erreur batch:`, error.message);
        if (error.response?.status === 401) {
          throw new Error("❌ Token Discord invalide");
        }
        throw error;
      }
    }

    console.log(`\n   📊 Total: ${allMessages.length} messages du bot TEXTE`);

    if (allMessages.length === 0) {
      console.log('   ❌ Aucun message du bot TEXTE trouvé');
      return res.json({ 
        success: false, 
        message: "Aucun message du bot TEXTE trouvé" 
      });
    }

    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const latestMessage = allMessages[0];

    console.log(`\n   📌 Dernier message: ${latestMessage.id}`);
    console.log(`   ⏰ Date: ${latestMessage.timestamp}`);

    if (!latestMessage.content || latestMessage.content.trim().length === 0) {
      console.log('   ❌ Message vide');
      return res.json({ 
        success: false, 
        message: "Message TEXTE vide" 
      });
    }

    const lines = latestMessage.content.split('\n');
    const title = lines[0].trim();
    const description = lines.slice(1).join('\n').trim();

    console.log(`\n   📝 Titre: ${title.substring(0, 60)}...`);
    console.log(`   📝 Description: ${description.substring(0, 60)}...`);
    console.log('\n   ✅ SUCCÈS!\n');

    res.json({ 
      success: true, 
      messageId: latestMessage.id,
      title: title,
      description: description
    });

  } catch (error) {
    console.error('\n   ❌ ERREUR COMPLÈTE:', error.message);
    console.error(error.stack);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route: Test
app.get('/api/test', async (req, res) => {
  try {
    console.log('🧪 Test de connexion Discord...');
    
    const response = await axios.get(
      `${DISCORD_API_URL}/channels/${DISCORD_CHANNEL_ID}`,
      {
        headers: {
          'Authorization': `Bot ${DISCORD_TOKEN}`
        }
      }
    );

    console.log(`✅ Connexion OK - Canal: ${response.data.name}\n`);

    res.json({ 
      success: true,
      channel: response.data.name
    });
  } catch (error) {
    console.error(`❌ Erreur test: ${error.message}\n`);
    res.status(401).json({ 
      success: false,
      error: "Token invalide ou canal non trouvé"
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

function extractImageUrls(text) {
  if (!text) return [];
  
  const urlRegex = /(https?:\/\/[^\s)]+)/gi;
  const matches = text.match(urlRegex) || [];
  
  return matches.filter(url => {
    const lower = url.toLowerCase();
    return lower.includes('.jpg') || 
           lower.includes('.jpeg') || 
           lower.includes('.png') || 
           lower.includes('.gif') || 
           lower.includes('.webp') ||
           lower.includes('discord') || 
           lower.includes('replicate') ||
           lower.includes('format=webp');
  });
}

async function downloadImages(urls) {
  const images = [];
  
  for (const url of urls) {
    try {
      console.log(`      ⬇️ Téléchargement: ${url.substring(0, 60)}...`);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 10,
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      const buffer = Buffer.from(response.data, 'binary');
      const contentType = response.headers['content-type'] || 'image/jpeg';
      let mimeType = contentType.split(';')[0].trim();
      
      if (contentType.includes('webp')) {
        mimeType = 'image/webp';
      } else if (contentType.includes('png')) {
        mimeType = 'image/png';
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        mimeType = 'image/jpeg';
      } else if (contentType.includes('gif')) {
        mimeType = 'image/gif';
      }
      
      const ext = getMimeExtension(mimeType);
      const filename = `discord_image_${Date.now()}.${ext}`;
      const base64 = buffer.toString('base64');
      
      images.push({
        filename: filename,
        base64: base64,
        type: mimeType
      });
      
      console.log(`      ✅ Téléchargé (${(buffer.length / 1024).toFixed(2)}KB)`);
      
    } catch (error) {
      console.warn(`      ⚠️ Erreur: ${error.message}`);
    }
  }
  
  return images;
}

function getMimeExtension(mimeType) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp'
  };
  
  return mimeMap[mimeType] || 'jpg';
}

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Serveur Vinted Import lancé`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/api/test`);
  console.log(`${'='.repeat(60)}\n`);
});


// ===== AUTHENTIFICATION =====

// Stockage temporaire des codes (en mémoire)
const verificationCodes = {};
const sessions = {};

// Route: Envoyer code de vérification
app.post('/send-verification-code', async (req, res) => {
  try {
    const { discordId } = req.body;
    
    if (!discordId) {
      return res.status(400).json({ success: false, error: 'Discord ID manquant' });
    }

    console.log(`📧 Envoi de code pour Discord ID: ${discordId}`);
    
    // Génère un code aléatoire 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Stocke le code (valide 10 minutes)
    verificationCodes[discordId] = {
      code: code,
      expiresAt: Date.now() + 10 * 60 * 1000
    };

    console.log(`✅ Code généré: ${code}`);

    res.json({ 
      success: true, 
      message: 'Code envoyé (pour test: ' + code + ')',
      code: code // Pour test en développement
    });

  } catch (error) {
    console.error('❌ Erreur send-verification-code:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route: Vérifier le code
app.post('/verify-code', async (req, res) => {
  try {
    const { discordId, code } = req.body;
    
    if (!discordId || !code) {
      return res.status(400).json({ success: false, error: 'Discord ID ou code manquant' });
    }

    console.log(`🔐 Vérification du code pour: ${discordId}`);
    
    const stored = verificationCodes[discordId];
    
    if (!stored) {
      return res.json({ success: false, error: 'Pas de code trouvé. Renvoie un code d\'abord.' });
    }

    if (Date.now() > stored.expiresAt) {
      delete verificationCodes[discordId];
      return res.json({ success: false, error: 'Code expiré' });
    }

    if (stored.code !== code) {
      return res.json({ success: false, error: 'Code incorrect' });
    }

    // Code correct! Génère une session
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions[token] = {
      discordId: discordId,
      username: `User${discordId.slice(-4)}`,
      createdAt: Date.now()
    };

    delete verificationCodes[discordId];

    console.log(`✅ Code vérifié! Token: ${token}`);

    res.json({ 
      success: true, 
      message: 'Connecté!',
      token: token,
      username: sessions[token].username
    });

  } catch (error) {
    console.error('❌ Erreur verify-code:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route: Vérifier la session
app.post('/check-session', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.json({ authenticated: false, error: 'Token manquant' });
    }

    console.log(`🔍 Vérification de session: ${token}`);
    
    const session = sessions[token];
    
    if (!session) {
      return res.json({ authenticated: false, error: 'Token invalide' });
    }

    // Token valide pendant 24h
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
      delete sessions[token];
      return res.json({ authenticated: false, error: 'Token expiré' });
    }

    console.log(`✅ Session valide pour: ${session.username}`);

    res.json({ 
      authenticated: true, 
      username: session.username,
      discordId: session.discordId
    });

  } catch (error) {
    console.error('❌ Erreur check-session:', error.message);
    res.status(500).json({ authenticated: false, error: error.message });
  }
});

// Route: Logout
app.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (token && sessions[token]) {
      delete sessions[token];
      console.log(`👋 Logout: ${token}`);
    }

    res.json({ success: true, message: 'Logout réussi' });

  } catch (error) {
    console.error('❌ Erreur logout:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== FIN AUTHENTIFICATION =====
