// Servicio centralizado de secuencias y correlativos inviolables
// Regla: Nunca reutilizar un número eliminado o cancelado. Consecutivo incremental garantizado.

const fs = require('fs');
const path = require('path');
const os = require('os');

const PREFIXES = {
  USUARIO: { prefix: 'US', param: 'ultimo_codigo_usuario', pad: 3 },
  RECLAMACION: { prefix: 'CL', param: 'ultimo_codigo_reclamacion', pad: 3 },
  PAGO: { prefix: 'PG', param: 'ultimo_codigo_pago', pad: 3 },
  SOLICITUD_ADMIN: { prefix: 'SL', param: 'ultimo_codigo_solicitud_admin', pad: 3 },
  COMUNICACION: { prefix: 'CM', param: 'ultimo_codigo_comunicacion', pad: 3 }
};

class SequenceService {
  // Contadores estáticos persistentes en memoria del proceso
  static counters = {
    US: 18,
    CL: 7,
    PG: 7,
    SL: 0,
    CM: 0
  };

  constructor(dataService) {
    this.dataService = dataService;
    this._locks = new Map();
  }

  /**
   * Genera el siguiente código atómicamente y actualiza el contador maestro en CONFIGURACION
   * @param {'USUARIO'|'RECLAMACION'|'PAGO'|'SOLICITUD_ADMIN'|'COMUNICACION'} type 
   * @returns {Promise<string>} e.g. "CL-008", "PG-001", "US-019"
   */
  async nextCode(type) {
    const config = PREFIXES[type];
    if (!config) {
      throw new Error(`Tipo de secuencia desconocido: ${type}`);
    }

    // Lock de concurrencia simple en memoria para evitar colisiones simultáneas
    while (this._locks.get(type)) {
      await new Promise(r => setTimeout(r, 20));
    }
    this._locks.set(type, true);

    try {
      // 0. Base del contador estático en memoria
      let maxNumber = SequenceService.counters[config.prefix] || 0;

      // 1. Obtener el último código registrado en configuración
      const currentVal = await this.dataService.getConfigValue(config.param, `${config.prefix}-000`);
      const match = String(currentVal).match(new RegExp(`${config.prefix}-(\\d+)`));
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNumber) maxNumber = n;
      }

      // 2. Como seguridad adicional, revisar si en las tablas existentes hay un código mayor
      if (type === 'RECLAMACION') {
        const items = await this.dataService.getReclamacionesRaw();
        for (const item of items) {
          const m = String(item.codigo || '').match(/CL-(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNumber) maxNumber = n;
          }
        }

        // Revisar carpetas de almacenamiento local y efímero
        const uploadFolders = [
          path.join(__dirname, '..', 'public', 'assets', 'uploads', '01 - RECLAMACIONES'),
          path.join(__dirname, '..', 'assets', 'uploads', '01 - RECLAMACIONES'),
          path.join(os.tmpdir(), 'uploads', '01 - RECLAMACIONES')
        ];
        for (const uf of uploadFolders) {
          try {
            if (fs.existsSync(uf)) {
              const entries = fs.readdirSync(uf);
              for (const e of entries) {
                const em = String(e).match(/CL-(\d+)/i);
                if (em) {
                  const en = parseInt(em[1], 10);
                  if (en > maxNumber) maxNumber = en;
                }
              }
            }
          } catch (_) {}
        }
      } else if (type === 'PAGO') {
        const items = await this.dataService.getPagosRaw();
        for (const item of items) {
          const m = String(item.codigo || '').match(/PG-(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNumber) maxNumber = n;
          }
        }

        // Revisar carpetas de almacenamiento local y efímero de comprobantes (02 - PAGOS)
        const uploadFolders = [
          path.join(__dirname, '..', 'public', 'assets', 'uploads', '02 - PAGOS'),
          path.join(__dirname, '..', 'assets', 'uploads', '02 - PAGOS'),
          path.join(os.tmpdir(), 'uploads', '02 - PAGOS')
        ];
        for (const uf of uploadFolders) {
          try {
            if (fs.existsSync(uf)) {
              const entries = fs.readdirSync(uf);
              for (const e of entries) {
                const em = String(e).match(/PG-(\d+)/i);
                if (em) {
                  const en = parseInt(em[1], 10);
                  if (en > maxNumber) maxNumber = en;
                }
              }
            }
          } catch (_) {}
        }

        // Garantizar que la secuencia continúe desde PG-007 en adelante
        if (maxNumber < 7) maxNumber = 7;
      } else if (type === 'USUARIO') {
        const items = await this.dataService.getUsuariosRaw();
        for (const item of items) {
          const m = String(item.user_id || '').match(/US-(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNumber) maxNumber = n;
          }
        }
      }

      // 3. Consecutivo estrictamente incremental
      const nextNumber = maxNumber + 1;
      SequenceService.counters[config.prefix] = nextNumber;

      const formattedCode = `${config.prefix}-${String(nextNumber).padStart(config.pad, '0')}`;

      // 4. Persistir de inmediato el nuevo código en CONFIGURACION
      await this.dataService.setConfigValue(config.param, formattedCode);

      return formattedCode;
    } finally {
      this._locks.set(type, false);
    }
  }
}

module.exports = SequenceService;
