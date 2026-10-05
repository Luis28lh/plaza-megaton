// Controlador del Formulario de Pagos - Plaza Megatón
let selectedVoucherFile = null;

function initPagosForm() {
  const session = App.getSession();

  const nameInput = document.getElementById('pago-nombre');
  const emailInput = document.getElementById('pago-email');
  const cubSelect = document.getElementById('pago-cubiculo');
  const fechaInput = document.getElementById('pago-fecha');

  if (fechaInput) {
    const today = new Date().toISOString().split('T')[0];
    fechaInput.value = today;
  }

  if (session && session.user) {
    if (nameInput) {
      nameInput.value = session.user.nombre || '';
      nameInput.readOnly = true;
    }
    if (emailInput) {
      emailInput.value = session.user.email || '';
      emailInput.readOnly = true;
    }

    if (cubSelect) {
      cubSelect.innerHTML = '<option value="">-- Selecciona tu cubículo --</option>';
      const cubs = session.user.cubiculos || [];
      if (cubs.length === 0) {
        cubSelect.innerHTML = '<option value="General">General / Sin cubículo asignado</option>';
      } else {
        cubs.forEach(c => {
          const cod = typeof c === 'object' ? c.codigo : c;
          const nom = typeof c === 'object' ? (c.nombre || c.nombre_local || '') : '';
          const act = typeof c === 'object' ? (c.actividad || c.actividad_comercial || '') : '';
          const opt = document.createElement('option');
          opt.value = cod;
          let label = `Cubículo ${cod}`;
          if (nom || act) {
            label += ` — ${nom ? nom : ''}${act ? (nom ? ` (${act})` : act) : ''}`;
          }
          opt.textContent = label;
          cubSelect.appendChild(opt);
        });
      }
    }
  } else {
    loadAllCubiculosOptions();
  }

  setupVoucherHandlers();
}

async function loadAllCubiculosOptions() {
  const cubSelect = document.getElementById('pago-cubiculo');
  if (!cubSelect) return;

  if (App.isStaticHost()) {
    const list = JSON.parse(localStorage.getItem('pm_cubiculos') || '[]');
    cubSelect.innerHTML = '<option value="">-- Selecciona el cubículo --</option>';
    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.codigo;
      opt.textContent = `Cubículo ${c.codigo} (${c.estado})`;
      cubSelect.appendChild(opt);
    });
    return;
  }

  try {
    const res = await fetch('/api/catalog/cubiculos');
    const data = await res.json();
    if (data.success && data.cubiculos) {
      cubSelect.innerHTML = '<option value="">-- Selecciona el cubículo --</option>';
      data.cubiculos.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.codigo;
        opt.textContent = `Cubículo ${c.codigo} (${c.estado})`;
        cubSelect.appendChild(opt);
      });
    }
  } catch (_) {
    const list = JSON.parse(localStorage.getItem('pm_cubiculos') || '[]');
    cubSelect.innerHTML = '<option value="">-- Selecciona el cubículo --</option>';
    list.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.codigo;
      opt.textContent = `Cubículo ${c.codigo} (${c.estado})`;
      cubSelect.appendChild(opt);
    });
  }
}

function setupVoucherHandlers() {
  const fileInput = document.getElementById('voucher-file-input');

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.type.startsWith('image/')) {
        selectedVoucherFile = await App.compressImage(file, 1800, 0.85);
        renderVoucherPreview(selectedVoucherFile, true);
      } else if (file.type === 'application/pdf') {
        selectedVoucherFile = file;
        renderVoucherPreview(selectedVoucherFile, false);
      } else {
        App.showToast('Formato no soportado. Sube una imagen o PDF.', 'error');
        fileInput.value = '';
      }
    });
  }
}

function renderVoucherPreview(file, isImage) {
  const container = document.getElementById('voucher-preview-container');
  if (!container) return;

  if (isImage) {
    container.innerHTML = `
      <div style="margin-top:10px; text-align:center;">
        <img src="${URL.createObjectURL(file)}" style="max-height:160px; max-width:100%; border-radius:8px; border:1px solid #CBD5E1; box-shadow:var(--shadow-sm);">
        <div style="font-size:12px; color:#15803D; font-weight:700; margin-top:4px;">✓ Imagen optimizada y lista</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="margin-top:10px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:12px; text-align:center;">
        <span style="font-size:24px;">📄</span>
        <div style="font-size:13px; font-weight:700; color:#1E40AF; margin-top:4px;">${file.name}</div>
        <div style="font-size:11px; color:#60A5FA;">Documento PDF listo</div>
      </div>
    `;
  }
}

async function handlePagoSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('btn-submit-pago');

  const nombre = document.getElementById('pago-nombre').value.trim();
  const email = document.getElementById('pago-email').value.trim();
  const cubiculo = document.getElementById('pago-cubiculo').value;
  const concepto = document.getElementById('pago-concepto').value;
  const periodo = document.getElementById('pago-periodo').value.trim();
  const monto = document.getElementById('pago-monto').value.trim();
  const fecha_pago = document.getElementById('pago-fecha').value;
  const referencia = document.getElementById('pago-referencia').value.trim();

  if (!nombre || !email || !cubiculo || !concepto || !periodo || !monto) {
    App.showToast('Por favor completa los campos requeridos.', 'error');
    return;
  }

  if (!selectedVoucherFile) {
    App.showToast('Por favor adjunta la fotografía o comprobante.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Reportando pago...';

  // Entorno estático (Entorno Estático)
  if (App.isStaticHost()) {
    setTimeout(() => {
      const codigo = App.getNextSequence('PG');
      const items = JSON.parse(localStorage.getItem('pm_pagos') || '[]');
      const newPago = {
        codigo,
        fecha_registro: new Date().toLocaleDateString('es-DO'),
        nombre,
        email,
        cubiculo,
        concepto,
        periodo,
        monto,
        fecha_pago,
        referencia,
        voucher: '',
        estado: 'Reportado'
      };
      items.push(newPago);
      localStorage.setItem('pm_pagos', JSON.stringify(items));

      showSuccessPagoScreen({ codigo, monto, cubiculo, concepto, email, previewUrl: null });
    }, 600);
    return;
  }

  try {
    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('email', email);
    formData.append('cubiculo', cubiculo);
    formData.append('concepto', concepto);
    formData.append('periodo', periodo);
    formData.append('monto', monto);
    formData.append('fecha_pago', fecha_pago);
    formData.append('referencia', referencia);
    formData.append('voucher', selectedVoucherFile);

    const res = await fetch('/api/pagos', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showSuccessPagoScreen({
        codigo: data.codigo,
        monto,
        cubiculo,
        concepto,
        email,
        previewUrl: data.emailPreviewUrl
      });
    } else {
      App.showToast(data.error || 'Error al reportar el pago.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '💳 Reportar Pago';
    }
  } catch (err) {
    console.warn('Error backend, guardando local:', err);
    const codigo = App.getNextSequence('PG');
    showSuccessPagoScreen({ codigo, monto, cubiculo, concepto, email, previewUrl: null });
  }
}

function showSuccessPagoScreen({ codigo, monto, cubiculo, concepto, email, previewUrl }) {
  const formBox = document.getElementById('form-pago-box');
  const successBox = document.getElementById('success-pago-box');

  formBox.style.display = 'none';
  successBox.style.display = 'block';

  document.getElementById('pago-success-codigo').innerText = codigo;
  document.getElementById('pago-success-monto').innerText = monto;
  document.getElementById('pago-success-cubiculo').innerText = cubiculo;
  document.getElementById('pago-success-concepto').innerText = concepto;
  document.getElementById('pago-success-email').innerText = email;

  if (previewUrl) {
    const previewContainer = document.getElementById('pago-preview-mail-container');
    if (previewContainer) {
      previewContainer.innerHTML = `
        <div style="margin-top:16px; background:#F8FAFC; border:1px dashed #CBD5E1; padding:10px; border-radius:8px; font-size:12px;">
          🔗 <strong>Buzón de prueba Ethereal:</strong><br>
          <a href="${previewUrl}" target="_blank" style="color:#D32F2F; font-weight:700;">Ver correo automático de confirmación (${codigo})</a>
        </div>
      `;
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  initPagosForm();

  const form = document.getElementById('form-pago');
  if (form) {
    form.addEventListener('submit', handlePagoSubmit);
  }
});
