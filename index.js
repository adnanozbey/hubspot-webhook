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

    const dealsRes = await axios.get(
      `https://api.hubapi.com/crm/v3/objects/deals?properties=dealstage,dealname&limit=100`,
      { headers }
    );

    const allDeals = dealsRes.data.results;
    const closedWonDeals = allDeals.filter(d => d.properties.dealstage === CLOSED_WON_STAGE_ID);

    console.log(`Total deals: ${allDeals.length}, Closed Won: ${closedWonDeals.length}`);

    for (const deal of closedWonDeals) {
      const dealId = deal.id;

      // Deal-Contact association'larını label'larıyla birlikte getir
      const assocRes = await axios.get(
        `https://api.hubapi.com/crm/v4/objects/deals/${dealId}/associations/contacts`,
        { headers }
      );

      const associations = assocRes.data.results;

      if (!associations || associations.length === 0) {
        console.log(`Deal ${dealId} - No contact found, reverting...`);
        await revertStage(dealId);
        continue;
      }

      // Bill To ve Ship To label'larını kontrol et
      let hasBillTo = false;
      let hasShipTo = false;

      for (const assoc of associations) {
        const labels = assoc.associationTypes?.map(t => t.label) || [];
        console.log(`Deal ${dealId} - Contact ${assoc.toObjectId} labels: ${labels.join(', ')}`);
        if (labels.includes('Bill To')) hasBillTo = true;
        if (labels.includes('Ship To')) hasShipTo = true;
      }

      if (!hasBillTo || !hasShipTo) {
        console.log(`Deal ${dealId} - Bill To: ${hasBillTo}, Ship To: ${hasShipTo} - reverting...`);
        await revertStage(dealId);
      } else {
        console.log(`Deal ${dealId} - OK, both labels present`);
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

setInterval(checkClosedWonDeals, 5 * 60 * 1000);
checkClosedWonDeals();

app.get('/', (req, res) => res.send('Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
