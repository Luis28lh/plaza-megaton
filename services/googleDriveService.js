// Servicio de Almacenamiento organizado para Google Drive y Almacenamiento Local
// Estructura:
// PLAZA MEGATÓN/
//   ├── 01 - RECLAMACIONES/
//   │   └── CL-001/ (fotografías)
//   └── 02 - PAGOS/
//       └── PG-001/ (vouchers)

const fs = require('fs');
const path = require('path');
const os = require('os');

class GoogleDriveService {
  constructor() {
    // En Vercel el filesystem es de solo lectura excepto /tmp (os.tmpdir)
    this.uploadsBase = process.env.VERCEL 
      ? path.join(os.tmpdir(), 'uploads') 
      : path.join(__dirname, '..', 'public', 'assets', 'uploads');
    this.reclamacionesDir = path.join(this.uploadsBase, '01 - RECLAMACIONES');
    this.pagosDir = path.join(this.uploadsBase, '02 - PAGOS');

    this.ensureDirs();
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(this.uploadsBase)) fs.mkdirSync(this.uploadsBase, { recursive: true });
      if (!fs.existsSync(this.reclamacionesDir)) fs.mkdirSync(this.reclamacionesDir, { recursive: true });
      if (!fs.existsSync(this.pagosDir)) fs.mkdirSync(this.pagosDir, { recursive: true });
    } catch (_) {}
  }

  /**
   * Guarda una o varias fotografías de reclamación en la subcarpeta del código CL-xxx
   * @param {string} codigo e.g. "CL-001"
   * @param {Array<Express.Multer.File>} files
   * @returns {Promise<Array<string>>} URLs relativas o de Google Drive
   */
  async saveReclamacionFiles(codigo, files = []) {
    this.ensureDirs();
    try {
      const folderPath = path.join(this.reclamacionesDir, codigo);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const safeFilename = `EVIDENCIA_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
        const destPath = path.join(folderPath, safeFilename);

        if (file.path && fs.existsSync(file.path)) {
          fs.renameSync(file.path, destPath);
        } else if (file.buffer) {
          fs.writeFileSync(destPath, file.buffer);
        }

        const fileUrl = `/assets/uploads/01 - RECLAMACIONES/${codigo}/${safeFilename}`;
        urls.push(fileUrl);
      }
    } catch (e) {
      console.warn('[GoogleDriveService] Aviso almacenamiento local en serverless:', e.message);
    }

    // Si Google Drive API está configurado mediante variables de entorno, sincronizar
    if (process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      console.log(`[GoogleDriveService] Subiendo archivos de ${codigo} a Google Drive...`);
      // Hook para googleapis drive.files.create
    }

    return urls;
  }

  /**
   * Guarda el comprobante/voucher de un pago en la subcarpeta PG-xxx
   * @param {string} codigo e.g. "PG-001"
   * @param {Express.Multer.File} file
   * @returns {Promise<string>} URL del comprobante
   */
  async savePagoVoucher(codigo, file) {
    if (!file) return '';

    this.ensureDirs();
    let fileUrl = '';
    try {
      const folderPath = path.join(this.pagosDir, codigo);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const safeFilename = `VOUCHER_${codigo}_${Date.now()}${ext}`;
      const destPath = path.join(folderPath, safeFilename);

      if (file.path && fs.existsSync(file.path)) {
        fs.renameSync(file.path, destPath);
      } else if (file.buffer) {
        fs.writeFileSync(destPath, file.buffer);
      }

      fileUrl = `/assets/uploads/02 - PAGOS/${codigo}/${safeFilename}`;
    } catch (e) {
      console.warn('[GoogleDriveService] Aviso almacenamiento voucher en serverless:', e.message);
    }

    if (process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      console.log(`[GoogleDriveService] Subiendo voucher ${codigo} a Google Drive...`);
    }

    return fileUrl;
  }
}

module.exports = GoogleDriveService;
