// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateId } = require('../utils/helpers');

// Asigură-te că directoarele există
const uploadDir = 'public/uploads/chat';
const imageDir = path.join(uploadDir, 'images');
const fileDir = path.join(uploadDir, 'files');

[uploadDir, imageDir, fileDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configurarea storage-ului
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const uploadPath = isImage ? imageDir : fileDir;
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueId = generateId();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

// Filtrarea fișierelor
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Imagini
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    // Documente
    'application/pdf', 
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Alte tipuri comune
    'application/zip',
    'application/x-zip-compressed'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tip de fișier nepermis: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1 
  }
});

// Middleware pentru gestionarea erorilor de upload
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large', 
        message: 'Fișierul este prea mare. Mărimea maximă permisă este 10MB.' 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files', 
        message: 'Se poate încărca un singur fișier.' 
      });
    }
  }
  
  if (error.message.includes('Tip de fișier nepermis')) {
    return res.status(400).json({ 
      error: 'Invalid file type', 
      message: error.message 
    });
  }
  
  next(error);
};

module.exports = {
  upload,
  handleUploadError
};
