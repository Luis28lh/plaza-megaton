// Servidor Backend - SISTEMA DE GESTIÓN – PLAZA MEGATÓN
// Soporta API REST, persistencia estructurada, carga de archivos y despacho de correos
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const DataService = require('./services/dataService');
const SequenceService = require('./services/sequenceService');
const GoogleDriveService = require('./services/googleDriveService');
const EmailService = require('./services/emailService');
const AuthService = require('./services/authService');
const GoogleAppsScriptBridge = require('./services/googleAppsScriptBridge');

const app = express();
const PORT = process.env.PORT || 3007;

// Instanciar servicios
const dataService = new DataService();
const sequenceService = new SequenceService(dataService);
const driveService = new GoogleDriveService();
const emailService = new EmailService(dataService);
const authService = new AuthService(dataService, emailService);

const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz3Ke4jrxn_cmQ8EC--_K-FbCfYIRdCAIVtplW6pKWclTukaG1tYLIWmdBgaBPf5tzSWA/exec';
const activeGoogleUrl = process.env.GOOGLE_APPS_SCRIPT_URL || 
  dataService.db?.CONFIGURACION?.find(c => c.parametro === 'google_apps_script_url')?.valor || 
  DEFAULT_GOOGLE_SCRIPT_URL;

if (activeGoogleUrl) {
  const bridge = new GoogleAppsScriptBridge(activeGoogleUrl);
  dataService.setGoogleBridge(bridge);
}

// Configurar multer para carga temporal en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB max
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets/uploads', express.static(path.join(__dirname, 'public', 'assets', 'uploads')));

// Roles Administrativos y PINs
const MASTER_PINS = ['megaton2026', 'master2026', (process.env.MASTER_PIN || '').trim()].filter(Boolean);
const GESTOR_PINS = ['gestor2026', 'admin2026', (process.env.GESTOR_PIN || '').trim()].filter(Boolean);

function authenticateAdmin(pin) {
  if (!pin) return null;
  const clean = String(pin).trim();
  if (MASTER_PINS.includes(clean)) {
    return { role: 'MASTER', nombre: 'Usuario Master (Super Admin)' };
  }
  if (GESTOR_PINS.includes(clean)) {
    return { role: 'GESTOR', nombre: 'Usuario Gestor (Administrador Operativo)' };
  }
  return null;
}

// Helper de autenticación administrativa (Permite Master y Gestor)
function requireAdmin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.admin_pin;
  const auth = authenticateAdmin(pin);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Acceso no autorizado al panel administrativo. Ingrese un PIN válido.' });
  }
  req.adminAuth = auth;
  next();
}

// Helper exclusivo para Usuario Master (Super Admin con acceso a Configuración e Historial)
function requireMaster(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.admin_pin;
  const auth = authenticateAdmin(pin);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Acceso no autorizado al panel administrativo.' });
  }
  if (auth.role !== 'MASTER') {
    return res.status(403).json({ 
      success: false, 
      error: 'Acceso restringido: Esta acción o módulo está reservado exclusivamente para el Usuario Master.' 
    });
  }
  req.adminAuth = auth;
  next();
}

// Helper para obtener usuario en sesión (opcional o requerido)
function getUserSession(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return authService.verifySession(token);
}

// ==========================================
// RUTAS DE LA API
// ==========================================

// 1. Catálogo de cubículos
app.get('/api/catalog/cubiculos', async (req, res) => {
  try {
    const cubiculos = await dataService.getCubiculos();
    res.json({ success: true, cubiculos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Registro de Usuario (desde QR o web)
app.post('/api/usuarios/registro', async (req, res) => {
  try {
    const { nombre, email, telefono, cubiculos } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre completo es obligatorio.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Debe ingresar un correo electrónico válido.' });
    }

    // Cubículos es opcional: puede ser array de strings o de objetos { codigo, nombre, actividad }
    let cubiculosList = [];
    if (Array.isArray(cubiculos)) {
      cubiculosList = cubiculos.map(c => {
        if (typeof c === 'object' && c !== null) {
          const cod = String(c.codigo || '').trim().toUpperCase();
          const nom = String(c.nombre || c.nombre_local || '').trim();
          const act = String(c.actividad || c.actividad_comercial || '').trim();
          return cod ? { codigo: cod, nombre: nom, actividad: act } : null;
        } else if (c && String(c).trim()) {
          return { codigo: String(c).trim().toUpperCase(), nombre: '', actividad: '' };
        }
        return null;
      }).filter(Boolean);
    } else if (cubiculos && String(cubiculos).trim()) {
      cubiculosList = [{ codigo: String(cubiculos).trim().toUpperCase(), nombre: '', actividad: '' }];
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await dataService.getUsuarioByEmail(cleanEmail);

    if (!user) {
      const user_id = await sequenceService.nextCode('USUARIO');
      user = await dataService.createUsuario({
        user_id,
        nombre: nombre.trim(),
        email: cleanEmail,
        telefono: telefono ? telefono.trim() : '',
        estado: 'Activo'
      });
    } else {
      await dataService.updateUsuario(user.user_id, {
        nombre: nombre.trim(),
        telefono: telefono ? telefono.trim() : user.telefono
      });
    }

    // Asociar cubículos indicados (si colocó alguno)
    let assignedCodes = [];
    if (cubiculosList.length > 0) {
      assignedCodes = await dataService.assignCubiculosToUser(user.user_id, cubiculosList);
    }

    const host = req.get('host') || '';
    const configuredUrl = await dataService.getConfigValue('url_publica', 'https://megaton1026.vercel.app');
    const portalUrl = configuredUrl || (host ? `${req.protocol}://${host}/` : 'https://megaton1026.vercel.app/');

    // Despachar correo de felicitación y confirmación oficial de membresía
    const mailResult = await emailService.sendWelcomeEmail({
      nombre: user.nombre,
      email: user.email,
      cubiculoCodigos: assignedCodes.length > 0 ? assignedCodes : ['Pendiente de asignar'],
      userId: user.user_id,
      portalUrl
    });

    // Crear sesión automática para que el usuario navegue sin trabas
    const session = authService.createSession({
      ...user,
      cubiculos: await dataService.getCubiculosByUser(user.user_id)
    });

    res.json({
      success: true,
      message: '¡Registro completado! Gracias por confirmar tus datos.',
      user_id: user.user_id,
      cubiculosAsignados: assignedCodes,
      sessionToken: session.sessionToken,
      user: session.user,
      emailPreviewUrl: mailResult.previewUrl
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Autenticación Magic Link
app.post('/api/auth/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Correo requerido.' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await authService.requestMagicLink(email.trim().toLowerCase(), baseUrl);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Verificación de token Magic Link
app.get('/api/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;
    const session = await authService.verifyMagicToken(token);
    if (!session) {
      return res.status(400).json({ success: false, error: 'Enlace inválido o expirado. Solicita uno nuevo.' });
    }
    res.json({ success: true, ...session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. Inicio de Sesión de Inquilino / Ocupante con Contraseña o PIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Debes ingresar tu correo y contraseña.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await dataService.getUsuarioByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({ success: false, error: 'No se encontró ningún usuario registrado con este correo.' });
    }

    const enteredPwd = String(password).trim();
    const userPwd = String(user.password || '').trim();

    // Validar contraseña asignada por admin, o por defecto '123456' / PIN temporal
    const isValid = userPwd ? (userPwd === enteredPwd) : (enteredPwd === '123456' || enteredPwd === 'megaton2026');
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Contraseña o PIN incorrecto. Si no la recuerdas, solicita un enlace a tu correo o contacta al Administrador Gestor.' });
    }

    const cubiculos = await dataService.getCubiculosByUser(user.user_id);
    const session = authService.createSession({
      ...user,
      cubiculos
    });

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      sessionToken: session.sessionToken,
      user: session.user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 5. Datos del usuario autenticado
app.get('/api/auth/me', async (req, res) => {
  const session = getUserSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'No autenticado.' });
  }

  const user = await dataService.getUsuarioByEmail(session.email);
  if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });

  res.json({ success: true, user });
});

// 6. Solicitudes / Reclamaciones (Listar)
app.get('/api/reclamaciones', async (req, res) => {
  try {
    const session = getUserSession(req);
    const filter = {};

    // Si no es admin y viene con token, limitar a su propio correo
    const pin = req.headers['x-admin-pin'];
    if (pin === (process.env.ADMIN_PIN || 'megaton2026')) {
      if (req.query.estado) filter.estado = req.query.estado;
      if (req.query.cubiculo) filter.cubiculo = req.query.cubiculo;
    } else if (session) {
      filter.email = session.email;
    } else if (req.query.email) {
      filter.email = req.query.email;
    }

    const items = await dataService.getReclamaciones(filter);
    res.json({ success: true, reclamaciones: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Crear Solicitud / Reclamación (con fotos)
app.post('/api/reclamaciones', upload.array('fotos', 6), async (req, res) => {
  try {
    const { nombre, email, cubiculo, asunto, detalle } = req.body;

    if (!nombre || !nombre.trim()) return res.status(400).json({ success: false, error: 'El nombre es obligatorio.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, error: 'El correo es obligatorio.' });
    if (!cubiculo || !cubiculo.trim()) return res.status(400).json({ success: false, error: 'Debe especificar el cubículo.' });
    if (!asunto || !asunto.trim()) return res.status(400).json({ success: false, error: 'Debe seleccionar un asunto.' });
    if (!detalle || !detalle.trim()) return res.status(400).json({ success: false, error: 'Debe detallar la situación.' });

    // 1. Generar código consecutivo e inviolable (CL-001, CL-002, ...)
    const codigo = await sequenceService.nextCode('RECLAMACION');

    // 2. Guardar fotos en subcarpeta de Google Drive / almacenamiento local
    let fileUrls = [];
    if (req.files && req.files.length > 0) {
      fileUrls = await driveService.saveReclamacionFiles(codigo, req.files);
    }

    // Buscar si existe usuario para ligar user_id
    const user = await dataService.getUsuarioByEmail(email.trim().toLowerCase());

    // 3. Crear registro
    const reclamacion = await dataService.createReclamacion({
      codigo,
      user_id: user ? user.user_id : '',
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      cubiculo: cubiculo.trim(),
      asunto: asunto.trim(),
      detalle: detalle.trim(),
      archivos: fileUrls,
      estado: 'Recibida',
      responsable: 'Administración'
    });

    // 4. Enviar correo automático de confirmación
    const mailResult = await emailService.sendReclamacionReceivedEmail({
      nombre: reclamacion.nombre,
      email: reclamacion.email,
      codigo: reclamacion.codigo,
      cubiculo: reclamacion.cubiculo,
      asunto: reclamacion.asunto
    });

    res.json({
      success: true,
      message: 'Solicitud registrada correctamente',
      codigo,
      reclamacion,
      emailPreviewUrl: mailResult.previewUrl
    });
  } catch (err) {
    console.error('Error al registrar reclamación:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Actualizar Reclamación (Administración)
app.patch('/api/reclamaciones/:codigo', requireAdmin, async (req, res) => {
  try {
    const { codigo } = req.params;
    const { estado, responsable, observacion, adminUser } = req.body;

    const updated = await dataService.updateReclamacion(codigo, {
      estado,
      responsable,
      observacion
    }, adminUser || 'Administración');

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Reclamación no encontrada.' });
    }

    // Notificar al usuario por correo del cambio
    if (estado || observacion) {
      await emailService.sendReclamacionStatusUpdatedEmail({
        nombre: updated.nombre,
        email: updated.email,
        codigo: updated.codigo,
        estado: updated.estado,
        observacion: observacion || '',
        responsable: updated.responsable
      });
    }

    res.json({ success: true, reclamacion: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Pagos (Listar)
app.get('/api/pagos', async (req, res) => {
  try {
    const session = getUserSession(req);
    const filter = {};

    const pin = req.headers['x-admin-pin'];
    if (pin === (process.env.ADMIN_PIN || 'megaton2026')) {
      if (req.query.estado) filter.estado = req.query.estado;
      if (req.query.cubiculo) filter.cubiculo = req.query.cubiculo;
    } else if (session) {
      filter.email = session.email;
    } else if (req.query.email) {
      filter.email = req.query.email;
    }

    const items = await dataService.getPagos(filter);
    res.json({ success: true, pagos: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Reportar Pago (con comprobante/voucher)
app.post('/api/pagos', upload.single('voucher'), async (req, res) => {
  try {
    const { nombre, email, cubiculo, concepto, periodo, monto, fecha_pago, referencia } = req.body;

    if (!nombre || !nombre.trim()) return res.status(400).json({ success: false, error: 'El nombre es obligatorio.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, error: 'El correo es obligatorio.' });
    if (!cubiculo || !cubiculo.trim()) return res.status(400).json({ success: false, error: 'Debe seleccionar un cubículo.' });
    if (!concepto || !concepto.trim()) return res.status(400).json({ success: false, error: 'El concepto de pago es requerido.' });
    if (!monto || !monto.trim()) return res.status(400).json({ success: false, error: 'El monto es obligatorio.' });

    // 1. Generar código consecutivo e inviolable (PG-001, PG-002, ...)
    const codigo = await sequenceService.nextCode('PAGO');

    // 2. Guardar voucher en subcarpeta PG-xxx
    let voucherUrl = '';
    if (req.file) {
      voucherUrl = await driveService.savePagoVoucher(codigo, req.file);
    }

    const user = await dataService.getUsuarioByEmail(email.trim().toLowerCase());

    // 3. Crear registro
    const pago = await dataService.createPago({
      codigo,
      user_id: user ? user.user_id : '',
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      cubiculo: cubiculo.trim(),
      concepto: concepto.trim(),
      periodo: periodo ? periodo.trim() : 'Actual',
      monto: monto.trim(),
      fecha_pago: fecha_pago ? fecha_pago.trim() : '',
      referencia: referencia ? referencia.trim() : '',
      voucher: voucherUrl,
      estado: 'Reportado'
    });

    // 4. Enviar correo de confirmación
    const mailResult = await emailService.sendPagoReceivedEmail({
      nombre: pago.nombre,
      email: pago.email,
      codigo: pago.codigo,
      cubiculo: pago.cubiculo,
      concepto: pago.concepto,
      periodo: pago.periodo,
      monto: pago.monto
    });

    res.json({
      success: true,
      message: 'Pago reportado correctamente',
      codigo,
      pago,
      emailPreviewUrl: mailResult.previewUrl
    });
  } catch (err) {
    console.error('Error al registrar pago:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Actualizar Pago (Administración: Confirmar, Rechazar, etc.)
app.patch('/api/pagos/:codigo', requireAdmin, async (req, res) => {
  try {
    const { codigo } = req.params;
    const { estado, observaciones, adminUser } = req.body;

    const updated = await dataService.updatePago(codigo, {
      estado,
      observaciones
    }, adminUser || 'Administración');

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Pago no encontrado.' });
    }

    // Notificar al usuario por correo si se confirmó o rechazó
    if (['Confirmado', 'Rechazado', 'Pendiente de información'].includes(estado)) {
      await emailService.sendPagoStatusUpdatedEmail({
        nombre: updated.nombre,
        email: updated.email,
        codigo: updated.codigo,
        estado: updated.estado,
        observacion: observaciones || '',
        monto: updated.monto
      });
    }

    res.json({ success: true, pago: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Panel Administrativo: KPIs del Dashboard
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const kpis = await dataService.getDashboardKPIs();
    res.json({ 
      success: true, 
      kpis,
      role: req.adminAuth ? req.adminAuth.role : 'GESTOR',
      roleName: req.adminAuth ? req.adminAuth.nombre : 'Usuario Gestor'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Panel Administrativo: Listar Usuarios
app.get('/api/admin/usuarios', requireAdmin, async (req, res) => {
  try {
    const usuarios = await dataService.getUsuarios();
    res.json({ success: true, usuarios });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Panel Administrativo: Modificar Usuario (cambiar contraseña, asignar/quitar cubículos o activar/desactivar)
app.patch('/api/admin/usuarios/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { estado, nombre, telefono, password, agregarCubiculo, quitarCubiculo } = req.body;
    const adminName = req.adminAuth ? req.adminAuth.nombre : 'Administración';

    const updates = {};
    if (estado !== undefined) updates.estado = estado;
    if (nombre !== undefined) updates.nombre = nombre;
    if (telefono !== undefined) updates.telefono = telefono;
    if (password !== undefined && String(password).trim()) updates.password = String(password).trim();

    if (Object.keys(updates).length > 0) {
      await dataService.updateUsuario(userId, updates, adminName);
    }

    if (agregarCubiculo) {
      await dataService.assignCubiculosToUser(userId, [agregarCubiculo]);
    }

    if (quitarCubiculo) {
      await dataService.removeCubiculoFromUser(userId, quitarCubiculo);
    }

    const updatedUser = await dataService.getUsuarioById(userId);
    res.json({ success: true, usuario: updatedUser, message: 'Usuario actualizado correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Panel Administrativo: Historial y Auditoría (Solo Usuario Master)
app.get('/api/admin/historial', requireMaster, async (req, res) => {
  try {
    const filter = {};
    if (req.query.tipo) filter.tipo_documento = req.query.tipo;
    if (req.query.codigo) filter.codigo_documento = req.query.codigo;

    const historial = await dataService.getHistorial(filter);
    res.json({ success: true, historial });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Panel Administrativo: Configuración (Solo Usuario Master)
app.get('/api/admin/config', requireMaster, async (req, res) => {
  try {
    const config = await dataService.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/config', requireMaster, async (req, res) => {
  try {
    const { parametro, valor } = req.body;
    if (!parametro) return res.status(400).json({ success: false, error: 'Parámetro requerido.' });

    await dataService.setConfigValue(parametro, valor);
    res.json({ success: true, message: 'Configuración actualizada.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Información para Código QR de Registro
app.get('/api/qr/info', async (req, res) => {
  try {
    const configuredUrl = await dataService.getConfigValue('url_publica', `http://localhost:${PORT}`);
    const host = req.get('host');
    const protocol = req.protocol;
    const currentBase = `${protocol}://${host}`;
    const targetUrl = `${configuredUrl || currentBase}/registro.html`;

    res.json({
      success: true,
      targetUrl,
      title: 'REGISTRO PLAZA MEGATÓN'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17b. Presupuesto Oficial Período 2026
app.get('/api/admin/presupuesto', requireAdmin, async (req, res) => {
  const data = await dataService.getPresupuesto();
  res.json({ success: true, presupuesto: data });
});

// 17c. Catálogo Detallado de Cubículos / Locales
app.get('/api/admin/cubiculos', requireAdmin, async (req, res) => {
  const data = await dataService.getCubiculos();
  res.json({ success: true, cubiculos: data });
});

// 18. Google Apps Script / Google Drive Test de Conexión
app.post('/api/admin/google/test', async (req, res) => {
  const pin = req.headers['x-admin-pin'];
  if (pin !== process.env.ADMIN_PIN && pin !== 'megaton2026') {
    return res.status(401).json({ success: false, error: 'PIN no autorizado.' });
  }

  const { scriptUrl } = req.body;
  const targetUrl = scriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'URL de Google Apps Script no especificada.' });
  }

  try {
    const bridge = new GoogleAppsScriptBridge(targetUrl);
    const result = await bridge.sendRequest('TEST_CONNECTION', {});
    if (result && result.success) {
      await dataService.setConfigValue('google_apps_script_url', targetUrl);
      dataService.setGoogleBridge(bridge);
      return res.json({ success: true, ...result });
    }
    return res.status(400).json({ success: false, error: 'El script de Google no devolvió confirmación.', details: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 19. Sincronización masiva a Google Sheets y Google Drive
app.post('/api/admin/google/sync-all', async (req, res) => {
  const pin = req.headers['x-admin-pin'];
  if (pin !== process.env.ADMIN_PIN && pin !== 'megaton2026') {
    return res.status(401).json({ success: false, error: 'PIN no autorizado.' });
  }

  if (!dataService.googleBridge || !dataService.googleBridge.isEnabled()) {
    return res.status(400).json({ success: false, error: 'Conexión con Google Apps Script no configurada.' });
  }

  try {
    const usuarios = await dataService.getUsuarios();
    const reclamaciones = await dataService.getReclamaciones();
    const pagos = await dataService.getPagos();

    for (const u of usuarios) {
      await dataService.googleBridge.syncUsuario(u);
    }
    for (const r of reclamaciones) {
      await dataService.googleBridge.syncReclamacion(r);
    }
    for (const p of pagos) {
      await dataService.googleBridge.syncPago(p);
    }

    res.json({
      success: true,
      message: `¡Sincronización completada! ${usuarios.length} usuarios, ${reclamaciones.length} reclamaciones y ${pagos.length} pagos sincronizados en Google Drive.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback de navegación amigable SPA / Páginas directas
const routes = {
  '/registro': 'registro.html',
  '/solicitudes': 'solicitudes.html',
  '/pagos': 'pagos.html',
  '/mis-solicitudes': 'mis-solicitudes.html',
  '/mis-pagos': 'mis-pagos.html',
  '/login': 'login.html',
  '/admin': 'admin.html'
};

for (const [route, file] of Object.entries(routes)) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
}

// Iniciar servidor local si se ejecuta directamente (no en Vercel serverless)
if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 [PLAZA MEGATÓN] Sistema de Gestión Inmobiliaria`);
    console.log(`📡 Servidor activo en: http://localhost:${PORT}`);
    console.log(`📱 Formulario QR directo: http://localhost:${PORT}/registro.html`);
    console.log(`💼 Portal Administrativo: http://localhost:${PORT}/admin.html`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
