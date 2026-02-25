const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1474894755656896593";
const IMAGE_BOT_ID = process.env.IMAGE_BOT_ID || "1433976859741126678";
const TEXT_BOT_ID = process.env.TEXT_BOT_ID || "1458637793076187186";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_API_URL = "https://discord.com/api/v10";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1430279545298227271";
const CATEGORY_CLIENTS = "1458597097233191066";
const CATEGORY_ADMIN = "1458112370747506758";

if (!DISCORD_TOKEN) {
  console.error("❌ ERREUR: DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}

// Initialize Discord.js client
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

let discordReady = false;

discordClient.once('ready', () => {
  console.log(`✅ Discord client connecté: ${discordClient.user.tag}`);
  discordReady = true;
});

discordClient.login(DISCORD_TOKEN).catch(err => {
  console.error('❌ Erreur connexion Discord.js:', err.message);
});

app.use(cors());
app.use(express.json());

// ===== AUTHENTIFICATION =====
// Stockage temporaire des codes (en mémoire)
const verificationCodes = {};
const sessions = {};
// ===== FIN STOCKAGE =====

app.use((req, res, next) => {
  console.log(`\n[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Route: Récupère la dernière image du salon utilisateur
app.get('/api/images', async (req, res) => {
  try {
    // Vérification de l'authentification
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }
    const session = sessions[token];
    if (!session) {
      return res.status(401).json({ success: false, error: 'Session invalide' });
    }

    const { username } = session;
    console.log(`🔍 Recherche image pour salon-${username}...`);

    const channel = await getUserChannel(username);
    if (!channel) {
      return res.json({ success: false, message: `Salon salon-${username} non trouvé` });
    }

    console.log(`   📢 Salon trouvé: ${channel.name} (${channel.id})`);

    const messages = await channel.messages.fetch({ limit: 100 });

    const imageBotMessages = messages
      .filter(msg =>
        msg.author.id === IMAGE_BOT_ID &&
        (msg.attachments.size > 0 || msg.embeds.length > 0 || extractImageUrls(msg.content).length > 0)
      )
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    if (imageBotMessages.size === 0) {
      return res.json({ success: false, message: 'Aucune image trouvée' });
    }

    const latestMessage = imageBotMessages.first();
    console.log(`   📌 Dernier message image: ${latestMessage.id}`);

    const imageUrls = extractImageUrls(latestMessage.content);

    latestMessage.embeds.forEach(embed => {
      if (embed.image?.url) imageUrls.push(embed.image.url);
      if (embed.thumbnail?.url) imageUrls.push(embed.thumbnail.url);
    });

    latestMessage.attachments.forEach(att => {
      imageUrls.push(att.url);
    });

    if (imageUrls.length === 0) {
      return res.json({ success: false, message: 'Aucune image trouvée' });
    }

    const lastImageUrl = imageUrls[imageUrls.length - 1];
    const images = await downloadImages([lastImageUrl]);

    if (images.length === 0) {
      throw new Error('Erreur téléchargement');
    }

    console.log(`   ✅ Image téléchargée (${images[0].filename})`);

    res.json({
      success: true,
      messageId: latestMessage.id,
      count: 1,
      images: images
    });

  } catch (error) {
    console.error('\n   ❌ ERREUR /api/images:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route: Récupère le dernier texte du salon utilisateur
app.get('/api/text', async (req, res) => {
  try {
    // Vérification de l'authentification
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }
    const session = sessions[token];
    if (!session) {
      return res.status(401).json({ success: false, error: 'Session invalide' });
    }

    const { username } = session;
    console.log(`🔍 Recherche texte pour salon-${username}...`);

    const channel = await getUserChannel(username);
    if (!channel) {
      return res.json({ success: false, message: `Salon salon-${username} non trouvé` });
    }

    console.log(`   📢 Salon trouvé: ${channel.name} (${channel.id})`);

    const messages = await channel.messages.fetch({ limit: 100 });

    const textBotMessages = messages
      .filter(msg =>
        msg.author.id === TEXT_BOT_ID &&
        msg.content && msg.content.trim().length > 0
      )
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    if (textBotMessages.size === 0) {
      return res.json({ success: false, message: 'Aucun texte trouvé' });
    }

    const latestMessage = textBotMessages.first();
    console.log(`   📌 Dernier message texte: ${latestMessage.id}`);

    const lines = latestMessage.content.split('\n');
    const title = lines[0].trim();
    const description = lines.slice(1).join('\n').trim();

    console.log(`\n   📝 Titre: ${title.substring(0, 60)}...`);
    console.log('\n   ✅ SUCCÈS!\n');

    res.json({
      success: true,
      messageId: latestMessage.id,
      title: title,
      description: description
    });

  } catch (error) {
    console.error('\n   ❌ ERREUR /api/text:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route: Récupère le dernier texte du salon utilisateur (alias)
app.get('/api/textes', async (req, res) => {
  try {
    // Vérification de l'authentification
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }
    const session = sessions[token];
    if (!session) {
      return res.status(401).json({ success: false, error: 'Session invalide' });
    }

    const { username } = session;
    console.log(`🔍 Recherche texte pour salon-${username}...`);

    const channel = await getUserChannel(username);
    if (!channel) {
      return res.json({ success: false, message: `Salon salon-${username} non trouvé` });
    }

    console.log(`   📢 Salon trouvé: ${channel.name} (${channel.id})`);

    const messages = await channel.messages.fetch({ limit: 100 });

    const textBotMessages = messages
      .filter(msg =>
        msg.author.id === TEXT_BOT_ID &&
        msg.content && msg.content.trim().length > 0
      )
      .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    if (textBotMessages.size === 0) {
      return res.json({ success: false, message: 'Aucun texte trouvé' });
    }

    const latestMessage = textBotMessages.first();
    console.log(`   📌 Dernier message texte: ${latestMessage.id}`);

    const lines = latestMessage.content.split('\n');
    const title = lines[0].trim();
    const description = lines.slice(1).join('\n').trim();

    res.json({
      success: true,
      messageId: latestMessage.id,
      title: title,
      description: description
    });

  } catch (error) {
    console.error('\n   ❌ ERREUR /api/textes:', error.message);
    res.status(500).json({ success: false, error: error.message });
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

// Helper: Trouve le salon salon-{username} dans les catégories
async function getUserChannel(username) {
  const guild = await discordClient.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();
  const channelName = `salon-${username}`;
  return guild.channels.cache.find(ch =>
    ch.name === channelName &&
    (ch.parentId === CATEGORY_CLIENTS || ch.parentId === CATEGORY_ADMIN)
  ) || null;
}

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

// Route: Envoyer code de vérification
app.post('/send-verification-code', async (req, res) => {
  try {
    const { discordId } = req.body;
    
    if (!discordId) {
      return res.status(400).json({ success: false, error: 'Discord ID manquant' });
    }

    console.log(`📧 Envoi de code pour Discord ID: ${discordId}`);

    // Récupère les infos de l'utilisateur Discord
    const discordUser = await discordClient.users.fetch(discordId);
    const username = discordUser.username;

    // Génère un code aléatoire 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Stocke le code avec le pseudo (valide 10 minutes)
    verificationCodes[discordId] = {
      code: code,
      username: username,
      expiresAt: Date.now() + 10 * 60 * 1000
    };

    // Envoie le code par DM Discord via le bot
    await discordUser.send(`🔐 Ton code de vérification Vinteo Import: **${code}**\n\nCe code est valide pendant 10 minutes.`);

    console.log(`✅ Code envoyé par DM à ${username} (${discordId})`);

    res.json({ 
      success: true, 
      message: 'Code envoyé par DM Discord',
      username: username
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

    // Code correct! Vérifier le salon et le rôle
    const channel = await getUserChannel(stored.username);
    if (!channel) {
      return res.json({ success: false, error: `Salon salon-${stored.username} non trouvé` });
    }

    const REQUIRED_ROLE_ID = '1458129484036313118';
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    if (!member.roles.cache.has(REQUIRED_ROLE_ID)) {
      return res.json({ success: false, error: 'Rôle requis non trouvé' });
    }

    // Génère une session permanente (sans expiration)
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessions[token] = {
      discordId: discordId,
      username: stored.username,
      createdAt: Date.now()
    };

    delete verificationCodes[discordId];

    console.log(`✅ Code vérifié! Token: ${token}`);

    res.json({ 
      success: true, 
      message: 'Connecté!',
      token: token,
      username: sessions[token].username,
      discordId: discordId
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
