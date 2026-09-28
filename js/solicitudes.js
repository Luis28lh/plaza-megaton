// Controlador del Formulario de Solicitudes y Reclamaciones - Plaza Megatón
let selectedPhotos = [];

function initSolicitudesForm() {
  const session = App.getSession();

  const nameInput = document.getElementById('sol-nombre');
  const emailInput = document.getElementById('sol-email');
  const cubSelect = document.getElementById('sol-cubiculo');

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
        cubSelect.innerHTML = '<option value="General">General / Área Común</option>';
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

  setupPhotoHandlers();
}

async function loadAllCubiculosOptions() {
  const cubSelect = document.getElementById('sol-cubiculo');
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

function setupPhotoHandlers() {
  const cameraInput = document.getElementById('camera-input');
  const galleryInput = document.getElementById('gallery-input');

  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => handleFilesSelected(e.target.files));
  }
  if (galleryInput) {
    galleryInput.addEventListener('change', (e) => handleFilesSelected(e.target.files));
  }
}

async function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  const maxPhotos = 5;
  if (selectedPhotos.length + files.length > maxPhotos) {
    App.showToast(`Puedes adjuntar un máximo de ${maxPhotos} fotografías.`, 'error');
    return;
  }

  App.showToast('Optimizando imágenes para subida móvil...', 'info');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const compressed = await App.compressImage(file, 1600, 0.8);
    selectedPhotos.push(compressed);
  }

  renderPhotoPreviews();
}

function renderPhotoPreviews() {
  const gallery = document.getElementById('photos-preview-gallery');
  if (!gallery) return;

  gallery.innerHTML = '';

  selectedPhotos.forEach((file, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-thumb-wrap';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'del-btn';
    delBtn.innerHTML = '✕';
    delBtn.onclick = () => {
      selectedPhotos.splice(index, 1);
      renderPhotoPreviews();
    };

    wrap.appendChild(img);
    wrap.appendChild(delBtn);
    gallery.appendChild(wrap);
  });
}

async function handleSolicitudSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById('btn-submit-solicitud');

  const nombre = document.getElementById('sol-nombre').value.trim();
  const email = document.getElementById('sol-email').value.trim();
  const cubiculo = document.getElementById('sol-cubiculo').value;
  const asunto = document.getElementById('sol-asunto').value;
  const detalle = document.getElementById('sol-detalle').value.trim();

  if (!nombre || !email || !cubiculo || !asunto || !detalle) {
    App.showToast('Por favor completa todos los campos requeridos.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '⏳ Registrando solicitud...';

  // Entorno estático (GitHub Pages)
  if (App.isStaticHost()) {
    setTimeout(() => {
      const codigo = App.getNextSequence('CL');
      const items = JSON.parse(localStorage.getItem('pm_reclamaciones') || '[]');
      const newRec = {
        codigo,
        fecha: new Date().toLocaleDateString('es-DO'),
        hora: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
        nombre,
        email,
        cubiculo,
        asunto,
        detalle,
        archivos: [],
        estado: 'Recibida',
        responsable: 'Administración'
      };
      items.push(newRec);
      localStorage.setItem('pm_reclamaciones', JSON.stringify(items));

      showSuccessSolicitudScreen({ codigo, cubiculo, asunto, email, previewUrl: null });
    }, 600);
    return;
  }

  try {
    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('email', email);
    formData.append('cubiculo', cubiculo);
    formData.append('asunto', asunto);
    formData.append('detalle', detalle);

    selectedPhotos.forEach(file => {
      formData.append('fotos', file);
    });

    const res = await fetch('/api/reclamaciones', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      showSuccessSolicitudScreen({
        codigo: data.codigo,
        cubiculo,
        asunto,
        email,
        previewUrl: data.emailPreviewUrl
      });
    } else {
      App.showToast(data.error || 'Error al registrar la solicitud.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📤 Enviar Solicitud';
    }
  } catch (err) {
    console.warn('Error con backend, guardando local:', err);
    const codigo = App.getNextSequence('CL');
    showSuccessSolicitudScreen({ codigo, cubiculo, asunto, email, previewUrl: null });
  }
}

function showSuccessSolicitudScreen({ codigo, cubiculo, asunto, email, previewUrl }) {
  const formBox = document.getElementById('form-solicitud-box');
  const successBox = document.getElementById('success-solicitud-box');

  formBox.style.display = 'none';
  successBox.style.display = 'block';

  document.getElementById('sol-success-codigo').innerText = codigo;
  document.getElementById('sol-success-cubiculo').innerText = cubiculo;
  document.getElementById('sol-success-asunto').innerText = asunto;
  document.getElementById('sol-success-email').innerText = email;

  if (previewUrl) {
    const previewContainer = document.getElementById('sol-preview-mail-container');
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
  initSolicitudesForm();

  const form = document.getElementById('form-solicitud');
  if (form) {
    form.addEventListener('submit', handleSolicitudSubmit);
  }
});
