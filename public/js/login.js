// Controlador de Acceso Seguro sin Contraseña (Magic Link) - Plaza Megatón
async function handleLoginSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const submitBtn = document.getElementById('btn-submit-login');
  const email = emailInput.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    App.showToast('Ingresa un correo electrónico válido.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Verificando y enviando enlace...';

  try {
    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('login-form-step').style.display = 'none';
      document.getElementById('login-sent-step').style.display = 'block';
      document.getElementById('sent-email-address').innerText = email;

      if (data.previewUrl) {
        document.getElementById('login-preview-container').innerHTML = `
          <div style="margin-top:16px; background:#F8FAFC; border:1px dashed #CBD5E1; padding:12px; border-radius:8px; font-size:12px;">
            🔗 <strong>Buzón de prueba Ethereal (Enlace detectado):</strong><br>
            <a href="${data.previewUrl}" target="_blank" style="color:#D32F2F; font-weight:700;">Abrir correo con enlace mágico de acceso</a>
          </div>
        `;
      }
    } else {
      App.showToast(data.error || 'Correo no encontrado.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📩 Enviar enlace de acceso';
    }
  } catch (err) {
    console.error('Error enviando enlace:', err);
    App.showToast('Error de conexión con el servidor.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '📩 Enviar enlace de acceso';
  }
}

// Verificación automática si viene con ?token=... en la URL
async function checkUrlToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) return;

  const statusBox = document.getElementById('token-verifying-box');
  const formBox = document.getElementById('login-form-step');

  if (formBox) formBox.style.display = 'none';
  if (statusBox) statusBox.style.display = 'block';

  try {
    const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (data.success && data.user) {
      App.setSession(data.user, data.sessionToken);
      App.showToast(`¡Bienvenido de vuelta, ${data.user.nombre}!`, 'success');
      setTimeout(() => {
        window.location.href = '/mis-solicitudes.html';
      }, 800);
    } else {
      if (statusBox) {
        statusBox.innerHTML = `
          <div style="color:#DC2626; font-size:32px; margin-bottom:8px;">⚠️</div>
          <h3 style="color:#DC2626; font-size:18px; font-weight:800;">Enlace inválido o expirado</h3>
          <p style="font-size:13px; color:#64748B; margin:8px 0 16px;">Los enlaces mágicos tienen una vigencia de 60 minutos y se invalidan tras ser usados.</p>
          <a href="/login.html" class="btn-primary" style="display:inline-flex; width:auto; padding:10px 20px;">Solicitar un nuevo enlace</a>
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
