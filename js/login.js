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

  if (!email || email.length < 3) {
    App.showToast('Ingresa tu correo electrónico registrado o identificador.', 'error');
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

    if (res.ok && data.success) {
      // Si ingresó con clave temporal (ej. 123456), guiarlo a validar con el PIN de 6 dígitos enviado al correo
      if (data.mustChangePassword) {
        App.showToast(data.message || 'Código PIN enviado a tu correo. Ingresa el PIN y tu nueva clave.', 'info');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🔑 Iniciar Sesión';
        showVerifyStep(data.targetEmail || email, data.previewUrl);
        return;
      }

      if (data.user) {
        App.setSession(data.user, data.sessionToken);
        App.showToast(`¡Bienvenido de vuelta, ${data.user.nombre}!`, 'success');
        setTimeout(() => {
          window.location.href = 'mis-solicitudes.html';
        }, 700);
        return;
      }
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

  if (!email || email.length < 3) {
    App.showToast('Ingresa tu correo electrónico registrado.', 'error');
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
  submitBtn.innerHTML = '⏳ Guardando tu PIN o contraseña...';

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
      App.showToast('¡PIN / Contraseña guardada exitosamente! Bienvenido.', 'success');
      setTimeout(() => {
        window.location.href = 'mis-solicitudes.html';
      }, 700);
    } else {
      App.showToast(data.error || 'No se pudo guardar la contraseña.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '✓ Guardar mi PIN / Contraseña y Entrar';
    }
  } catch (err) {
    console.error('Error guardando contraseña definitiva:', err);
    App.showToast('Error de conexión con el servidor.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✓ Guardar mi PIN / Contraseña y Entrar';
  }
}

// 5. Despacho de Enlace Mágico por Correo
async function handleSendMagicLink() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    App.showToast('Ingresa tu correo para enviarte el enlace.', 'error');
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

document.addEventListener('DOMContentLoaded', () => {
  checkUrlToken();

  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', handleLoginSubmit);
  }
});
