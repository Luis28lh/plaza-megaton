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

  try {
    listContainer.innerHTML = '<div style="text-align:center; padding:30px; color:#64748B;">Cargando historial de pagos...</div>';

    const res = await fetch(`/api/pagos?email=${encodeURIComponent(session.user.email)}`, {
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    const data = await res.json();

    if (data.success && data.pagos) {
      userPagos = data.pagos;
      renderPagosList(userPagos);
    } else {
      listContainer.innerHTML = '<div style="color:#DC2626; padding:20px;">No se pudieron cargar tus pagos.</div>';
    }
  } catch (err) {
    console.error('Error cargando pagos:', err);
    listContainer.innerHTML = '<div style="color:#DC2626; padding:20px;">Error de conexión.</div>';
  }
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
      <div style="text-align:center; padding:40px 16px;">
        <div style="font-size:36px; margin-bottom:8px;">💰</div>
        <h3 style="font-size:17px; font-weight:800; color:var(--text-main);">No tienes pagos registrados</h3>
        <p style="font-size:13px; color:var(--text-muted); margin:6px 0 16px;">Esta casilla es exclusivamente para consultar tu historial y estados de cuenta. Para registrar un nuevo voucher bancario, hazlo desde la opción principal de inicio.</p>
        <a href="index.html" class="btn-secondary" style="display:inline-flex; width:auto; padding:8px 18px; font-size:13px; font-weight:700;">🏠 Volver al Inicio</a>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card-box';
    card.style.marginBottom = '12px';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <div>
          <span style="font-size:15px; font-weight:900; color:var(--primary-red); letter-spacing:0.5px;">${item.codigo}</span>
          <span style="font-size:13px; color:var(--text-muted); margin-left:6px;">· ${item.periodo}</span>
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

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #F1F5F9; padding-top:8px; font-size:12px; color:var(--text-muted);">
        <div>Fecha: ${item.fecha_pago || item.fecha_registro}</div>
        ${item.voucher ? `<a href="${item.voucher.replace('/assets/uploads/', '/api/uploads/')}" target="_blank" style="color:#2563EB; font-weight:700; text-decoration:none;">📄 Ver Voucher</a>` : '<span style="color:#94A3B8;">Sin voucher</span>'}
      </div>
      ${item.observaciones ? `<div style="background:#FFF5F5; border-radius:6px; padding:6px 10px; margin-top:8px; font-size:12px; color:#B91C1C;"><strong>Nota administración:</strong> ${item.observaciones}</div>` : ''}
    `;

    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadMisPagos();
});
