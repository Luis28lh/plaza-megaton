// Controlador de Consulta de Mis Pagos - Plaza Megatón
let userPagos = [];

async function loadMisPagos() {
  const session = App.getSession();
  const listContainer = document.getElementById('pagos-list-container');
  const authPrompt = document.getElementById('auth-prompt-box');

  if (!session || !session.user) {
    if (listContainer) listContainer.style.display = 'none';
    if (authPrompt) authPrompt.style.display = 'block';
    return;
  }

  if (authPrompt) authPrompt.style.display = 'none';
  if (listContainer) listContainer.style.display = 'block';

  const userEmail = (session.user.email || '').trim().toLowerCase();

  // 1. Cargar pagos locales del dispositivo como respaldo inmediato
  const localList = getLocalUserPagos(userEmail);

  try {
    listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:#64748B;">Cargando historial de pagos...</div>';

    const res = await fetch(`/api/pagos?email=${encodeURIComponent(userEmail)}`, {
      headers: { 'Authorization': `Bearer ${session.token || ''}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.pagos)) {
        userPagos = data.pagos;
        // Si hay pagos locales con códigos nuevos no presentes en el servidor, fusionarlos
        if (localList && localList.length > 0) {
          const serverCodes = new Set(data.pagos.map(p => (p.codigo || '').toUpperCase()));
          const onlyNewLocals = localList.filter(p => p.codigo && !serverCodes.has(p.codigo.toUpperCase()) && !p.codigo.toUpperCase().includes('PG-007'));
          if (onlyNewLocals.length > 0) {
            userPagos = mergePagos(data.pagos, onlyNewLocals);
          }
        }
        renderPagosList(userPagos);
        return;
      }
    }
    
    // Si la API responde vacío o falla, mostrar lo resguardado en la app
    userPagos = localList;
    renderPagosList(userPagos);
  } catch (err) {
    console.warn('Conexión con servidor no disponible, mostrando pagos almacenados en la app:', err);
    userPagos = localList;
    renderPagosList(userPagos);
  }
}

function getLocalUserPagos(userEmail) {
  try {
    const emailKey = `pm_user_pagos_${userEmail}`;
    const specific = JSON.parse(localStorage.getItem(emailKey) || '[]');
    const general = JSON.parse(localStorage.getItem('pm_pagos') || '[]');
    const generalFiltered = general.filter(p => (p.email || '').trim().toLowerCase() === userEmail);
    return mergePagos(specific, generalFiltered);
  } catch (_) {
    return [];
  }
}

function mergePagos(primaryList, secondaryList) {
  const map = new Map();
  (secondaryList || []).forEach(p => {
    if (p && p.codigo) map.set(p.codigo.toUpperCase(), p);
  });
  (primaryList || []).forEach(p => {
    if (p && p.codigo) {
      const existing = map.get(p.codigo.toUpperCase()) || {};
      map.set(p.codigo.toUpperCase(), { ...existing, ...p });
    }
  });

  // Ordenar cronológicamente descendente (más recientes arriba)
  return Array.from(map.values()).sort((a, b) => {
    const numA = parseInt(String(a.codigo || '').replace(/\D/g, '') || '0', 10);
    const numB = parseInt(String(b.codigo || '').replace(/\D/g, '') || '0', 10);
    return numB - numA;
  });
}

function getPagoBadgeClass(estado) {
  switch (estado) {
    case 'Reportado': return 'badge-reportado';
    case 'En revisión': return 'badge-revision';
    case 'Confirmado': return 'badge-confirmado';
    case 'Rechazado': return 'badge-rechazado';
    case 'Pendiente de información': return 'badge-pendiente';
    default: return 'badge-reportado';
  }
}

function renderPagosList(items) {
  const container = document.getElementById('pagos-list-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 16px; background:#fff; border-radius:16px; border:1px solid #E2E8F0;">
        <div style="font-size:36px; margin-bottom:8px;">💰</div>
        <h3 style="font-size:17px; font-weight:800; color:var(--text-main);">No tienes pagos registrados aún</h3>
        <p style="font-size:13px; color:var(--text-muted); margin:6px 0 16px; max-width:440px; margin-left:auto; margin-right:auto;">
          Aquí se acumularán todos los comprobantes que reportes en la plataforma con su código consecutivo oficial.
        </p>
        <a href="pagos.html" class="btn-primary" style="display:inline-flex; width:auto; padding:10px 22px; font-size:13px; font-weight:700;">💳 Registrar Nuevo Pago</a>
      </div>
    `;
    return;
  }

  // Calcular estadísticas para el resumen superior
  let totalMonto = 0;
  let confirmados = 0;
  let enRevision = 0;

  items.forEach(p => {
    const cleanNum = parseFloat(String(p.monto || '').replace(/[^0-9.]/g, '')) || 0;
    totalMonto += cleanNum;
    if (p.estado === 'Confirmado') confirmados++;
    else enRevision++;
  });

  const totalFormatted = new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP'
  }).format(totalMonto).replace('DOP', 'RD$');

  let html = `
    <!-- Tarjeta Resumen: Cantidad de Pagos y Total Abonado -->
    <div style="background:#FFFFFF; border:1.5px solid #CBD5E1; border-radius:14px; padding:16px 20px; margin-bottom:18px; box-shadow:var(--shadow-sm);">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
        <div>
          <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase; letter-spacing:0.5px;">📊 Resumen de tu Cuenta</div>
          <div style="font-size:22px; font-weight:900; color:#0F172A; margin-top:2px;">
            ${items.length} ${items.length === 1 ? 'Pago Realizado' : 'Pagos Realizados'}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px; font-weight:800; color:#64748B; text-transform:uppercase;">Total Reportado</div>
          <div style="font-size:22px; font-weight:900; color:#15803D; margin-top:2px;">
            ${totalFormatted}
          </div>
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; padding-top:10px; border-top:1px solid #F1F5F9; font-size:12px;">
        <span style="background:#DCFCE7; color:#166534; font-weight:700; padding:3px 10px; border-radius:999px;">✓ ${confirmados} Confirmado(s)</span>
        <span style="background:#FEF3C7; color:#92400E; font-weight:700; padding:3px 10px; border-radius:999px;">⏳ ${enRevision} En Revisión / Reportado(s)</span>
      </div>
    </div>
  `;

  // Renderizar cada pago individual
  items.forEach(item => {
    const voucherUrl = item.voucher || (item.codigo ? `/api/uploads/02 - PAGOS/${item.codigo}/voucher.jpg` : '');
    const hasVoucher = Boolean(voucherUrl || item.voucher_data || item.voucher_base64);

    html += `
      <div class="card-box" style="margin-bottom:14px; transition:border-color 0.15s ease;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <span style="font-size:16px; font-weight:900; color:var(--primary-red); letter-spacing:0.5px;">${item.codigo}</span>
            <span style="font-size:13px; color:var(--text-muted); margin-left:6px;">· ${item.periodo || 'Cuota'}</span>
          </div>
          <span class="badge ${getPagoBadgeClass(item.estado)}">${item.estado}</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin:8px 0;">
          <div>
            <div style="font-size:14px; font-weight:700; color:var(--text-main);">${item.concepto}</div>
            <div style="font-size:12px; color:var(--text-muted);">Cubículo: <strong>${item.cubiculo}</strong></div>
          </div>
          <div style="font-size:18px; font-weight:900; color:#15803D;">
            ${item.monto}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-top:1px solid #F1F5F9; padding-top:10px; font-size:12px; color:var(--text-muted);">
          <div>📅 Fecha: <strong>${item.fecha_pago || item.fecha_registro}</strong> ${item.referencia ? `· Ref: <code>${item.referencia}</code>` : ''}</div>
          <div>
            ${hasVoucher ? `
              <button onclick="openVoucherModal('${item.codigo}')" style="background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; font-size:12px; font-weight:700; padding:4px 12px; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                👁️ Ver Comprobante
              </button>
            ` : '<span style="color:#94A3B8;">Sin comprobante adjunto</span>'}
          </div>
        </div>
        ${item.observaciones ? `<div style="background:#FFF5F5; border-radius:6px; padding:6px 10px; margin-top:8px; font-size:12px; color:#B91C1C;"><strong>Nota administración:</strong> ${item.observaciones}</div>` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}

function openVoucherModal(codigo) {
  const pago = (userPagos || []).find(p => p.codigo === codigo);
  if (!pago) return;

  const modal = document.getElementById('voucher-modal');
  const title = document.getElementById('voucher-modal-title');
  const body = document.getElementById('voucher-modal-body');
  if (!modal || !body) return;

  if (title) title.innerText = `📄 Comprobante de Pago — ${pago.codigo}`;

  let src = '';
  if (pago.voucher_data) {
    src = pago.voucher_data;
  } else if (pago.voucher_base64) {
    src = `data:${pago.voucher_mime || 'image/jpeg'};base64,${pago.voucher_base64}`;
  } else if (pago.voucher) {
    src = pago.voucher.replace('/assets/uploads/', '/api/uploads/');
  } else {
    src = `/api/pagos/${codigo}/voucher`;
  }

  body.innerHTML = `
    <div style="margin-bottom:12px; font-size:13px; color:#475569; text-align:left; background:#FFFFFF; border:1px solid #E2E8F0; padding:10px 14px; border-radius:8px;">
      <div><strong>Concepto:</strong> ${pago.concepto} · <strong>Monto:</strong> <span style="color:#15803D; font-weight:800;">${pago.monto}</span></div>
      <div style="margin-top:2px;"><strong>Cubículo:</strong> ${pago.cubiculo} · <strong>Fecha:</strong> ${pago.fecha_pago || pago.fecha_registro}</div>
    </div>
    <div style="display:flex; justify-content:center; align-items:center; min-height:220px;">
      <img src="${src}" alt="Comprobante ${codigo}" style="max-width:100%; max-height:65vh; border-radius:8px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1); object-fit:contain;" onerror="this.onerror=null; this.src='/api/uploads/02 - PAGOS/${codigo}/voucher.jpg';">
    </div>
  `;

  modal.style.display = 'flex';
}

function closeVoucherModal() {
  const modal = document.getElementById('voucher-modal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  loadMisPagos();
});
