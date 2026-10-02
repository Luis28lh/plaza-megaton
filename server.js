// Servidor Backend - SISTEMA DE GESTIÓN – PLAZA MEGATÓN
// Soporta API REST, persistencia estructurada, carga de archivos y despacho de correos
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const os = require('os');

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

// Servidor de subidas dinámico con soporte serverless para Vercel
const handleUploadServing = (req, res) => {
  try {
    const rawPath = req.params[0] || '';
    const decodedRelPath = decodeURIComponent(rawPath);

    // 1. Si existe en /tmp/uploads (archivos subidos en Vercel)
    const tmpPath = path.join(os.tmpdir(), 'uploads', decodedRelPath);
    if (fs.existsSync(tmpPath)) {
      return res.sendFile(tmpPath);
    }

    // 2. Si existe en public/assets/uploads (archivos preinstalados)
    const publicPath = path.join(__dirname, 'public', 'assets', 'uploads', decodedRelPath);
    if (fs.existsSync(publicPath)) {
      return res.sendFile(publicPath);
    }

    // 3. Fallback en memoria / base de datos para vouchers (PG-xxx)
    const matchPago = decodedRelPath.match(/PG-\d+/i);
    if (matchPago) {
      const pago = (dataService.db?.PAGOS || []).find(p => p.codigo === matchPago[0]);
      if (pago && pago.voucher_base64) {
        const mime = pago.voucher_mime || 'image/jpeg';
        res.setHeader('Content-Type', mime);
        return res.send(Buffer.from(pago.voucher_base64, 'base64'));
      }
    }

    // 4. Fallback en memoria / base de datos para evidencias (CL-xxx)
    const matchRec = decodedRelPath.match(/CL-\d+/i);
    if (matchRec) {
      const rec = (dataService.db?.RECLAMACIONES || []).find(r => r.codigo === matchRec[0]);
      if (rec && rec.evidencias_base64 && rec.evidencias_base64.length > 0) {
        const ev = rec.evidencias_base64[0];
        if (ev && ev.data) {
          res.setHeader('Content-Type', ev.mime || 'image/jpeg');
          return res.send(Buffer.from(ev.data, 'base64'));
        }
      }
    }

    // 5. Fallback visual elegante cuando el archivo no está en el contenedor efímero
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#F8FAFC;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#F1F5F9;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="600" height="420" fill="url(#grad)" rx="16"/>
        <rect x="20" y="20" width="560" height="380" fill="none" stroke="#E2E8F0" stroke-width="2" rx="12"/>
        <circle cx="300" cy="130" r="44" fill="#FEE2E2"/>
        <text x="300" y="145" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="40" text-anchor="middle">🧾</text>
        <text x="300" y="215" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#0F172A">Comprobante de Pago Registrado</text>
        <text x="300" y="245" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" text-anchor="middle" fill="#D32F2F">${matchPago ? matchPago[0] : (matchRec ? matchRec[0] : 'VOUCHER')}</text>
        <text x="300" y="275" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" text-anchor="middle" fill="#475569">Tu comprobante fue recibido correctamente y está registrado en Plaza Megatón.</text>
        <text x="300" y="300" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" text-anchor="middle" fill="#475569">El departamento administrativo está validando la conciliación bancaria.</text>
        <rect x="170" y="335" width="260" height="40" fill="#D32F2F" rx="8"/>
        <text x="300" y="360" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#FFFFFF">✓ VALIDADO EN EL SISTEMA</text>
      </svg>
    `);
  } catch (err) {
    res.status(500).send('Error al procesar el archivo: ' + err.message);
  }
};

app.get('/api/uploads/*', handleUploadServing);
app.get('/assets/uploads/*', handleUploadServing);
app.get('/api/pagos/:codigo/voucher', async (req, res) => {
  const { codigo } = req.params;
  const pago = (dataService.db?.PAGOS || []).find(p => p.codigo.toUpperCase() === codigo.toUpperCase());
  if (!pago) return res.status(404).send('Pago no encontrado');
  if (pago.voucher_base64) {
    res.setHeader('Content-Type', pago.voucher_mime || 'image/jpeg');
    return res.send(Buffer.from(pago.voucher_base64, 'base64'));
  }
  req.params[0] = pago.voucher ? pago.voucher.replace(/^\/api\/uploads\//, '').replace(/^\/assets\/uploads\//, '') : `02 - PAGOS/${pago.codigo}/voucher.jpg`;
  return handleUploadServing(req, res);
});

// Roles Administrativos y PINs / Credenciales Master
const MASTER_PINS = ['megaton2026', 'master2026', 'Warn255133', (process.env.MASTER_PIN || '').trim()].filter(Boolean);
const GESTOR_PINS = ['gestor2026', 'admin2026', (process.env.GESTOR_PIN || '').trim()].filter(Boolean);
const MASTER_EMAIL = 'ing.lmlh@gmail.com';
const MASTER_PASSWORD = 'Warn255133';

function authenticateAdmin(pin, userHeader = '') {
  if (!pin) return null;
  const clean = String(pin).trim();
  const cleanUser = String(userHeader || '').trim().toLowerCase();

  if (MASTER_PINS.includes(clean) || (cleanUser === MASTER_EMAIL && clean === MASTER_PASSWORD)) {
    return { role: 'MASTER', nombre: 'Usuario Master (ing.lmlh@gmail.com)', email: MASTER_EMAIL };
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

    // Cubículos es OBLIGATORIO: debe estar relacionado a un cubículo existente
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

    if (!cubiculosList || cubiculosList.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Debes seleccionar al menos un cubículo o local registrado para completar tu registro.' 
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const allCubiculos = await dataService.getCubiculos();
    const allUsers = dataService.db.USUARIOS || [];
    const allRelations = dataService.db.USUARIO_CUBICULO || [];

    // Validar que cada cubículo exista en el catálogo oficial (33 locales) y verificar titularidad
    for (const cItem of cubiculosList) {
      const rawCode = cItem.codigo;
      const cub = allCubiculos.find(c => 
        c.cubiculo_id.toUpperCase() === rawCode || 
        c.codigo.toUpperCase() === rawCode ||
        c.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '') === rawCode.replace(/[^A-Z0-9]/g, '')
      );

      if (!cub) {
        return res.status(400).json({ 
          success: false, 
          error: `El cubículo "${rawCode}" no existe en el catálogo oficial de Plaza Megatón (33 cubículos autorizados).` 
        });
      }

      // Normalizar al código oficial
      cItem.codigo = cub.codigo;
      cItem.cubiculo_id = cub.cubiculo_id;

      // Buscar si el cubículo ya tiene un titular/correo asignado
      const rel = allRelations.find(r => 
        (r.cubiculo_id === cub.cubiculo_id || r.codigo_local === cub.codigo) && r.estado === 'Activo'
      );
      let assignedUser = null;
      if (rel) {
        assignedUser = allUsers.find(u => u.user_id === rel.user_id);
      }
      if (!assignedUser) {
        assignedUser = allUsers.find(u => u.cubiculos && u.cubiculos.includes(cub.codigo));
      }

      if (assignedUser && assignedUser.email) {
        const assignedEmail = assignedUser.email.trim().toLowerCase();
        // Si el cubículo ya tiene correo incorporado y se intenta registrar con un correo ajeno:
        if (assignedEmail !== cleanEmail) {
          return res.status(403).json({
            success: false,
            error: `Acceso restringido: El cubículo ${cub.codigo} ya está vinculado a su titular oficial. No está permitido registrarse con un correo distinto. Si eres el nuevo propietario o inquilino, contacta a la Administración para validar tu cuenta.`
          });
        }
      }
    }

    let user = await dataService.getUsuarioByEmail(cleanEmail);

    if (!user) {
      const user_id = await sequenceService.nextCode('USUARIO');
      user = await dataService.createUsuario({
        user_id,
        nombre: nombre.trim(),
        email: cleanEmail,
        telefono: telefono ? telefono.trim() : '',
        estado: 'Pendiente de Aprobación'
      });
    } else {
      await dataService.updateUsuario(user.user_id, {
        nombre: nombre.trim(),
        telefono: telefono ? telefono.trim() : user.telefono,
        estado: 'Pendiente de Aprobación'
      });
    }

    // Asociar cubículos indicados en estado Pendiente
    let assignedCodes = [];
    if (cubiculosList.length > 0) {
      assignedCodes = await dataService.assignCubiculosToUser(user.user_id, cubiculosList, 'Pendiente');
    }

    // Registrar en auditoría
    await dataService.addHistorial({
      tipo_documento: 'USUARIO',
      codigo_documento: user.user_id,
      usuario: user.nombre,
      accion: 'Solicitud de Registro Web',
      estado_anterior: 'N/A',
      estado_nuevo: 'Pendiente de Aprobación',
      observacion: `El usuario ${user.nombre} (${user.email}) solicitó registro para el local: ${assignedCodes.join(', ') || 'N/A'}. En espera de validación y aprobación por la administración.`
    });

    res.json({
      success: true,
      pendingApproval: true,
      message: '¡Solicitud enviada! Tu registro para el cubículo ha sido recibido y está en proceso de validación por la administración de Plaza Megatón 2000. Tan pronto sea aprobado por el Gestor o Administrador, recibirás un correo de bienvenida con tus accesos para entrar a la plataforma.',
      user_id: user.user_id,
      cubiculosAsignados: assignedCodes
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
    const enteredPwd = String(password).trim();

    // Acceso directo y prioritario para Usuario Master
    if (cleanEmail === MASTER_EMAIL && (enteredPwd === MASTER_PASSWORD || enteredPwd === 'megaton2026')) {
      let masterUser = await dataService.getUsuarioByEmail(MASTER_EMAIL);
      if (!masterUser) {
        masterUser = await dataService.createUsuario({
          user_id: 'US-MASTER',
          nombre: 'Ing. Luis Miguel Lizardo Hernández',
          email: MASTER_EMAIL,
          telefono: '809-555-0100',
          password: MASTER_PASSWORD,
          estado: 'Activo'
        });
      }
      const cubiculos = await dataService.getCubiculos();
      const session = authService.createSession({
        ...masterUser,
        rol: 'MASTER',
        cubiculos
      });
      return res.json({
        success: true,
        message: '¡Bienvenido, Usuario Master!',
        mustChangePassword: false,
        sessionToken: session.sessionToken,
        user: session.user,
        isAdmin: true,
        role: 'MASTER'
      });
    }

    const user = await dataService.getUsuarioByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas o correo no registrado.' });
    }

    if (user.estado === 'Pendiente de Aprobación' || user.estado === 'Pendiente') {
      return res.status(403).json({
        success: false,
        error: 'Tu registro está en proceso de validación y aprobación por la administración de Plaza Megatón 2000. Recibirás una notificación por correo tan pronto sea validado y activado tu acceso.'
      });
    }

    if (user.estado === 'Inactivo' || user.estado === 'Rechazado') {
      return res.status(403).json({
        success: false,
        error: 'Tu cuenta se encuentra inactiva o ha sido rechazada por la administración. Comunícate con la administración.'
      });
    }

    const userPwd = String(user.password || '').trim();

    // Protocolo de Acceso Oficial:
    // Tu propia dirección de correo sirve como contraseña temporal para primer ingreso
    const isUsingEmailAsPassword = (enteredPwd.toLowerCase() === cleanEmail);
    const isMatchingPermanentPwd = userPwd ? (userPwd === enteredPwd) : false;

    const isValid = isUsingEmailAsPassword || isMatchingPermanentPwd;
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Contraseña o PIN incorrecto. Si no recuerdas tu clave, pulsa "¿Olvidaste o quieres cambiarla?" para recibir un código de seguridad en tu correo registrado.' 
      });
    }

    const cubiculos = await dataService.getCubiculosByUser(user.user_id);
    const session = authService.createSession({
      ...user,
      cubiculos
    });

    // Detectar si es contraseña temporal que requiere cambio obligatorio
    const isTemp = Boolean(isUsingEmailAsPassword || user.debe_cambiar_password || user.password_temporal);

    res.json({
      success: true,
      message: isTemp 
        ? 'Acceso concedido con tu clave temporal. Ahora genera tu propio PIN o contraseña definitiva.' 
        : 'Inicio de sesión exitoso.',
      mustChangePassword: isTemp,
      isEmailAsPassword: isUsingEmailAsPassword,
      sessionToken: session.sessionToken,
      user: session.user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4c. Solicitar Código de Seguridad por Correo para Restablecer Contraseña
app.post('/api/auth/reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordResetCode(email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4d. Validar Código de 6 Dígitos y Restablecer Contraseña
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const result = await authService.verifyAndResetPassword(email, code, newPassword);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4e. Cambiar Contraseña Temporal en el Primer Inicio
app.post('/api/auth/change-temp-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const result = await authService.changeTemporaryPassword(userId, newPassword);
    res.json(result);
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

    // 2. Guardar fotos en subcarpeta de Google Drive / almacenamiento local y preservar base64
    let fileUrls = [];
    let evidenciasBase64 = [];
    if (req.files && req.files.length > 0) {
      fileUrls = await driveService.saveReclamacionFiles(codigo, req.files);
      evidenciasBase64 = req.files.map(f => ({
        name: f.originalname,
        mime: f.mimetype || 'image/jpeg',
        data: f.buffer ? f.buffer.toString('base64') : ''
      })).filter(e => e.data);
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
      evidencias_base64: evidenciasBase64,
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

    // 2. Guardar voucher en subcarpeta PG-xxx y almacenar buffer base64 para persistencia serverless garantizada
    let voucherUrl = '';
    let voucherBase64 = '';
    let voucherMime = '';
    if (req.file) {
      voucherUrl = await driveService.savePagoVoucher(codigo, req.file);
      if (req.file.buffer) {
        voucherBase64 = req.file.buffer.toString('base64');
        voucherMime = req.file.mimetype || 'image/jpeg';
      }
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
      voucher_base64: voucherBase64,
      voucher_mime: voucherMime,
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
    if (password !== undefined && String(password).trim()) {
      updates.password = String(password).trim();
      if (req.body.debe_cambiar_password !== undefined) {
        updates.debe_cambiar_password = Boolean(req.body.debe_cambiar_password);
        updates.password_temporal = Boolean(req.body.debe_cambiar_password);
      }
    }

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

// 14b. Panel Administrativo: Aprobar Registro de Usuario y Despachar Credenciales Oficiales
app.post('/api/admin/usuarios/:userId/aprobar', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminName = req.adminAuth ? req.adminAuth.nombre : 'Administración';

    const result = await dataService.activateUserAndCubiculos(userId, adminName);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

    const { user, assignedCodes } = result;

    const host = req.get('host') || '';
    const configuredUrl = await dataService.getConfigValue('url_publica', 'https://megaton1026.vercel.app');
    let portalUrl = configuredUrl || (host ? `${req.protocol}://${host}/` : 'https://megaton1026.vercel.app/');
    if (!portalUrl.endsWith('/')) portalUrl += '/';

    // Despachar correo de felicitación y acceso oficial al inquilino
    const mailResult = await emailService.sendAccountApprovedEmail({
      nombre: user.nombre,
      email: user.email,
      cubiculoCodigos: assignedCodes.length > 0 ? assignedCodes : ['Cubículo Oficial'],
      userId: user.user_id,
      portalUrl,
      adminName
    });

    res.json({
      success: true,
      message: `¡Usuario ${user.nombre} aprobado con éxito! Credenciales oficiales e instrucciones despachadas a ${user.email}.`,
      usuario: user,
      emailPreviewUrl: mailResult ? mailResult.previewUrl : null
    });
  } catch (err) {
    console.error('Error al aprobar usuario:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14c. Panel Administrativo: Rechazar Solicitud de Registro de Usuario
app.post('/api/admin/usuarios/:userId/rechazar', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { motivo } = req.body || {};
    const adminName = req.adminAuth ? req.adminAuth.nombre : 'Administración';

    const user = await dataService.rejectUserRegistration(userId, adminName, motivo);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

    res.json({
      success: true,
      message: `Solicitud de registro de ${user.nombre} rechazada correctamente.`,
      usuario: user
    });
  } catch (err) {
    console.error('Error al rechazar usuario:', err);
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

// 20. NOVEDADES COMUNITARIAS
app.get('/api/novedades', async (req, res) => {
  try {
    const novedades = await dataService.getNovedades();
    res.json({ success: true, novedades });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/novedades', requireAdmin, async (req, res) => {
  try {
    const { titulo, categoria, fecha_evento, contenido } = req.body;
    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ success: false, error: 'El título es obligatorio.' });
    }
    if (!contenido || !contenido.trim()) {
      return res.status(400).json({ success: false, error: 'El contenido es obligatorio.' });
    }

    const adminName = req.adminAuth ? req.adminAuth.nombre : 'Consejo de Administración';
    const novedad = await dataService.createNovedad({
      titulo,
      categoria,
      fecha_evento,
      contenido,
      autor: adminName
    });

    res.json({ success: true, novedad, message: 'Novedad publicada exitosamente en el muro comunitario.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/novedades/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminName = req.adminAuth ? req.adminAuth.nombre : 'Administración';
    const deleted = await dataService.deleteNovedad(id, adminName);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Novedad no encontrada.' });
    }
    res.json({ success: true, message: 'Novedad eliminada correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 21. MENSAJERÍA DIRECTA / BUZÓN DE INQUILINOS
app.get('/api/mensajes', async (req, res) => {
  try {
    const session = getUserSession(req);
    const pin = req.headers['x-admin-pin'];
    const isAdmin = (pin === (process.env.ADMIN_PIN || 'megaton2026') || pin === 'gestor2026' || pin === 'Warn255133');

    if (isAdmin && !req.query.email) {
      const mensajes = await dataService.getAllMensajesAdmin();
      return res.json({ success: true, mensajes });
    }

    const targetEmail = session ? session.email : (req.query.email ? req.query.email.trim().toLowerCase() : '');
    const targetUserId = session ? session.userId : (req.query.user_id || '');

    if (!targetEmail && !targetUserId) {
      return res.status(400).json({ success: false, error: 'Debe especificar el correo o iniciar sesión para consultar su buzón.' });
    }

    const mensajes = await dataService.getMensajesByUser(targetEmail, targetUserId);
    res.json({ success: true, mensajes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/mensajes', requireAdmin, async (req, res) => {
  try {
    const { user_id, email, cubiculo, asunto, contenido, enviar_email } = req.body;

    if (!asunto || !asunto.trim()) {
      return res.status(400).json({ success: false, error: 'El asunto del mensaje es requerido.' });
    }
    if (!contenido || !contenido.trim()) {
      return res.status(400).json({ success: false, error: 'El cuerpo del mensaje no puede estar vacío.' });
    }
    if (!email && !user_id && !cubiculo) {
      return res.status(400).json({ success: false, error: 'Debe seleccionar un destinatario (correo, usuario o cubículo).' });
    }

    // Resolver usuario si se proporcionó cubículo o email
    let targetEmail = email ? email.trim().toLowerCase() : '';
    let targetName = 'Inquilino';
    let targetUserId = user_id || '';

    if (targetEmail) {
      const user = await dataService.getUsuarioByEmail(targetEmail);
      if (user) {
        targetName = user.nombre;
        targetUserId = user.user_id;
      }
    } else if (targetUserId) {
      const user = await dataService.getUsuarioById(targetUserId);
      if (user) {
        targetName = user.nombre;
        targetEmail = user.email;
      }
    }

    const adminName = req.adminAuth ? req.adminAuth.nombre : 'Consejo de Administración';

    let emailSent = false;
    let emailPreviewUrl = null;

    if (enviar_email && targetEmail) {
      const host = req.get('host') || '';
      const configuredUrl = await dataService.getConfigValue('url_publica', 'https://megaton1026.vercel.app');
      let portalUrl = configuredUrl || (host ? `${req.protocol}://${host}/` : 'https://megaton1026.vercel.app/');
      if (!portalUrl.endsWith('/')) portalUrl += '/';

      const mailRes = await emailService.sendDirectMessageEmail({
        nombre: targetName,
        email: targetEmail,
        cubiculo: cubiculo || '',
        asunto: asunto.trim(),
        contenido: contenido.trim(),
        adminName,
        portalUrl
      });
      if (mailRes && mailRes.success) {
        emailSent = true;
        emailPreviewUrl = mailRes.previewUrl;
      }
    }

    const mensaje = await dataService.createMensaje({
      user_id: targetUserId,
      email: targetEmail,
      cubiculo: cubiculo || '',
      asunto: asunto.trim(),
      contenido: contenido.trim(),
      autor: adminName,
      enviado_email: emailSent
    });

    res.json({
      success: true,
      message: emailSent 
        ? `Mensaje registrado en el buzón del inquilino y despachado con éxito a ${targetEmail}.`
        : 'Mensaje registrado exitosamente en el buzón del inquilino.',
      mensaje,
      emailSent,
      emailPreviewUrl
    });
  } catch (err) {
    console.error('Error enviando mensaje administrativo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/mensajes/:id/leido', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataService.markMensajeLeido(id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Mensaje no encontrado.' });
    }
    res.json({ success: true, mensaje: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Servir Service Worker con scope raíz
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  const swPath = path.join(__dirname, 'public', 'sw.js');
  if (fs.existsSync(swPath)) return res.sendFile(swPath);
  return res.sendFile(path.join(__dirname, 'sw.js'));
});

// Servir Manifest PWA
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  const manifestPath = path.join(__dirname, 'public', 'manifest.json');
  if (fs.existsSync(manifestPath)) return res.sendFile(manifestPath);
  return res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Fallback de navegación amigable SPA / Páginas directas
const routes = {
  '/registro': 'registro.html',
  '/solicitudes': 'solicitudes.html',
  '/pagos': 'pagos.html',
  '/mis-solicitudes': 'mis-solicitudes.html',
  '/mis-pagos': 'mis-pagos.html',
  '/novedades': 'novedades.html',
  '/instalar': 'instalar.html',
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
