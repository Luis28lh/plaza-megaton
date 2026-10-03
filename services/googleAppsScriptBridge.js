// Puente de comunicación opcional con Google Apps Script (Webhook autónomo)
// Permite sincronizar bidireccionalmente con Google Sheets y Google Drive sin requerir Service Account de GCP.

class GoogleAppsScriptBridge {
  constructor(url) {
    this.url = url || process.env.GOOGLE_APPS_SCRIPT_URL;
  }

  isEnabled() {
    return Boolean(this.url && this.url.startsWith('https://script.google.com'));
  }

  async sendRequest(action, payload) {
    if (!this.isEnabled()) return null;

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script respondió status ${response.status}`);
      }

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (_) {
        return { success: true, raw: text };
      }
    } catch (err) {
      console.error(`[GoogleAppsScriptBridge] Error en acción ${action}:`, err.message);
      return null;
    }
  }

  async syncUsuario(user) {
    return this.sendRequest('SYNC_USUARIO', user);
  }

  async syncAsignaciones(userId, cubiculos) {
    return this.sendRequest('SYNC_ASIGNACIONES', { userId, cubiculos });
  }

  async syncReclamacion(reclamacion) {
    return this.sendRequest('SYNC_RECLAMACION', reclamacion);
  }

  async syncUpdateReclamacion(reclamacion) {
    return this.sendRequest('UPDATE_RECLAMACION', reclamacion);
  }

  async syncPago(pago) {
    return this.sendRequest('SYNC_PAGO', pago);
  }

  async syncUpdatePago(pago) {
    return this.sendRequest('UPDATE_PAGO', pago);
  }

  async syncHistorial(entry) {
    return this.sendRequest('SYNC_HISTORIAL', entry);
  }
}

module.exports = GoogleAppsScriptBridge;
