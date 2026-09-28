// Servicio de autenticación sin contraseña mediante Magic Link y tokens de sesión
const crypto = require('crypto');

class AuthService {
  constructor(dataService, emailService) {
    this.dataService = dataService;
    this.emailService = emailService;
    // Mapas en memoria para tokens temporales
    this.magicTokens = new Map(); // token -> { email, expiresAt }
    this.sessions = new Map();    // sessionToken -> { userId, email, expiresAt }
  }

  /**
   * Genera y despacha un Magic Link al correo indicado
   */
  async requestMagicLink(email, reqBaseUrl = 'http://localhost:3007') {
    const user = await this.dataService.getUsuarioByEmail(email);
    if (!user) {
      return { success: false, error: 'No encontramos ningún usuario registrado con este correo electrónico.' };
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
}

module.exports = AuthService;
