// Controlador de Acceso Seguro, Protocolo de Contraseña Temporal y Código de Verificación - Plaza Megatón

let pendingSession = null;
let targetResetEmail = '';

// Navegación entre pasos
function hideAllSteps() {
  const steps = ['login-form-step', 'reset-request-step', 'reset-verify-step', 'temp-password-step', 'login-sent-step', 'token-verifying-box'];
  steps.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = 'none';
  });
}

function showLoginStep(e) {
  if (e) e.preventDefault();
  hideAllSteps();
  const el = document.getElementById('login-form-step');
  if (el) el.style.display = 'block';
}

function showResetStep(e) {
  if (e) e.preventDefault();
  hideAllSteps();
  const el = document.getElementById('reset-request-step');
  if (el) el.style.display = 'block';
  const loginEmail = document.getElementById('login-email');
  const resetEmail = document.getElementById('reset-email');
  if (loginEmail && resetEmail && loginEmail.value.trim()) {
    resetEmail.value = loginEmail.value.trim();
  }
}

function showVerifyStep(email, previewUrl = null) {
  hideAllSteps();
  targetResetEmail = email;
  const el = document.getElementById('reset-verify-step');
  if (el) el.style.display = 'block';
  const display = document.getElementById('reset-target-email-display');
  if (display) display.innerText = email;

  const preview = document.getElementById('reset-preview-container');
  if (preview) {
    if (previewUrl) {
      preview.innerHTML = `
        <div style="background:#F8FAFC; border:1px dashed #CBD5E1; padding:12px; border-radius:8px; font-size:12px; margin-bottom:14px;">
          🔗 <strong>Buzón de pruebas Ethereal (Código detectado):</strong><br>
          <a href="${previewUrl}" target="_blank" style="color:#D32F2F; font-weight:700;">Abrir correo con el código de 6 dígitos</a>
        </div>
      `;
    } else {
      preview.innerHTML = '';
    }
  }
}

function showTempPasswordStep(user, sessionToken, isEmailAsPassword = false) {
  hideAllSteps();
  pendingSession = { user, sessionToken };
  const el = document.getElementById('temp-password-step');
  if (el) el.style.display = 'block';

  const subtitle = document.getElementById('temp-password-subtitle');
  if (subtitle && user && user.nombre) {
    subtitle.innerText = `¡Hola, ${user.nombre}! Genera tu PIN o contraseña definitiva`;
  }
}

// 1. Inicio de Sesión
async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('btn-submit-login');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  const cleanEmail = email.toLowerCase();

  if (!cleanEmail.includes('@')) {
    App.showToast('Solamente puedes ingresar con tu correo electrónico. No se admiten números de cubículo ni otros identificadores.', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  if (!cleanEmail.endsWith('.com')) {
    App.showToast('El correo electrónico debe terminar obligatoriamente en .com (ejemplo: usuario@dominio.com).', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  // Si no ingresó contraseña, enviar automáticamente enlace de acceso al correo
  if (!password) {
    return handleSendMagicLink();
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Verificando credenciales...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok && data.success && data.user) {
      App.setSession(data.user, data.sessionToken);
      App.showToast(data.message || `¡Bienvenido(a), ${data.user.nombre}!`, 'success');
      setTimeout(() => {
        window.location.href = 'mis-solicitudes.html';
      }, 500);
      return;
    } else {
      App.showToast(data.error || 'Contraseña o correo incorrecto.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🔑 Iniciar Sesión';
    }
  } catch (err) {
    console.warn('Fallo de conexión API:', err);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🔑 Iniciar Sesión';
    App.showToast('Error de conexión con el servidor.', 'error');
  }
}

// 2. Solicitar Código de 6 Dígitos al Correo
async function handleRequestResetCode(event) {
  event.preventDefault();
  const emailInput = document.getElementById('reset-email');
  const email = emailInput ? emailInput.value.trim() : '';
  const submitBtn = document.getElementById('btn-send-reset-code');

  const cleanEmail = email.toLowerCase();

  if (!cleanEmail.includes('@')) {
    App.showToast('Solamente puedes utilizar tu correo electrónico registrado.', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  if (!cleanEmail.endsWith('.com')) {
    App.showToast('El correo electrónico debe terminar obligatoriamente en .com (ejemplo: usuario@dominio.com).', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Generando y enviando código...';

  try {
    const res = await fetch('/api/auth/reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      App.showToast('Código de seguridad enviado. Revisa tu Bandeja Principal o la carpeta de Spam.', 'success');
      showVerifyStep(email, data.previewUrl);
    } else {
      App.showToast(data.error || 'No se pudo enviar el código.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📩 Enviar Código de Seguridad';
    }
  } catch (err) {
    console.error('Error solicitando código:', err);
    App.showToast('Error de conexión con el servidor.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '📩 Enviar Código de Seguridad';
  }
}

// 3. Validar Código de 6 Dígitos y Restablecer Contraseña
async function handleVerifyResetCode(event) {
  event.preventDefault();
  const codeInput = document.getElementById('reset-code-input');
  const pwdInput = document.getElementById('reset-new-password');
  const confirmPwdInput = document.getElementById('reset-confirm-password');
  const submitBtn = document.getElementById('btn-submit-verify-reset');

  const code = codeInput ? codeInput.value.trim() : '';
  const newPassword = pwdInput ? pwdInput.value.trim() : '';
  const confirmPassword = confirmPwdInput ? confirmPwdInput.value.trim() : '';

  if (!code || code.length !== 6) {
    App.showToast('Ingresa el código numérico de 6 dígitos recibido por correo.', 'error');
    return;
  }

  if (!newPassword || newPassword.length < 4) {
    App.showToast('La nueva contraseña debe tener al menos 4 caracteres.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    App.showToast('Las contraseñas ingresadas no coinciden.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Validando código y actualizando...';

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: targetResetEmail,
        code,
        newPassword
      })
    });

    const data = await res.json();

    if (res.ok && data.success && data.user) {
      App.setSession(data.user, data.sessionToken);
      App.showToast('¡Contraseña restablecida con éxito! Ingresando a tu cuenta...', 'success');
      setTimeout(() => {
        window.location.href = 'mis-solicitudes.html';
      }, 800);
      return;
    } else {
      App.showToast(data.error || 'Código incorrecto o expirado.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '🔒 Confirmar Cambio e Iniciar Sesión';
    }
  } catch (err) {
    console.error('Error validando código:', err);
    App.showToast('Error de conexión con el servidor.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🔒 Confirmar Cambio e Iniciar Sesión';
  }
}

// 4. Establecer Contraseña Definitiva tras Clave Temporal
async function handleChangeTempPassword(event) {
  event.preventDefault();
  const pwdInput = document.getElementById('temp-new-password');
  const confirmPwdInput = document.getElementById('temp-confirm-password');
  const submitBtn = document.getElementById('btn-submit-temp-password');

  const newPassword = pwdInput ? pwdInput.value.trim() : '';
  const confirmPassword = confirmPwdInput ? confirmPwdInput.value.trim() : '';

  if (!pendingSession || !pendingSession.user) {
    App.showToast('Sesión no encontrada. Por favor inicia sesión nuevamente.', 'error');
    showLoginStep();
    return;
  }

  if (!newPassword || newPassword.length < 4) {
    App.showToast('La contraseña definitiva debe tener al menos 4 caracteres.', 'error');
    return;
  }

  if (newPassword !== confirmPassword) {
    App.showToast('Las contraseñas no coinciden.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Aceptar';

  try {
    const res = await fetch('/api/auth/change-temp-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: pendingSession.user.userId,
        newPassword
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      App.setSession(pendingSession.user, pendingSession.sessionToken);
      App.showToast('✅ ¡Bienvenido(a)!', 'success');
      setTimeout(() => {
        window.location.href = 'mis-solicitudes.html';
      }, 700);
    } else {
      App.showToast(data.error || 'Error al validar credenciales.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Aceptar';
    }
  } catch (err) {
    console.error('Error guardando contraseña definitiva:', err);
    App.showToast('Error de conexión con el servidor.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Aceptar';
  }
}

// 5. Despacho de Enlace Mágico por Correo
async function handleSendMagicLink() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput ? emailInput.value.trim() : '';

  const cleanEmail = email.toLowerCase();

  if (!cleanEmail.includes('@')) {
    App.showToast('Solamente puedes utilizar tu correo electrónico registrado.', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  if (!cleanEmail.endsWith('.com')) {
    App.showToast('El correo electrónico debe terminar obligatoriamente en .com (ejemplo: usuario@dominio.com).', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  const magicBtn = document.getElementById('btn-magic-link');
  if (magicBtn) {
    magicBtn.disabled = true;
    magicBtn.innerHTML = '⏳ Enviando enlace a tu correo...';
  }

  try {
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {
      App.showToast('Enlace de acceso enviado. Revisa tu Bandeja Principal o carpeta de Spam.', 'success');
      hideAllSteps();
      document.getElementById('login-sent-step').style.display = 'block';
      document.getElementById('sent-email-address').innerText = email;

      if (data.previewUrl) {
        document.getElementById('login-preview-container').innerHTML = `
          <div style="margin-top:16px; background:#F8FAFC; border:1px dashed #CBD5E1; padding:12px; border-radius:8px; font-size:12px;">
            🔗 <strong>Buzón de prueba Ethereal (Enlace detectado):</strong><br>
            <a href="${data.previewUrl}" target="_blank" style="color:#D32F2F; font-weight:700;">Abrir correo con enlace de acceso</a>
          </div>
        `;
      }
    } else {
      App.showToast(data.error || 'No se encontró este correo.', 'error');
      if (magicBtn) {
        magicBtn.disabled = false;
        magicBtn.innerHTML = '📩 Enviar enlace de acceso directo a mi correo';
      }
    }
  } catch (err) {
    App.showToast('Error de conexión con el servidor.', 'error');
    if (magicBtn) {
      magicBtn.disabled = false;
      magicBtn.innerHTML = '📩 Enviar enlace de acceso directo a mi correo';
    }
  }
}

// 6. Verificación automática si viene con ?token=... en la URL
async function checkUrlToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) return;

  hideAllSteps();
  const statusBox = document.getElementById('token-verifying-box');
  if (statusBox) statusBox.style.display = 'block';

  try {
    const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (data.success && data.user) {
      App.setSession(data.user, data.sessionToken);
      App.showToast(`¡Bienvenido de vuelta, ${data.user.nombre}!`, 'success');
      setTimeout(() => {
        window.location.href = 'mis-solicitudes.html';
      }, 800);
    } else {
      if (statusBox) {
        statusBox.innerHTML = `
          <div style="color:#DC2626; font-size:32px; margin-bottom:8px;">⚠️</div>
          <h3 style="color:#DC2626; font-size:18px; font-weight:800;">Enlace inválido o expirado</h3>
          <p style="font-size:13px; color:#64748B; margin:8px 0 16px;">Los enlaces mágicos tienen vigencia de 60 minutos y se invalidan tras ser usados.</p>
          <a href="login.html" class="btn-primary" style="display:inline-flex; width:auto; padding:10px 20px;">Solicitar un nuevo enlace</a>
        `;
      }
    }
  } catch (err) {
    console.error('Error verificando token:', err);
  }
}

function checkExistingSession() {
  const urlParams = new URLSearchParams(window.location.search);
  // Si viene con un token específico en URL o forzar cambio, no autoredirigir
  if (urlParams.get('token') || urlParams.get('action') === 'logout') return;

  const session = App.getSession();
  if (session && session.user) {
    const firstName = (session.user.nombre || 'Inquilino').split(' ')[0];
    const cubs = Array.isArray(session.user.cubiculos)
      ? session.user.cubiculos.map(c => typeof c === 'object' ? c.codigo : c).join(', ')
      : (session.user.cubiculos || '');

    hideAllSteps();
    const container = document.querySelector('.login-card') || document.querySelector('.card-box') || document.body;
    let activeBox = document.getElementById('already-logged-in-box');
    if (!activeBox) {
      activeBox = document.createElement('div');
      activeBox.id = 'already-logged-in-box';
      activeBox.style.cssText = 'text-align:center; padding:32px 18px;';
      activeBox.innerHTML = `
        <div style="font-size:46px; margin-bottom:12px;">👤</div>
        <div style="display:inline-flex; align-items:center; gap:6px; background:#DCFCE7; color:#15803D; font-size:12px; font-weight:800; padding:4px 12px; border-radius:999px; margin-bottom:10px;">
          <span style="display:inline-block; width:8px; height:8px; background:#16A34A; border-radius:50%;"></span>
          Sesión Activa Permanente
        </div>
        <h3 style="font-size:19px; font-weight:900; color:#0F172A; margin:0 0 6px;">¡Hola, ${firstName}!</h3>
        <p style="font-size:13px; color:#475569; margin:0 0 18px; line-height:1.5;">
          Ya te encuentras registrado(a) y conectado(a) en este dispositivo como <strong>${session.user.nombre}</strong> ${cubs ? `(Cubículo ${cubs})` : ''}.
        </p>
        <div style="display:flex; flex-direction:column; gap:10px; max-width:320px; margin:0 auto 16px;">
          <a href="mis-solicitudes.html" class="btn-primary" style="padding:12px; font-size:15px; font-weight:800; text-decoration:none; display:block;">
            📋 Continuar a Mis Solicitudes
          </a>
          <a href="index.html" class="btn-secondary" style="padding:10px; font-size:14px; font-weight:700; text-decoration:none; display:block;">
            🏠 Volver al Inicio
          </a>
        </div>
        <div style="margin-top:14px;">
          <button type="button" onclick="App.clearSession()" style="background:none; border:none; color:#DC2626; font-size:12px; cursor:pointer; text-decoration:underline; font-weight:700;">
            ¿Deseas cerrar sesión o cambiar de cuenta?
          </button>
        </div>
      `;
      const formStep = document.getElementById('login-form-step');
      if (formStep && formStep.parentNode) {
        formStep.parentNode.insertBefore(activeBox, formStep);
      } else {
        container.appendChild(activeBox);
      }
    }

    // Redirigir suavemente tras 1.2 segundos si el usuario no pulsa nada
    setTimeout(() => {
      if (window.location.pathname.includes('login') && !window.location.search.includes('action=logout')) {
        window.location.href = 'mis-solicitudes.html';
      }
    }, 1200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkUrlToken();
  checkExistingSession();

  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLoginSubmit);
  }
});
