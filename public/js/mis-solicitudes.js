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
        <div style="font-size:13px; font-weight:700; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
          <span>📸 Fotografías de Evidencia (${item.archivos.length}):</span>
          <span style="font-size:11px; color:#64748B; font-weight:normal;">(Toca la foto para ampliar)</span>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${item.archivos.map((url, idx) => {
            const safeUrl = url.replace('/assets/uploads/', '/api/uploads/');
            return `
              <div style="position:relative; cursor:pointer;" onclick="openPhotoLightbox('${safeUrl}', '${item.codigo}')" title="Ver foto en tamaño completo">
                <img src="${safeUrl}" 
                     alt="Evidencia ${item.codigo}" 
                     style="width:90px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #CBD5E1; box-shadow:0 2px 4px rgba(0,0,0,0.06); transition:transform 0.15s ease;"
                     onmouseover="this.style.transform='scale(1.04)'"
                     onmouseout="this.style.transform='scale(1)'"
                     onerror="this.onerror=null; this.src='/api/reclamaciones/${item.codigo}/fotos/${idx}';">
                <div style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.65); color:#fff; border-radius:4px; padding:1px 4px; font-size:10px;">🔍</div>
              </div>
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

function openPhotoLightbox(imgSrc, title = 'Evidencia') {
  let modal = document.getElementById('pm-lightbox-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pm-lightbox-modal';
    modal.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(15,23,42,0.92); backdrop-filter:blur(4px); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; opacity:0; transition:opacity 0.2s ease;';
    modal.innerHTML = `
      <div style="max-width:92vw; max-height:88vh; display:flex; flex-direction:column; align-items:center; position:relative; width:100%; max-width:600px;">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:12px; color:#fff;">
          <span id="pm-lightbox-title" style="font-weight:700; font-size:15px; color:#F8FAFC;">Fotografía de Evidencia</span>
          <div style="display:flex; gap:8px;">
            <a id="pm-lightbox-ext" href="#" target="_blank" style="background:rgba(255,255,255,0.18); color:#fff; padding:6px 12px; font-size:12px; border-radius:6px; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">↗ Abrir en pestaña</a>
            <button onclick="closePhotoLightbox()" style="background:#EF4444; color:#fff; border:none; border-radius:6px; width:32px; height:32px; font-size:18px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>
          </div>
        </div>
        <img id="pm-lightbox-img" src="" alt="Evidencia" style="max-width:100%; max-height:76vh; object-fit:contain; border-radius:8px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6); background:#0F172A; border:1px solid #334155;">
      </div>
    `;
    modal.onclick = (e) => {
      if (e.target === modal) closePhotoLightbox();
    };
    document.body.appendChild(modal);
  }
  document.getElementById('pm-lightbox-title').textContent = `Fotografía de Evidencia — ${title}`;
  document.getElementById('pm-lightbox-img').src = imgSrc;
  document.getElementById('pm-lightbox-ext').href = imgSrc;
  modal.style.display = 'flex';
  setTimeout(() => { modal.style.opacity = '1'; }, 10);
}

function closePhotoLightbox() {
  const modal = document.getElementById('pm-lightbox-modal');
  if (modal) {
    modal.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; }, 200);
  }
}

function checkTempPasswordPrompt() {
  const session = App.getSession();
  if (!session || !session.user) return;
  const isTemp = session.user.mustChangePassword || session.user.isTempPassword || session.user.needsPinSetup;
  if (!isTemp) return;

  const existingBanner = document.getElementById('temp-password-banner');
  if (!existingBanner) {
    const main = document.querySelector('main.container');
    if (main) {
      const banner = document.createElement('div');
      banner.id = 'temp-password-banner';
      banner.style.cssText = 'background:#FFFBEB; border:1.5px solid #F59E0B; border-left:5px solid #D97706; border-radius:10px; padding:14px 18px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 1px 4px rgba(0,0,0,0.05);';
      banner.innerHTML = `
        <div>
          <div style="font-weight:800; color:#B45309; font-size:14px; display:flex; align-items:center; gap:6px;">
            🔑 Clave Temporal Activa (123456)
          </div>
          <div style="font-size:13px; color:#78350F; margin-top:3px;">
            Has ingresado con la clave provisional. Por tu seguridad, define tus 4 dígitos de PIN personal.
          </div>
        </div>
        <div>
          <button class="btn-sm" style="background:#D97706; color:#FFF; font-weight:800; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;" onclick="openSetPinModal()">
            🔒 Configurar PIN de 4 Dígitos
          </button>
        </div>
      `;
      main.insertBefore(banner, main.firstChild);
    }
  }

  // Al acceder automáticamente le pedimos los 4 pines
  setTimeout(() => {
    openSetPinModal();
  }, 400);
}

function openSetPinModal() {
  let modal = document.getElementById('set-pin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'set-pin-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:440px; text-align:center; padding:24px 22px;">
        <div style="font-size:42px; margin-bottom:10px;">🔑</div>
        <h3 style="font-size:18px; font-weight:900; margin:0 0 8px; color:#0F172A;">Configura tu PIN de Acceso</h3>
        <p style="font-size:13px; color:#64748B; margin:0 0 18px; line-height:1.5;">
          Por tu seguridad, introduce tus <strong>4 dígitos de PIN personal</strong> para tus próximos accesos al portal.
        </p>

        <div style="margin-bottom:14px; text-align:left;">
          <label style="font-size:13px; font-weight:700; color:#334155; display:block; margin-bottom:6px;">
            Nuevo PIN Personal (4 dígitos numéricos):
          </label>
          <input 
            type="password" 
            id="modal-pin-input" 
            class="form-input" 
            maxlength="4" 
            pattern="[0-9]{4}" 
            inputmode="numeric" 
            placeholder="••••" 
            style="font-size:24px; text-align:center; letter-spacing:10px; font-weight:900; padding:10px;"
            autocomplete="new-password"
          >
        </div>

        <div style="margin-bottom:16px; text-align:left;">
          <label style="font-size:13px; font-weight:700; color:#334155; display:block; margin-bottom:6px;">
            Confirmar PIN (4 dígitos numéricos):
          </label>
          <input 
            type="password" 
            id="modal-pin-confirm" 
            class="form-input" 
            maxlength="4" 
            pattern="[0-9]{4}" 
            inputmode="numeric" 
            placeholder="••••" 
            style="font-size:24px; text-align:center; letter-spacing:10px; font-weight:900; padding:10px;"
            autocomplete="new-password"
          >
        </div>

        <div id="modal-pin-err" style="color:#DC2626; font-size:12px; font-weight:700; margin-bottom:12px; display:none;"></div>

        <button type="button" id="btn-save-modal-pin" class="btn-primary" style="width:100%; padding:14px; font-size:16px; font-weight:800; cursor:pointer;" onclick="submitSetPinFromModal()">
          Aceptar
        </button>

        <div style="margin-top:12px;">
          <button type="button" onclick="closeSetPinModal()" style="background:none; border:none; color:#64748B; font-size:12px; cursor:pointer; text-decoration:underline;">
            Cerrar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
  setTimeout(() => {
    const inp = document.getElementById('modal-pin-input');
    if (inp) inp.focus();
  }, 100);
}

function closeSetPinModal() {
  const modal = document.getElementById('set-pin-modal');
  if (modal) modal.classList.remove('open');
}

async function submitSetPinFromModal() {
  const pin = (document.getElementById('modal-pin-input')?.value || '').trim();
  const confirmPin = (document.getElementById('modal-pin-confirm')?.value || '').trim();
  const errEl = document.getElementById('modal-pin-err');
  const btn = document.getElementById('btn-save-modal-pin');

  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    if (errEl) { errEl.innerText = 'El PIN debe ser exactamente de 4 dígitos numéricos (ej. 1234).'; errEl.style.display = 'block'; }
    return;
  }
  if (pin !== confirmPin) {
    if (errEl) { errEl.innerText = 'Los PIN ingresados no coinciden.'; errEl.style.display = 'block'; }
    return;
  }

  const session = App.getSession();
  if (!session || !session.user) return;

  btn.disabled = true;
  btn.innerText = 'Aceptar';

  try {
    const res = await fetch('/api/auth/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.userId, pin })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast('✅ ¡Bienvenido(a)! Tu acceso ha sido configurado.', 'success');
      closeSetPinModal();
      const banner = document.getElementById('temp-password-banner');
      if (banner) banner.remove();
      session.user.mustChangePassword = false;
      session.user.isTempPassword = false;
      session.user.needsPinSetup = false;
      session.user.pin = pin;
      session.user.hasPin = true;
      App.setSession(session.user, session.token);
    } else {
      if (errEl) { errEl.innerText = data.error || 'Error al guardar PIN.'; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.innerText = 'Aceptar';
    }
  } catch (e) {
    if (errEl) { errEl.innerText = 'Error de conexión con el servidor.'; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.innerText = 'Aceptar';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadMisSolicitudes();
  checkTempPasswordPrompt();
});
