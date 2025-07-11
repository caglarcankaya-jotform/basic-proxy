const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const BACKEND = process.env.BACKEND_BASE_URL;

if (!BACKEND) {
  throw new Error('BACKEND_BASE_URL is not set.');
}

app.use(express.json())

app.post("*", async (req, res) => {
  let status;
  let data;
  try {
    const response = await axios.post(`${BACKEND}${req.originalUrl}`, req.body);
    status = response.status;
    data = response.data;
  } catch (e) {
    status = e.response.status;
    data = e.response.data;
  } finally {
    res.status(status).send(data.content);
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

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
