const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const CLOSED_WON_STAGE_ID = process.env.CLOSED_WON_STAGE_ID;
const PREVIOUS_STAGE_ID = process.env.PREVIOUS_STAGE_ID;

const headers = {
  Authorization: `Bearer ${HUBSPOT_API_KEY}`,
  'Content-Type': 'application/json'
};

async function checkClosedWonDeals() {
  try {
    console.log('Checking Closed Won deals...');

    // Closed Won deallerini getir
    const dealsRes = await axios.post(
      'https://api.hubapi.com/crm/v3/objects/deals/search',
      {
        filterGroups: [{
          filters: [{
            propertyName: 'dealstage',
            operator: 'EQ',
            value: CLOSED_WON_STAGE_ID
          }]
        }],
        properties: ['dealname', 'dealstage'],
        limit: 100
      },
      { headers }
    );

    const deals = dealsRes.data.results;
    console.log(`Found ${deals.length} Closed Won deals`);

    for (const deal of deals) {
      const dealId = deal.id;

      // Deal'e bağlı Contact'ı bul
      const assocRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts`,
        { headers }
      );

      const contacts = assocRes.data.results;
      if (!contacts || contacts.length === 0) {
        console.log(`Deal ${dealId} - No contact found, reverting...`);
        await revertStage(dealId);
        continue;
      }

      const contactId = contacts[0].id;

      // Contact'taki Bill To ve Ship To kontrol et
      const contactRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=bill_to,ship_to`,
        { headers }
      );

      const { bill_to, ship_to } = contactRes.data.properties;

      if (!bill_to || !ship_to) {
        console.log(`Deal ${dealId} - Bill To or Ship To missing, reverting...`);
        await revertStage(dealId);
      } else {
        console.log(`Deal ${dealId} - OK`);
      }
    }
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

async function revertStage(dealId) {
  await axios.patch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
    { properties: { dealstage: PREVIOUS_STAGE_ID } },
    { headers }
  );
  console.log(`Deal ${dealId} reverted to previous stage`);
}

// Her 5 dakikada bir kontrol et
setInterval(checkClosedWonDeals, 5 * 60 * 1000);

// Başlangıçta da çalıştır
checkClosedWonDeals();

// Health check endpoint
app.get('/', (req, res) => res.send('Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
