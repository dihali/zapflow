const { Router } = require('express');
const { register, login, me, updateInstance } = require('../controllers/auth.controller');
const auth = require('../middleware/auth');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, me);
router.patch('/instance', auth, updateInstance);

module.exports = router;
