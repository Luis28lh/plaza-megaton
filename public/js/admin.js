// Controlador Integral del Portal Administrativo - Plaza Megatón
let currentTab = 'kpis';
let adminData = {
  kpis: null,
  locales: [],
  presupuesto: null,
  usuarios: [],
  reclamaciones: [],
  pagos: [],
  historial: [],
  config: [],
  novedades: [],
  mensajes: []
};

// Helper para cargar catálogo en entornos estáticos (GitHub Pages / demo)
async function fetchCatalogFallback() {
  if (window._catalogLoaded) return window._catalogLoaded;
  try {
    const res = await fetch('database/initial_catalog.json');
    if (res.ok) {
      window._catalogLoaded = await res.json();
      return window._catalogLoaded;
    }
  } catch (_) {}
  return null;
}

// Autenticación por PIN y Roles (MASTER vs GESTOR)
function getAdminPin() {
  return sessionStorage.getItem('megaton_admin_pin') || '';
}

function setAdminPin(pin) {
  sessionStorage.setItem('megaton_admin_pin', pin);
}

function getAdminRole() {
  return sessionStorage.getItem('megaton_admin_role') || 'GESTOR';
}

function setAdminRole(role) {
  sessionStorage.setItem('megaton_admin_role', role);
}

function applyRolePermissions(role) {
  const badge = document.getElementById('admin-user-badge');
  const tabRoles = document.getElementById('tab-btn-roles');
  const tabHistorial = document.getElementById('tab-btn-historial');
  const tabConfig = document.getElementById('tab-btn-config');

  if (role === 'MASTER') {
    if (badge) {
      badge.innerHTML = '⭐ MASTER';
      badge.style.background = '#F59E0B';
      badge.style.color = '#78350F';
      badge.title = 'Super Administrador con Control Total y Código';
    }
    if (tabRoles) tabRoles.style.display = 'inline-flex';
    if (tabHistorial) tabHistorial.style.display = 'inline-flex';
    if (tabConfig) tabConfig.style.display = 'inline-flex';
  } else {
    // GESTOR OPERATIVO (Solo administración de clientes, solicitudes y pagos; sin acceso a Roles, Historial ni Configuración)
    if (badge) {
      badge.innerHTML = '💼 GESTOR';
      badge.style.background = '#10B981';
      badge.style.color = '#064E3B';
      badge.title = 'Administrador Operativo de Plaza Megatón';
    }
    // Ocultar Roles & Criterios, Historial y Configuración para el Usuario Gestor
    if (tabRoles) tabRoles.style.display = 'none';
    if (tabHistorial) tabHistorial.style.display = 'none';
    if (tabConfig) tabConfig.style.display = 'none';

    // Si estaba posicionado en una de las pestañas restringidas, volver a KPIs
    if (currentTab === 'roles' || currentTab === 'historial' || currentTab === 'config') {
      switchAdminTab('kpis');
    }
  }
}

async function checkAdminAuth() {
  const pin = getAdminPin();
  const authGate = document.getElementById('admin-auth-gate');
  const panel = document.getElementById('admin-main-panel');

  if (!pin) {
    if (authGate) authGate.style.display = 'flex';
    if (panel) panel.style.display = 'none';
    return false;
  }

  // Verificar PIN contra la API del servidor
  try {
    const res = await fetch('/api/admin/dashboard', {
      headers: { 'x-admin-pin': pin }
    });

    if (res.ok) {
      const data = await res.json();
      const detectedRole = data.role || (['megaton2026', 'master2026', 'Warn255133'].includes(pin) ? 'MASTER' : 'GESTOR');
      setAdminRole(detectedRole);

      if (authGate) authGate.style.display = 'none';
      if (panel) panel.style.display = 'block';

      applyRolePermissions(detectedRole);
      loadAllAdminData();
      return true;
    }
  } catch (err) {
    console.warn('Backend API no disponible directamente, evaluando credenciales en modo autónomo...');
  }

  // Fallback offline / estático
  let clientRole = null;
  if (['megaton2026', 'master2026', 'Warn255133'].includes(pin)) {
    clientRole = 'MASTER';
  } else if (['gestor2026', 'admin2026'].includes(pin)) {
    clientRole = 'GESTOR';
  }

  if (clientRole) {
    setAdminRole(clientRole);
    if (authGate) authGate.style.display = 'none';
    if (panel) panel.style.display = 'block';

    applyRolePermissions(clientRole);
    loadAllAdminData();
    return true;
  } else {
    sessionStorage.removeItem('megaton_admin_pin');
    sessionStorage.removeItem('megaton_admin_role');
    if (authGate) authGate.style.display = 'flex';
    if (panel) panel.style.display = 'none';
    alert('Credenciales incorrectas. Ingrese el PIN asignado (Master: Warn255133 o megaton2026 / Gestor: gestor2026).');
    return false;
  }
}

function handlePinSubmit(e) {
  e.preventDefault();
  const pinInput = document.getElementById('admin-pin-input');
  const pin = pinInput.value.trim();
  if (!pin) return;

  setAdminPin(pin);
  checkAdminAuth();
}

function adminLogout() {
  sessionStorage.removeItem('megaton_admin_pin');
  sessionStorage.removeItem('megaton_admin_role');
  window.location.reload();
}

// ==========================================
// CARGA Y PESTAÑAS CON VALIDACIÓN RBAC
// ==========================================
function switchAdminTab(tabName) {
  const role = getAdminRole();

  // Si es Usuario Gestor e intenta acceder a Roles & Criterios, Historial o Configuración, bloquear
  if (role === 'GESTOR' && (tabName === 'roles' || tabName === 'historial' || tabName === 'config')) {
    App.showToast('Acceso restringido: Esta sección está reservada exclusivamente para el Usuario Master.', 'error');
    tabName = 'kpis';
  }

  currentTab = tabName;
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const sections = ['kpis', 'locales', 'presupuesto', 'usuarios', 'reclamaciones', 'pagos', 'comunicaciones', 'roles', 'historial', 'config'];
  sections.forEach(s => {
    const el = document.getElementById(`tab-section-${s}`);
    if (el) el.style.display = (s === tabName) ? 'block' : 'none';
  });

  if (tabName === 'kpis') loadKPIs();
  if (tabName === 'locales') loadLocales();
  if (tabName === 'presupuesto') loadPresupuesto();
  if (tabName === 'usuarios') loadUsuarios();
  if (tabName === 'reclamaciones') loadReclamaciones();
  if (tabName === 'pagos') loadPagos();
  if (tabName === 'comunicaciones') loadAdminComunicaciones();
  if (tabName === 'historial' && role === 'MASTER') loadHistorial();
  if (tabName === 'config' && role === 'MASTER') loadConfig();
}

async function loadAllAdminData() {
  loadKPIs();
  loadLocales();
  loadPresupuesto();
  loadUsuarios();
  loadReclamaciones();
  loadPagos();
  loadAdminComunicaciones();
}

// ==========================================
// 1. KPIS / DASHBOARD
// ==========================================
async function loadKPIs() {
  try {
    const res = await fetch('/api/admin/dashboard', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();
    if (data.success && data.kpis) {
      adminData.kpis = data.kpis;
      const k = data.kpis;
      
      document.getElementById('kpi-cub-total').innerText = k.cubiculos.total;
      document.getElementById('kpi-cub-ocupados').innerText = k.cubiculos.ocupados;
      document.getElementById('kpi-cub-disp').innerText = k.cubiculos.disponibles;

      document.getElementById('kpi-users-total').innerText = k.usuarios.total;
      document.getElementById('kpi-users-activos').innerText = k.usuarios.activos;
      const pendUsersEl = document.getElementById('kpi-users-pendientes');
      if (pendUsersEl) pendUsersEl.innerText = k.usuarios.pendientes || 0;

      document.getElementById('kpi-rec-abiertas').innerText = k.reclamaciones.abiertas;
      document.getElementById('kpi-rec-pend').innerText = k.reclamaciones.pendientes;
      document.getElementById('kpi-rec-resueltas').innerText = k.reclamaciones.resueltas;

      document.getElementById('kpi-pag-reportados').innerText = k.pagos.reportados;
      document.getElementById('kpi-pag-pend').innerText = k.pagos.pendientes;
      document.getElementById('kpi-pag-confirmados').innerText = k.pagos.confirmados;

      if (k.telemetria) {
        const cargasEl = document.getElementById('kpi-app-cargas');
        if (cargasEl) cargasEl.innerText = k.telemetria.total_cargas || 0;
        const movilesEl = document.getElementById('kpi-app-moviles');
        if (movilesEl) movilesEl.innerText = (k.telemetria.cargas_moviles || 0) + ' móviles';
        const unicosEl = document.getElementById('kpi-app-unicos');
        if (unicosEl) unicosEl.innerText = (k.telemetria.dispositivos_unicos || 0) + ' únicos';
      }
      return;
    }
  } catch (_) {}

  // Fallback desde catálogo
  const cat = await fetchCatalogFallback();
  if (cat) {
    const cubs = cat.CUBICULOS || [];
    const users = cat.USUARIOS || [];
    const recs = cat.RECLAMACIONES || JSON.parse(localStorage.getItem('pm_reclamaciones') || '[]');
    const pags = cat.PAGOS || JSON.parse(localStorage.getItem('pm_pagos') || '[]');

    const elCubTot = document.getElementById('kpi-cub-total');
    const elCubOcup = document.getElementById('kpi-cub-ocupados');
    const elCubDisp = document.getElementById('kpi-cub-disp');
    const elUsTot = document.getElementById('kpi-users-total');
    const elUsAct = document.getElementById('kpi-users-activos');

    if (elCubTot) elCubTot.innerText = cubs.length || 33;
    if (elCubOcup) elCubOcup.innerText = cubs.filter(c => c.estado === 'Ocupado').length || 33;
    if (elCubDisp) elCubDisp.innerText = cubs.filter(c => c.estado !== 'Ocupado').length || 0;

    if (elUsTot) elUsTot.innerText = users.length || 18;
    if (elUsAct) elUsAct.innerText = users.length || 18;

    const elRecAb = document.getElementById('kpi-rec-abiertas');
    const elRecPe = document.getElementById('kpi-rec-pend');
    const elRecRe = document.getElementById('kpi-rec-resueltas');
    if (elRecAb) elRecAb.innerText = recs.filter(r => r.estado !== 'Resuelta').length;
    if (elRecPe) elRecPe.innerText = recs.filter(r => r.estado === 'Pendiente').length;
    if (elRecRe) elRecRe.innerText = recs.filter(r => r.estado === 'Resuelta').length;

    const elPagRep = document.getElementById('kpi-pag-reportados');
    const elPagPe = document.getElementById('kpi-pag-pend');
    const elPagCo = document.getElementById('kpi-pag-confirmados');
    if (elPagRep) elPagRep.innerText = pags.length;
    if (elPagPe) elPagPe.innerText = pags.filter(p => p.estado === 'Pendiente').length;
    if (elPagCo) elPagCo.innerText = pags.filter(p => p.estado === 'Confirmado').length;
  }
}

// ==========================================
// 1b. LOCALES & MANTENIMIENTO
// ==========================================
async function loadLocales() {
  const tbody = document.getElementById('table-locales-body');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Cargando locales y cuotas de mantenimiento...</td></tr>';
    const res = await fetch('/api/admin/cubiculos', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();
    if (data.success && data.cubiculos) {
      adminData.locales = data.cubiculos;
      renderLocalesTable(adminData.locales);
      return;
    }
  } catch (_) {}

  // Fallback a catálogo oficial
  const cat = await fetchCatalogFallback();
  if (cat && cat.CUBICULOS) {
    adminData.locales = cat.CUBICULOS;
  } else {
    adminData.locales = JSON.parse(localStorage.getItem('pm_cubiculos') || '[]');
  }
  renderLocalesTable(adminData.locales);
}

function renderLocalesTable(list) {
  const tbody = document.getElementById('table-locales-body');
  if (!tbody) return;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:30px; color:#64748B;">No se encontraron locales.</td></tr>';
    return;
  }

  // Actualizar KPIs de locales
  const totalM2 = list.reduce((acc, c) => acc + (parseFloat(c.area_m2) || 0), 0);
  const totalCuota = list.reduce((acc, c) => acc + (parseFloat(c.mantenimiento_mensual || c.cuota) || 0), 0);
  
  const elArea = document.getElementById('kpi-loc-area');
  const elCuota = document.getElementById('kpi-loc-cuota');
  const elAnual = document.getElementById('kpi-loc-anual');
  const elTotal = document.getElementById('kpi-loc-total');

  if (elArea) elArea.innerText = totalM2.toFixed(2) + ' m²';
  if (elCuota) elCuota.innerText = App.formatCurrency(totalCuota);
  if (elAnual) elAnual.innerText = App.formatCurrency(totalCuota * 12);
  if (elTotal) elTotal.innerText = list.length;

  tbody.innerHTML = '';
  list.forEach(c => {
    const tr = document.createElement('tr');
    const cuota = parseFloat(c.mantenimiento_mensual || c.cuota) || 0;
    const precio = parseFloat(c.precio_m2) || 0;
    const rncTxt = c.rnc ? `<span style="font-size:11px; background:#F1F5F9; color:#334155; padding:2px 6px; border-radius:4px; font-weight:700;">${c.rnc}</span>` : '<span style="color:#94A3B8; font-size:11px;">N/A</span>';
    
    tr.innerHTML = `
      <td><span style="background:#FEE2E2; color:#B71C1C; padding:4px 8px; border-radius:6px; font-weight:800; font-size:13px;">${c.codigo}</span></td>
      <td><strong style="color:#475569; font-size:12px;">${c.nivel || 'Nivel General'}</strong></td>
      <td>
        <strong style="color:#0F172A;">${c.nombre_local || c.nombre || c.propietario}</strong>
        ${c.propietario && c.propietario !== (c.nombre_local || c.nombre) ? `<div style="font-size:11px; color:#64748B;">Prop: ${c.propietario}</div>` : ''}
      </td>
      <td>${rncTxt}</td>
      <td style="text-align:right; font-weight:700;">${(c.area_m2 || 0).toFixed(2)} m²</td>
      <td style="text-align:right; color:#475569;">RD$ ${precio.toFixed(2)}</td>
      <td style="text-align:right;"><strong style="color:#D32F2F;">${App.formatCurrency(cuota)}</strong></td>
      <td style="font-size:12px; color:#475569;">${c.actividad_comercial || 'Comercial'}</td>
      <td><span class="badge ${c.estado === 'Ocupado' ? 'badge-activo' : 'badge-pendiente'}">${c.estado || 'Ocupado'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function filterLocales() {
  const q = (document.getElementById('search-locales-input')?.value || '').toLowerCase();
  const nivel = document.getElementById('filter-locales-nivel')?.value || 'Todos';

  const filtered = (adminData.locales || []).filter(c => {
    const matchesNivel = (nivel === 'Todos' || c.nivel === nivel);
    const matchesText = !q || 
      (c.codigo && c.codigo.toLowerCase().includes(q)) ||
      (c.nombre_local && c.nombre_local.toLowerCase().includes(q)) ||
      (c.propietario && c.propietario.toLowerCase().includes(q)) ||
      (c.rnc && c.rnc.toLowerCase().includes(q)) ||
      (c.actividad_comercial && c.actividad_comercial.toLowerCase().includes(q));
    return matchesNivel && matchesText;
  });

  renderLocalesTable(filtered);
}

// ==========================================
// 1c. PRESUPUESTO OFICIAL 2026
// ==========================================
async function loadPresupuesto() {
  const containerIng = document.getElementById('presupuesto-ingresos-list');
  const containerEg = document.getElementById('presupuesto-egresos-list');
  if (!containerIng || !containerEg) return;

  try {
    const res = await fetch('/api/admin/presupuesto', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();
    if (data.success && data.presupuesto) {
      adminData.presupuesto = data.presupuesto;
      renderPresupuesto(adminData.presupuesto);
      return;
    }
  } catch (_) {}

  // Fallback desde catálogo
  const cat = await fetchCatalogFallback();
  if (cat && cat.PRESUPUESTO_2026) {
    adminData.presupuesto = cat.PRESUPUESTO_2026;
  }
  if (adminData.presupuesto) {
    renderPresupuesto(adminData.presupuesto);
  }
}

function renderPresupuesto(p) {
  const cIng = document.getElementById('presupuesto-ingresos-list');
  const cEg = document.getElementById('presupuesto-egresos-list');
  if (!cIng || !cEg || !p) return;

  const totalBase = p.ingresos?.total_ingresos_base_mensual || 137813.80;

  // Renderizar Ingresos
  const ingData = [
    { nivel: "Primer Nivel", detalle: "Locales A-101 a A-105-A (WES, Bingo, Armería...)", mensual: p.ingresos?.primer_nivel?.mensual || 48105.40, anual: p.ingresos?.primer_nivel?.anual || 577264.80, color: "#D32F2F" },
    { nivel: "Segundo Nivel", detalle: "Locales A-201 a A-210 (INABIE, Jet Pack, Alba Rdz...)", mensual: p.ingresos?.segundo_nivel?.mensual || 45208.40, anual: p.ingresos?.segundo_nivel?.anual || 542500.80, color: "#2563EB" },
    { nivel: "Tercer Nivel (Base)", detalle: "Locales A-301 a A-312 (B&B Gym, Vipsania, Grupo Inter...)", mensual: p.ingresos?.tercer_nivel_base?.mensual || 44500.00, anual: p.ingresos?.tercer_nivel_base?.anual || 533999.96, color: "#7C3AED" },
    { nivel: "Tercer Nivel (Con Variaciones)", detalle: "Incluye Mega Coffy, Antena/Sotea y cuotas extendidas", mensual: p.ingresos?.tercer_nivel_presupuesto?.mensual || 77635.00, variacion: p.ingresos?.tercer_nivel_presupuesto?.variacion || 33135.00, color: "#0D9488", esVariacion: true }
  ];

  cIng.innerHTML = ingData.map(item => {
    const pct = ((item.mensual / totalBase) * 100).toFixed(1);
    return `
      <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid #F1F5F9;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <div>
            <strong style="color:#0F172A; font-size:14px;">${item.nivel}</strong>
            <div style="font-size:11px; color:#64748B;">${item.detalle}</div>
          </div>
          <div style="text-align:right;">
            <strong style="color:${item.color}; font-size:14px;">${App.formatCurrency(item.mensual)}</strong>
            <div style="font-size:11px; color:#64748B;">${item.anual ? App.formatCurrency(item.anual) + '/año' : `+${App.formatCurrency(item.variacion)} var.`}</div>
          </div>
        </div>
        <div style="background:#F1F5F9; border-radius:999px; height:7px; overflow:hidden;">
          <div style="background:${item.color}; width:${Math.min(pct, 100)}%; height:100%; border-radius:999px;"></div>
        </div>
        <div style="font-size:10px; color:#94A3B8; text-align:right; margin-top:2px;">${pct}% del ingreso base mensual</div>
      </div>
    `;
  }).join('');

  // Renderizar Egresos
  const egresosList = Array.isArray(p.egresos) ? p.egresos : [];
  cEg.innerHTML = egresosList.map(eg => {
    const pct = ((eg.mensual / totalBase) * 100).toFixed(1);
    return `
      <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid #F1F5F9;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <div>
            <strong style="color:#0F172A; font-size:13px;">${eg.concepto}</strong>
          </div>
          <div style="text-align:right;">
            <strong style="color:#D32F2F; font-size:14px;">${App.formatCurrency(eg.mensual)}</strong>
            <div style="font-size:11px; color:#64748B;">${App.formatCurrency(eg.anual)}/año</div>
          </div>
        </div>
        <div style="background:#F1F5F9; border-radius:999px; height:7px; overflow:hidden;">
          <div style="background:#D32F2F; width:${pct}%; height:100%; border-radius:999px;"></div>
        </div>
        <div style="font-size:10px; color:#94A3B8; text-align:right; margin-top:2px;">${pct}% del presupuesto operativo mensual</div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 2. USUARIOS
// ==========================================
async function loadUsuarios() {
  const tbody = document.getElementById('table-usuarios-body');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Cargando usuarios...</td></tr>';
    const res = await fetch('/api/admin/usuarios', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();

    if (data.success && data.usuarios) {
      adminData.usuarios = data.usuarios;
      renderUsuariosTable(data.usuarios);
      return;
    }
  } catch (_) {}

  // Fallback desde catálogo
  const cat = await fetchCatalogFallback();
  if (cat && cat.USUARIOS) {
    adminData.usuarios = cat.USUARIOS;
    renderUsuariosTable(adminData.usuarios);
  }
}

function updateUsuariosTabBadge() {
  const pendingCount = (adminData.usuarios || []).filter(u => u.estado === 'Pendiente de Aprobación' || u.estado === 'Pendiente').length;
  const tabBtn = document.getElementById('tab-btn-usuarios');
  if (tabBtn) {
    if (pendingCount > 0) {
      tabBtn.innerHTML = `👥 Usuarios <span style="background:#EF4444; color:#FFFFFF; font-size:11px; font-weight:800; padding:2px 7px; border-radius:999px; margin-left:6px;">${pendingCount} pendientes</span>`;
    } else {
      tabBtn.innerHTML = `👥 Usuarios`;
    }
  }
}

function renderUsuariosTable(users) {
  const tbody = document.getElementById('table-usuarios-body');
  if (!tbody) return;

  updateUsuariosTabBadge();

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748B;">No hay usuarios registrados aún.</td></tr>';
    return;
  }

  // Ordenar para mostrar los pendientes de aprobación prioritariamente arriba
  const sortedUsers = [...users].sort((a, b) => {
    const isAPending = (a.estado === 'Pendiente de Aprobación' || a.estado === 'Pendiente');
    const isBPending = (b.estado === 'Pendiente de Aprobación' || b.estado === 'Pendiente');
    if (isAPending && !isBPending) return -1;
    if (!isAPending && isBPending) return 1;
    return 0;
  });

  const occupantUsers = sortedUsers.filter(u => u.user_id !== 'US-MASTER');
  const userOptionsHtml = occupantUsers.map(u => {
    const isBertha = (u.user_id === 'US-017' || (u.nombre || '').toUpperCase().includes('BERTHA'));
    const statusLabel = u.pin ? `🔑 PIN: ${u.pin}` : (u.password === '123456' ? '⚠️ Clave Temp 123456' : '🔒 Clave Personal');
    return `<option value="${u.user_id}" ${isBertha ? 'selected' : ''}>${u.nombre} (${u.email}) - ${statusLabel}</option>`;
  }).join('');

  ['select-reset-user', 'dashboard-select-reset-user', 'modal-select-reset-user'].forEach(selectId => {
    const el = document.getElementById(selectId);
    if (el) el.innerHTML = userOptionsHtml;
  });

  tbody.innerHTML = '';
  sortedUsers.forEach(u => {
    const isPending = (u.estado === 'Pendiente de Aprobación' || u.estado === 'Pendiente');
    const isActivo = (u.estado === 'Activo');
    const tr = document.createElement('tr');
    if (isPending) {
      tr.style.background = '#FFFBEB'; // Resaltado ámbar suave
    }

    const cubsHtml = Array.isArray(u.cubiculos) && u.cubiculos.length > 0
      ? u.cubiculos.map(c => {
          if (typeof c === 'object' && c !== null) {
            const extra = [c.nombre, c.actividad].filter(Boolean).join(' · ');
            return `<div style="margin-bottom: 2px;"><strong>${c.codigo}</strong>${extra ? ' <span style="font-size:11px; color:#475569;">(' + extra + ')</span>' : ''}</div>`;
          }
          return `<div style="margin-bottom: 2px;"><strong>${c}</strong></div>`;
        }).join('')
      : '<span style="color:#94A3B8;">Ninguno</span>';

    // Badge según estado
    let badgeHtml = '';
    if (isPending) {
      badgeHtml = `<span class="badge" style="background:#FEF3C7; color:#B45309; border:1px solid #FCD34D; font-weight:700; white-space:nowrap;">⏳ Pendiente</span>`;
    } else if (isActivo) {
      badgeHtml = `<span class="badge badge-activo">Activo</span>`;
    } else {
      badgeHtml = `<span class="badge badge-rechazado">${u.estado || 'Inactivo'}</span>`;
    }

    // Botones de acción
    let actionsHtml = '';
    const safeName = (u.nombre || '').replace(/'/g, "\\'");
    if (isPending) {
      actionsHtml = `
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button class="btn-sm" style="background:#15803D; color:#FFFFFF; font-weight:700; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="approveUserRegistration('${u.user_id}', '${safeName}')" title="Aprobar cubículo y despachar correo de activación">
            ✅ Aprobar y Dar Acceso
          </button>
          <button class="btn-sm btn-sm-danger" style="padding:6px 9px;" onclick="rejectUserRegistration('${u.user_id}', '${safeName}')" title="Rechazar solicitud">
            ✕ Rechazar
          </button>
          <button class="btn-sm btn-sm-outline" style="padding:6px 8px;" onclick="openEditUserModal('${u.user_id}')" title="Ver y editar">
            ⚙️
          </button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button class="btn-sm btn-sm-outline" onclick="openEditUserModal('${u.user_id}')">⚙️ Gestionar</button>
          <button class="btn-sm" style="background:#D97706; color:#fff; font-weight:800; border:none; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick="resetProvisionalAccess('${u.user_id}', '${safeName}')" title="Reiniciar a clave provisional 123456 y borrar PIN para que el usuario configure su PIN al entrar">🔄 Reiniciar (123456)</button>
        </div>
      `;
    }

    let pinStatusHtml = '';
    if (u.pin) {
      pinStatusHtml = `<span style="background:#DCFCE7; color:#166534; padding:3px 8px; border-radius:6px; font-weight:800; font-size:12px; white-space:nowrap;">🔑 PIN: ${u.pin}</span>`;
    } else if (u.password_temporal || u.debe_cambiar_password || u.password === '123456') {
      pinStatusHtml = `<span style="background:#FEF3C7; color:#B45309; padding:3px 8px; border-radius:6px; font-weight:800; font-size:12px; white-space:nowrap;">⚠️ Clave Temp: 123456</span>`;
    } else {
      pinStatusHtml = `<span style="background:#F1F5F9; color:#475569; padding:3px 8px; border-radius:6px; font-weight:600; font-size:12px; white-space:nowrap;">🔒 Clave Personal</span>`;
    }

    tr.innerHTML = `
      <td><strong>${u.user_id}</strong></td>
      <td><strong>${u.nombre}</strong></td>
      <td>${u.email}<br><small style="color:#64748B;">${u.telefono || 'Sin tel.'}</small></td>
      <td><span style="background:${isPending ? '#FEF3C7' : '#FEE2E2'}; color:${isPending ? '#B45309' : '#B71C1C'}; padding:4px 8px; border-radius:6px; font-weight:600; font-size:12px; display:inline-block;">${cubsHtml}</span></td>
      <td>${pinStatusHtml}</td>
      <td>${badgeHtml}</td>
      <td>${actionsHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function approveUserRegistration(userId, userName) {
  if (!confirm(`¿Aprobar el registro y otorgar acceso oficial a "${userName}"?\n\nAl confirmar:\n1. El cubículo solicitado quedará formalmente vinculado a su nombre.\n2. Se despachará automáticamente un correo electrónico oficial de bienvenida con sus credenciales e instrucciones de acceso.`)) {
    return;
  }

  try {
    App.showToast('Procesando aprobación y despachando correo oficial...', 'info');
    const res = await fetch(`/api/admin/usuarios/${userId}/aprobar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast(data.message || 'Usuario aprobado con éxito.', 'success');
      loadUsuarios();
      loadKPIs();
    } else {
      App.showToast(data.error || 'No se pudo aprobar el usuario.', 'error');
    }
  } catch (err) {
    console.error('Error aprobando usuario:', err);
    App.showToast('Error de conexión al aprobar usuario.', 'error');
  }
}

async function rejectUserRegistration(userId, userName) {
  const motivo = prompt(`¿Rechazar la solicitud de registro de "${userName}"?\n(Opcional) Indica el motivo del rechazo:`);
  if (motivo === null) return;

  try {
    const res = await fetch(`/api/admin/usuarios/${userId}/rechazar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ motivo })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast(data.message || 'Solicitud rechazada.', 'info');
      loadUsuarios();
      loadKPIs();
    } else {
      App.showToast(data.error || 'No se pudo rechazar la solicitud.', 'error');
    }
  } catch (err) {
    console.error('Error rechazando usuario:', err);
    App.showToast('Error de conexión al rechazar usuario.', 'error');
  }
}

function filterUsuarios() {
  const q = document.getElementById('search-usuarios-input').value.toLowerCase();
  const filtered = adminData.usuarios.filter(u => 
    u.nombre.toLowerCase().includes(q) || 
    u.email.toLowerCase().includes(q) || 
    u.user_id.toLowerCase().includes(q) ||
    (Array.isArray(u.cubiculos) && u.cubiculos.some(c => {
      const txt = typeof c === 'object' ? `${c.codigo} ${c.nombre || ''} ${c.actividad || ''}` : String(c);
      return txt.toLowerCase().includes(q);
    }))
  );
  renderUsuariosTable(filtered);
}

function openEditUserModal(userId) {
  const user = adminData.usuarios.find(u => u.user_id === userId);
  if (!user) return;

  const isPending = (user.estado === 'Pendiente de Aprobación' || user.estado === 'Pendiente');
  const safeName = (user.nombre || '').replace(/'/g, "\\'");
  const modal = document.getElementById('edit-user-modal');
  const body = document.getElementById('edit-user-body');

  const cubsFormatted = Array.isArray(user.cubiculos) && user.cubiculos.length > 0
    ? user.cubiculos.map(c => {
        if (typeof c === 'object' && c !== null) {
          const extra = [c.nombre, c.actividad].filter(Boolean).join(' · ');
          return `• <strong>${c.codigo}</strong>${extra ? ' — ' + extra : ''}`;
        }
        return `• <strong>${c}</strong>`;
      }).join('<br>')
    : 'Ninguno';

  body.innerHTML = `
    <div style="font-size:16px; font-weight:800; margin-bottom:12px;">Usuario: ${user.nombre} (${user.user_id})</div>

    ${isPending ? `
    <div style="background:#FFFBEB; border:1.5px solid #FCD34D; border-radius:10px; padding:12px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <div style="font-weight:800; color:#B45309; font-size:13px;">⏳ Registro Pendiente de Aprobación</div>
        <div style="font-size:12px; color:#78350F; margin-top:2px;">El ocupante espera validación. Puedes aprobar su cubículo y enviarle su correo de activación.</div>
      </div>
      <button type="button" class="btn-sm" style="background:#15803D; color:#FFFFFF; font-weight:800; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;" onclick="approveUserRegistration('${user.user_id}', '${safeName}'); closeEditUserModal();">
        ✅ Aprobar y Dar Acceso Ahora
      </button>
    </div>
    ` : ''}

    <div class="form-group">
      <label class="form-label">Correo electrónico / Usuario de acceso:</label>
      <input type="text" id="edit-user-email" class="form-input" value="${user.email || ''}">
      <span style="font-size:11px; color:#64748B;">Correo con el que este usuario iniciará sesión y recibirá su código PIN de seguridad.</span>
    </div>
    <div class="form-group">
      <label class="form-label">Teléfono:</label>
      <input type="text" id="edit-user-tel" class="form-input" value="${user.telefono || ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Estado:</label>
      <select id="edit-user-estado" class="form-select">
        <option value="Pendiente de Aprobación" ${user.estado === 'Pendiente de Aprobación' || user.estado === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente de Aprobación</option>
        <option value="Activo" ${user.estado === 'Activo' ? 'selected' : ''}>Activo</option>
        <option value="Inactivo" ${user.estado === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
        <option value="Rechazado" ${user.estado === 'Rechazado' ? 'selected' : ''}>Rechazado</option>
      </select>
    </div>

    <!-- ACCESO TEMPORAL 123456 Y REINICIO DE PROCESO -->
    <div style="background:#FFFBEB; border:1.5px solid #F59E0B; border-radius:10px; padding:14px; margin-top:14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="flex:1; min-width:240px;">
        <div style="font-weight:900; color:#B45309; font-size:13px; display:flex; align-items:center; gap:6px;">
          <span>🔄</span> Reiniciar Proceso Provisional (123456 y Borrar PIN)
        </div>
        <div style="font-size:12px; color:#78350F; margin-top:3px; line-height:1.4;">
          Borra cualquier PIN previo y restablece la clave a <strong>123456</strong>. Al entrar, el inquilino verá automáticamente la ventana modal para configurar su <strong>PIN de 4 dígitos</strong>.
        </div>
      </div>
      <button type="button" class="btn-sm" style="background:#D97706; color:#FFFFFF; font-weight:800; border:none; padding:9px 14px; border-radius:6px; cursor:pointer;" onclick="resetProvisionalAccess('${user.user_id}', '${safeName}')">
        🔄 Reiniciar a 123456
      </button>
    </div>

    <!-- SECCIÓN: CAMBIO DE CONTRASEÑA / PIN DEL USUARIO -->
    <div style="background:#F8FAFC; border:1.5px solid #CBD5E1; border-radius:10px; padding:14px; margin-top:14px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <label class="form-label" style="margin:0; font-size:13px; font-weight:800; color:#0F172A;">🔑 Cambiar Contraseña / PIN de Acceso:</label>
        <span style="font-size:11px; background:#DCFCE7; color:#15803D; font-weight:700; padding:2px 8px; border-radius:6px;">Habilitado Gestor & Master</span>
      </div>
      <p style="font-size:12px; color:#64748B; margin:0 0 10px;">
        Establece una contraseña o PIN para este inquilino para que pueda ingresar a su portal personal directamente.
      </p>
      <div style="display:flex; gap:8px;">
        <input type="text" id="edit-user-new-password" class="form-input" placeholder="Nueva contraseña (ej. megaton123)" style="font-weight:600;">
        <button type="button" class="btn-sm btn-sm-primary" style="white-space:nowrap; padding:0 14px;" onclick="submitChangePassword('${user.user_id}')">
          Actualizar Clave
        </button>
      </div>
      <label style="font-size:12px; color:#475569; display:flex; align-items:center; gap:6px; margin-top:8px; cursor:pointer;">
        <input type="checkbox" id="edit-user-is-temp" checked>
        <span>Exigir cambio obligatorio al iniciar sesión (Clave temporal para inquilino)</span>
      </label>
      <div id="pwd-change-msg" style="font-size:12px; margin-top:6px; display:none;"></div>
    </div>

    <div class="form-group">
      <label class="form-label">Cubículos actualmente asociados:</label>
      <div style="font-size:13px; color:#B71C1C; margin-bottom:8px; line-height:1.5;">${cubsFormatted}</div>
    </div>
    <div style="border-top:1px solid #E2E8F0; padding-top:12px; margin-top:12px;">
      <div class="form-group">
        <label class="form-label">➕ Asignar nuevo cubículo (ej: C-015):</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="add-cubiculo-code" class="form-input" placeholder="Ej: C-008" style="text-transform:uppercase;">
          <button type="button" class="btn-sm btn-sm-primary" onclick="submitAddCubiculo('${user.user_id}')">Asignar</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">➖ Quitar cubículo asociado:</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="remove-cubiculo-code" class="form-input" placeholder="Ej: C-001" style="text-transform:uppercase;">
          <button type="button" class="btn-sm btn-sm-danger" onclick="submitRemoveCubiculo('${user.user_id}')">Quitar</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-user').onclick = () => saveUserBasicInfo(user.user_id);
  modal.classList.add('open');
}

async function quickEnableTemporalAccess(userId, userName) {
  try {
    const emailInput = document.getElementById('edit-user-email');
    const emailToSave = emailInput ? emailInput.value.trim().toLowerCase() : undefined;

    const payload = {
      password: '123456',
      debe_cambiar_password: true,
      password_temporal: true,
      estado: 'Activo'
    };
    if (emailToSave) {
      payload.email = emailToSave;
    }

    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast(`✅ Acceso temporal habilitado con clave 123456 para ${userName || userId}.`, 'success');
      const msgEl = document.getElementById('pwd-change-msg');
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#15803D';
        msgEl.innerHTML = `⚡ <strong>Acceso Temporal Habilitado:</strong> Clave asignada a <code>123456</code>. Al iniciar sesión, el inquilino recibirá el PIN a su correo para fijar su clave definitiva.`;
      }
      loadUsuarios();
    } else {
      App.showToast(data.error || 'Error al habilitar acceso temporal.', 'error');
    }
  } catch (err) {
    App.showToast('Error de conexión al habilitar acceso temporal.', 'error');
  }
}

async function triggerMasterQuickReset() {
  const select = document.getElementById('select-reset-user');
  const userId = select ? select.value : '';
  if (!userId) {
    App.showToast('Selecciona un usuario para reiniciar.', 'error');
    return;
  }
  const userName = select.options[select.selectedIndex]?.text || userId;
  await resetProvisionalAccess(userId, userName);
}

async function triggerDashboardMasterReset() {
  const select = document.getElementById('dashboard-select-reset-user');
  const userId = select ? select.value : '';
  if (!userId) {
    App.showToast('Selecciona un usuario para reiniciar.', 'error');
    return;
  }
  const userName = select.options[select.selectedIndex]?.text || userId;
  await resetProvisionalAccess(userId, userName);
}

async function triggerModalMasterReset() {
  const select = document.getElementById('modal-select-reset-user');
  const userId = select ? select.value : '';
  if (!userId) {
    App.showToast('Selecciona un usuario para reiniciar.', 'error');
    return;
  }
  const userName = select.options[select.selectedIndex]?.text || userId;
  await resetProvisionalAccess(userId, userName);
}

function openMasterResetModal() {
  const modal = document.getElementById('master-reset-modal');
  if (modal) modal.classList.add('open');
}

function closeMasterResetModal() {
  const modal = document.getElementById('master-reset-modal');
  if (modal) modal.classList.remove('open');
}

async function resetProvisionalAccess(userId, userName) {
  const cleanName = (userName || userId).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*\[.*?\]\s*/g, ' ').trim();
  if (!confirm(`¿Deseas reiniciar la cuenta de "${cleanName}" a la clave provisional (123456) y borrar su PIN?\n\nAl confirmar:\n1. La contraseña volverá a ser "123456".\n2. Se borrará su PIN actual para que quede en blanco.\n3. Al entrar por primera vez con 123456, el sistema le pedirá automáticamente registrar su nuevo PIN personal de 4 dígitos.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/usuarios/${encodeURIComponent(userId)}/reset-provisional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast(`✅ ${data.message}`, 'success');
      const msgEl = document.getElementById('pwd-change-msg');
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#B45309';
        msgEl.innerHTML = `🔄 <strong>Proceso Reiniciado:</strong> Clave asignada a <code>123456</code> y PIN borrado. El inquilino verá el formulario de 4 pines al entrar.`;
      }
      loadUsuarios();
      const modal = document.getElementById('edit-user-modal');
      if (modal && modal.classList.contains('open')) {
        setTimeout(() => modal.classList.remove('open'), 600);
      }
      const masterModal = document.getElementById('master-reset-modal');
      if (masterModal && masterModal.classList.contains('open')) {
        setTimeout(() => masterModal.classList.remove('open'), 600);
      }
    } else {
      App.showToast(data.error || 'Error al reiniciar el proceso provisional.', 'error');
    }
  } catch (err) {
    App.showToast('Error de conexión al reiniciar el proceso.', 'error');
  }
}

async function submitChangePassword(userId) {
  const pwdInput = document.getElementById('edit-user-new-password');
  const tempCheckbox = document.getElementById('edit-user-is-temp');
  const msgEl = document.getElementById('pwd-change-msg');
  const newPwd = pwdInput ? pwdInput.value.trim() : '';
  const isTemp = tempCheckbox ? tempCheckbox.checked : true;

  if (!newPwd) {
    App.showToast('Ingresa una contraseña válida para el usuario.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ 
        password: newPwd,
        debe_cambiar_password: isTemp,
        password_temporal: isTemp
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast('Contraseña de usuario actualizada correctamente.', 'success');
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#15803D';
        msgEl.innerHTML = `✅ Contraseña cambiada con éxito a: <strong>${newPwd}</strong> ${isTemp ? '(temporal, el inquilino deberá cambiarla al ingresar)' : '(definitiva)'}`;
      }
      pwdInput.value = '';
      loadUsuarios();
    } else {
      App.showToast(data.error || 'No se pudo actualizar la contraseña.', 'error');
    }
  } catch (err) {
    console.error('Error al actualizar contraseña:', err);
    App.showToast('Error de conexión al actualizar contraseña.', 'error');
  }
}

async function saveUserBasicInfo(userId) {
  const emailInput = document.getElementById('edit-user-email');
  const telInput = document.getElementById('edit-user-tel');
  const estadoInput = document.getElementById('edit-user-estado');

  const email = emailInput ? emailInput.value.trim().toLowerCase() : undefined;
  const tel = telInput ? telInput.value.trim() : '';
  const estado = estadoInput ? estadoInput.value : 'Activo';

  try {
    const res = await fetch(`/api/admin/usuarios/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ email, telefono: tel, estado })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      App.showToast('Información de usuario actualizada correctamente', 'success');
      closeEditUserModal();
      loadUsuarios();
    } else {
      App.showToast(data.error || 'Error al actualizar usuario', 'error');
    }
  } catch (_) {
    App.showToast('Error de conexión al guardar cambios.', 'error');
  }
}

async function submitAddCubiculo(userId) {
  const code = document.getElementById('add-cubiculo-code').value.trim().toUpperCase();
  if (!code) return;

  const res = await fetch(`/api/admin/usuarios/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': getAdminPin() },
    body: JSON.stringify({ agregarCubiculo: code })
  });
  if (res.ok) {
    App.showToast(`Cubículo ${code} asignado`, 'success');
    closeEditUserModal();
    loadUsuarios();
  }
}

async function submitRemoveCubiculo(userId) {
  const code = document.getElementById('remove-cubiculo-code').value.trim().toUpperCase();
  if (!code) return;

  const res = await fetch(`/api/admin/usuarios/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-pin': getAdminPin() },
    body: JSON.stringify({ quitarCubiculo: code })
  });
  if (res.ok) {
    App.showToast(`Cubículo ${code} desasociado`, 'success');
    closeEditUserModal();
    loadUsuarios();
  }
}

function closeEditUserModal() {
  document.getElementById('edit-user-modal').classList.remove('open');
}

// ==========================================
// 3. RECLAMACIONES
// ==========================================
async function loadReclamaciones() {
  const tbody = document.getElementById('table-reclamaciones-body');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Cargando reclamaciones...</td></tr>';
    const res = await fetch('/api/reclamaciones', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();

    if (data.success && data.reclamaciones) {
      adminData.reclamaciones = data.reclamaciones;
      renderReclamacionesTable(data.reclamaciones);
    }
  } catch (_) {}
}

function renderReclamacionesTable(items) {
  const tbody = document.getElementById('table-reclamaciones-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748B;">No hay reclamaciones reportadas.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  items.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--primary-red);">${r.codigo}</strong></td>
      <td>${r.fecha}</td>
      <td><strong>${r.nombre}</strong><br><small style="color:#64748B;">${r.email}</small></td>
      <td><span style="font-weight:700;">${r.cubiculo}</span></td>
      <td>${r.asunto}</td>
      <td><span class="badge ${getBadgeClass(r.estado)}">${r.estado}</span></td>
      <td>
        <button class="btn-sm btn-sm-primary" onclick="openAdminReclamacionModal('${r.codigo}')">Atender</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterReclamaciones() {
  const estadoFilter = document.getElementById('filter-rec-estado').value;
  const q = document.getElementById('search-rec-input').value.toLowerCase();

  let filtered = adminData.reclamaciones;
  if (estadoFilter !== 'Todos') {
    filtered = filtered.filter(r => r.estado === estadoFilter);
  }
  if (q) {
    filtered = filtered.filter(r => 
      r.codigo.toLowerCase().includes(q) ||
      r.nombre.toLowerCase().includes(q) ||
      r.cubiculo.toLowerCase().includes(q) ||
      r.asunto.toLowerCase().includes(q)
    );
  }
  renderReclamacionesTable(filtered);
}

function openAdminReclamacionModal(codigo) {
  const item = adminData.reclamaciones.find(r => r.codigo === codigo);
  if (!item) return;

  const modal = document.getElementById('admin-reclamacion-modal');
  const body = document.getElementById('admin-reclamacion-body');

  let photosHtml = '';
  if (item.archivos && item.archivos.length > 0) {
    photosHtml = `
      <div style="margin-top:14px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:6px;">Fotografías de Evidencia (${item.archivos.length}):</div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${item.archivos.map(url => {
            const safeUrl = url.replace('/assets/uploads/', '/api/uploads/');
            return `
              <a href="${safeUrl}" target="_blank">
                <img src="${safeUrl}" style="width:100px; height:100px; object-fit:cover; border-radius:8px; border:1px solid #CBD5E1;">
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span class="success-code-num">${item.codigo}</span>
      <span class="badge ${getBadgeClass(item.estado)}">${item.estado}</span>
    </div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Usuario:</strong> ${item.nombre} (${item.email})</div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Cubículo:</strong> ${item.cubiculo}</div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Asunto:</strong> ${item.asunto}</div>
    <div style="font-size:14px; margin-bottom:10px;"><strong>Fecha de Registro:</strong> ${item.fecha} ${item.hora || ''}</div>

    <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-bottom:14px;">
      <div style="font-size:12px; font-weight:700; color:#64748B; margin-bottom:4px; text-transform:uppercase;">Detalle reportado:</div>
      <div style="font-size:14px; color:#1E293B;">${item.detalle}</div>
    </div>

    ${photosHtml}

    <div style="border-top:2px solid #F1F5F9; padding-top:14px; margin-top:16px;">
      <div class="form-group">
        <label class="form-label">Cambiar Estado:</label>
        <select id="modal-rec-estado" class="form-select">
          <option value="Recibida" ${item.estado === 'Recibida' ? 'selected' : ''}>Recibida</option>
          <option value="En revisión" ${item.estado === 'En revisión' ? 'selected' : ''}>En revisión</option>
          <option value="Asignada" ${item.estado === 'Asignada' ? 'selected' : ''}>Asignada</option>
          <option value="En proceso" ${item.estado === 'En proceso' ? 'selected' : ''}>En proceso</option>
          <option value="Pendiente de información" ${item.estado === 'Pendiente de información' ? 'selected' : ''}>Pendiente de información</option>
          <option value="Resuelta" ${item.estado === 'Resuelta' ? 'selected' : ''}>Resuelta</option>
          <option value="Cerrada" ${item.estado === 'Cerrada' ? 'selected' : ''}>Cerrada</option>
          <option value="Cancelada" ${item.estado === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Responsable Asignado / Técnico:</label>
        <input type="text" id="modal-rec-responsable" class="form-input" value="${item.responsable || 'Administración'}">
      </div>

      <div class="form-group">
        <label class="form-label">Observación o Solución (se notificará al usuario):</label>
        <textarea id="modal-rec-observacion" class="form-textarea" placeholder="Describe los avances o la solución aplicada..."></textarea>
      </div>
    </div>
  `;

  document.getElementById('btn-save-reclamacion').onclick = () => saveReclamacionAction(item.codigo);
  modal.classList.add('open');
}

async function saveReclamacionAction(codigo) {
  const estado = document.getElementById('modal-rec-estado').value;
  const responsable = document.getElementById('modal-rec-responsable').value;
  const observacion = document.getElementById('modal-rec-observacion').value;

  try {
    const res = await fetch(`/api/reclamaciones/${codigo}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ estado, responsable, observacion })
    });

    if (res.ok) {
      App.showToast(`Solicitud ${codigo} actualizada`, 'success');
      closeAdminReclamacionModal();
      loadReclamaciones();
      loadKPIs();
    }
  } catch (_) {}
}

function closeAdminReclamacionModal() {
  document.getElementById('admin-reclamacion-modal').classList.remove('open');
}

// ==========================================
// 4. PAGOS
// ==========================================
async function loadPagos() {
  const tbody = document.getElementById('table-pagos-body');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Cargando pagos...</td></tr>';
    const res = await fetch('/api/pagos', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();

    if (data.success && data.pagos) {
      adminData.pagos = data.pagos;
      renderPagosTable(data.pagos);
    }
  } catch (_) {}
}

function renderPagosTable(items) {
  const tbody = document.getElementById('table-pagos-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748B;">No hay reportes de pagos.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  items.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--primary-red);">${p.codigo}</strong></td>
      <td>${p.fecha_pago || p.fecha_registro}</td>
      <td><strong>${p.nombre}</strong><br><small style="color:#64748B;">${p.email}</small></td>
      <td><span style="font-weight:700;">${p.cubiculo}</span></td>
      <td><strong style="color:#15803D;">${p.monto}</strong><br><small>${p.periodo}</small></td>
      <td><span class="badge ${getPagoBadgeClass(p.estado)}">${p.estado}</span></td>
      <td>
        <button class="btn-sm btn-sm-primary" onclick="openAdminPagoModal('${p.codigo}')">Revisar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterPagos() {
  const estadoFilter = document.getElementById('filter-pago-estado').value;
  const q = document.getElementById('search-pago-input').value.toLowerCase();

  let filtered = adminData.pagos;
  if (estadoFilter !== 'Todos') {
    filtered = filtered.filter(p => p.estado === estadoFilter);
  }
  if (q) {
    filtered = filtered.filter(p => 
      p.codigo.toLowerCase().includes(q) ||
      p.nombre.toLowerCase().includes(q) ||
      p.cubiculo.toLowerCase().includes(q) ||
      p.periodo.toLowerCase().includes(q)
    );
  }
  renderPagosTable(filtered);
}

function openAdminPagoModal(codigo) {
  const item = adminData.pagos.find(p => p.codigo === codigo);
  if (!item) return;

  const modal = document.getElementById('admin-pago-modal');
  const body = document.getElementById('admin-pago-body');

  let voucherHtml = '<div style="color:#94A3B8; font-size:13px;">Sin comprobante adjunto.</div>';
  if (item.voucher) {
    const safeVoucherUrl = item.voucher.replace('/assets/uploads/', '/api/uploads/');
    if (item.voucher.toLowerCase().endsWith('.pdf')) {
      voucherHtml = `
        <div style="margin-top:10px;">
          <a href="${safeVoucherUrl}" target="_blank" class="btn-secondary" style="display:inline-flex; width:auto; padding:10px 20px;">
            📄 Abrir Voucher en PDF
          </a>
        </div>
      `;
    } else {
      voucherHtml = `
        <div style="margin-top:10px; text-align:center;">
          <a href="${safeVoucherUrl}" target="_blank">
            <img src="${safeVoucherUrl}" style="max-height:220px; max-width:100%; border-radius:8px; border:1px solid #CBD5E1; box-shadow:var(--shadow-sm);">
          </a>
          <div style="font-size:11px; color:#64748B; margin-top:4px;">Haz clic en la imagen para ver en alta resolución</div>
        </div>
      `;
    }
  }

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span class="success-code-num">${item.codigo}</span>
      <span class="badge ${getPagoBadgeClass(item.estado)}">${item.estado}</span>
    </div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Usuario:</strong> ${item.nombre} (${item.email})</div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Cubículo:</strong> ${item.cubiculo}</div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Concepto:</strong> ${item.concepto}</div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Período:</strong> ${item.periodo}</div>
    <div style="font-size:16px; margin-bottom:4px; font-weight:800; color:#15803D;">Monto: ${item.monto}</div>
    <div style="font-size:14px; margin-bottom:4px;"><strong>Referencia bancaria:</strong> ${item.referencia || 'No indicada'}</div>
    <div style="font-size:14px; margin-bottom:10px;"><strong>Fecha del pago:</strong> ${item.fecha_pago || item.fecha_registro}</div>

    <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-top:10px;">
      <div style="font-size:13px; font-weight:700; margin-bottom:6px;">Comprobante / Voucher:</div>
      ${voucherHtml}
    </div>

    <div class="form-group" style="margin-top:16px;">
      <label class="form-label">Observaciones administrativas:</label>
      <input type="text" id="modal-pago-observaciones" class="form-input" placeholder="Ej: Verificado en Banco Popular" value="${item.observaciones || ''}">
    </div>
  `;

  document.getElementById('btn-pago-confirmar').onclick = () => updatePagoStatus(item.codigo, 'Confirmado');
  document.getElementById('btn-pago-rechazar').onclick = () => updatePagoStatus(item.codigo, 'Rechazado');
  document.getElementById('btn-pago-pedir-info').onclick = () => updatePagoStatus(item.codigo, 'Pendiente de información');

  modal.classList.add('open');
}

async function updatePagoStatus(codigo, nuevoEstado) {
  const observaciones = document.getElementById('modal-pago-observaciones').value;

  try {
    const res = await fetch(`/api/pagos/${codigo}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ estado: nuevoEstado, observaciones })
    });

    if (res.ok) {
      App.showToast(`Pago ${codigo} marcado como ${nuevoEstado}`, 'success');
      closeAdminPagoModal();
      loadPagos();
      loadKPIs();
    }
  } catch (_) {}
}

function closeAdminPagoModal() {
  document.getElementById('admin-pago-modal').classList.remove('open');
}

// ==========================================
// 5. HISTORIAL Y AUDITORÍA MASTER
// ==========================================
let currentHistorialFilter = 'TODOS';
let currentHistorialSearch = '';

async function loadHistorial() {
  const tbody = document.getElementById('table-historial-body');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748B;">Cargando bitácora de movimientos y auditoría...</td></tr>';
    const res = await fetch('/api/admin/historial', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();

    if (data.success && data.historial) {
      adminData.historial = data.historial;
      updateHistorialKPIs(data.historial);
      applyHistorialFilterAndRender();
      
      const refreshEl = document.getElementById('historial-last-refresh');
      if (refreshEl) {
        const now = new Date();
        const horaFmt = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        refreshEl.innerHTML = `🕒 <strong>Sincronizado:</strong> ${horaFmt}`;
      }
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#EF4444;">No se pudo cargar la bitácora de auditoría. Verifique privilegios de Usuario Master.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#EF4444;">Error al conectar con la base de datos de auditoría.</td></tr>';
  }
}

function updateHistorialKPIs(items = []) {
  const totalEl = document.getElementById('kpi-historial-total');
  const loginsEl = document.getElementById('kpi-historial-logins');
  const archivosEl = document.getElementById('kpi-historial-archivos');
  const registrosEl = document.getElementById('kpi-historial-registros');

  const total = items.length;
  const logins = items.filter(h => (h.tipo_movimiento || '').includes('SESION') || (h.tipo_documento === 'SESION')).length;
  const archivos = items.filter(h => Boolean(h.archivo) || (h.tipo_movimiento || '').includes('SUBIR_ARCHIVO') || (h.tipo_movimiento || '').includes('VOUCHER')).length;
  const registros = items.filter(h => (h.tipo_movimiento || '').includes('REGISTRO') || (h.tipo_movimiento || '').includes('ACCESO') || (h.tipo_documento === 'USUARIO')).length;

  if (totalEl) totalEl.textContent = total;
  if (loginsEl) loginsEl.textContent = logins;
  if (archivosEl) archivosEl.textContent = archivos;
  if (registrosEl) registrosEl.textContent = registros;
}

function setHistorialFilter(type, btnElement) {
  currentHistorialFilter = type;
  document.querySelectorAll('#historial-filter-chips .historial-chip').forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = '#FFFFFF';
    btn.style.color = '#334155';
  });
  if (btnElement) {
    btnElement.classList.add('active');
    btnElement.style.background = '#0F172A';
    btnElement.style.color = '#FFFFFF';
  }
  applyHistorialFilterAndRender();
}

function handleHistorialSearch() {
  const input = document.getElementById('historial-search-input');
  currentHistorialSearch = input ? input.value.trim().toLowerCase() : '';
  applyHistorialFilterAndRender();
}

function applyHistorialFilterAndRender() {
  const allItems = adminData.historial || [];
  let filtered = allItems;

  if (currentHistorialFilter === 'ARCHIVOS') {
    filtered = filtered.filter(h => Boolean(h.archivo) || (h.tipo_movimiento || '').includes('SUBIR_ARCHIVO'));
  } else if (currentHistorialFilter === 'SESIONES') {
    filtered = filtered.filter(h => (h.tipo_movimiento || '').includes('SESION') || h.tipo_documento === 'SESION');
  } else if (currentHistorialFilter === 'REGISTROS') {
    filtered = filtered.filter(h => (h.tipo_movimiento || '').includes('REGISTRO') || (h.tipo_movimiento || '').includes('ACCESO') || h.tipo_documento === 'USUARIO');
  } else if (currentHistorialFilter === 'PAGOS') {
    filtered = filtered.filter(h => (h.tipo_movimiento || '').includes('PAGO') || h.tipo_documento === 'PAGO');
  } else if (currentHistorialFilter === 'SOLICITUDES') {
    filtered = filtered.filter(h => (h.tipo_movimiento || '').includes('SOLICITUD') || h.tipo_documento === 'RECLAMACION');
  } else if (currentHistorialFilter === 'SEGURIDAD') {
    filtered = filtered.filter(h => (h.tipo_movimiento || '').includes('CONTRASENA') || h.tipo_documento === 'SEGURIDAD');
  }

  if (currentHistorialSearch) {
    const q = currentHistorialSearch;
    filtered = filtered.filter(h =>
      (h.usuario || '').toLowerCase().includes(q) ||
      (h.codigo_documento || '').toLowerCase().includes(q) ||
      (h.cubiculo || '').toLowerCase().includes(q) ||
      (h.tipo_movimiento || '').toLowerCase().includes(q) ||
      (h.tipo_documento || '').toLowerCase().includes(q) ||
      (h.archivo || '').toLowerCase().includes(q) ||
      (h.accion || '').toLowerCase().includes(q) ||
      (h.observacion || '').toLowerCase().includes(q) ||
      (h.ip || '').toLowerCase().includes(q)
    );
  }

  renderHistorialTable(filtered);
}

function renderHistorialTable(items) {
  const tbody = document.getElementById('table-historial-body');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:36px; color:#64748B;">No se encontraron movimientos registrados con los filtros aplicados.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  items.forEach(h => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #F1F5F9';

    // Determinar badge para tipo_movimiento
    let badgeColor = '#E2E8F0';
    let badgeTextColor = '#334155';
    let icon = '📝';
    const tipo = (h.tipo_movimiento || h.tipo_documento || '').toUpperCase();

    if (tipo.includes('SESION') || tipo.includes('MAGIC')) {
      badgeColor = '#DBEAFE';
      badgeTextColor = '#1E40AF';
      icon = '🔐';
    } else if (tipo.includes('PAGO')) {
      badgeColor = '#D1FAE5';
      badgeTextColor = '#065F46';
      icon = '💰';
    } else if (tipo.includes('ARCHIVO') || h.archivo) {
      badgeColor = '#FEF3C7';
      badgeTextColor = '#92400E';
      icon = '📎';
    } else if (tipo.includes('SOLICITUD') || tipo.includes('RECLAMACION')) {
      badgeColor = '#FEE2E2';
      badgeTextColor = '#991B1B';
      icon = '🛠️';
    } else if (tipo.includes('ACCESO') || tipo.includes('HABILITACION')) {
      badgeColor = '#EDE9FE';
      badgeTextColor = '#5B21B6';
      icon = '⭐';
    } else if (tipo.includes('REGISTRO')) {
      badgeColor = '#E0E7FF';
      badgeTextColor = '#3730A3';
      icon = '👥';
    } else if (tipo.includes('CONTRASENA') || tipo.includes('SEGURIDAD')) {
      badgeColor = '#FCE7F3';
      badgeTextColor = '#9D174D';
      icon = '🔒';
    }

    const archivoHtml = h.archivo 
      ? `<span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:#FEF3C7; color:#92400E; padding:3px 7px; border-radius:6px; font-weight:700; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${h.archivo}">📎 ${h.archivo}</span>`
      : `<span style="color:#94A3B8; font-size:12px;">—</span>`;

    const cubiculoHtml = h.cubiculo 
      ? `<span style="font-weight:700; color:#0F172A; background:#F1F5F9; padding:2px 6px; border-radius:4px; font-size:11px;">${h.cubiculo}</span>`
      : `<span style="color:#94A3B8; font-size:12px;">—</span>`;

    const ipHtml = h.ip ? `<div style="font-size:10px; color:#94A3B8; margin-top:2px;">IP: ${h.ip}</div>` : '';

    const transicionHtml = (h.estado_anterior || h.estado_nuevo)
      ? `<div style="font-size:11px; margin-top:4px;">${h.estado_anterior ? `<span style="color:#64748B;">${h.estado_anterior}</span> → ` : ''}<strong style="color:#0F172A;">${h.estado_nuevo || ''}</strong></div>`
      : '';

    tr.innerHTML = `
      <td style="padding:12px 14px; white-space:nowrap;">
        <div style="font-weight:700; color:#0F172A; font-size:12px;">${h.fecha}</div>
        <div style="font-size:11px; color:#64748B;">${h.hora || ''}</div>
      </td>
      <td style="padding:12px 14px; white-space:nowrap;">
        <span style="display:inline-flex; align-items:center; gap:5px; background:${badgeColor}; color:${badgeTextColor}; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; letter-spacing:0.3px;">
          <span>${icon}</span>
          <span>${h.tipo_movimiento || h.tipo_documento}</span>
        </span>
      </td>
      <td style="padding:12px 14px; white-space:nowrap;">
        <strong style="color:#0F172A; font-size:12px;">${h.codigo_documento || 'N/A'}</strong>
      </td>
      <td style="padding:12px 14px;">
        <div style="font-weight:700; color:#0F172A; font-size:12px;">${h.usuario || 'Sistema'}</div>
        ${ipHtml}
      </td>
      <td style="padding:12px 14px; white-space:nowrap;">
        ${cubiculoHtml}
      </td>
      <td style="padding:12px 14px;">
        ${archivoHtml}
      </td>
      <td style="padding:12px 14px; font-size:12px; font-weight:600; color:#334155;">
        ${h.accion || 'Modificación'}
      </td>
      <td style="padding:12px 14px; font-size:12px; color:#475569; max-width:320px;">
        <div>${h.observacion || ''}</div>
        ${transicionHtml}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function exportHistorialCSV() {
  const items = adminData.historial || [];
  if (items.length === 0) {
    App.showToast('No hay datos en la bitácora para exportar.', 'warning');
    return;
  }

  const headers = ['ID', 'Fecha', 'Hora', 'Tipo Movimiento', 'Documento', 'Usuario', 'Cubículo', 'Archivo Subido', 'Acción', 'Estado Anterior', 'Estado Nuevo', 'Observación', 'IP'];
  const rows = items.map(h => [
    `"${h.id || ''}"`,
    `"${h.fecha || ''}"`,
    `"${h.hora || ''}"`,
    `"${h.tipo_movimiento || h.tipo_documento || ''}"`,
    `"${h.codigo_documento || ''}"`,
    `"${(h.usuario || '').replace(/"/g, '""')}"`,
    `"${(h.cubiculo || '').replace(/"/g, '""')}"`,
    `"${(h.archivo || '').replace(/"/g, '""')}"`,
    `"${(h.accion || '').replace(/"/g, '""')}"`,
    `"${(h.estado_anterior || '').replace(/"/g, '""')}"`,
    `"${(h.estado_nuevo || '').replace(/"/g, '""')}"`,
    `"${(h.observacion || '').replace(/"/g, '""')}"`,
    `"${h.ip || ''}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BITACORA_AUDITORIA_PLAZA_MEGATON_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  App.showToast('Bitácora oficial exportada en formato CSV.', 'success');
}

// ==========================================
// 6. CÓDIGO QR DE REGISTRO
// ==========================================
async function loadQRInfo() {
  try {
    let targetUrl = '';
    if (App.isStaticHost()) {
      // Si está en hosting estático
      const base = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
      targetUrl = `${base}/registro.html`;
    } else {
      const res = await fetch('/api/qr/info');
      const data = await res.json();
      targetUrl = (data && data.targetUrl) ? data.targetUrl : `${window.location.origin}/registro.html`;
    }

    const qrTargetInput = document.getElementById('qr-target-url');
    if (qrTargetInput) qrTargetInput.value = targetUrl;

    const qrImg = document.getElementById('qr-code-img');
    if (qrImg) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(targetUrl)}&color=0f172a&bgcolor=ffffff&qzone=1`;
      qrImg.src = qrApiUrl;
    }
  } catch (_) {}
}

function printQRCard() {
  window.print();
}

function downloadQR() {
  const qrImg = document.getElementById('qr-code-img');
  if (!qrImg || !qrImg.src) return;

  const a = document.createElement('a');
  a.href = qrImg.src;
  a.download = 'QR_REGISTRO_PLAZA_MEGATON.png';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ==========================================
// 7. CONFIGURACIÓN
// ==========================================
async function loadConfig() {
  const container = document.getElementById('config-form-container');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/config', { headers: { 'x-admin-pin': getAdminPin() } });
    const data = await res.json();

    if (data.success && data.config) {
      adminData.config = data.config;
      renderConfigFields(data.config);
    }
  } catch (_) {}
}

function renderConfigFields(configList) {
  const container = document.getElementById('config-form-container');
  if (!container) return;

  container.innerHTML = '';

  const inputGoogle = document.getElementById('input-google-script-url');
  const gUrlItem = configList.find(c => c.parametro === 'google_apps_script_url');
  const DEFAULT_DEPLOYED_URL = 'https://script.google.com/macros/s/AKfycbzhIZ4dMGMyX4ZQgZrBnwegGHjPJC9U_9sw7jRcUVHVB2MGp9sLluZBi3wYN5bZICX0/exec';
  if (inputGoogle) {
    if (gUrlItem && gUrlItem.valor) {
      inputGoogle.value = gUrlItem.valor;
    } else if (localStorage.getItem('pm_google_script_url')) {
      inputGoogle.value = localStorage.getItem('pm_google_script_url');
    } else {
      inputGoogle.value = DEFAULT_DEPLOYED_URL;
      localStorage.setItem('pm_google_script_url', DEFAULT_DEPLOYED_URL);
    }
  }

  configList.forEach(item => {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label class="form-label">${item.parametro}:</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="cfg-${item.parametro}" class="form-input" value="${item.valor || ''}">
        <button type="button" class="btn-sm btn-sm-primary" onclick="saveSingleConfig('${item.parametro}')">Guardar</button>
      </div>
    `;
    container.appendChild(group);
  });
}

async function saveSingleConfig(parametro) {
  const input = document.getElementById(`cfg-${parametro}`);
  if (!input) return;

  const valor = input.value;
  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ parametro, valor })
    });

    if (res.ok) {
      App.showToast(`Parámetro ${parametro} actualizado`, 'success');
    }
  } catch (_) {}
}

// ==========================================
// 8. GOOGLE DRIVE Y GOOGLE SHEETS
// ==========================================
async function testGoogleConnection() {
  const input = document.getElementById('input-google-script-url');
  const resultDiv = document.getElementById('google-test-result');
  const statusSpan = document.getElementById('google-conn-status');
  const scriptUrl = input ? input.value.trim() : '';

  if (!scriptUrl) {
    App.showToast('Por favor introduce la URL de Google Apps Script.', 'error');
    return;
  }

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<span style="color:#64748B;">⏳ Probando conexión con Google Drive y Google Sheets...</span>';

  // Si corre en GitHub Pages directo
  if (App.isStaticHost()) {
    localStorage.setItem('pm_google_script_url', scriptUrl);
    try {
      const res = await fetch(scriptUrl, { method: 'GET' });
      const data = await res.json();
      if (data.status === 'ONLINE') {
        statusSpan.innerHTML = '<span style="background:#DCFCE7; color:#166534; font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px;">🟢 Conectado a Google Drive</span>';
        resultDiv.innerHTML = `
          <div style="background:#F0FDF4; border:1px solid #BBF7D0; padding:10px; border-radius:8px; color:#166534;">
            ✅ <strong>Conexión exitosa.</strong> Carpeta <strong>${data.folderDrive}</strong> activa.<br>
            Base de datos: <a href="https://docs.google.com/spreadsheets/d/${data.spreadsheetId}" target="_blank" style="color:#D32F2F; font-weight:700;">${data.spreadsheetName}</a>
          </div>
        `;
        App.showToast('¡Conectado exitosamente con Google Drive!', 'success');
      } else {
        throw new Error('Respuesta inesperada');
      }
    } catch (err) {
      statusSpan.innerHTML = '<span style="background:#FEE2E2; color:#991B1B; font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px;">🔴 Error de conexión</span>';
      resultDiv.innerHTML = `<span style="color:#DC2626;">Error al conectar: ${err.message}. Verifica los permisos de acceso "Cualquier persona" en Apps Script.</span>`;
    }
    return;
  }

  // Backend Node.js
  try {
    const res = await fetch('/api/admin/google/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({ scriptUrl })
    });
    const data = await res.json();

    if (data.success) {
      statusSpan.innerHTML = '<span style="background:#DCFCE7; color:#166534; font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px;">🟢 Conectado a Google Drive</span>';
      resultDiv.innerHTML = `
        <div style="background:#F0FDF4; border:1px solid #BBF7D0; padding:10px; border-radius:8px; color:#166534;">
          ✅ <strong>Conexión exitosa.</strong> Carpeta <strong>${data.folderName}</strong> activa.<br>
          Base de datos: <a href="${data.spreadsheetUrl}" target="_blank" style="color:#D32F2F; font-weight:700;">Abrir PLAZA_MEGATON_DATABASE en Google Sheets</a>
        </div>
      `;
      App.showToast('¡Conectado exitosamente con Google Drive!', 'success');
    } else {
      statusSpan.innerHTML = '<span style="background:#FEE2E2; color:#991B1B; font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px;">🔴 Error</span>';
      resultDiv.innerHTML = `<span style="color:#DC2626;">${data.error || 'No se pudo conectar con Google Apps Script.'}</span>`;
    }
  } catch (err) {
    statusSpan.innerHTML = '<span style="background:#FEE2E2; color:#991B1B; font-size:11px; font-weight:700; padding:3px 10px; border-radius:9999px;">🔴 Error de red</span>';
    resultDiv.innerHTML = `<span style="color:#DC2626;">Error de red: ${err.message}</span>`;
  }
}

async function syncAllToGoogle() {
  const resultDiv = document.getElementById('google-test-result');
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<span style="color:#64748B;">⏳ Sincronizando usuarios, cubículos, solicitudes y pagos a Google Sheets...</span>';

  // Si corre en entorno estático
  if (App.isStaticHost()) {
    const scriptUrl = localStorage.getItem('pm_google_script_url');
    if (!scriptUrl) {
      App.showToast('Primero prueba y guarda la URL de Google Apps Script.', 'error');
      return;
    }
    const users = JSON.parse(localStorage.getItem('pm_usuarios') || '[]');
    let count = 0;
    for (const u of users) {
      try {
        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'SYNC_USUARIO', payload: u })
        });
        count++;
      } catch (_) {}
    }
    resultDiv.innerHTML = `<span style="color:#166534;">✅ ${count} usuarios sincronizados directamente a tu Google Drive.</span>`;
    App.showToast(`Sincronización enviada a Google Drive`, 'success');
    return;
  }

  // Backend Node.js
  try {
    const res = await fetch('/api/admin/google/sync-all', {
      method: 'POST',
      headers: { 'x-admin-pin': getAdminPin() }
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.innerHTML = `<span style="color:#166534;">✅ ${data.message}</span>`;
      App.showToast(data.message, 'success');
    } else {
      resultDiv.innerHTML = `<span style="color:#DC2626;">${data.error}</span>`;
      App.showToast(data.error, 'error');
    }
  } catch (err) {
    resultDiv.innerHTML = `<span style="color:#DC2626;">Error: ${err.message}</span>`;
  }
}

// ==========================================
// 4b. NOVEDADES COMUNITARIAS Y MENSAJERÍA DIRECTA
// ==========================================
async function loadAdminComunicaciones() {
  populateMessageRecipientDropdown();
  await Promise.all([
    loadAdminNovedades(),
    loadAdminMensajes()
  ]);
}

function populateMessageRecipientDropdown() {
  const select = document.getElementById('msg-select-destinatario');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '-- Seleccionar Cubículo u Ocupante --';
  select.appendChild(defaultOpt);

  const allOpt = document.createElement('option');
  allOpt.value = 'ALL';
  allOpt.dataset.email = 'todos@plazamegaton.com';
  allOpt.dataset.cub = 'Todos los cubículos';
  allOpt.dataset.name = 'Todos los Ocupantes';
  allOpt.textContent = '📢 Todos los Inquilinos Registrados (Difusión General)';
  select.appendChild(allOpt);

  // Group for Official 33 Cubicles
  const cubGroup = document.createElement('optgroup');
  cubGroup.label = '🏢 Catálogo Oficial de 33 Cubículos';

  const locales = (adminData.locales && adminData.locales.length > 0) 
    ? adminData.locales 
    : [
        { codigo: 'A-101' }, { codigo: 'A-102' }, { codigo: 'A-103' }, { codigo: 'A-104' }, { codigo: 'A-105' }, { codigo: 'A-105-A' },
        { codigo: 'A-201' }, { codigo: 'A-202' }, { codigo: 'A-203' }, { codigo: 'A-204' }, { codigo: 'A-205' }, { codigo: 'A-206' },
        { codigo: 'A-207' }, { codigo: 'A-208' }, { codigo: 'A-209' }, { codigo: 'A-210' }, { codigo: 'A-301-A' }, { codigo: 'A-301-B' },
        { codigo: 'A-301-C' }, { codigo: 'A-301-D' }, { codigo: 'A-302' }, { codigo: 'A-303' }, { codigo: 'A-304' }, { codigo: 'A-305' },
        { codigo: 'A-306' }, { codigo: 'A-307' }, { codigo: 'A-307-ANT' }, { codigo: 'A-307-COF' }, { codigo: 'A-308' }, { codigo: 'A-309' },
        { codigo: 'A-310' }, { codigo: 'A-311' }, { codigo: 'A-312' }
      ];

  const usuarios = adminData.usuarios || [];

  locales.forEach(loc => {
    const cubCode = loc.codigo;
    const assignedUser = usuarios.find(u => u.cubiculos && u.cubiculos.includes(cubCode));
    const opt = document.createElement('option');
    opt.value = cubCode;
    opt.dataset.cub = cubCode;

    if (assignedUser) {
      opt.dataset.email = assignedUser.email;
      opt.dataset.name = assignedUser.nombre;
      opt.dataset.userId = assignedUser.user_id;
      opt.textContent = `Cubículo ${cubCode} — ${assignedUser.nombre} (${assignedUser.email})`;
    } else {
      opt.dataset.email = '';
      opt.dataset.name = '';
      opt.dataset.userId = '';
      opt.textContent = `Cubículo ${cubCode} — Sin usuario registrado`;
    }
    cubGroup.appendChild(opt);
  });
  select.appendChild(cubGroup);

  // Group for Individual Registered Users
  if (usuarios.length > 0) {
    const userGroup = document.createElement('optgroup');
    userGroup.label = '👥 Inquilinos Registrados Activos';
    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = `USR_${u.user_id}`;
      opt.dataset.userId = u.user_id;
      opt.dataset.email = u.email;
      opt.dataset.name = u.nombre;
      opt.dataset.cub = (u.cubiculos && u.cubiculos.length > 0) ? u.cubiculos.join(', ') : 'S/C';
      opt.textContent = `👤 ${u.nombre} (${u.email}) [Cub: ${(u.cubiculos || []).join(', ')}]`;
      userGroup.appendChild(opt);
    });
    select.appendChild(userGroup);
  }

  if (currentVal) select.value = currentVal;
}

function onMessageRecipientChange() {
  const select = document.getElementById('msg-select-destinatario');
  const emailInput = document.getElementById('msg-input-email');
  const cubInput = document.getElementById('msg-input-cubiculo');
  if (!select || !emailInput || !cubInput) return;

  const selectedOpt = select.options[select.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) {
    return;
  }

  if (selectedOpt.value === 'ALL') {
    emailInput.value = 'inquilinos@plazamegaton.com';
    cubInput.value = 'Todos los cubículos';
    return;
  }

  emailInput.value = selectedOpt.dataset.email || '';
  cubInput.value = selectedOpt.dataset.cub || '';
}

async function loadAdminNovedades() {
  try {
    const res = await fetch('/api/novedades');
    const data = await res.json();
    if (data.success && Array.isArray(data.novedades)) {
      adminData.novedades = data.novedades;
      renderAdminNovedades();
    }
  } catch (err) {
    console.error('Error al cargar novedades en admin:', err);
  }
}

function renderAdminNovedades() {
  const container = document.getElementById('admin-novedades-list');
  const countBadge = document.getElementById('nov-badge-count');
  if (!container) return;

  const list = adminData.novedades || [];
  if (countBadge) countBadge.innerText = `${list.length} ${list.length === 1 ? 'aviso' : 'avisos'}`;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:#94A3B8;">
        <span style="font-size:32px;">📢</span>
        <p style="margin-top:8px; font-size:13px;">No hay novedades publicadas actualmente en el muro comunitario.</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    let catBg = '#E0F2FE';
    let catColor = '#0369A1';
    let catIcon = '📢';

    if (item.categoria === 'Mantenimiento') {
      catBg = '#FEF3C7'; catColor = '#B45309'; catIcon = '🛠️';
    } else if (item.categoria === 'Asamblea') {
      catBg = '#EDE9FE'; catColor = '#6D28D9'; catIcon = '👥';
    } else if (item.categoria === 'Aviso Urgente') {
      catBg = '#FEE2E2'; catColor = '#B91C1C'; catIcon = '⚠️';
    } else if (item.categoria === 'Proyecto Plaza') {
      catBg = '#DCFCE7'; catColor = '#15803D'; catIcon = '🏢';
    } else if (item.categoria === 'Convivencia') {
      catBg = '#FCE7F3'; catColor = '#BE185D'; catIcon = '🤝';
    }

    const fechaFmt = item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const autor = item.autor || 'Consejo de Administración';

    return `
      <div style="border:1px solid #E2E8F0; border-radius:10px; padding:14px; background:#FFFFFF; position:relative; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="background:${catBg}; color:${catColor}; font-weight:800; font-size:11px; padding:2px 8px; border-radius:999px;">
              ${catIcon} ${item.categoria}
            </span>
            ${item.destacado ? '<span style="background:#FEF3C7; color:#B45309; font-weight:800; font-size:10px; padding:2px 6px; border-radius:4px;">⭐ DESTACADO</span>' : ''}
            <span style="font-size:11px; color:#94A3B8;">${fechaFmt}</span>
          </div>
          <button class="btn-sm btn-sm-danger" onclick="deleteNovedadAdmin('${item.id}')" style="padding:4px 8px; font-size:11px;" title="Eliminar del muro">
            🗑️ Eliminar
          </button>
        </div>
        <h4 style="font-size:14px; font-weight:800; color:#0F172A; margin:0 0 6px 0;">${item.titulo}</h4>
        <p style="font-size:12px; color:#475569; margin:0 0 8px 0; line-height:1.5;">${item.contenido}</p>
        <div style="font-size:11px; color:#64748B; border-top:1px dashed #F1F5F9; padding-top:6px;">
          ✍️ Publicado por: <strong>${autor}</strong>
        </div>
      </div>
    `;
  }).join('');
}

async function submitPublishNovedad(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-publish-nov');
  const titulo = document.getElementById('nov-input-titulo').value.trim();
  const categoria = document.getElementById('nov-input-categoria').value;
  const fecha = document.getElementById('nov-input-fecha').value;
  const contenido = document.getElementById('nov-input-contenido').value.trim();
  const destacado = document.getElementById('nov-input-destacado').checked;

  if (!titulo || !contenido) {
    App.showToast('Por favor complete el título y contenido del comunicado.', 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Publicando en el portal...';
  }

  try {
    const res = await fetch('/api/admin/novedades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({
        titulo,
        categoria,
        fecha_evento: fecha,
        contenido,
        destacado
      })
    });

    const data = await res.json();
    if (data.success) {
      App.showToast('¡Novedad publicada exitosamente en el portal comunitario!', 'success');
      document.getElementById('form-publish-novedad').reset();
      await loadAdminNovedades();
    } else {
      App.showToast(data.error || 'Error al publicar la novedad.', 'error');
    }
  } catch (err) {
    App.showToast('Error de conexión al publicar novedad.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📢 Publicar Novedad en el Portal';
    }
  }
}

async function deleteNovedadAdmin(id) {
  if (!confirm('¿Confirma que desea eliminar esta novedad del muro comunitario? Dejará de ser visible para los inquilinos.')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/novedades/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': getAdminPin() }
    });
    const data = await res.json();
    if (data.success) {
      App.showToast('Novedad eliminada correctamente.', 'info');
      await loadAdminNovedades();
    } else {
      App.showToast(data.error || 'Error al eliminar.', 'error');
    }
  } catch (err) {
    App.showToast('Error de conexión al eliminar novedad.', 'error');
  }
}

async function loadAdminMensajes() {
  try {
    const res = await fetch('/api/mensajes', {
      headers: { 'x-admin-pin': getAdminPin() }
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.mensajes)) {
      adminData.mensajes = data.mensajes;
      renderAdminMensajes();
    }
  } catch (err) {
    console.error('Error al cargar mensajes admin:', err);
  }
}

function renderAdminMensajes() {
  const container = document.getElementById('admin-mensajes-list');
  const countBadge = document.getElementById('msg-badge-count');
  if (!container) return;

  const list = adminData.mensajes || [];
  if (countBadge) countBadge.innerText = `${list.length} ${list.length === 1 ? 'mensaje' : 'mensajes'}`;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px; color:#94A3B8;">
        <span style="font-size:32px;">📬</span>
        <p style="margin-top:8px; font-size:13px;">No se han emitido comunicaciones directas a inquilinos aún.</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const fechaFmt = item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : (item.fecha ? `${item.fecha} ${item.hora || ''}` : '');
    const readReceipt = item.fecha_leido_fmt || (item.fecha_leido ? new Date(item.fecha_leido).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' }) : '');
    const estadoLectura = item.leido
      ? `<span style="color:#15803D; font-weight:700; font-size:11px;">✓ Leído en portal ${readReceipt ? `(${readReceipt})` : ''}</span>`
      : '<span style="color:#D97706; font-weight:700; font-size:11px;">⏳ No leído aún</span>';
    const estadoEmail = item.enviado_email
      ? '<span style="color:#2563EB; font-size:11px; font-weight:600;">📧 Copia despachada a correo</span>'
      : '<span style="color:#64748B; font-size:11px;">🌐 Solo en portal</span>';

    return `
      <div style="border:1px solid #E2E8F0; border-radius:10px; padding:14px; background:#FFFFFF; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
          <div style="font-size:12px; font-weight:800; color:#1E293B; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span>📍 Cubículo: <strong>${item.cubiculo || 'General'}</strong></span>
            <span style="font-weight:400; color:#475569;">· ${item.email || 'N/A'}</span>
            <span style="font-size:10px; background:#EFF6FF; color:#1D4ED8; font-weight:800; padding:1px 6px; border-radius:4px;">🔒 CONSTANCIA INMUTABLE</span>
          </div>
          <span style="font-size:11px; color:#94A3B8;">${fechaFmt}</span>
        </div>
        <h4 style="font-size:14px; font-weight:800; color:#0F172A; margin:0 0 4px 0;">${item.asunto}</h4>
        <p style="font-size:12px; color:#475569; margin:0 0 10px 0; line-height:1.5;">${item.contenido}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #F1F5F9; padding-top:6px; font-size:11px; flex-wrap:wrap; gap:6px;">
          <div>${estadoLectura} · ${estadoEmail}</div>
          <div style="color:#64748B;">Emitido por: <strong>${item.autor || 'Administración'}</strong></div>
        </div>
      </div>
    `;
  }).join('');
}

async function submitSendDirectMessage(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-send-direct-msg');
  const select = document.getElementById('msg-select-destinatario');
  const email = document.getElementById('msg-input-email').value.trim();
  const cubiculo = document.getElementById('msg-input-cubiculo').value.trim();
  const asunto = document.getElementById('msg-input-asunto').value.trim();
  const contenido = document.getElementById('msg-input-contenido').value.trim();
  const enviar_email = document.getElementById('msg-input-enviar-email').checked;

  if (!email && !cubiculo) {
    App.showToast('Debe ingresar un correo o cubículo de destino.', 'error');
    return;
  }

  if (!asunto || !contenido) {
    App.showToast('Por favor ingrese el asunto y contenido del mensaje.', 'error');
    return;
  }

  if (select && select.value === 'ALL') {
    if (!confirm('¿Confirma que desea enviar este comunicado a TODOS los inquilinos registrados en la plataforma?')) {
      return;
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Enviando notificación...';
  }

  try {
    const res = await fetch('/api/admin/mensajes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': getAdminPin()
      },
      body: JSON.stringify({
        email,
        cubiculo,
        asunto,
        contenido,
        enviar_email
      })
    });

    const data = await res.json();
    if (data.success) {
      App.showToast(data.message || 'Mensaje enviado exitosamente.', 'success');
      document.getElementById('form-send-direct-msg').reset();
      await loadAdminMensajes();
    } else {
      App.showToast(data.error || 'Error al enviar el mensaje.', 'error');
    }
  } catch (err) {
    App.showToast('Error de conexión al enviar mensaje.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '✉️ Enviar Mensaje Oficial';
    }
  }
}

// Helpers de badges
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

document.addEventListener('DOMContentLoaded', () => {
  checkAdminAuth();

  const authForm = document.getElementById('admin-login-form');
  if (authForm) authForm.addEventListener('submit', handlePinSubmit);
});
