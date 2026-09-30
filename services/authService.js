// Servicio de autenticación sin contraseña mediante Magic Link y tokens de sesión
const crypto = require('crypto');

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
    const user = await this.dataService.getUsuarioByEmail(email);
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
   * Crea una sesión de usuario válida por 30 días
   */
  createSession(user) {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const sessionData = {
      userId: user.user_id,
      email: user.email,
      nombre: user.nombre,
      telefono: user.telefono,
      cubiculos: user.cubiculos || [],
      expiresAt
    };

    this.sessions.set(sessionToken, sessionData);

    return {
      sessionToken,
      user: sessionData
    };
  }

  /**
   * Valida un token de sesión enviado en encabezado Authorization
   */
  verifySession(sessionToken) {
    if (!sessionToken) return null;
    const session = this.sessions.get(sessionToken);
    if (!session) return null;

    if (Date.now() > session.expiresAt) {
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
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.dataService.getUsuarioByEmail(cleanEmail);

    if (!user) {
      return { success: false, error: 'No se encontró ningún usuario registrado con este correo electrónico.' };
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
    await this.dataService.updateUsuario(user.user_id, {
      password: cleanPwd,
      debe_cambiar_password: false,
      password_temporal: false,
      password_modificado: new Date().toISOString()
    }, `Validación Código Seguro [${user.email}]`);

    // Iniciar sesión automáticamente
    const session = this.createSession({
      ...user,
      cubiculos: await this.dataService.getCubiculosByUser(user.user_id)
    });

    return {
      success: true,
      message: '¡Contraseña actualizada exitosamente! Has iniciado sesión.',
      sessionToken: session.sessionToken,
      user: session.user
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
      return { success: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const cleanPwd = String(newPassword).trim();
    const updated = await this.dataService.updateUsuario(userId, {
      password: cleanPwd,
      debe_cambiar_password: false,
      password_temporal: false,
      password_modificado: new Date().toISOString()
    }, 'Inquilino (Cambio de Clave Temporal)');

    if (!updated) return { success: false, error: 'Usuario no encontrado.' };

    return {
      success: true,
      message: 'Contraseña definitiva establecida correctamente.'
    };
  }
}

module.exports = AuthService;
