const { Router } = require('express');
const { getByCampaign, getDashboardStats } = require('../controllers/messages.controller');
const auth = require('../middleware/auth');

const router = Router();

router.use(auth);

router.get('/stats', getDashboardStats);
router.get('/campaign/:campaignId', getByCampaign);

module.exports = router;
