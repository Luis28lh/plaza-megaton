// Capa de Servicio / Repositorio Unificado (DataService)
// Abstrae el acceso a datos permitiendo migración futura a PostgreSQL/Supabase/Firebase
// Implementa persistencia local robusta e interfaces preparadas para Google Sheets API y Apps Script Webhook.

const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.VERCEL 
  ? path.join('/tmp', 'local_db.json') 
  : path.join(__dirname, '..', 'database', 'local_db.json');
const INITIAL_CATALOG_PATH = path.join(__dirname, '..', 'database', 'initial_catalog.json');

class DataService {
  constructor() {
    this.db = null;
    this.googleBridge = null; // Se inyecta si está habilitado
    this.init();
  }

  setGoogleBridge(bridge) {
    this.googleBridge = bridge;
  }

  init() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.db = JSON.parse(raw);
      } else {
        // Inicializar desde catálogo inicial usando require para empaquetado automático en Vercel
        this.db = JSON.parse(JSON.stringify(require('../database/initial_catalog.json')));
        this.persist();
      }
    } catch (err) {
      try {
        this.db = JSON.parse(JSON.stringify(require('../database/initial_catalog.json')));
      } catch (_) {
        if (!this.db) {
          this.db = { CUBICULOS: [], USUARIOS: [], USUARIO_CUBICULO: [], PRESUPUESTO_2026: null, RECLAMACIONES: [], PAGOS: [], CONFIGURACION: [], HISTORIAL: [], NOVEDADES: [], MENSAJES: [] };
        }
      }
    }

    if (!this.db) {
      this.db = { CUBICULOS: [], USUARIOS: [], USUARIO_CUBICULO: [], PRESUPUESTO_2026: null, RECLAMACIONES: [], PAGOS: [], CONFIGURACION: [], HISTORIAL: [], NOVEDADES: [], MENSAJES: [] };
    }

    // Asegurar que Bertha Soury (US-017) y usuarios de initial_catalog tengan sus datos y aliases más recientes
    try {
      const initialCat = require('../database/initial_catalog.json');
      if (initialCat && Array.isArray(initialCat.USUARIOS)) {
        for (const initU of initialCat.USUARIOS) {
          const existing = (this.db.USUARIOS || []).find(u => u.user_id === initU.user_id);
          if (existing) {
            if (initU.alias_emails) existing.alias_emails = initU.alias_emails;
            if (initU.email) existing.email = initU.email;
            if (initU.telefono && !existing.telefono) existing.telefono = initU.telefono;
            if (initU.user_id === 'US-017') {
              if (!existing.pin && !existing.password) {
                existing.password = '123456';
                existing.password_temporal = true;
                existing.debe_cambiar_password = true;
              }
              existing.estado = 'Activo';
            }
          } else {
            if (!this.db.USUARIOS) this.db.USUARIOS = [];
            this.db.USUARIOS.push(initU);
          }
        }
        for (const u of this.db.USUARIOS) {
          if (u.pin === undefined) u.pin = null;
        }
      }
    } catch (_) {}

    if (!this.db.NOVEDADES) {
      this.db.NOVEDADES = [
        {
          id: 'NOV-001',
          titulo: 'Convocatoria a Reunión Ordinaria de Propietarios y Condóminos',
          categoria: 'Reunión / Asamblea',
          fecha_publicacion: '30/09/2026',
          fecha_evento: '15/10/2026 - 6:30 PM',
          contenido: 'Se convoca a todos los propietarios y ocupantes a la asamblea semestral para revisar los avances del presupuesto 2026, proyectos de iluminación y presentación de la nueva plataforma digital de la plaza.',
          autor: 'Consejo de Administración',
          destacado: true
        },
        {
          id: 'NOV-002',
          titulo: 'Mantenimiento Preventivo de Bomba y Cisterna de Agua',
          categoria: 'Mantenimiento',
          fecha_publicacion: '28/09/2026',
          fecha_evento: '05/10/2026 - 7:00 AM a 11:00 AM',
          contenido: 'Se llevará a cabo el lavado y desinfección de la cisterna principal de agua potable, así como la calibración de la bomba presurizadora. Los baños comunes funcionarán con reserva.',
          autor: 'Administración Técnica',
          destacado: false
        },
        {
          id: 'NOV-003',
          titulo: 'Habilitación de Portal Digital y Buzón de Comunicaciones',
          categoria: 'Aviso General',
          fecha_publicacion: '25/09/2026',
          fecha_evento: 'Permanente',
          contenido: 'Estimados ocupantes: Ya se encuentra en funcionamiento la plataforma web para crear solicitudes con fotos, reportar pagos con comprobante y consultar comunicados directos desde su teléfono.',
          autor: 'Ing. Luis Miguel Lizardo Hernández',
          destacado: true
        }
      ];
      this.persist();
    }

    if (!this.db.MENSAJES) {
      this.db.MENSAJES = [];
    }
  }

  persist() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2), 'utf8');
    } catch (err) {
      console.warn('[DataService] Aviso guardando DB:', err.message);
    }
  }

  // ==========================================
  // CONFIGURACIÓN
  // ==========================================
  async getConfig() {
    return this.db.CONFIGURACION || [];
  }

  async getConfigValue(param, fallback = '') {
    const list = this.db.CONFIGURACION || [];
    const item = list.find(c => c.parametro === param);
    return item ? item.valor : fallback;
  }

  async setConfigValue(param, valor) {
    if (!this.db.CONFIGURACION) this.db.CONFIGURACION = [];
    const idx = this.db.CONFIGURACION.findIndex(c => c.parametro === param);
    if (idx >= 0) {
      this.db.CONFIGURACION[idx].valor = valor;
    } else {
      this.db.CONFIGURACION.push({ parametro: param, valor });
    }
    this.persist();
    return true;
  }

  // ==========================================
  // CUBÍCULOS
  // ==========================================
  async getCubiculos() {
    return this.db.CUBICULOS || [];
  }

  async getCubiculoById(id) {
    return (this.db.CUBICULOS || []).find(c => c.cubiculo_id === id);
  }

  async getCubiculoByCode(codigo) {
    return (this.db.CUBICULOS || []).find(c => c.codigo.toUpperCase() === codigo.toUpperCase());
  }

  async updateCubiculo(id, updates) {
    const cub = (this.db.CUBICULOS || []).find(c => c.cubiculo_id === id || c.codigo === id);
    if (!cub) return null;
    Object.assign(cub, updates);
    this.persist();
    return cub;
  }

  // ==========================================
  // PRESUPUESTO 2026
  // ==========================================
  async getPresupuesto() {
    return this.db.PRESUPUESTO_2026 || null;
  }

  // ==========================================
  // USUARIOS
  // ==========================================
  async getUsuariosRaw() {
    return this.db.USUARIOS || [];
  }

  async getUsuarios() {
    const users = this.db.USUARIOS || [];
    const relations = this.db.USUARIO_CUBICULO || [];
    const cubiculos = this.db.CUBICULOS || [];

    return users.map(u => {
      const userCubRels = relations.filter(r => r.user_id === u.user_id && (r.estado === 'Activo' || r.estado === 'Pendiente'));
      const cubList = userCubRels.map(rel => {
        const c = cubiculos.find(cb => cb.cubiculo_id === rel.cubiculo_id);
        const cod = c ? c.codigo : rel.cubiculo_id;
        const nom = rel.nombre_local || (c ? c.nombre_local : '') || '';
        const act = rel.actividad_comercial || (c ? c.actividad_comercial : '') || '';
        if (nom || act) {
          return `${cod} (${nom ? nom + (act ? ' · ' + act : '') : act})`;
        }
        return cod;
      });
      return {
        ...u,
        cubiculos: cubList
      };
    });
  }

  async getUsuarioById(id) {
    const user = (this.db.USUARIOS || []).find(u => u.user_id === id);
    if (!user) return null;
    const cubiculos = await this.getCubiculosByUser(user.user_id);
    return { ...user, cubiculos };
  }

  async getUsuarioByEmail(email) {
    if (!email) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    const emailWithoutDomainExt = cleanEmail.replace(/\.[a-z0-9]+$/i, '');
    const cleanWithoutSymbols = cleanEmail.replace(/[^a-z0-9]/g, '');

    const user = (this.db.USUARIOS || []).find(u => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uWithoutExt = uEmail.replace(/\.[a-z0-9]+$/i, '');
      const uWithoutSymbols = uEmail.replace(/[^a-z0-9]/g, '');

      // 1. Coincidencia exacta
      if (uEmail === cleanEmail) return true;

      // 2. Coincidencia con lista de alias de correos
      if (Array.isArray(u.alias_emails) && u.alias_emails.some(a => {
        const cleanA = (a || '').trim().toLowerCase();
        return cleanA === cleanEmail || cleanA.replace(/\.[a-z0-9]+$/i, '') === emailWithoutDomainExt;
      })) {
        return true;
      }

      // 3. Coincidencia si se omitió o agregó extensión de dominio (ej. b.souri@souriindustrial <-> b.souri@souriindustrial.com)
      if (uEmail === cleanEmail + '.com' || cleanEmail === uEmail + '.com') return true;
      if (cleanEmail.includes('@') && emailWithoutDomainExt === uWithoutExt) return true;

      // 4. Tolerancia ortográfica 'i' vs 'y' (ej. souri vs soury)
      if (cleanEmail.replace(/y/g, 'i') === uEmail.replace(/y/g, 'i') || 
          emailWithoutDomainExt.replace(/y/g, 'i') === uWithoutExt.replace(/y/g, 'i')) {
        return true;
      }

      // 5. Coincidencia por código de cubículo (ej. "A-308", "A-309", "308", "309")
      if (Array.isArray(u.cubiculos)) {
        for (const c of u.cubiculos) {
          const cCode = (typeof c === 'object' ? c.codigo : String(c)).trim().toLowerCase();
          if (cCode === cleanEmail || cCode.replace(/[^a-z0-9]/g, '') === cleanWithoutSymbols) {
            return true;
          }
        }
      }

      // 6. Coincidencia por user_id (ej. "US-017")
      if ((u.user_id || '').toLowerCase() === cleanEmail) return true;

      // 7. Casos especiales conocidos
      if (cleanEmail === 'wes.inform@gmail.com' && (uEmail.includes('warn.electrical') || u.user_id === 'US-004')) return true;
      return false;
    });
    if (!user) return null;
    const cubiculos = await this.getCubiculosByUser(user.user_id);
    return { ...user, cubiculos };
  }

  async createUsuario({ user_id, nombre, email, telefono, password, estado = 'Activo' }) {
    const fecha_registro = new Date().toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });

    const newUser = {
      user_id,
      nombre,
      email: email.trim().toLowerCase(),
      telefono: telefono || '',
      password: password ? String(password).trim() : '123456',
      fecha_registro,
      estado
    };

    if (!this.db.USUARIOS) this.db.USUARIOS = [];
    this.db.USUARIOS.push(newUser);
    this.persist();

    // Sincronizar con Google si está conectado
    if (this.googleBridge) {
      this.googleBridge.syncUsuario(newUser).catch(err => console.error('[GoogleBridge Error]', err));
    }

    return newUser;
  }

  async updateUsuario(userId, updates, adminUser = 'Administración') {
    const user = (this.db.USUARIOS || []).find(u => u.user_id === userId);
    if (!user) return null;

    const changedFields = [];
    if (updates.email && updates.email.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
      changedFields.push(`correo (${user.email} -> ${updates.email})`);
      if (!Array.isArray(user.alias_emails)) {
        user.alias_emails = [];
      }
      if (user.email && !user.alias_emails.includes(user.email)) {
        user.alias_emails.push(user.email);
      }
    }
    if (updates.nombre && updates.nombre !== user.nombre) {
      changedFields.push(`nombre (${user.nombre} -> ${updates.nombre})`);
    }
    if (updates.password && updates.password !== user.password) {
      changedFields.push('contraseña');
    }
    if (updates.estado && updates.estado !== user.estado) {
      changedFields.push(`estado (${user.estado} -> ${updates.estado})`);
    }
    if (updates.telefono && updates.telefono !== user.telefono) {
      changedFields.push('teléfono');
    }

    Object.assign(user, updates);
    this.persist();

    // Sincronizar con Google si está conectado
    if (this.googleBridge) {
      this.googleBridge.syncUsuario(user).catch(err => console.error('[GoogleBridge Error]', err));
    }

    if (changedFields.length > 0) {
      await this.addHistorial({
        tipo_movimiento: 'ACTUALIZACION_USUARIO',
        tipo_documento: 'USUARIO',
        codigo_documento: user.user_id,
        usuario: adminUser,
        cubiculo: (user.cubiculos || []).join(', ') || '',
        accion: 'Actualización de Usuario',
        estado_anterior: 'ACTIVO',
        estado_nuevo: user.estado || 'ACTIVO',
        observacion: `Modificación de ${changedFields.join(', ')} para ${user.nombre} (${user.email}) por ${adminUser}.`
      });
    }

    return user;
  }

  // ==========================================
  // RELACIÓN USUARIO - CUBÍCULOS
  // ==========================================
  async getCubiculosByUser(userId, includePending = true) {
    const relations = (this.db.USUARIO_CUBICULO || []).filter(r => 
      r.user_id === userId && (r.estado === 'Activo' || (includePending && r.estado === 'Pendiente'))
    );
    const cubiculos = this.db.CUBICULOS || [];
    return relations.map(r => {
      const c = cubiculos.find(cb => cb.cubiculo_id === r.cubiculo_id);
      return {
        cubiculo_id: r.cubiculo_id,
        codigo: c ? c.codigo : r.cubiculo_id,
        nivel: c ? c.nivel : '',
        nombre: r.nombre_local || (c ? c.nombre_local : '') || '',
        actividad: r.actividad_comercial || (c ? c.actividad_comercial : '') || '',
        observaciones: c ? c.observaciones : '',
        estado_relacion: r.estado || 'Activo'
      };
    });
  }

  async assignCubiculosToUser(userId, cubiculoIds, initialStatus = 'Activo') {
    if (!this.db.USUARIO_CUBICULO) this.db.USUARIO_CUBICULO = [];
    if (!this.db.CUBICULOS) this.db.CUBICULOS = [];

    const now = new Date().toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });

    const assigned = [];
    for (const item of cubiculoIds) {
      if (!item) continue;
      const rawCode = typeof item === 'object' ? item.codigo : item;
      const nombreLocal = typeof item === 'object' ? (item.nombre || item.nombre_local || '') : '';
      const actividadComercial = typeof item === 'object' ? (item.actividad || item.actividad_comercial || '') : '';

      if (!rawCode || !String(rawCode).trim()) continue;
      const cleanCode = String(rawCode).trim().toUpperCase();

      // Buscar por ID, código exacto o código alfanumérico
      let cub = this.db.CUBICULOS.find(c => 
        c.cubiculo_id.toUpperCase() === cleanCode || 
        c.codigo.toUpperCase() === cleanCode ||
        c.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '') === cleanCode.replace(/[^A-Z0-9]/g, '')
      );

      if (!cub) {
        console.warn(`[dataService] Cubículo "${cleanCode}" no existe en el catálogo oficial de 33 locales. Omitiendo.`);
        continue;
      } else {
        if (initialStatus === 'Activo') {
          cub.estado = 'Ocupado';
        }
        if (nombreLocal) cub.nombre_local = nombreLocal;
        if (actividadComercial) cub.actividad_comercial = actividadComercial;
      }

      // Verificar si ya existe relación
      let existing = this.db.USUARIO_CUBICULO.find(r => r.user_id === userId && r.cubiculo_id === cub.cubiculo_id);
      if (existing) {
        existing.estado = initialStatus;
        if (nombreLocal) existing.nombre_local = nombreLocal;
        if (actividadComercial) existing.actividad_comercial = actividadComercial;
      } else {
        const relId = `UC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.db.USUARIO_CUBICULO.push({
          id: relId,
          user_id: userId,
          cubiculo_id: cub.cubiculo_id,
          nombre_local: nombreLocal,
          actividad_comercial: actividadComercial,
          fecha_asignacion: now,
          estado: initialStatus
        });
      }

      assigned.push(cub.codigo);
    }

    this.persist();

    if (this.googleBridge && assigned.length > 0 && initialStatus === 'Activo') {
      this.googleBridge.syncAsignaciones(userId, assigned).catch(err => console.error('[GoogleBridge Error]', err));
    }

    return assigned;
  }

  /**
   * Activa un usuario en estado "Pendiente de Aprobación" y confirma sus cubículos
   */
  async activateUserAndCubiculos(userId, adminName = 'Administración') {
    const user = (this.db.USUARIOS || []).find(u => u.user_id === userId);
    if (!user) return null;

    const oldEstado = user.estado;
    user.estado = 'Activo';
    user.debe_cambiar_password = true; // Exige cambio de clave en primer ingreso
    user.password_temporal = true;

    // Activar relaciones de cubículos pendientes de este usuario
    const relations = (this.db.USUARIO_CUBICULO || []).filter(r => r.user_id === userId);
    const assignedCodes = [];
    relations.forEach(r => {
      r.estado = 'Activo';
      const cub = (this.db.CUBICULOS || []).find(c => c.cubiculo_id === r.cubiculo_id);
      if (cub) {
        cub.estado = 'Ocupado';
        if (r.nombre_local) cub.nombre_local = r.nombre_local;
        if (r.actividad_comercial) cub.actividad_comercial = r.actividad_comercial;
        if (!assignedCodes.includes(cub.codigo)) {
          assignedCodes.push(cub.codigo);
        }
      }
    });

    this.persist();

    if (this.googleBridge) {
      this.googleBridge.syncUsuario(user).catch(err => console.error('[GoogleBridge Error]', err));
      if (assignedCodes.length > 0) {
        this.googleBridge.syncAsignaciones(userId, assignedCodes).catch(err => console.error('[GoogleBridge Error]', err));
      }
    }

    await this.addHistorial({
      tipo_movimiento: 'HABILITACION_ACCESO',
      tipo_documento: 'USUARIO',
      codigo_documento: user.user_id,
      usuario: adminName,
      cubiculo: assignedCodes.join(', ') || 'N/A',
      accion: 'Aprobación de Registro y Concesión de Acceso',
      estado_anterior: oldEstado || 'Pendiente de Aprobación',
      estado_nuevo: 'Activo',
      observacion: `Aprobado registro del inquilino ${user.nombre} (${user.email}) para los cubículos: ${assignedCodes.join(', ') || 'N/A'}. Notificación y credenciales oficiales despachadas por correo.`
    });

    return { user, assignedCodes };
  }

  /**
   * Rechaza la solicitud de registro de un usuario
   */
  async rejectUserRegistration(userId, adminName = 'Administración', motivo = '') {
    const user = (this.db.USUARIOS || []).find(u => u.user_id === userId);
    if (!user) return null;

    const oldEstado = user.estado;
    user.estado = 'Rechazado';

    const relations = (this.db.USUARIO_CUBICULO || []).filter(r => r.user_id === userId);
    relations.forEach(r => {
      r.estado = 'Rechazado';
    });

    this.persist();

    if (this.googleBridge) {
      this.googleBridge.syncUsuario(user).catch(err => console.error('[GoogleBridge Error]', err));
    }

    await this.addHistorial({
      tipo_movimiento: 'RECHAZO_ACCESO',
      tipo_documento: 'USUARIO',
      codigo_documento: user.user_id,
      usuario: adminName,
      cubiculo: relations.map(r => r.cubiculo_codigo).join(', ') || 'N/A',
      accion: 'Rechazo de Registro',
      estado_anterior: oldEstado || 'Pendiente de Aprobación',
      estado_nuevo: 'Rechazado',
      observacion: `Solicitud de registro de ${user.nombre} (${user.email}) rechazada por ${adminName}.${motivo ? ' Motivo: ' + motivo : ''}`
    });

    return user;
  }

  async removeCubiculoFromUser(userId, cubiculoIdOrCode) {
    const cub = (this.db.CUBICULOS || []).find(c => c.cubiculo_id === cubiculoIdOrCode || c.codigo.toUpperCase() === cubiculoIdOrCode.toUpperCase());
    if (!cub) return false;

    const rel = (this.db.USUARIO_CUBICULO || []).find(r => r.user_id === userId && r.cubiculo_id === cub.cubiculo_id);
    if (rel) {
      rel.estado = 'Inactivo';
    }

    // Verificar si queda algún otro usuario activo en este cubículo
    const remaining = (this.db.USUARIO_CUBICULO || []).filter(r => r.cubiculo_id === cub.cubiculo_id && r.estado === 'Activo');
    if (remaining.length === 0) {
      cub.estado = 'Disponible';
    }

    this.persist();
    return true;
  }

  // ==========================================
  // RECLAMACIONES / SOLICITUDES
  // ==========================================
  async getReclamacionesRaw() {
    return this.db.RECLAMACIONES || [];
  }

  async getReclamaciones(filter = {}) {
    let items = this.db.RECLAMACIONES || [];

    if (filter.email) {
      const e = filter.email.trim().toLowerCase();
      items = items.filter(r => (r.email || '').trim().toLowerCase() === e);
    }
    if (filter.user_id) {
      items = items.filter(r => r.user_id === filter.user_id);
    }
    if (filter.estado && filter.estado !== 'Todos') {
      items = items.filter(r => r.estado === filter.estado);
    }
    if (filter.cubiculo) {
      items = items.filter(r => (r.cubiculo || '').includes(filter.cubiculo));
    }

    // Orden descendente por código o fecha
    return items.slice().reverse();
  }

  async getReclamacionByCode(codigo) {
    return (this.db.RECLAMACIONES || []).find(r => r.codigo.toUpperCase() === codigo.toUpperCase());
  }

  async createReclamacion(data) {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });
    const hora = now.toLocaleTimeString('es-DO', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo'
    });

    const newRec = {
      codigo: data.codigo,
      fecha,
      hora,
      user_id: data.user_id || '',
      nombre: data.nombre || '',
      email: (data.email || '').trim().toLowerCase(),
      cubiculo: data.cubiculo,
      asunto: data.asunto,
      detalle: data.detalle,
      archivos: data.archivos || [], // URLs de fotos
      estado: data.estado || 'Recibida',
      responsable: data.responsable || 'Sin asignar',
      fecha_actualizacion: `${fecha} ${hora}`
    };

    if (!this.db.RECLAMACIONES) this.db.RECLAMACIONES = [];
    this.db.RECLAMACIONES.push(newRec);

    // Registrar en Historial
    const archivosEvidencia = (data.archivos_nombres && data.archivos_nombres.length > 0)
      ? data.archivos_nombres.join(', ')
      : (Array.isArray(newRec.archivos) && newRec.archivos.length > 0)
        ? newRec.archivos.map(a => typeof a === 'string' ? a.split('/').pop() : (a.name || 'foto')).join(', ')
        : '';

    await this.addHistorial({
      tipo_movimiento: archivosEvidencia ? 'SUBIR_ARCHIVO_SOLICITUD' : 'REGISTRO_SOLICITUD',
      tipo_documento: 'RECLAMACION',
      codigo_documento: newRec.codigo,
      usuario: `${newRec.nombre} (${newRec.email})`,
      cubiculo: newRec.cubiculo,
      archivo: archivosEvidencia,
      accion: archivosEvidencia ? 'Creación de Solicitud con Evidencias Adjuntas' : 'Creación de Solicitud',
      estado_anterior: '',
      estado_nuevo: newRec.estado,
      observacion: `Asunto: ${newRec.asunto} | Cubículo: ${newRec.cubiculo}${archivosEvidencia ? ' | Archivos: ' + archivosEvidencia : ''}`,
      ip: data.ip || ''
    });

    this.persist();

    if (this.googleBridge) {
      this.googleBridge.syncReclamacion(newRec).catch(err => console.error('[GoogleBridge Error]', err));
    }

    return newRec;
  }

  async updateReclamacion(codigo, updates, adminUser = 'Administración', ip = '') {
    const rec = (this.db.RECLAMACIONES || []).find(r => r.codigo.toUpperCase() === codigo.toUpperCase());
    if (!rec) return null;

    const oldEstado = rec.estado;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo' });
    const hora = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo' });

    Object.assign(rec, updates);
    rec.fecha_actualizacion = `${fecha} ${hora}`;

    // Registrar en Historial si cambió de estado o se agregó observación
    if (updates.estado && updates.estado !== oldEstado) {
      await this.addHistorial({
        tipo_movimiento: 'ACTUALIZACION_SOLICITUD',
        tipo_documento: 'RECLAMACION',
        codigo_documento: rec.codigo,
        usuario: adminUser,
        cubiculo: rec.cubiculo,
        archivo: Array.isArray(rec.archivos) ? rec.archivos.map(a => typeof a === 'string' ? a.split('/').pop() : (a.name || 'foto')).join(', ') : '',
        accion: 'Cambio de Estado de Solicitud',
        estado_anterior: oldEstado,
        estado_nuevo: updates.estado,
        observacion: updates.observacion || `Actualizado por ${adminUser}`,
        ip
      });
    } else if (updates.observacion) {
      await this.addHistorial({
        tipo_movimiento: 'ACTUALIZACION_SOLICITUD',
        tipo_documento: 'RECLAMACION',
        codigo_documento: rec.codigo,
        usuario: adminUser,
        cubiculo: rec.cubiculo,
        archivo: '',
        accion: 'Nota Administrativa en Solicitud',
        estado_anterior: oldEstado,
        estado_nuevo: rec.estado,
        observacion: updates.observacion,
        ip
      });
    }

    this.persist();

    if (this.googleBridge) {
      this.googleBridge.syncUpdateReclamacion(rec).catch(err => console.error('[GoogleBridge Error]', err));
    }

    return rec;
  }

  // ==========================================
  // PAGOS
  // ==========================================
  async getPagosRaw() {
    return this.db.PAGOS || [];
  }

  async getPagos(filter = {}) {
    let items = this.db.PAGOS || [];

    if (filter.email) {
      const e = filter.email.trim().toLowerCase();
      items = items.filter(p => (p.email || '').trim().toLowerCase() === e);
    }
    if (filter.user_id) {
      items = items.filter(p => p.user_id === filter.user_id);
    }
    if (filter.estado && filter.estado !== 'Todos') {
      items = items.filter(p => p.estado === filter.estado);
    }
    if (filter.cubiculo) {
      items = items.filter(p => (p.cubiculo || '').includes(filter.cubiculo));
    }

    return items.slice().reverse();
  }

  async getPagoByCode(codigo) {
    return (this.db.PAGOS || []).find(p => p.codigo.toUpperCase() === codigo.toUpperCase());
  }

  async createPago(data) {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });
    const hora = now.toLocaleTimeString('es-DO', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo'
    });

    const newPago = {
      codigo: data.codigo,
      fecha_registro: `${fecha} ${hora}`,
      user_id: data.user_id || '',
      nombre: data.nombre || '',
      email: (data.email || '').trim().toLowerCase(),
      cubiculo: data.cubiculo,
      concepto: data.concepto,
      periodo: data.periodo,
      monto: data.monto,
      fecha_pago: data.fecha_pago || fecha,
      referencia: data.referencia || '',
      voucher: data.voucher || '', // URL
      estado: data.estado || 'Reportado',
      observaciones: data.observaciones || ''
    };

    if (!this.db.PAGOS) this.db.PAGOS = [];
    this.db.PAGOS.push(newPago);

    // Historial
    const archivoVoucher = data.archivo_nombre || (newPago.voucher ? newPago.voucher.split('/').pop() : '');
    await this.addHistorial({
      tipo_movimiento: archivoVoucher ? 'SUBIR_ARCHIVO_PAGO' : 'REGISTRO_PAGO',
      tipo_documento: 'PAGO',
      codigo_documento: newPago.codigo,
      usuario: `${newPago.nombre} (${newPago.email})`,
      cubiculo: newPago.cubiculo,
      archivo: archivoVoucher,
      accion: archivoVoucher ? 'Reporte de Pago con Comprobante Adjunto' : 'Reporte de Pago',
      estado_anterior: '',
      estado_nuevo: newPago.estado,
      observacion: `Monto: RD$ ${newPago.monto} | Período: ${newPago.periodo} | Cubículo: ${newPago.cubiculo}${archivoVoucher ? ' | Archivo: ' + archivoVoucher : ''}`,
      ip: data.ip || ''
    });

    this.persist();

    if (this.googleBridge) {
      this.googleBridge.syncPago(newPago).catch(err => console.error('[GoogleBridge Error]', err));
    }

    return newPago;
  }

  async updatePago(codigo, updates, adminUser = 'Administración', ip = '') {
    const pago = (this.db.PAGOS || []).find(p => p.codigo.toUpperCase() === codigo.toUpperCase());
    if (!pago) return null;

    const oldEstado = pago.estado;
    Object.assign(pago, updates);

    if (updates.estado && updates.estado !== oldEstado) {
      await this.addHistorial({
        tipo_movimiento: 'EVALUACION_PAGO',
        tipo_documento: 'PAGO',
        codigo_documento: pago.codigo,
        usuario: adminUser,
        cubiculo: pago.cubiculo,
        archivo: pago.voucher ? pago.voucher.split('/').pop() : '',
        accion: 'Evaluación y Cambio de Estado de Pago',
        estado_anterior: oldEstado,
        estado_nuevo: updates.estado,
        observacion: updates.observaciones || `Estado modificado a ${updates.estado} por ${adminUser}`,
        ip
      });
    }

    this.persist();

    if (this.googleBridge) {
      this.googleBridge.syncUpdatePago(pago).catch(err => console.error('[GoogleBridge Error]', err));
    }

    return pago;
  }

  // ==========================================
  // HISTORIAL Y AUDITORÍA
  // ==========================================
  async getHistorial(filter = {}) {
    let items = this.db.HISTORIAL || [];

    if (filter.tipo_movimiento) {
      items = items.filter(h => h.tipo_movimiento === filter.tipo_movimiento);
    }
    if (filter.tipo_documento) {
      items = items.filter(h => h.tipo_documento === filter.tipo_documento);
    }
    if (filter.codigo_documento) {
      items = items.filter(h => (h.codigo_documento || '').toUpperCase() === filter.codigo_documento.toUpperCase());
    }
    if (filter.usuario) {
      items = items.filter(h => (h.usuario || '').toLowerCase().includes(filter.usuario.toLowerCase()));
    }
    if (filter.cubiculo) {
      items = items.filter(h => (h.cubiculo || '').toUpperCase().includes(filter.cubiculo.toUpperCase()));
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      items = items.filter(h => 
        (h.usuario || '').toLowerCase().includes(q) ||
        (h.codigo_documento || '').toLowerCase().includes(q) ||
        (h.cubiculo || '').toLowerCase().includes(q) ||
        (h.tipo_movimiento || '').toLowerCase().includes(q) ||
        (h.archivo || '').toLowerCase().includes(q) ||
        (h.accion || '').toLowerCase().includes(q) ||
        (h.observacion || '').toLowerCase().includes(q)
      );
    }

    return items.slice().reverse();
  }

  async addHistorial({ tipo_movimiento, tipo_documento, codigo_documento, usuario, cubiculo, archivo, accion, estado_anterior, estado_nuevo, observacion, ip }) {
    if (!this.db.HISTORIAL) this.db.HISTORIAL = [];

    const now = new Date();
    const fecha = now.toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });
    const hora = now.toLocaleTimeString('es-DO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo'
    });

    // Determinar categoría normalizada de movimiento si no se especifica
    let finalTipoMov = tipo_movimiento;
    if (!finalTipoMov) {
      if (archivo) {
        finalTipoMov = 'SUBIR_ARCHIVO';
      } else if (tipo_documento) {
        finalTipoMov = `${tipo_documento}_${(accion || 'ACCION').toUpperCase().replace(/\s+/g, '_')}`;
      } else {
        finalTipoMov = 'MOVIMIENTO_GENERAL';
      }
    }

    const entry = {
      id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tipo_movimiento: finalTipoMov,
      tipo_documento: tipo_documento || 'SISTEMA',
      codigo_documento: codigo_documento || 'N/A',
      fecha,
      hora,
      timestamp_iso: now.toISOString(),
      usuario: usuario || 'Sistema',
      cubiculo: cubiculo || '',
      archivo: archivo || '',
      accion: accion || 'Modificación',
      estado_anterior: estado_anterior || '',
      estado_nuevo: estado_nuevo || '',
      observacion: observacion || '',
      ip: ip || ''
    };

    this.db.HISTORIAL.push(entry);
    this.persist();

    // Sincronizar bitácora a Google Apps Script Bridge si está conectado
    if (this.googleBridge && typeof this.googleBridge.syncHistorial === 'function') {
      this.googleBridge.syncHistorial(entry).catch(err => console.error('[GoogleBridge Bitácora Error]', err));
    }

    return entry;
  }

  // ==========================================
  // KPIS PARA DASHBOARD ADMINISTRATIVO
  // ==========================================
  async getDashboardKPIs() {
    const cubiculos = this.db.CUBICULOS || [];
    const usuarios = this.db.USUARIOS || [];
    const reclamaciones = this.db.RECLAMACIONES || [];
    const pagos = this.db.PAGOS || [];

    const totalCubiculos = cubiculos.length;
    const cubiculosOcupados = cubiculos.filter(c => c.estado === 'Ocupado').length;
    const cubiculosDisponibles = cubiculos.filter(c => c.estado === 'Disponible').length;
    const cubiculosMantenimiento = cubiculos.filter(c => c.estado === 'Mantenimiento').length;

    const totalUsuarios = usuarios.length;
    const usuariosActivos = usuarios.filter(u => u.estado === 'Activo').length;
    const usuariosPendientes = usuarios.filter(u => u.estado === 'Pendiente de Aprobación' || u.estado === 'Pendiente').length;

    const reclAbiertas = reclamaciones.filter(r => ['Recibida', 'En revisión', 'Asignada', 'En proceso'].includes(r.estado)).length;
    const reclPendientes = reclamaciones.filter(r => r.estado === 'Pendiente de información').length;
    const reclResueltas = reclamaciones.filter(r => ['Resuelta', 'Cerrada'].includes(r.estado)).length;

    const pagosReportados = pagos.filter(p => p.estado === 'Reportado').length;
    const pagosPendientes = pagos.filter(p => ['En revisión', 'Pendiente de información'].includes(p.estado)).length;
    const pagosConfirmados = pagos.filter(p => p.estado === 'Confirmado').length;

    const tel = this.db.TELEMETRIA || {
      total_cargas: 0,
      cargas_moviles: 0,
      cargas_pwa: 0,
      dispositivos_unicos: []
    };

    return {
      cubiculos: {
        total: totalCubiculos,
        ocupados: cubiculosOcupados,
        disponibles: cubiculosDisponibles,
        mantenimiento: cubiculosMantenimiento
      },
      usuarios: {
        total: totalUsuarios,
        activos: usuariosActivos,
        pendientes: usuariosPendientes
      },
      reclamaciones: {
        total: reclamaciones.length,
        abiertas: reclAbiertas,
        pendientes: reclPendientes,
        resueltas: reclResueltas
      },
      pagos: {
        total: pagos.length,
        reportados: pagosReportados,
        pendientes: pagosPendientes,
        confirmados: pagosConfirmados
      },
      telemetria: {
        total_cargas: tel.total_cargas || 0,
        cargas_moviles: tel.cargas_moviles || 0,
        cargas_pwa: tel.cargas_pwa || 0,
        dispositivos_unicos: (tel.dispositivos_unicos || []).length
      }
    };
  }

  // ==========================================
  // TELEMETRÍA Y CONTADOR DE CARGAS DE LA APP
  // ==========================================
  async registrarCargaApp({ deviceId, isMobile, isPWA, tipoDispositivo, pantalla, usuario, cubiculo, ip }) {
    if (!this.db.TELEMETRIA) {
      this.db.TELEMETRIA = {
        total_cargas: 0,
        cargas_moviles: 0,
        cargas_escritorio: 0,
        cargas_pwa: 0,
        dispositivos_unicos: [],
        ultimas_cargas: []
      };
    }

    const tel = this.db.TELEMETRIA;
    tel.total_cargas = (tel.total_cargas || 0) + 1;

    if (isMobile) {
      tel.cargas_moviles = (tel.cargas_moviles || 0) + 1;
    } else {
      tel.cargas_escritorio = (tel.cargas_escritorio || 0) + 1;
    }

    if (isPWA) {
      tel.cargas_pwa = (tel.cargas_pwa || 0) + 1;
    }

    if (deviceId && !tel.dispositivos_unicos.includes(deviceId)) {
      tel.dispositivos_unicos.push(deviceId);
    }

    const now = new Date();
    const fecha = now.toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });
    const hora = now.toLocaleTimeString('es-DO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo'
    });

    const registro = {
      id: `CARGA-${Date.now()}`,
      fecha,
      hora,
      deviceId: deviceId || 'ANONIMO',
      dispositivo: tipoDispositivo || (isMobile ? 'Móvil' : 'Escritorio'),
      isMobile: Boolean(isMobile),
      isPWA: Boolean(isPWA),
      pantalla: pantalla || 'index.html',
      usuario: usuario || 'Visitante',
      cubiculo: cubiculo || 'N/A',
      ip: ip || ''
    };

    if (!Array.isArray(tel.ultimas_cargas)) {
      tel.ultimas_cargas = [];
    }
    tel.ultimas_cargas.unshift(registro);
    if (tel.ultimas_cargas.length > 200) {
      tel.ultimas_cargas.pop();
    }

    this.persist();
    return tel;
  }

  async getTelemetria() {
    if (!this.db.TELEMETRIA) {
      this.db.TELEMETRIA = {
        total_cargas: 0,
        cargas_moviles: 0,
        cargas_escritorio: 0,
        cargas_pwa: 0,
        dispositivos_unicos: [],
        ultimas_cargas: []
      };
    }
    const tel = this.db.TELEMETRIA;
    return {
      total_cargas: tel.total_cargas || 0,
      cargas_moviles: tel.cargas_moviles || 0,
      cargas_escritorio: tel.cargas_escritorio || 0,
      cargas_pwa: tel.cargas_pwa || 0,
      total_dispositivos_unicos: (tel.dispositivos_unicos || []).length,
      ultimas_cargas: (tel.ultimas_cargas || []).slice(0, 50)
    };
  }

  // ==========================================
  // NOVEDADES & AVISOS COMUNITARIOS
  // ==========================================
  async getNovedades() {
    if (!this.db.NOVEDADES) this.db.NOVEDADES = [];
    return this.db.NOVEDADES.slice().reverse();
  }

  async createNovedad({ titulo, categoria, fecha_evento, contenido, autor = 'Administración' }) {
    if (!this.db.NOVEDADES) this.db.NOVEDADES = [];

    const now = new Date();
    const fecha_publicacion = now.toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });

    const newNovedad = {
      id: `NOV-${Date.now()}`,
      titulo: titulo.trim(),
      categoria: categoria ? categoria.trim() : 'Aviso General',
      fecha_publicacion,
      fecha_evento: fecha_evento ? fecha_evento.trim() : '',
      contenido: contenido.trim(),
      autor: autor || 'Administración',
      fecha_iso: now.toISOString()
    };

    this.db.NOVEDADES.push(newNovedad);
    this.persist();

    await this.addHistorial({
      tipo_documento: 'NOVEDAD',
      codigo_documento: newNovedad.id,
      usuario: autor,
      accion: 'Publicación de Novedad',
      estado_anterior: '',
      estado_nuevo: 'Publicado',
      observacion: `Novedad: "${newNovedad.titulo}" [${newNovedad.categoria}]`
    });

    return newNovedad;
  }

  async deleteNovedad(id, adminName = 'Administración') {
    if (!this.db.NOVEDADES) return false;
    const idx = this.db.NOVEDADES.findIndex(n => n.id === id);
    if (idx === -1) return false;

    const removed = this.db.NOVEDADES.splice(idx, 1)[0];
    this.persist();

    await this.addHistorial({
      tipo_documento: 'NOVEDAD',
      codigo_documento: id,
      usuario: adminName,
      accion: 'Eliminación de Novedad',
      estado_anterior: 'Publicado',
      estado_nuevo: 'Eliminado',
      observacion: `Novedad eliminada: "${removed.titulo}"`
    });

    return true;
  }

  // ==========================================
  // MENSAJERÍA DIRECTA / BUZÓN DE INQUILINOS
  // ==========================================
  async getMensajesByUser(email, userId) {
    if (!this.db.MENSAJES) this.db.MENSAJES = [];
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    return this.db.MENSAJES.filter(m => {
      if (cleanEmail && m.email && m.email.trim().toLowerCase() === cleanEmail) return true;
      if (userId && m.user_id && m.user_id === userId) return true;
      return false;
    }).slice().reverse();
  }

  async getAllMensajesAdmin() {
    if (!this.db.MENSAJES) this.db.MENSAJES = [];
    return this.db.MENSAJES.slice().reverse();
  }

  async createMensaje({ user_id, email, cubiculo, asunto, contenido, autor = 'Administración', enviado_email = false }) {
    if (!this.db.MENSAJES) this.db.MENSAJES = [];

    const now = new Date();
    const fecha = now.toLocaleDateString('es-DO', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
    });
    const hora = now.toLocaleTimeString('es-DO', {
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo'
    });

    const newMensaje = {
      id: `MSG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: user_id || '',
      email: email ? email.trim().toLowerCase() : '',
      cubiculo: cubiculo || '',
      asunto: asunto.trim(),
      contenido: contenido.trim(),
      autor: autor || 'Consejo de Administración',
      fecha,
      hora,
      leido: false,
      fecha_leido: null,
      enviado_email: Boolean(enviado_email),
      fecha_iso: now.toISOString()
    };

    this.db.MENSAJES.push(newMensaje);
    this.persist();

    await this.addHistorial({
      tipo_documento: 'MENSAJE',
      codigo_documento: newMensaje.id,
      usuario: autor,
      accion: 'Envío de Mensaje a Inquilino',
      estado_anterior: '',
      estado_nuevo: 'Enviado',
      observacion: `Para: ${newMensaje.email} (${newMensaje.cubiculo || 'General'}) | Asunto: "${newMensaje.asunto}"`
    });

    return newMensaje;
  }

  async markMensajeLeido(id) {
    if (!this.db.MENSAJES) return null;
    const msg = this.db.MENSAJES.find(m => m.id === id);
    if (!msg) return null;

    if (!msg.leido) {
      const now = new Date();
      msg.leido = true;
      msg.fecha_leido = now.toISOString();
      msg.fecha_leido_fmt = now.toLocaleDateString('es-DO', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santo_Domingo'
      }) + ' ' + now.toLocaleTimeString('es-DO', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Santo_Domingo'
      });
      this.persist();

      await this.addHistorial({
        tipo_documento: 'MENSAJE',
        codigo_documento: msg.id,
        usuario: msg.email || 'Propietario / Ocupante',
        accion: 'Acuse de Lectura de Constancia',
        estado_anterior: 'No leído',
        estado_nuevo: 'Leído',
        observacion: `El destinatario abrió y leyó la constancia oficial el ${msg.fecha_leido_fmt}`
      });
    }

    return msg;
  }
}

module.exports = DataService;
