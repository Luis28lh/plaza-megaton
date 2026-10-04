// Controlador de Consulta de Mis Solicitudes - Plaza Megatón
let userReclamaciones = [];

async function loadMisSolicitudes() {
  const session = App.getSession();
  const listContainer = document.getElementById('solicitudes-list-container');
  const authPrompt = document.getElementById('auth-prompt-box');

  if (!session || !session.user) {
    if (listContainer) listContainer.style.display = 'none';
    if (authPrompt) authPrompt.style.display = 'block';
    return;
  }

  if (authPrompt) authPrompt.style.display = 'none';
  if (listContainer) listContainer.style.display = 'block';

  try {
    listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:#64748B;">Cargando tus solicitudes...</div>';

    const res = await fetch(`/api/reclamaciones?email=${encodeURIComponent(session.user.email)}`, {
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    const data = await res.json();

    if (data.success && data.reclamaciones) {
      userReclamaciones = data.reclamaciones;
      renderSolicitudesList(userReclamaciones);
    } else {
      listContainer.innerHTML = '<div style="color:#DC2626; padding:20px;">No se pudieron cargar tus solicitudes.</div>';
    }
  } catch (err) {
    console.error('Error cargando solicitudes:', err);
    listContainer.innerHTML = '<div style="color:#DC2626; padding:20px;">Error de conexión.</div>';
  }
}

function getBadgeClass(estado) {
  switch (estado) {
    case 'Recibida': return 'badge-recibida';
    case 'En revisión': return 'badge-revision';
    case 'Asignada': return 'badge-asignada';
    case 'En proceso': return 'badge-proceso';
    case 'Pendiente de información': return 'badge-pendiente';
    case 'Resuelta':
    case 'Cerrada': return 'badge-resuelta';
    case 'Cancelada': return 'badge-rechazado';
    default: return 'badge-recibida';
  }
}

function renderSolicitudesList(items) {
  const container = document.getElementById('solicitudes-list-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 16px;">
        <div style="font-size:36px; margin-bottom:8px;">📋</div>
        <h3 style="font-size:17px; font-weight:800; color:var(--text-main);">No tienes solicitudes registradas</h3>
        <p style="font-size:13px; color:var(--text-muted); margin:6px 0 16px;">Esta casilla es exclusivamente para consultar el avance de tus solicitudes. Si necesitas reportar una avería o mantenimiento, hazlo desde la opción principal de inicio.</p>
        <a href="index.html" class="btn-secondary" style="display:inline-flex; width:auto; padding:8px 18px; font-size:13px; font-weight:700;">🏠 Volver al Inicio</a>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card-box';
    card.style.cursor = 'pointer';
    card.style.marginBottom = '12px';
    card.style.transition = 'transform 0.15s ease, border-color 0.15s ease';

    card.onmouseover = () => card.style.borderColor = 'var(--primary-red)';
    card.onmouseout = () => card.style.borderColor = 'var(--border-light)';
    card.onclick = () => openSolicitudModal(item.codigo);

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <span style="font-size:15px; font-weight:900; color:var(--primary-red); letter-spacing:0.5px;">${item.codigo}</span>
        <span class="badge ${getBadgeClass(item.estado)}">${item.estado}</span>
      </div>
      <div style="font-size:15px; font-weight:700; color:var(--text-main); margin-bottom:4px;">${item.asunto}</div>
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">
        Cubículo: <strong>${item.cubiculo}</strong> · Fecha: ${item.fecha}
      </div>
      <p style="font-size:13px; color:var(--text-body); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${item.detalle}
      </p>
      ${item.archivos && item.archivos.length > 0 ? `<div style="font-size:11px; color:#2563EB; font-weight:600; margin-top:6px;">📸 ${item.archivos.length} foto(s) adjunta(s)</div>` : ''}
    `;

    container.appendChild(card);
  });
}

function openSolicitudModal(codigo) {
  const item = userReclamaciones.find(r => r.codigo === codigo);
  if (!item) return;

  const modal = document.getElementById('solicitud-detail-modal');
  const body = document.getElementById('solicitud-detail-body');

  let photosHtml = '';
  if (item.archivos && item.archivos.length > 0) {
    photosHtml = `
      <div style="margin-top:14px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:6px;">Fotografías de Evidencia:</div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${item.archivos.map(url => {
            const safeUrl = url.replace('/assets/uploads/', '/api/uploads/');
            return `
              <a href="${safeUrl}" target="_blank">
                <img src="${safeUrl}" style="width:84px; height:84px; object-fit:cover; border-radius:8px; border:1px solid #CBD5E1;">
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span class="success-code-num" style="font-size:20px;">${item.codigo}</span>
      <span class="badge ${getBadgeClass(item.estado)}">${item.estado}</span>
    </div>
    <div style="font-size:14px; margin-bottom:6px;"><strong>Cubículo:</strong> ${item.cubiculo}</div>
    <div style="font-size:14px; margin-bottom:6px;"><strong>Asunto:</strong> ${item.asunto}</div>
    <div style="font-size:14px; margin-bottom:6px;"><strong>Fecha y Hora:</strong> ${item.fecha} ${item.hora || ''}</div>
    <div style="font-size:14px; margin-bottom:6px;"><strong>Responsable:</strong> ${item.responsable || 'Administración'}</div>
    
    <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-top:12px;">
      <div style="font-size:12px; font-weight:700; color:#64748B; margin-bottom:4px; text-transform:uppercase;">Detalle reportado:</div>
      <div style="font-size:14px; color:#1E293B; line-height:1.5;">${item.detalle}</div>
    </div>

    ${photosHtml}
  `;

  modal.classList.add('open');
}

function closeSolicitudModal() {
  const modal = document.getElementById('solicitud-detail-modal');
  if (modal) modal.classList.remove('open');
}

function checkTempPasswordPrompt() {
  const session = App.getSession();
  if (!session || !session.user) return;
  const isTemp = session.user.mustChangePassword || session.user.isTempPassword;
  if (!isTemp) return;

  const existingBanner = document.getElementById('temp-password-banner');
  if (existingBanner) return;

  const main = document.querySelector('main.container');
  if (!main) return;

  const banner = document.createElement('div');
  banner.id = 'temp-password-banner';
  banner.style.cssText = 'background:#FFFBEB; border:1.5px solid #F59E0B; border-left:5px solid #D97706; border-radius:10px; padding:14px 18px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 1px 4px rgba(0,0,0,0.05);';
  banner.innerHTML = `
    <div>
      <div style="font-weight:800; color:#B45309; font-size:14px; display:flex; align-items:center; gap:6px;">
        🔑 Clave Temporal Activa (123456)
      </div>
      <div style="font-size:13px; color:#78350F; margin-top:3px;">
        Has ingresado con la clave provisional. Te recomendamos definir tu contraseña definitiva personal.
      </div>
    </div>
    <div>
      <button class="btn-sm" style="background:#D97706; color:#FFF; font-weight:800; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;" onclick="openChangePasswordModal()">
        🔒 Crear Contraseña Definitiva
      </button>
    </div>
  `;
  main.insertBefore(banner, main.firstChild);
}

function openChangePasswordModal() {
  let modal = document.getElementById('change-password-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'change-password-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:440px;">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; margin:0;">🔒 Configurar Contraseña Definitiva</h3>
          <button onclick="closeChangePasswordModal()" style="background:none; border:none; font-size:20px; cursor:pointer;">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px;">
          <p style="font-size:13px; color:#64748B; margin:0 0 14px;">
            Ingresa tu nueva contraseña personal para tus próximos inicios de sesión en Plaza Megatón.
          </p>
          <div class="form-group" style="margin-bottom:12px;">
            <label class="form-label" style="font-size:13px; font-weight:700;">Nueva Contraseña (mínimo 4 caracteres):</label>
            <input type="password" id="modal-new-pwd" class="form-input" placeholder="Nueva contraseña">
          </div>
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-size:13px; font-weight:700;">Confirmar Contraseña:</label>
            <input type="password" id="modal-confirm-pwd" class="form-input" placeholder="Repite la nueva contraseña">
          </div>
          <div id="modal-pwd-err" style="color:#DC2626; font-size:12px; margin-bottom:10px; display:none;"></div>
          <button type="button" id="btn-save-modal-pwd" class="btn-primary" style="width:100%;" onclick="submitChangePasswordFromModal()">
            💾 Guardar Contraseña Definitiva
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
}

function closeChangePasswordModal() {
  const modal = document.getElementById('change-password-modal');
  if (modal) modal.classList.remove('open');
}

async function submitChangePasswordFromModal() {
  const newPwd = (document.getElementById('modal-new-pwd')?.value || '').trim();
  const confirmPwd = (document.getElementById('modal-confirm-pwd')?.value || '').trim();
  const errEl = document.getElementById('modal-pwd-err');
  const btn = document.getElementById('btn-save-modal-pwd');

  if (!newPwd || newPwd.length < 4) {
    if (errEl) { errEl.innerText = 'La contraseña debe tener al menos 4 caracteres.'; errEl.style.display = 'block'; }
    return;
  }
  if (newPwd !== confirmPwd) {
    if (errEl) { errEl.innerText = 'Las contraseñas no coinciden.'; errEl.style.display = 'block'; }
    return;
  }

  const session = App.getSession();
  if (!session || !session.user) return;

  btn.disabled = true;
  btn.innerText = 'Guardando...';

  try {
    const res = await fetch('/api/auth/change-temp-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.userId, newPassword: newPwd })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast('¡Contraseña definitiva guardada correctamente!', 'success');
      closeChangePasswordModal();
      const banner = document.getElementById('temp-password-banner');
      if (banner) banner.remove();
      session.user.mustChangePassword = false;
      session.user.isTempPassword = false;
      App.setSession(session.user, session.token);
    } else {
      if (errEl) { errEl.innerText = data.error || 'Error al guardar contraseña.'; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.innerText = '💾 Guardar Contraseña Definitiva';
    }
  } catch (e) {
    if (errEl) { errEl.innerText = 'Error de conexión.'; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.innerText = '💾 Guardar Contraseña Definitiva';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadMisSolicitudes();
  checkTempPasswordPrompt();
});
