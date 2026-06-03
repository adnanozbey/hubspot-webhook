const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const CLOSED_WON_STAGE_ID = process.env.CLOSED_WON_STAGE_ID;
const PREVIOUS_STAGE_ID = process.env.PREVIOUS_STAGE_ID;

app.post('/webhook', async (req, res) => {
  try {
    const events = req.body;

    for (const event of events) {
      const dealId = event.objectId;
      const newStageId = event.propertyValue;

      // Sadece Closed Won'a geçişte tetikle
      if (newStageId !== CLOSED_WON_STAGE_ID) continue;

      // Deal'e bağlı Contact'ı bul
      const assocRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts`,
        { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } }
      );

      const contacts = assocRes.data.results;
      if (!contacts || contacts.length === 0) {
        await revertStage(dealId);
        continue;
      }

      const contactId = contacts[0].id;

      // Contact'taki Bill To ve Ship To alanlarını kontrol et
      const contactRes = await axios.get(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=bill_to,ship_to`,
        { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } }
      );

      const { bill_to, ship_to } = contactRes.data.properties;

      if (!bill_to || !ship_to) {
        console.log(`Deal ${dealId} - Bill To veya Ship To boş, geri çekiliyor...`);
        await revertStage(dealId);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    res.sendStatus(500);
  }
});

async function revertStage(dealId) {
  await axios.patch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
    { properties: { dealstage: PREVIOUS_STAGE_ID } },
    { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
