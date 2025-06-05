const { v4: uuidv4 } = require('uuid');


function generateId() {
  return uuidv4(); // Generează UUID standard
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isImageFile(mimetype) {
  return mimetype.startsWith('image/');
}

module.exports = {
  generateId,
  formatFileSize,
  isImageFile
};
