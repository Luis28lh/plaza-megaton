// Controlador Global y Utilidades de Frontend - Plaza Megatón
// Compatible con Servidor Local Node.js y Despliegue Remoto en GitHub Pages

const App = {
  // Manejo de sesión local
  getSession() {
    try {
      const token = localStorage.getItem('megaton_token');
      const userRaw = localStorage.getItem('megaton_user');
      if (!token || !userRaw) return null;
      return { token, user: JSON.parse(userRaw) };
    } catch (_) {
      return null;
    }
  },

  setSession(user, token) {
    if (token) localStorage.setItem('megaton_token', token);
    if (user) localStorage.setItem('megaton_user', JSON.stringify(user));
    this.updateUserHeader();
  },

  clearSession() {
    localStorage.removeItem('megaton_token');
    localStorage.removeItem('megaton_user');
    window.location.href = 'index.html';
  },

  // Notificaciones Toast flotantes
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  },

  // Compresión automática de imágenes en el cliente (Canvas)
  // Convierte fotos pesadas de celulares (4MB-10MB) en JPEG optimizados de ~300KB
  async compressImage(file, maxDimension = 1600, quality = 0.8) {
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          }, 'image/jpeg', quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // Formato de moneda dominicana
  formatCurrency(value) {
    if (!value) return 'RD$ 0.00';
    const num = parseFloat(String(value).replace(/[^0-9.-]+/g, '')) || 0;
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(num).replace('DOP', 'RD$');
  },

  // Actualiza el indicador del usuario en la barra superior
  updateUserHeader() {
    const pill = document.getElementById('user-header-pill');
    if (!pill) return;

    const session = this.getSession();
    if (session && session.user) {
      const firstName = (session.user.nombre || 'Usuario').split(' ')[0];
      const cubs = Array.isArray(session.user.cubiculos) 
        ? session.user.cubiculos.map(c => typeof c === 'object' ? c.codigo : c).join(', ')
        : '';
      pill.innerHTML = `👤 ${firstName} ${cubs ? `(${cubs})` : ''} <span style="font-size: 10px; opacity: 0.8; margin-left: 4px;">▼</span>`;
      pill.title = 'Sesión activa. Haz clic para cambiar de cuenta.';
      pill.onclick = (e) => {
        e.preventDefault();
        if (confirm(`¿Cerrar sesión de ${session.user.nombre}?`)) {
          this.clearSession();
        }
      };
    } else {
      pill.innerHTML = `🔑 Acceder`;
      pill.onclick = () => {
        window.location.href = 'login.html';
      };
    }
  },

  // Inicialización de componentes comunes
  init() {
    this.updateUserHeader();

    // Resaltar navegación activa
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (currentPath.includes(href) || (currentPath.endsWith('/') && href.includes('index')))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Inicializar almacenamiento local autónomo si corre en GitHub Pages
    if (this.isStaticHost()) {
      this.initLocalStore();
    }
  },

  // Detecta si corre en GitHub Pages u otro host estático sin backend Node
  isStaticHost() {
    return window.location.hostname.includes('github.io') || window.location.protocol === 'file:';
  },

  // Almacenamiento local persistente para funcionamiento en GitHub Pages (offline/remoto)
  initLocalStore() {
    if (!localStorage.getItem('pm_cubiculos')) {
      const cubs = [];
      for (let i = 1; i <= 30; i++) {
        const cod = 'C-' + (i < 10 ? '00' + i : (i < 100 ? '0' + i : i));
        cubs.push({
          cubiculo_id: 'CUB-' + (i < 10 ? '00' + i : i),
          codigo: cod,
          estado: 'Disponible',
          observaciones: 'Pasillo Principal'
        });
      }
      localStorage.setItem('pm_cubiculos', JSON.stringify(cubs));
    }
    if (!localStorage.getItem('pm_usuarios')) localStorage.setItem('pm_usuarios', '[]');
    if (!localStorage.getItem('pm_reclamaciones')) localStorage.setItem('pm_reclamaciones', '[]');
    if (!localStorage.getItem('pm_pagos')) localStorage.setItem('pm_pagos', '[]');
    if (!localStorage.getItem('pm_historial')) {
      localStorage.setItem('pm_historial', JSON.stringify([{
        id: 'H-001',
        tipo_documento: 'SISTEMA',
        codigo_documento: 'INIT',
        fecha: new Date().toLocaleDateString('es-DO'),
        hora: '12:00 PM',
        usuario: 'Sistema',
        accion: 'Catálogo inicializado',
        estado_anterior: '',
        estado_nuevo: 'ACTIVO',
        observacion: '30 cubículos disponibles en Plaza Megatón'
      }]));
    }
    if (!localStorage.getItem('pm_counters')) {
      localStorage.setItem('pm_counters', JSON.stringify({ US: 0, CL: 0, PG: 0 }));
    }
  },

  // Generador de secuencias en entorno estático
  getNextSequence(prefix) {
    const counters = JSON.parse(localStorage.getItem('pm_counters') || '{"US":0,"CL":0,"PG":0}');
    counters[prefix] = (counters[prefix] || 0) + 1;
    localStorage.setItem('pm_counters', JSON.stringify(counters));
    return `${prefix}-${String(counters[prefix]).padStart(3, '0')}`;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
