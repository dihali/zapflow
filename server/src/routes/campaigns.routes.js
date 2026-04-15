const { Router } = require('express');
const { list, getOne, create, approve, launch, pause, remove } = require('../controllers/campaigns.controller');
const auth = require('../middleware/auth');

const router = Router();

router.use(auth);

router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id/approve', approve);
router.post('/:id/launch', launch);
router.patch('/:id/pause', pause);
router.delete('/:id', remove);

module.exports = router;
