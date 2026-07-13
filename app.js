const quoteForm = document.getElementById('quoteForm');
const messageBox = document.getElementById('msg');

function normalizeSubmission(form) {
  const raw = Object.fromEntries(new FormData(form));
  return {
    nom: String(raw.nom || '').trim(),
    telephone: String(raw.telephone || '').trim(),
    courriel: String(raw.courriel || '').trim(),
    service: String(raw.service || '').trim(),
    depart: String(raw.depart || '').trim(),
    destination: String(raw.destination || '').trim(),
    date: String(raw.date || '').trim(),
    heure: String(raw.heure || '').trim(),
    details: String(raw.details || '').trim()
  };
}

async function notifyWebhook(payload) {
  const url = String(window.MOVENTRA_WEBHOOK_URL || '').trim();
  if (!url) return { configured: false, delivered: false };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook Make: erreur HTTP ${response.status}`);
  }

  return { configured: true, delivered: true };
}

quoteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const data = normalizeSubmission(form);

  messageBox.className = '';
  messageBox.textContent = 'Envoi en cours...';
  submitButton.disabled = true;

  try {
    const createdAtClient = new Date().toISOString();
    const documentRef = await db.collection('demandes_soumission').add({
      ...data,
      status: 'nouvelle',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtClient,
      source: 'site-moventra',
      notificationStatus: 'en_attente'
    });

    const webhookPayload = {
      event: 'nouvelle_soumission_moventra',
      submissionId: documentRef.id,
      createdAt: createdAtClient,
      ...data
    };

    let notificationStatus = 'non_configuree';
    try {
      const webhookResult = await notifyWebhook(webhookPayload);
      notificationStatus = webhookResult.delivered ? 'envoyee_au_webhook' : 'non_configuree';
    } catch (webhookError) {
      console.error('Notification webhook:', webhookError);
      notificationStatus = 'erreur_webhook';
    }

    await documentRef.update({ notificationStatus });

    form.reset();
    messageBox.className = 'success';
    messageBox.textContent = 'Votre demande a été envoyée. Moventra vous contactera bientôt.';
  } catch (error) {
    console.error('Soumission Moventra:', error);
    messageBox.className = 'error';
    messageBox.textContent = `Erreur : ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});
