const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SCAN_EXTENSIONS = ['.stl', '.obj', '.ply', '.dcm'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const MAX_SCAN_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

const scanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/scans'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/images'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const uploadScan = multer({
  storage: scanStorage,
  limits: { fileSize: MAX_SCAN_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (SCAN_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid scan file type. Allowed: ${SCAN_EXTENSIONS.join(', ')}`));
    }
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type. Allowed: ${IMAGE_EXTENSIONS.join(', ')}`));
    }
  },
});

module.exports = { uploadScan, uploadImage };
