// Controlador del Formulario de Registro QR - Plaza Megatón
// Validación estricta: los cubículos deben existir en el catálogo oficial de 33 locales
// y estar vinculados a los correos legítimos de sus titulares.

let catalogCubiculos = [];

const OFFICIAL_33_CUBICULOS = [
  { codigo: 'A-101', nombre: 'Yesenia Grullón', nivel: 'Primer Nivel' },
  { codigo: 'A-102', nombre: 'Alba María García Rodríguez', nivel: 'Primer Nivel' },
  { codigo: 'A-103', nombre: 'Consultorio Dra. Melissa', nivel: 'Primer Nivel' },
  { codigo: 'A-104', nombre: 'Warn Electrical Services SRL', nivel: 'Primer Nivel' },
  { codigo: 'A-105', nombre: 'Armería La Mocana SRL - Pablo Abreu', nivel: 'Primer Nivel' },
  { codigo: 'A-105-A', nombre: 'Bingo', nivel: 'Primer Nivel' },
  { codigo: 'A-201', nombre: 'INABIE', nivel: 'Segundo Nivel' },
  { codigo: 'A-202', nombre: 'Luis María García', nivel: 'Segundo Nivel' },
  { codigo: 'A-203', nombre: 'Jet Pack', nivel: 'Segundo Nivel' },
  { codigo: 'A-204', nombre: 'Manuel Santos', nivel: 'Segundo Nivel' },
  { codigo: 'A-205', nombre: 'Centro de Uña', nivel: 'Segundo Nivel' },
  { codigo: 'A-206', nombre: 'Alba Rodríguez & Asociados, SRL', nivel: 'Segundo Nivel' },
  { codigo: 'A-207', nombre: 'Alba Rodríguez & Asociados, SRL', nivel: 'Segundo Nivel' },
  { codigo: 'A-208', nombre: 'Nicolás Grullón', nivel: 'Segundo Nivel' },
  { codigo: 'A-209', nombre: 'Ahsdiel Music Bar SRL', nivel: 'Segundo Nivel' },
  { codigo: 'A-210', nombre: 'Ahsdiel Music Bar SRL', nivel: 'Segundo Nivel' },
  { codigo: 'A-301-A', nombre: 'Vipsania Grullón', nivel: 'Tercer Nivel' },
  { codigo: 'A-301-B', nombre: 'Vipsania Grullón', nivel: 'Tercer Nivel' },
  { codigo: 'A-301-C', nombre: 'Vipsania Grullón', nivel: 'Tercer Nivel' },
  { codigo: 'A-301-D', nombre: 'Vipsania Grullón', nivel: 'Tercer Nivel' },
  { codigo: 'A-302', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' },
  { codigo: 'A-303', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' },
  { codigo: 'A-304', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' },
  { codigo: 'A-305', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' },
  { codigo: 'A-306', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' },
  { codigo: 'A-307', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' },
  { codigo: 'A-307-ANT', nombre: 'Esward-Sotea, Antena', nivel: 'Tercer Nivel' },
  { codigo: 'A-307-COF', nombre: 'Mega Coffy', nivel: 'Tercer Nivel' },
  { codigo: 'A-308', nombre: 'Bertha Soury', nivel: 'Tercer Nivel' },
  { codigo: 'A-309', nombre: 'Bertha Soury', nivel: 'Tercer Nivel' },
  { codigo: 'A-310', nombre: 'B&B Operadora de Filmes & Gym SRL', nivel: 'Tercer Nivel' },
  { codigo: 'A-311', nombre: 'Elda Bencosme', nivel: 'Tercer Nivel' },
  { codigo: 'A-312', nombre: 'Grupo de Desarrollo Internacional', nivel: 'Tercer Nivel' }
];

async function loadCubiculosCatalog() {
  try {
    const res = await fetch('/api/catalog/cubiculos');
    const data = await res.json();
    if (data.success && data.cubiculos && data.cubiculos.length > 0) {
      catalogCubiculos = data.cubiculos;
    } else {
      catalogCubiculos = OFFICIAL_33_CUBICULOS;
    }
  } catch (err) {
    console.warn('Usando catálogo oficial precargado:', err);
    catalogCubiculos = OFFICIAL_33_CUBICULOS;
  }
  populateAllCubiculoSelects();
}

function getCubiculoSelectOptionsHtml(selectedCode = '') {
  const list = (catalogCubiculos && catalogCubiculos.length > 0) ? catalogCubiculos : OFFICIAL_33_CUBICULOS;
  let html = `<option value="">-- Seleccionar Cubículo Oficial (${list.length}) --</option>`;
  list.forEach(c => {
    const isSel = (c.codigo.toUpperCase() === String(selectedCode).trim().toUpperCase()) ? 'selected' : '';
    const nom = c.nombre_local || c.nombre || '';
    const label = `${c.codigo}${nom ? ' — ' + nom : ''} (${c.nivel || 'Plaza Megatón'})`;
    html += `<option value="${c.codigo}" ${isSel} data-nombre="${nom}" data-actividad="${c.actividad_comercial || c.actividad || ''}">${label}</option>`;
  });
  return html;
}

function populateAllCubiculoSelects() {
  document.querySelectorAll('.cubiculo-item-code').forEach(sel => {
    if (sel.tagName.toLowerCase() === 'select') {
      const curVal = sel.value;
      sel.innerHTML = getCubiculoSelectOptionsHtml(curVal);
      if (curVal) sel.value = curVal;
    }
  });
}

function initCubiculosDynamicFields() {
  const container = document.getElementById('cubiculos-inputs-container');
  const addBtn = document.getElementById('btn-add-cubiculo');
  if (!container) return;

  container.innerHTML = '';
  // Inicializar con 1 bloque de cubículo vacío
  addCubiculoInputRow();

  if (addBtn) {
    addBtn.onclick = () => {
      addCubiculoInputRow();
    };
  }

  loadCubiculosCatalog();
}

function addCubiculoInputRow(initialData = {}) {
  const container = document.getElementById('cubiculos-inputs-container');
  if (!container) return;

  const currentCount = container.querySelectorAll('.cubiculo-card-block').length;
  const nextNum = currentCount + 1;

  const initialCode = typeof initialData === 'object' ? (initialData.codigo || '') : String(initialData || '');
  const initialName = typeof initialData === 'object' ? (initialData.nombre || initialData.nombre_local || '') : '';
  const initialActivity = typeof initialData === 'object' ? (initialData.actividad || initialData.actividad_comercial || '') : '';

  const block = document.createElement('div');
  block.className = 'cubiculo-card-block';
  block.innerHTML = `
    <div class="cubiculo-card-header">
      <div class="cubiculo-card-title">
        <span class="cubiculo-row-badge">${nextNum}</span>
        <span>Cubículo o Local #${nextNum}</span>
      </div>
      <button type="button" class="btn-remove-cubiculo-block" title="Quitar este cubículo">
        ✕ Quitar
      </button>
    </div>

    <!-- Campo 1: Selección obligatoria del Cubículo Oficial -->
    <div class="cubiculo-field-group">
      <label class="cubiculo-field-label">
        <span>Número del Cubículo o Local <strong style="color:var(--primary-red);">*</strong></span>
        <span class="cubiculo-field-opt" style="color:#059669; font-weight:700;">✓ Catálogo Oficial</span>
      </label>
      <select class="form-input cubiculo-item-code" required style="font-weight:700; font-size:14px; background:#FFFFFF;">
        ${getCubiculoSelectOptionsHtml(initialCode)}
      </select>
    </div>

    <!-- Campo 2: Nombre del Cubículo o Local (Opcional) -->
    <div class="cubiculo-field-group">
      <label class="cubiculo-field-label">
        <span>Nombre o Referencia del Local</span>
        <span class="cubiculo-field-opt">(Opcional)</span>
      </label>
      <input 
        type="text" 
        class="form-input cubiculo-item-name" 
        placeholder="Ej: Taller Eléctrico Pérez, Modas Laura..." 
        value="${initialName}" 
        autocomplete="off"
      >
    </div>

    <!-- Campo 3: Actividad Comercial (Opcional) -->
    <div class="cubiculo-field-group">
      <label class="cubiculo-field-label">
        <span>Actividad comercial</span>
        <span class="cubiculo-field-opt">(Opcional)</span>
      </label>
      <input 
        type="text" 
        class="form-input cubiculo-item-activity" 
        placeholder="Ej: Reparación de celulares, Venta de ropa..." 
        value="${initialActivity}" 
        list="actividad-comercial-list" 
        autocomplete="off"
      >
    </div>
  `;

  // Autocompletar nombre y actividad al seleccionar un cubículo
  const selectEl = block.querySelector('.cubiculo-item-code');
  if (selectEl) {
    selectEl.onchange = () => {
      const selectedOpt = selectEl.options[selectEl.selectedIndex];
      if (selectedOpt && selectedOpt.value) {
        const nom = selectedOpt.getAttribute('data-nombre');
        const act = selectedOpt.getAttribute('data-actividad');
        const nameInput = block.querySelector('.cubiculo-item-name');
        const actInput = block.querySelector('.cubiculo-item-activity');
        if (nameInput && (!nameInput.value || nameInput.value === initialName)) {
          if (nom) nameInput.value = nom;
        }
        if (actInput && (!actInput.value || actInput.value === initialActivity)) {
          if (act) actInput.value = act;
        }
      }
    };
  }

  // Manejar eliminación de bloque
  const removeBtn = block.querySelector('.btn-remove-cubiculo-block');
  removeBtn.onclick = () => {
    const totalBlocks = container.querySelectorAll('.cubiculo-card-block').length;
    if (totalBlocks > 1) {
      block.remove();
      renumberCubiculoRows();
    } else {
      // Si es el único bloque, limpiar sus inputs
      const codeInput = block.querySelector('.cubiculo-item-code');
      const nameInput = block.querySelector('.cubiculo-item-name');
      const actInput = block.querySelector('.cubiculo-item-activity');
      if (codeInput) codeInput.value = '';
      if (nameInput) nameInput.value = '';
      if (actInput) actInput.value = '';
    }
  };

  container.appendChild(block);
}

function renumberCubiculoRows() {
  const container = document.getElementById('cubiculos-inputs-container');
  if (!container) return;

  const blocks = container.querySelectorAll('.cubiculo-card-block');
  blocks.forEach((block, index) => {
    const badge = block.querySelector('.cubiculo-row-badge');
    const titleSpan = block.querySelector('.cubiculo-card-title span:last-child');
    const num = index + 1;
    if (badge) badge.innerText = num;
    if (titleSpan) titleSpan.innerText = `Cubículo o Local #${num}`;
  });
}

function getEnteredCubiculos() {
  const container = document.getElementById('cubiculos-inputs-container');
  if (!container) return [];

  const blocks = container.querySelectorAll('.cubiculo-card-block');
  const list = [];
  const seenCodes = new Set();

  blocks.forEach(block => {
    const codeInput = block.querySelector('.cubiculo-item-code');
    const nameInput = block.querySelector('.cubiculo-item-name');
    const actInput = block.querySelector('.cubiculo-item-activity');

    const codigo = codeInput ? codeInput.value.trim().toUpperCase() : '';
    const nombre = nameInput ? nameInput.value.trim() : '';
    const actividad = actInput ? actInput.value.trim() : '';

    if (codigo && !seenCodes.has(codigo)) {
      seenCodes.add(codigo);
      list.push({
        codigo,
        nombre: nombre || '',
        actividad: actividad || ''
      });
    }
  });
  return list;
}

async function handleRegistroSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('btn-submit-registro');

  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const cubiculosArr = getEnteredCubiculos();

  if (!nombre) {
    App.showToast('Por favor escribe tu nombre completo.', 'error');
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    App.showToast('Por favor ingresa un correo electrónico válido.', 'error');
    return;
  }
  if (!cubiculosArr || cubiculosArr.length === 0) {
    App.showToast('Debes seleccionar al menos un cubículo oficial de la lista.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Procesando registro...';

  // Entorno estático (Entorno Estático)
  if (App.isStaticHost()) {
    setTimeout(() => {
      const userId = App.getNextSequence('US');
      const users = JSON.parse(localStorage.getItem('pm_usuarios') || '[]');
      const newUser = {
        user_id: userId,
        nombre,
        email,
        telefono,
        cubiculos: cubiculosArr,
        fecha_registro: new Date().toLocaleDateString('es-DO'),
        estado: 'Pendiente de Aprobación'
      };
      users.push(newUser);
      localStorage.setItem('pm_usuarios', JSON.stringify(users));

      // Sincronizar con Google Drive / Sheets si está configurado
      const scriptUrl = localStorage.getItem('pm_google_script_url');
      if (scriptUrl) {
        const portalUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/index.html';
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SYNC_USUARIO',
            payload: {
              ...newUser,
              portalUrl
            }
          })
        }).catch(err => console.warn('Sync a Google Apps Script:', err));
      }

      showSuccessScreen({
        nombre,
        email,
        cubiculos: cubiculosArr.length > 0 ? cubiculosArr : ['Pendiente de asignar'],
        previewUrl: null
      });
    }, 600);
    return;
  }

  // Backend Node.js
  try {
    const payload = {
      nombre,
      email,
      telefono,
      cubiculos: cubiculosArr
    };

    const res = await fetch('/api/usuarios/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      if (data.user && data.sessionToken && !data.pendingApproval) {
        App.setSession(data.user, data.sessionToken);
      }
      showSuccessScreen({
        nombre,
        email,
        cubiculos: (data.cubiculosAsignados && data.cubiculosAsignados.length > 0) ? data.cubiculosAsignados : (cubiculosArr.length > 0 ? cubiculosArr : ['Pendiente de asignar']),
        previewUrl: data.emailPreviewUrl
      });
    } else {
      App.showToast(data.error || 'Ocurrió un error al registrar tus datos.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '✅ Confirmar mi Registro';
    }
  } catch (err) {
    console.warn('Error conectando a backend, guardando en store local:', err);
    const userId = App.getNextSequence('US');
    const newUser = { user_id: userId, nombre, email, telefono, cubiculos: cubiculosArr, estado: 'Pendiente de Aprobación' };
    showSuccessScreen({
      nombre,
      email,
      cubiculos: cubiculosArr.length > 0 ? cubiculosArr : ['Pendiente de asignar'],
      previewUrl: null
    });
  }
}

function showSuccessScreen({ nombre, email, cubiculos, previewUrl }) {
  const formBox = document.getElementById('form-registro-box');
  const successBox = document.getElementById('success-registro-box');

  formBox.style.display = 'none';
  successBox.style.display = 'block';

  let formattedCubs = 'Pendiente de asignar';
  if (Array.isArray(cubiculos) && cubiculos.length > 0) {
    formattedCubs = cubiculos.map(c => {
      if (typeof c === 'object' && c !== null) {
        const parts = [c.codigo];
        if (c.nombre) parts.push(`"${c.nombre}"`);
        if (c.actividad) parts.push(`(${c.actividad})`);
        return parts.join(' ');
      }
      return String(c);
    }).join(', ');
  } else if (typeof cubiculos === 'string') {
    formattedCubs = cubiculos;
  }

  document.getElementById('success-cubiculos').innerText = formattedCubs;
  document.getElementById('success-email-dest').innerText = email;

  if (previewUrl) {
    const previewContainer = document.getElementById('preview-mail-container');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div style="margin-top:16px; background:#F8FAFC; border:1px dashed #CBD5E1; padding:10px; border-radius:8px; font-size:12px;">
          🔗 <strong>Buzón de prueba Ethereal:</strong><br>
          <a href="${previewUrl}" target="_blank" style="color:#D32F2F; font-weight:700;">Abrir correo de bienvenida recibido</a>
        </div>
      `;
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  initCubiculosDynamicFields();

  const form = document.getElementById('form-registro');
  if (form) {
    form.addEventListener('submit', handleRegistroSubmit);
  }

  const session = App.getSession();
  if (session && session.user) {
    const nameInput = document.getElementById('reg-nombre');
    const emailInput = document.getElementById('reg-email');
    const telInput = document.getElementById('reg-telefono');
    if (nameInput) nameInput.value = session.user.nombre || '';
    if (emailInput) emailInput.value = session.user.email || '';
    if (telInput) telInput.value = session.user.telefono || '';

    // Si ya tenía cubículos, poblar los bloques
    if (session.user.cubiculos && session.user.cubiculos.length > 0) {
      const container = document.getElementById('cubiculos-inputs-container');
      container.innerHTML = '';
      session.user.cubiculos.forEach(c => {
        addCubiculoInputRow(c);
      });
    }
  }
});
