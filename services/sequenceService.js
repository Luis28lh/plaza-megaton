// Servicio centralizado de secuencias y correlativos inviolables
// Regla: Nunca reutilizar un número eliminado o cancelado. Consecutivo incremental garantizado.

const PREFIXES = {
  USUARIO: { prefix: 'US', param: 'ultimo_codigo_usuario', pad: 3 },
  RECLAMACION: { prefix: 'CL', param: 'ultimo_codigo_reclamacion', pad: 3 },
  PAGO: { prefix: 'PG', param: 'ultimo_codigo_pago', pad: 3 },
  SOLICITUD_ADMIN: { prefix: 'SL', param: 'ultimo_codigo_solicitud_admin', pad: 3 },
  COMUNICACION: { prefix: 'CM', param: 'ultimo_codigo_comunicacion', pad: 3 }
};

class SequenceService {
  constructor(dataService) {
    this.dataService = dataService;
    this._locks = new Map();
  }

  /**
   * Genera el siguiente código atómicamente y actualiza el contador maestro en CONFIGURACION
   * @param {'USUARIO'|'RECLAMACION'|'PAGO'|'SOLICITUD_ADMIN'|'COMUNICACION'} type 
   * @returns {Promise<string>} e.g. "CL-001", "PG-001", "US-001"
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
      // 1. Obtener el último código registrado en configuración
      const currentVal = await this.dataService.getConfigValue(config.param, `${config.prefix}-000`);
      
      // 2. Extraer el valor numérico
      let maxNumber = 0;
      const match = String(currentVal).match(new RegExp(`${config.prefix}-(\\d+)`));
      if (match) {
        maxNumber = parseInt(match[1], 10);
      }

      // 3. Como seguridad adicional, revisar si en las tablas existentes hay un código mayor
      // Esto previene duplicados en caso de manipulación manual de la hoja
      if (type === 'RECLAMACION') {
        const items = await this.dataService.getReclamacionesRaw();
        for (const item of items) {
          const m = String(item.codigo || '').match(/CL-(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNumber) maxNumber = n;
          }
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

      const nextNumber = maxNumber + 1;
      const formattedCode = `${config.prefix}-${String(nextNumber).padStart(config.pad, '0')}`;

      // 4. Persistir de inmediato el nuevo código para garantizar no reutilización
      await this.dataService.setConfigValue(config.param, formattedCode);

      return formattedCode;
    } finally {
      this._locks.set(type, false);
    }
  }
}

module.exports = SequenceService;
