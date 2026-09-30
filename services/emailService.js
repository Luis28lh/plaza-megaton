// Servicio de notificaciones por correo electrónico con identidad corporativa de Plaza Megatón
const nodemailer = require('nodemailer');

class EmailService {
  constructor(dataService) {
    this.dataService = dataService;
    this.transporter = null;
    this.isTestAccount = false;
  }

  async getTransporter() {
    if (this.transporter && !this.isTestAccount) return this.transporter;

    let user = process.env.SMTP_USER || 'plazamegaton2000@gmail.com';
    let pass = process.env.SMTP_PASS;

    // Fallback a configuración en DB si existe
    if (!pass && this.dataService) {
      const dbUser = await this.dataService.getConfigValue('smtp_user', '');
      const dbPass = await this.dataService.getConfigValue('smtp_pass', '');
      if (dbUser) user = dbUser;
      if (dbPass) pass = dbPass;
    }

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user.trim(),
          pass: pass.replace(/\s+/g, '') // Soporta formato "abcd efgh ijkl mnop"
        }
      });
      this.isTestAccount = false;
      console.log(`[EmailService] Conectado a Gmail Oficial: ${user}`);
      return this.transporter;
    }

    // Entorno de pruebas temporal hasta ingresar la contraseña de aplicación de Gmail
    console.log('[EmailService] Contraseña de aplicación pendiente. Generando buzón seguro de pruebas Ethereal...');
    const testAccount = await nodemailer.createTestAccount();
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    this.isTestAccount = true;
    console.log(`[EmailService] Buzón de pruebas listo: ${testAccount.user}`);
    return this.transporter;
  }

  /**
   * Genera el encabezado y pie corporativo HTML en rojo Plaza Megatón
   */
  wrapTemplate(title, bodyContent) {
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #1E293B; }
        .container { max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #E2E8F0; }
        .header { background: linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%); padding: 28px 24px; text-align: center; color: #FFFFFF; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; letter-spacing: 0.5px; }
        .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; color: #334155; }
        .badge-code { display: inline-block; background-color: #FEE2E2; color: #991B1B; font-weight: 700; font-size: 18px; padding: 8px 16px; border-radius: 8px; border: 1px solid #FECACA; margin: 12px 0; }
        .info-box { background-color: #F8FAFC; border-left: 4px solid #D32F2F; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 16px 0; }
        .info-box p { margin: 4px 0; font-size: 14px; }
        .btn-action { display: inline-block; background-color: #D32F2F; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 16px; }
        .footer { background-color: #F1F5F9; padding: 20px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PLAZA MEGATÓN</h1>
          <p>SISTEMA DE GESTIÓN INMOBILIARIA</p>
        </div>
        <div class="content">
          ${bodyContent}
        </div>
        <div class="footer">
          <p><strong>Administración Plaza Megatón</strong></p>
          <p>Av. Principal esq. Central, Santo Domingo, Rep. Dominicana · Tel: 809-555-0199</p>
          <p>Este es un correo automático generado por el Sistema de Gestión.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  async sendMail({ to, subject, html, text }) {
    try {
      const transporter = await this.getTransporter();
      const dbUser = await this.dataService.getConfigValue('smtp_user', '');
      const senderUser = process.env.SMTP_USER || dbUser || 'plazamegaton2000@gmail.com';

      const mailOptions = {
        from: `"Plaza Megatón — Administración" <${senderUser}>`,
        to,
        replyTo: senderUser,
        subject,
        text: text || `${subject} - Notificación del Sistema de Plaza Megatón. Visita https://megaton1026.vercel.app/ para más detalles.`,
        html,
        headers: {
          'X-Entity-Ref-ID': Date.now().toString(),
          'X-Auto-Response-Suppress': 'OOF, AutoReply'
        }
      };

      const info = await transporter.sendMail(mailOptions);
      let previewUrl = null;

      if (this.isTestAccount) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`\n======================================================`);
        console.log(`📧 [EMAIL DESPACHADO (Prueba Ethereal)]: ${subject}`);
        console.log(`Para: ${to}`);
        console.log(`🔗 Ver correo en el navegador: ${previewUrl}`);
        console.log(`======================================================\n`);
      } else {
        console.log(`📧 [EMAIL DESPACHADO]: "${subject}" a ${to} (ID: ${info.messageId})`);
      }

      return { success: true, messageId: info.messageId, previewUrl };
    } catch (err) {
      console.error('[EmailService ERROR]', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * 1. Correo automático de Bienvenida post-registro
   */
  async sendWelcomeEmail({ nombre, email, cubiculoCodigos, userId, portalUrl }) {
    const finalPortalUrl = portalUrl || 'https://megaton1026.vercel.app/';
    const cubiculosStr = Array.isArray(cubiculoCodigos)
      ? cubiculoCodigos.map(c => {
          if (typeof c === 'object' && c !== null) {
            const parts = [c.codigo];
            if (c.nombre) parts.push(`"${c.nombre}"`);
            if (c.actividad) parts.push(`(${c.actividad})`);
            return parts.join(' ');
          }
          return String(c);
        }).join(', ')
      : cubiculoCodigos;

    const subject = '🎉 ¡Felicitaciones! Te confirmamos como Miembro de Plaza Megatón';

    const htmlBody = `
      <div style="text-align: center; margin-bottom: 22px;">
        <span style="background: #FEE2E2; color: #991B1B; font-weight: 800; font-size: 12px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
          Confirmación Oficial de Membresía
        </span>
        <h2 style="font-size: 24px; font-weight: 900; color: #0F172A; margin: 12px 0 4px;">¡Felicitaciones, ${nombre}!</h2>
        <p style="font-size: 15px; color: #475569; margin: 0;">
          Te confirmamos y felicitamos oficialmente como <strong>Miembro de la Plaza Megatón</strong>.
        </p>
      </div>

      <div class="info-box" style="background: #FFF5F5; border-left: 4px solid #D32F2F; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase;">Código Oficial de Miembro:</p>
        <p style="margin: 0 0 12px; font-size: 22px; font-weight: 900; color: #D32F2F;">${userId || 'REGISTRADO'}</p>
        
        <p style="margin: 0 0 4px; font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase;">Cubículo(s) o Local(es) Vinculado(s):</p>
        <p style="margin: 0; font-size: 15px; font-weight: 800; color: #0F172A; line-height: 1.5;">${cubiculosStr}</p>
      </div>

      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Tus datos han sido registrados con éxito en nuestra base de datos. Como miembro oficial, tienes acceso a los siguientes servicios digitales:
      </p>
      <ul style="font-size: 14px; color: #334155; line-height: 1.8; padding-left: 20px;">
        <li><strong>Reportar solicitudes y reclamaciones:</strong> Con fotos de evidencia y seguimiento en tiempo real (código <code>CL-xxx</code>).</li>
        <li><strong>Registrar y conciliar pagos:</strong> Subiendo comprobantes bancarios o vouchers con confirmación oficial (código <code>PG-xxx</code>).</li>
        <li><strong>Historial transparente y permanente:</strong> Disponible 24/7 desde tu teléfono celular sin contraseñas difíciles.</li>
      </ul>

      <p style="font-size: 14px; color: #334155; margin-top: 18px;">
        ¡Enhorabuena por ser parte fundamental de la comunidad de Plaza Megatón! Puedes acceder a la plataforma principal en cualquier momento desde el siguiente enlace:
      </p>

      <!-- Botón de Acceso Directo a la Plataforma Principal -->
      <div style="text-align: center; margin: 26px 0;">
        <a href="${finalPortalUrl}" target="_blank" style="background: #D32F2F; color: #FFFFFF; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(211, 47, 47, 0.3);">
          👉 Entrar a la Plataforma Principal
        </a>
        <div style="margin-top: 8px; font-size: 12px; color: #64748B;">
          Enlace directo: <a href="${finalPortalUrl}" style="color: #D32F2F; word-break: break-all;">${finalPortalUrl}</a>
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">
        Atentamente,<br>
        <strong>Consejo de Administración — Plaza Megatón</strong>
      </div>
    `;

    const text = `¡Felicitaciones, ${nombre}!\n\nTe confirmamos y felicitamos oficialmente como Miembro de la Plaza Megatón.\n\nCódigo Oficial: ${userId || 'REGISTRADO'}\nCubículo(s) o Local(es) vinculado(s): ${cubiculosStr}\n\nTus datos han sido registrados en nuestro sistema inmobiliario.\n\nAccede a la plataforma principal en:\n${finalPortalUrl}\n\n¡Enhorabuena por formar parte de Plaza Megatón!\n\nAtentamente,\nConsejo de Administración — Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate(subject, htmlBody),
      text
    });
  }

  /**
   * 2. Correo automático de confirmación de Reclamación / Solicitud
   */
  async sendReclamacionReceivedEmail({ nombre, email, codigo, cubiculo, asunto }) {
    const subject = `Plaza Megatón – Solicitud ${codigo} recibida`;

    const htmlBody = `
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido correctamente tu solicitud en el sistema.</p>
      
      <div style="text-align: center; margin: 16px 0;">
        <span style="font-size: 13px; color: #64748B; text-transform: uppercase;">Número de seguimiento:</span><br>
        <div class="badge-code">${codigo}</div>
      </div>

      <div class="info-box">
        <p><strong>Cubículo:</strong> ${cubiculo}</p>
        <p><strong>Asunto:</strong> ${asunto}</p>
        <p><strong>Estado actual:</strong> <span style="color: #2563EB; font-weight: 600;">Recibida</span></p>
      </div>

      <p>Conserva este número para futuras consultas. La administración estará dando seguimiento oportuno a tu solicitud.</p>
      
      <p style="margin-top: 24px;">Atentamente,<br><strong>Administración Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\nHemos recibido correctamente tu solicitud.\n\nNúmero de seguimiento: ${codigo}\nCubículo: ${cubiculo}\nAsunto: ${asunto}\nEstado actual: Recibida\n\nLa administración estará dando seguimiento a tu solicitud.\n\nAdministración\nPlaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate(subject, htmlBody),
      text
    });
  }

  /**
   * 3. Correo de actualización de estado de Reclamación
   */
  async sendReclamacionStatusUpdatedEmail({ nombre, email, codigo, estado, observacion, responsable }) {
    const subject = `Plaza Megatón – Actualización de Solicitud ${codigo}: ${estado}`;

    const htmlBody = `
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Te informamos que tu solicitud <strong>${codigo}</strong> ha cambiado de estado.</p>
      
      <div class="info-box">
        <p><strong>Nuevo Estado:</strong> <span style="color: #D32F2F; font-weight: 700; font-size: 16px;">${estado}</span></p>
        ${responsable ? `<p><strong>Responsable asignado:</strong> ${responsable}</p>` : ''}
        ${observacion ? `<p><strong>Observación:</strong> ${observacion}</p>` : ''}
      </div>

      <p>Puedes consultar el historial completo desde la sección "Mis Solicitudes" en nuestra plataforma.</p>
      <p style="margin-top: 24px;">Atentamente,<br><strong>Administración Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\nTu solicitud ${codigo} ha sido actualizada a estado: ${estado}.\n${observacion ? `Observación: ${observacion}\n` : ''}\nAdministración Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate(subject, htmlBody),
      text
    });
  }

  /**
   * 4. Correo automático de confirmación de reporte de Pago
   */
  async sendPagoReceivedEmail({ nombre, email, codigo, cubiculo, concepto, periodo, monto }) {
    const subject = `Plaza Megatón – Pago ${codigo} reportado correctamente`;

    const htmlBody = `
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Hemos recibido el reporte de tu pago en la plataforma.</p>
      
      <div style="text-align: center; margin: 16px 0;">
        <span style="font-size: 13px; color: #64748B; text-transform: uppercase;">Código de pago:</span><br>
        <div class="badge-code">${codigo}</div>
      </div>

      <div class="info-box">
        <p><strong>Cubículo:</strong> ${cubiculo}</p>
        <p><strong>Concepto:</strong> ${concepto}</p>
        <p><strong>Período:</strong> ${periodo}</p>
        <p><strong>Monto:</strong> <span style="font-weight: 700; color: #15803D;">${monto}</span></p>
        <p><strong>Estado actual:</strong> Reportado</p>
      </div>

      <p>El comprobante adjunto será revisado y validado por la administración de Plaza Megatón a la brevedad posible.</p>
      <p style="margin-top: 24px;">Atentamente,<br><strong>Administración Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\nHemos recibido el reporte de tu pago.\n\nCódigo: ${codigo}\nCubículo: ${cubiculo}\nConcepto: ${concepto}\nPeríodo: ${periodo}\nMonto: ${monto}\nEstado: Reportado\n\nEl comprobante será revisado por la administración de Plaza Megatón.\n\nAdministración\nPlaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate(subject, htmlBody),
      text
    });
  }

  /**
   * 5. Correo de actualización de estado de Pago (Confirmado / Rechazado)
   */
  async sendPagoStatusUpdatedEmail({ nombre, email, codigo, estado, observacion, monto }) {
    const isApproved = estado === 'Confirmado';
    const subject = `Plaza Megatón – Pago ${codigo} ${estado}`;

    const htmlBody = `
      <p>Hola, <strong>${nombre}</strong>:</p>
      <p>Te notificamos que el pago con código <strong>${codigo}</strong> ha sido evaluado por la administración:</p>
      
      <div class="info-box" style="border-left-color: ${isApproved ? '#16A34A' : '#DC2626'};">
        <p><strong>Estado:</strong> <span style="color: ${isApproved ? '#16A34A' : '#DC2626'}; font-weight: 700; font-size: 16px;">${estado}</span></p>
        ${monto ? `<p><strong>Monto:</strong> ${monto}</p>` : ''}
        ${observacion ? `<p><strong>Detalle / Observaciones:</strong> ${observacion}</p>` : ''}
      </div>

      <p style="margin-top: 24px;">Atentamente,<br><strong>Administración Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\nEl pago ${codigo} ha sido actualizado a: ${estado}.\n${observacion ? `Observación: ${observacion}\n` : ''}\nAdministración Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate(subject, htmlBody),
      text
    });
  }

  /**
   * 6. Correo con Magic Link de acceso seguro
   */
  async sendMagicLinkEmail({ nombre, email, token, loginUrl }) {
    const subject = 'Plaza Megatón – Enlace seguro de acceso';

    const htmlBody = `
      <p>Hola, <strong>${nombre || 'Ocupante'}</strong>:</p>
      <p>Has solicitado ingresar al <strong>Sistema de Gestión de Plaza Megatón</strong>.</p>
      <p>Haz clic en el siguiente botón para acceder directamente a tu cuenta sin necesidad de contraseña:</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${loginUrl}" class="btn-action">Ingresar a mi cuenta</a>
      </div>

      <p style="font-size: 13px; color: #64748B;">Este enlace es personal y expira en 60 minutos. Si no solicitaste este acceso, puedes ignorar este mensaje.</p>
      <p style="margin-top: 24px;">Atentamente,<br><strong>Administración Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\nPara acceder al Sistema de Gestión de Plaza Megatón, haz clic en el siguiente enlace:\n${loginUrl}\n\nEste enlace expira en 60 minutos.\n\nAdministración Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate(subject, htmlBody),
      text
    });
  }

  /**
   * 7. Correo con Código de Seguridad para Restablecer Contraseña
   */
  async sendPasswordResetCodeEmail({ nombre, email, code }) {
    const subject = `🔐 Código de Seguridad [${code}] para Restablecer Contraseña — Plaza Megatón`;

    const htmlBody = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background: #FEE2E2; color: #991B1B; font-weight: 800; font-size: 11px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
          Protocolo de Seguridad Oficial
        </span>
        <h2 style="font-size: 22px; font-weight: 900; color: #0F172A; margin: 12px 0 4px;">Código de Verificación</h2>
        <p style="font-size: 14px; color: #475569; margin: 0;">
          Hola, <strong>${nombre || 'Estimado Inquilino'}</strong>. Hemos recibido tu solicitud para modificar o restablecer la contraseña de tu cuenta.
        </p>
      </div>

      <div style="background: #F8FAFC; border: 2px dashed #D32F2F; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0;">
        <p style="margin: 0 0 6px; font-size: 12px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Tu Código de Seguridad Oficial:</p>
        <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #D32F2F; margin: 6px 0; font-family: monospace;">${code}</div>
        <p style="margin: 6px 0 0; font-size: 12px; color: #94A3B8;">Código de un solo uso válido durante los próximos 15 minutos.</p>
      </div>

      <p style="font-size: 14px; color: #334155; line-height: 1.6;">
        Ingresa este código de 6 dígitos en la pantalla de acceso del portal web de Plaza Megatón. Con esta validación, el sistema confirmará que eres el titular legítimo del correo y te permitirá establecer tu nueva contraseña de forma inmediata.
      </p>

      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 6px; margin: 22px 0; font-size: 13px; color: #92400E; line-height: 1.5;">
        🛡️ <strong>Seguridad Anti-Suplantación:</strong> Ningún tercero puede acceder a tu cuenta ni cambiar tu contraseña sin tener acceso directo a este correo. Si no solicitaste este cambio, puedes ignorar este mensaje; tu cuenta permanecerá protegida.
      </div>

      <p style="margin-top: 24px;">Atentamente,<br><strong>Consejo de Administración — Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\nTu código de seguridad oficial para cambiar tu contraseña en Plaza Megatón es:\n\n[ ${code} ]\n\nEste código vence en 15 minutos. Ingrésalo en el portal web para definir tu nueva contraseña.\n\nAdministración Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate('Seguridad de Cuenta', htmlBody),
      text
    });
  }

  /**
   * 8. Correo Oficial de Aprobación de Cuenta y Habilitación de Acceso
   */
  async sendAccountApprovedEmail({ nombre, email, cubiculoCodigos, userId, portalUrl, adminName }) {
    const cubDisplay = Array.isArray(cubiculoCodigos) ? cubiculoCodigos.join(', ') : (cubiculoCodigos || 'Cubículo Oficial');
    const subject = `🎉 ¡Cuenta Aprobada! Tu acceso a Plaza Megatón ha sido habilitado [${cubDisplay}]`;

    const htmlBody = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background: #DCFCE7; color: #15803D; font-weight: 800; font-size: 11px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
          Validación Oficial Aprobada
        </span>
        <h2 style="font-size: 22px; font-weight: 900; color: #0F172A; margin: 12px 0 4px;">¡Bienvenido a Plaza Megatón!</h2>
        <p style="font-size: 14px; color: #475569; margin: 0;">
          Estimado(a) <strong>${nombre}</strong>, la Administración ha validado tu solicitud de registro con éxito.
        </p>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748B;"><strong>Titular:</strong></td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700; text-align: right;">${nombre}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;"><strong>Correo autorizado:</strong></td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700; text-align: right;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;"><strong>Cubículo(s) Asignado(s):</strong></td>
            <td style="padding: 6px 0; color: #D32F2F; font-weight: 800; text-align: right;">${cubDisplay}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;"><strong>Código de Usuario:</strong></td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 700; text-align: right;">${userId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;"><strong>Validado por:</strong></td>
            <td style="padding: 6px 0; color: #15803D; font-weight: 700; text-align: right;">${adminName || 'Consejo de Administración'}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${portalUrl}login.html" target="_blank" style="background: #D32F2F; color: #FFFFFF; font-weight: 800; font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(211,47,47,0.25);">
          🔑 Ingresar al Portal de Plaza Megatón
        </a>
      </div>

      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #78350F; line-height: 1.5;">
        📌 <strong>Instrucciones para tu primer ingreso:</strong><br>
        1. Ingresa a través del botón superior.<br>
        2. En la casilla de contraseña, utiliza tu mismo correo electrónico (<strong>${email}</strong>) como clave temporal.<br>
        3. El sistema te solicitará inmediatamente generar tu propio PIN o contraseña definitiva de acceso.
      </div>

      <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
        Desde tu portal podrás reportar pagos con comprobante bancario, dar seguimiento a solicitudes de mantenimiento y consultar el estado de tu cuenta en tiempo real.
      </p>

      <p style="margin-top: 24px;">Atentamente,<br><strong>Consejo de Administración — Plaza Megatón</strong></p>
    `;

    const text = `Hola, ${nombre}:\n\n¡Tu cuenta ha sido aprobada por la Administración de Plaza Megatón!\n\nCubículo(s) asignados: ${cubDisplay}\nUsuario: ${userId}\n\nIngresa al portal aquí: ${portalUrl}login.html\nPara tu primer ingreso, tu clave temporal es tu correo (${email}). Se te pedirá definir tu propia clave definitiva.\n\nAdministración Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate('Aprobación de Cuenta', htmlBody),
      text
    });
  }

  /**
   * 9. Correo de Mensaje Directo de la Administración al Inquilino
   */
  async sendDirectMessageEmail({ nombre, email, cubiculo, asunto, contenido, adminName, portalUrl }) {
    const finalPortalUrl = portalUrl || 'https://megaton1026.vercel.app/';
    const subject = `📬 Mensaje de la Administración — Plaza Megatón [${asunto}]`;

    const htmlBody = `
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background: #EFF6FF; color: #1D4ED8; font-weight: 800; font-size: 11px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
          Comunicación Directa
        </span>
        <h2 style="font-size: 20px; font-weight: 900; color: #0F172A; margin: 12px 0 4px;">Mensaje de la Administración</h2>
        <p style="font-size: 14px; color: #475569; margin: 0;">
          Estimado(a) <strong>${nombre || 'Ocupante'}</strong>${cubiculo ? ' · Cubículo <strong>' + cubiculo + '</strong>' : ''}:
        </p>
      </div>

      <div style="background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <div style="font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Asunto:</div>
        <div style="font-size: 16px; font-weight: 800; color: #0F172A; margin-bottom: 14px;">${asunto}</div>

        <div style="font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Mensaje:</div>
        <div style="font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-line; background: #FFFFFF; border: 1px solid #CBD5E1; padding: 14px; border-radius: 8px;">
          ${contenido}
        </div>
      </div>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${finalPortalUrl}novedades.html?tab=mensajes" target="_blank" style="background: #D32F2F; color: #FFFFFF; font-weight: 800; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
          📬 Abrir Buzón en la Plataforma
        </a>
      </div>

      <div style="background: #F1F5F9; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #64748B; line-height: 1.5; text-align: center;">
        💡 Este mensaje queda registrado permanentemente en tu buzón digital dentro de la app para tu tranquilidad y consulta 24/7.
      </div>

      <p style="margin-top: 24px; font-size: 13px; color: #475569;">
        Atentamente,<br>
        <strong>${adminName || 'Consejo de Administración'} — Plaza Megatón</strong>
      </p>
    `;

    const text = `Hola, ${nombre || 'Ocupante'}:\n\nHas recibido un mensaje directo de la Administración de Plaza Megatón.\n\nAsunto: ${asunto}\n\nMensaje:\n${contenido}\n\nPuedes consultar tu buzón digital en:\n${finalPortalUrl}novedades.html?tab=mensajes\n\nAtentamente,\n${adminName || 'Consejo de Administración'} Plaza Megatón`;

    return this.sendMail({
      to: email,
      subject,
      html: this.wrapTemplate('Mensaje Administrativo', htmlBody),
      text
    });
  }
}

module.exports = EmailService;
