// Servicio de autenticación sin contraseña mediante Magic Link y tokens de sesión
const crypto = require('crypto');
const SESSION_SECRET = process.env.SESSION_SECRET || 'plaza-megaton-2026-auth-persistent-secret-key-prod';

class AuthService {
  constructor(dataService, emailService) {
    this.dataService = dataService;
    this.emailService = emailService;
    // Mapas en memoria para tokens temporales
    this.magicTokens = new Map(); // token -> { email, expiresAt }
    this.sessions = new Map();    // sessionToken -> { userId, email, expiresAt }
    this.resetCodes = new Map();  // email -> { code, expiresAt, attempts }
  }

  /**
   * Genera y despacha un Magic Link al correo indicado
   */
  async requestMagicLink(email, reqBaseUrl = 'http://localhost:3007') {
    if (!email) return { success: false, error: 'Ingresa un correo electrónico.' };
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, error: 'Solamente puedes ingresar con tu correo electrónico registrado.' };
    }
    if (!cleanEmail.endsWith('.com')) {
      return { success: false, error: 'El correo electrónico debe terminar obligatoriamente en .com (ejemplo: usuario@dominio.com).' };
    }
    const user = await this.dataService.getUsuarioByEmail(cleanEmail);
    if (!user) {
      return { success: false, error: 'No encontramos ningún usuario registrado con este correo electrónico.' };
    }

    if (user.estado === 'Pendiente de Aprobación' || user.estado === 'Pendiente') {
      return {
        success: false,
        error: 'Tu registro está en proceso de validación y aprobación por la administración de Plaza Megatón 2000. Recibirás una notificación por correo tan pronto sea validado y activado tu acceso.'
      };
    }

    if (user.estado === 'Inactivo' || user.estado === 'Rechazado') {
      return {
        success: false,
        error: 'Tu cuenta se encuentra inactiva o ha sido rechazada por la administración. Comunícate con la administración para más información.'
      };
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hora de validez

    this.magicTokens.set(token, { email: user.email, expiresAt });

    const loginUrl = `${reqBaseUrl}/login.html?token=${token}`;

    const mailRes = await this.emailService.sendMagicLinkEmail({
      nombre: user.nombre,
      email: user.email,
      token,
      loginUrl
    });

    return {
      success: true,
      previewUrl: mailRes.previewUrl,
      message: 'Enlace de acceso enviado a tu correo.'
    };
  }

  /**
   * Valida un token de Magic Link y emite una sesión duradera
   */
  async verifyMagicToken(token) {
    if (!token) return null;
    const entry = this.magicTokens.get(token);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.magicTokens.delete(token);
      return null;
    }

    // Token consumido (un solo uso)
    this.magicTokens.delete(token);

    const user = await this.dataService.getUsuarioByEmail(entry.email);
    if (!user) return null;

    return this.createSession(user);
  }

  /**
   * Crea una sesión de usuario permanente (válida por 365 días) con token firmado criptográfico (stateless)
   * Esto garantiza que los ocupantes permanezcan dentro de la app aún cuando se realicen actualizaciones o reinicios de servidor.
   */
  createSession(user) {
    const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 año de permanencia

    const sessionData = {
      userId: user.user_id || user.userId,
      email: user.email,
      nombre: user.nombre,
      telefono: user.telefono || '',
      cubiculos: user.cubiculos || [],
      isAdmin: Boolean(user.isAdmin),
      role: user.role || 'USER',
      hasPin: Boolean(user.pin || user.hasPin),
      mustChangePassword: Boolean(user.debe_cambiar_password),
      expiresAt
    };

    // Generar token criptográfico firmado HMAC-SHA256 (stateless)
    const payloadB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    const sessionToken = `${payloadB64}.${signature}`;

    this.sessions.set(sessionToken, sessionData);

    return {
      sessionToken,
      user: sessionData
    };
  }

  /**
   * Valida un token de sesión enviado en encabezado Authorization
   * Soporta tanto tokens firmados stateless (resistentes a despliegues y lambdas) como tokens en memoria.
   */
  verifySession(sessionToken) {
    if (!sessionToken || typeof sessionToken !== 'string') return null;

    // 1. Verificación stateless criptográfica de alta persistencia
    if (sessionToken.includes('.')) {
      const parts = sessionToken.split('.');
      if (parts.length === 2) {
        const [payloadB64, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
        if (signature === expectedSig) {
          try {
            const data = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
            if (data && (!data.expiresAt || Date.now() <= data.expiresAt)) {
              return data;
            }
          } catch (_) {}
        }
      }
    }

    // 2. Fallback a mapa en memoria (tokens tradicionales)
    const session = this.sessions.get(sessionToken);
    if (!session) return null;

    if (session.expiresAt && Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return session;
  }

  /**
   * Genera un código numérico seguro de 6 dígitos y lo envía por correo al inquilino
   */
  async requestPasswordResetCode(email) {
    if (!email) return { success: false, error: 'Ingresa un correo electrónico.' };
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, error: 'Solamente puedes utilizar tu correo electrónico registrado.' };
    }
    if (!cleanEmail.endsWith('.com')) {
      return { success: false, error: 'El correo electrónico debe terminar obligatoriamente en .com (ejemplo: usuario@dominio.com).' };
    }
    const user = await this.dataService.getUsuarioByEmail(cleanEmail);

    if (!user) {
      return { success: false, error: 'Este correo no está registrado en la tabla oficial de usuarios autorizados de Plaza Megatón 2000.' };
    }

    if (user.estado === 'Pendiente de Aprobación' || user.estado === 'Pendiente') {
      return {
        success: false,
        error: 'Tu cuenta está en proceso de validación y aprobación por la administración de Plaza Megatón 2000. Recibirás una notificación por correo tan pronto sea validado y activado tu acceso.'
      };
    }

    if (user.estado === 'Inactivo' || user.estado === 'Rechazado') {
      return {
        success: false,
        error: 'Tu cuenta se encuentra inactiva o ha sido rechazada por la administración.'
      };
    }

    // Código numérico seguro de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos de vigencia

    this.resetCodes.set(cleanEmail, {
      code,
      expiresAt,
      attempts: 0
    });

    const mailRes = await this.emailService.sendPasswordResetCodeEmail({
      nombre: user.nombre,
      email: user.email,
      code
    });

    return {
      success: true,
      message: 'Código de seguridad enviado con éxito a tu correo electrónico.',
      previewUrl: mailRes.previewUrl
    };
  }

  /**
   * Valida el código de 6 dígitos numéricos recibido por correo y actualiza la contraseña
   */
  async verifyAndResetPassword(email, code, newPassword) {
    if (!email || !code || !newPassword) {
      return { success: false, error: 'Correo, código y nueva contraseña son obligatorios.' };
    }

    if (String(newPassword).trim().length < 4) {
      return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const entry = this.resetCodes.get(cleanEmail);

    if (!entry) {
      return { success: false, error: 'No se ha solicitado ningún código para este correo o ya fue utilizado.' };
    }

    if (Date.now() > entry.expiresAt) {
      this.resetCodes.delete(cleanEmail);
      return { success: false, error: 'El código de seguridad ha expirado. Solicita uno nuevo.' };
    }

    if (entry.attempts >= 5) {
      this.resetCodes.delete(cleanEmail);
      return { success: false, error: 'Has superado el límite de intentos permitidos. Solicita un nuevo código.' };
    }

    if (entry.code !== String(code).trim()) {
      entry.attempts += 1;
      return { success: false, error: `Código incorrecto. Te quedan ${5 - entry.attempts} intentos.` };
    }

    // Código verificado exitosamente (de un solo uso)
    this.resetCodes.delete(cleanEmail);

    const user = await this.dataService.getUsuarioByEmail(cleanEmail);
    if (!user) {
      return { success: false, error: 'Usuario no encontrado.' };
    }

    const cleanPwd = String(newPassword).trim();
    const is4Digits = /^\d{4}$/.test(cleanPwd);
    const updateData = {
      password: cleanPwd,
      debe_cambiar_password: false,
      password_temporal: false,
      password_modificado: new Date().toISOString()
    };
    if (is4Digits) {
      updateData.pin = cleanPwd;
      updateData.pin_configurado = true;
    }

    await this.dataService.updateUsuario(user.user_id, updateData, `Validación Código Seguro [${user.email}]`);

    // Iniciar sesión automáticamente
    const session = this.createSession({
      ...user,
      ...updateData,
      cubiculos: await this.dataService.getCubiculosByUser(user.user_id)
    });

    return {
      success: true,
      message: '¡Contraseña actualizada exitosamente! Has iniciado sesión.',
      sessionToken: session.sessionToken,
      user: {
        ...session.user,
        mustChangePassword: false,
        isTempPassword: false,
        needsPinSetup: false,
        hasPin: Boolean(is4Digits || user.pin)
      }
    };
  }

  /**
   * Modifica la contraseña temporal obligatoria en el primer inicio de sesión
   */
  async changeTemporaryPassword(userId, newPassword) {
    if (!userId || !newPassword) {
      return { success: false, error: 'Usuario y nueva contraseña requeridos.' };
    }
    if (String(newPassword).trim().length < 4) {
      return { success: false, error: 'La contraseña o PIN debe tener al menos 4 caracteres.' };
    }

    const cleanPwd = String(newPassword).trim();
    const is4Digits = /^\d{4}$/.test(cleanPwd);
    const updateData = {
      password: cleanPwd,
      debe_cambiar_password: false,
      password_temporal: false,
      password_modificado: new Date().toISOString()
    };
    if (is4Digits) {
      updateData.pin = cleanPwd;
      updateData.pin_configurado = true;
    }

    const updated = await this.dataService.updateUsuario(userId, updateData, 'Inquilino (Cambio de Clave Temporal)');

    if (!updated) return { success: false, error: 'Usuario no encontrado.' };

    return {
      success: true,
      message: 'Contraseña definitiva establecida correctamente.'
    };
  }

  /**
   * Configura los 4 dígitos de PIN personal solicitados automáticamente al ingresar con clave temporal
   */
  async setUserPin(userId, pin) {
    if (!userId || !pin) {
      return { success: false, error: 'Usuario y PIN requeridos.' };
    }
    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return { success: false, error: 'El PIN debe ser exactamente de 4 dígitos numéricos (ej. 1234).' };
    }

    const updated = await this.dataService.updateUsuario(userId, {
      pin: cleanPin,
      password: cleanPin,
      debe_cambiar_password: false,
      password_temporal: false,
      pin_configurado: true,
      password_modificado: new Date().toISOString()
    }, 'Inquilino (Configuración PIN 4 Dígitos)');

    if (!updated) return { success: false, error: 'Usuario no encontrado.' };

    return {
      success: true,
      message: '¡Acceso configurado correctamente!',
      pin: cleanPin
    };
  }
}

module.exports = AuthService;
