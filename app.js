// proxy.js
const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND = process.env.BACKEND_BASE_URL;
const CANVA_CLIENT_ID = process.env.CANVA_CLIENT_ID;
const CANVA_CLIENT_SECRET = process.env.CANVA_CLIENT_SECRET;
const CANVA_REDIRECT_URI = process.env.CANVA_REDIRECT_URI;

if (!BACKEND) throw new Error('BACKEND_BASE_URL is not set.');

// IMPORTANT: capture raw body (do NOT use express.json())
app.use(express.raw({ type: '*/*' }));

function forwardHeaders(req) {
  // clone incoming headers and drop hop-by-hop/unsafe ones
  const headers = { ...req.headers };

  // These should be set by axios based on the data we send
  delete headers['content-length'];
  delete headers['transfer-encoding'];
  // Avoid forwarding the proxy's host
  delete headers['host'];

  return headers;
}

// JWT verification function for Canva tokens
function verifyCanvaToken(token) {
  try {
    // Canva JWT tokens are signed with their secret
    // In production, you'd verify with Canva's public key
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      throw new Error('Invalid token format');
    }

    // Basic validation - in production you'd verify signature with Canva's public key
    const payload = decoded.payload;
    
    if (!payload.sub || !payload.team) {
      throw new Error('Missing required claims');
    }

    return {
      userId: payload.sub,
      teamId: payload.team?.id,
      teamName: payload.team?.name,
      iat: payload.iat,
      exp: payload.exp
    };
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

// Canva Authentication Callback Endpoint
app.get('/auth/callback', (req, res) => {
  const { canva_user_token, nonce, state } = req.query;

  if (!canva_user_token) {
    return res.status(400).json({ error: 'Missing canva_user_token' });
  }

  // Verify the JWT token
  const userInfo = verifyCanvaToken(canva_user_token);
  
  if (!userInfo) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  console.log('Canva user authenticated:', {
    userId: userInfo.userId,
    teamId: userInfo.teamId,
    teamName: userInfo.teamName,
    nonce,
    state
  });

  // In a real app, you would:
  // 1. Store the user session
  // 2. Link the Canva user to your app's user
  // 3. Redirect to your app's success page
  
  // For now, return success with user info
  res.json({
    success: true,
    message: 'Authentication successful',
    user: userInfo,
    nonce,
    state
  });
});

// OAuth 2.0 Authorization endpoint (for OAuth flow)
app.get('/auth/authorize', (req, res) => {
  const { code_challenge, code_challenge_method, state } = req.query;
  
  if (!CANVA_CLIENT_ID) {
    return res.status(500).json({ error: 'Canva app not configured' });
  }

  // Build Canva authorization URL
  const authUrl = new URL('https://www.canva.com/api/oauth/authorize');
  authUrl.searchParams.set('client_id', CANVA_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', CANVA_REDIRECT_URI);
  authUrl.searchParams.set('client_secret', CANVA_CLIENT_SECRET);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'design:read design:write');
  
  if (code_challenge) {
    authUrl.searchParams.set('code_challenge', code_challenge);
    authUrl.searchParams.set('code_challenge_method', code_challenge_method || 'S256');
  }
  
  if (state) {
    authUrl.searchParams.set('state', state);
  }

  res.redirect(authUrl.toString());
});

// Additional OAuth endpoint that Canva might be expecting
app.get('/api/oauth2/authorize', (req, res) => {
  console.log('OAuth2 authorize request received:', req.query);
  
  // Forward all query parameters to your backend
  const queryString = new URLSearchParams(req.query).toString();
  const backendUrl = `${BACKEND}/api/oauth2/authorize?${queryString}`;
  
  console.log('Forwarding to:', backendUrl);
  res.redirect(backendUrl);
});

// Handle proxy-request endpoint
app.post('/api/proxy-request', async (req, res) => {
  console.log('Proxy request received:', req.body);
  try {
    const response = await axios({
      method: 'post',
      url: `${BACKEND}/proxy-request`,
      data: req.body,
      headers: forwardHeaders(req),
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
    console.log('Proxy response:', response.data);
    res.status(response.status).set(response.headers).send(response.data);
  } catch (e) {
    const status = e.response?.status ?? 502;
    res.status(status).send(e.response?.data ?? 'Upstream error');
  }
});

app.get('/api/proxy-request', async (req, res) => {
  console.log('Proxy request GET received:', req.query);
  try {
    const queryString = new URLSearchParams(req.query).toString();
    const backendUrl = `${BACKEND}/proxy-request${queryString ? '?' + queryString : ''}`;
    const response = await axios.get(backendUrl, {
      headers: forwardHeaders(req),
      validateStatus: () => true,
    });
    console.log('Proxy response:', response.data);
    res.status(response.status).set(response.headers).send(response.data);
  } catch (e) {
    const status = e.response?.status ?? 502;
    res.status(status).send(e.response?.data ?? 'Upstream error');
  }
});

app.post('*', async (req, res) => {
  try {
    const response = await axios({
      method: 'post',
      url: `${BACKEND}${req.originalUrl}`,
      // forward the original raw bytes exactly
      data: req.body, // Buffer from express.raw
      headers: forwardHeaders(req),
      // prevent axios from changing the body
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
    res.status(response.status).set(response.headers).send(response.data);
  } catch (e) {
    const status = e.response?.status ?? 502;
    res.status(status).send(e.response?.data ?? 'Upstream error');
  }
});

// accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("*", async (req, res) => {
  let status;
  let data;
  try {
    const response = await axios.get(`${BACKEND}${req.originalUrl}`)
    status = response.status;
    data = response.data;
  } catch (e) {
    status = e.response.status;
    data = e.response.data;
  } finally {
    res.status(status).send(data.content);
  }
});

app.listen(PORT, () => console.log(`Proxy on :${PORT}`));