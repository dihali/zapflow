const { Router } = require('express');
const multer = require('multer');
const { list, create, importCsv, remove, bulkDelete } = require('../controllers/contacts.controller');
const auth = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Apenas arquivos CSV ou Excel (.xlsx, .xls) são aceitos'));
  },
});
const router = Router();

router.use(auth);

router.get('/', list);
router.post('/', create);
router.post('/import', upload.single('file'), importCsv);
router.delete('/bulk', bulkDelete);
router.delete('/:id', remove);

module.exports = router;
