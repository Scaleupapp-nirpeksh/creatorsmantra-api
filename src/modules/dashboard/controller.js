const { asyncHandler } = require('../../shared/utils')
const DashboardService = require('./service')

class DashboardController {
  /**
   * Fetch Deals Data
   * GET /api/v1/dashboard/reports
   */
  getReports(req, res, next) {
    return asyncHandler(async (req, res) => {
      const userId = req.user.id
      const result = await DashboardService.getReports(userId)
      res.status(201).json(result)
    })(req, res, next)
  }
}

module.exports = new DashboardController()
