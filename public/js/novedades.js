// Controlador del Módulo de Novedades y Buzón de Mensajes — Plaza Megatón

let currentNovedades = [];
let currentMensajes = [];

function getCategoryBadge(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('reunión') || c.includes('asamblea')) {
    return `<span class="novedad-badge badge-reunion">📅 Reunión / Asamblea</span>`;
  }
  if (c.includes('mantenimiento') || c.includes('trabajo') || c.includes('reparación')) {
    return `<span class="novedad-badge badge-mantenimiento">🔧 Mantenimiento</span>`;
  }
  if (c.includes('urgente') || c.includes('corte') || c.includes('emergencia')) {
    return `<span class="novedad-badge badge-urgente">⚠️ Urgente</span>`;
  }
  return `<span class="novedad-badge badge-aviso">📢 Aviso General</span>`;
}

function switchNovedadesTab(tabName) {
  const btnNov = document.getElementById('tab-btn-nov');
  const btnMsg = document.getElementById('tab-btn-msg');
  const secNov = document.getElementById('section-novedades');
  const secMsg = document.getElementById('section-mensajes');
  const bnavNov = document.getElementById('bnav-novedades');
  const bnavMsg = document.getElementById('bnav-mensajes');

  if (tabName === 'mensajes') {
    if (btnNov) btnNov.classList.remove('active');
    if (btnMsg) btnMsg.classList.add('active');
    if (secNov) secNov.style.display = 'none';
    if (secMsg) secMsg.style.display = 'block';
    if (bnavNov) bnavNov.classList.remove('active');
    if (bnavMsg) bnavMsg.classList.add('active');
    loadMensajes();
  } else {
    if (btnNov) btnNov.classList.add('active');
    if (btnMsg) btnMsg.classList.remove('active');
    if (secNov) secNov.style.display = 'block';
    if (secMsg) secMsg.style.display = 'none';
    if (bnavNov) bnavNov.classList.add('active');
    if (bnavMsg) bnavMsg.classList.remove('active');
    loadNovedades();
  }

  try {
    const url = new URL(window.location);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url);
  } catch (_) {}
}

async function loadNovedades() {
  const container = document.getElementById('novedades-list-container');
  if (!container) return;

  try {
    const res = await fetch('/api/novedades');
    const data = await res.json();
    if (data.success && Array.isArray(data.novedades)) {
      currentNovedades = data.novedades;
      renderNovedades(data.novedades);
      return;
    }
  } catch (err) {
    console.warn('Error cargando novedades desde API:', err);
  }

  // Fallback local en caso de desconexión
  renderNovedades([
    {
      id: 'NOV-001',
      titulo: 'Convocatoria a Reunión Ordinaria de Propietarios y Condóminos',
      categoria: 'Reunión / Asamblea',
      fecha_publicacion: '30/09/2026',
      fecha_evento: '15/10/2026 - 6:30 PM',
      contenido: 'Se convoca a todos los propietarios y ocupantes a la asamblea semestral para revisar los avances del presupuesto 2026, proyectos de iluminación y presentación de la nueva plataforma digital de la plaza.',
      autor: 'Consejo de Administración'
    },
    {
      id: 'NOV-002',
      titulo: 'Mantenimiento Preventivo de Bomba y Cisterna de Agua',
      categoria: 'Mantenimiento',
      fecha_publicacion: '28/09/2026',
      fecha_evento: '05/10/2026 - 7:00 AM a 11:00 AM',
      contenido: 'Se llevará a cabo el lavado y desinfección de la cisterna principal de agua potable, así como la calibración de la bomba presurizadora. Los baños comunes funcionarán con reserva.',
      autor: 'Administración Técnica'
    }
  ]);
}

function renderNovedades(list) {
  const container = document.getElementById('novedades-list-container');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 16px; color:#64748B; background:#F8FAFC; border-radius:14px; border:1px dashed #CBD5E1;">
        📢 No hay avisos ni novedades publicadas por el momento.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => `
    <article class="novedad-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
        ${getCategoryBadge(item.categoria)}
        <span style="font-size:11px; color:#94A3B8; font-weight:600;">${item.fecha_publicacion || ''}</span>
      </div>

      <h3 style="font-size:17px; font-weight:900; color:#0F172A; margin:0 0 8px; line-height:1.3;">
        ${item.titulo}
      </h3>

      ${item.fecha_evento ? `
        <div style="background:#F1F5F9; border-radius:8px; padding:6px 12px; font-size:12px; color:#334155; font-weight:700; margin-bottom:10px; display:inline-flex; align-items:center; gap:6px;">
          🗓️ <span>Fecha programada: <strong>${item.fecha_evento}</strong></span>
        </div>
      ` : ''}

      <p style="font-size:14px; color:#334155; line-height:1.6; margin:0 0 12px; white-space:pre-line;">
        ${item.contenido}
      </p>

      <div style="border-top:1px solid #F1F5F9; padding-top:10px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#64748B;">
        <span>Emitido por: <strong>${item.autor || 'Consejo de Administración'}</strong></span>
        <span style="color:#059669; font-weight:700;">✓ Comunicación Oficial</span>
      </div>
    </article>
  `).join('');
}

async function loadMensajes(forcedEmail = null) {
  const container = document.getElementById('mensajes-list-container');
  const authBox = document.getElementById('msg-auth-box');
  if (!container) return;

  const session = App.getSession();
  let email = forcedEmail || (session && session.user ? session.user.email : '');

  if (!email) {
    if (authBox) authBox.style.display = 'block';
    container.innerHTML = '';
    return;
  } else {
    if (authBox) authBox.style.display = 'none';
  }

  container.innerHTML = `
    <div style="text-align:center; padding:30px; color:#64748B;">
      ⏳ Consultando tu buzón de comunicaciones...
    </div>
  `;

  try {
    const res = await fetch(`/api/mensajes?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.mensajes)) {
      currentMensajes = data.mensajes;
      renderMensajes(data.mensajes, email);
      updateUnreadBadge(data.mensajes);
      return;
    }
  } catch (err) {
    console.warn('Error al consultar mensajes:', err);
  }

  container.innerHTML = `
    <div style="text-align:center; padding:30px 16px; color:#64748B; background:#F8FAFC; border-radius:14px; border:1px dashed #CBD5E1;">
      📬 No tienes mensajes nuevos ni notificaciones pendientes en tu buzón.
    </div>
  `;
}

function updateUnreadBadge(mensajes) {
  const unreadCount = (mensajes || []).filter(m => !m.leido).length;
  const badgeEl = document.getElementById('unread-msg-badge');
  if (badgeEl) {
    if (unreadCount > 0) {
      badgeEl.innerText = unreadCount;
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }
  }
}

function renderMensajes(mensajes, userEmail) {
  const container = document.getElementById('mensajes-list-container');
  if (!container) return;

  if (!mensajes || mensajes.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 16px; color:#64748B; background:#F8FAFC; border-radius:14px; border:1px dashed #CBD5E1;">
        <div style="font-size:36px; margin-bottom:8px;">📬</div>
        <h4 style="font-size:16px; font-weight:800; color:#0F172A; margin:0 0 6px;">Buzón al día</h4>
        <p style="font-size:13px; color:#64748B; margin:0;">
          No tienes mensajes nuevos de la administración para <strong>${userEmail}</strong>.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = mensajes.map(msg => {
    const isUnread = !msg.leido;
    const readFmt = msg.fecha_leido_fmt || (msg.fecha_leido ? new Date(msg.fecha_leido).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '');
    return `
      <div class="mensaje-card ${isUnread ? 'unread' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="mensaje-indicator ${isUnread ? 'indicator-unread' : 'indicator-read'}">
              ${isUnread ? '🔴 Pendiente de Lectura' : '🟢 Leído'}
            </span>
            <span style="font-size:10px; background:#EFF6FF; color:#1D4ED8; font-weight:800; padding:2px 8px; border-radius:6px; text-transform:uppercase;">
              📜 Constancia Oficial Inmutable
            </span>
            ${msg.cubiculo ? `<span style="font-size:11px; background:#FEE2E2; color:#B71C1C; padding:2px 8px; border-radius:6px; font-weight:700;">Cubículo ${msg.cubiculo}</span>` : ''}
          </div>
          <span style="font-size:11px; color:#64748B; font-weight:600;">Emitido: ${msg.fecha || ''} ${msg.hora || ''}</span>
        </div>

        <div style="font-size:11px; color:#94A3B8; font-family:monospace; margin-bottom:6px;">
          Registro Oficial ID: <strong>${msg.id}</strong>
        </div>

        <h4 style="font-size:16px; font-weight:900; color:#0F172A; margin:0 0 6px;">
          ${msg.asunto}
        </h4>

        <div style="font-size:13px; color:#334155; line-height:1.6; background:#F8FAFC; border:1px solid #E2E8F0; padding:12px; border-radius:8px; margin-bottom:10px; white-space:pre-line;">
          ${msg.contenido}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:12px; color:#64748B; border-top:1px dashed #E2E8F0; padding-top:8px;">
          <div>
            <span>Emitido por: <strong>${msg.autor || 'Consejo de Administración'}</strong></span>
            ${readFmt ? `<span style="margin-left:8px; color:#15803D; font-size:11px; font-weight:600;">· Leído el ${readFmt}</span>` : ''}
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${msg.enviado_email ? `<span style="color:#2563EB; font-weight:600; font-size:11px;">✉️ Copia enviada a tu correo</span>` : ''}
            ${isUnread ? `
              <button type="button" class="btn-sm btn-sm-outline" style="padding:4px 10px; font-size:11px; font-weight:700;" onclick="markMsgAsRead('${msg.id}')">
                ✓ Confirmar Lectura
              </button>
            ` : '<span style="font-size:11px; color:#15803D; font-weight:700;">✓ Constancia Verificada</span>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function markMsgAsRead(msgId) {
  try {
    const res = await fetch(`/api/mensajes/${msgId}/leido`, { method: 'PATCH' });
    if (res.ok) {
      const msg = currentMensajes.find(m => m.id === msgId);
      if (msg) msg.leido = true;
      const session = App.getSession();
      renderMensajes(currentMensajes, session && session.user ? session.user.email : '');
      updateUnreadBadge(currentMensajes);
    }
  } catch (err) {
    console.error('Error al marcar leído:', err);
  }
}

function lookupMensajesByEmail() {
  const input = document.getElementById('msg-lookup-email');
  const email = input ? input.value.trim() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    App.showToast('Ingresa un correo electrónico válido.', 'error');
    return;
  }
  loadMensajes(email);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const activeTab = params.get('tab') || 'novedades';

  switchNovedadesTab(activeTab);

  // Si hay sesión iniciada, precargar mensajes para tener el contador activo
  const session = App.getSession();
  if (session && session.user && session.user.email) {
    fetch(`/api/mensajes?email=${encodeURIComponent(session.user.email)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.mensajes)) {
          updateUnreadBadge(data.mensajes);
        }
      })
      .catch(() => {});
  }
});
