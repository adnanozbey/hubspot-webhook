const express = require('express');
const axios = require('axios');
const app = express();

const PRIVATE_APP_TOKEN = process.env.HUBSPOT_API_KEY;

app.get('/', (req, res) => {
  res.send('HubSpot Webhook Server running.');
});

app.get('/check/:dealId', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { dealId } = req.params;
  try {
    const [dealRes, assocRes] = await Promise.all([
      axios.get(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealstage`, {
        headers: { Authorization: `Bearer ${PRIVATE_APP_TOKEN}` }
      }),
      axios.get(`https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/companies`, {
        headers: { Authorization: `Bearer ${PRIVATE_APP_TOKEN}` }
      })
    ]);
    const stage = dealRes.data.properties?.dealstage;
    let billTo = false, shipTo = false;
    (assocRes.data.results || []).forEach(a => {
      (a.associationTypes || []).forEach(t => {
        if (t.label === 'Bill To') billTo = true;
        if (t.label === 'Ship To') shipTo = true;
      });
    });
    res.json({ stage, billTo, shipTo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
