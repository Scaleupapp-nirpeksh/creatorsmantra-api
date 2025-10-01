const { successResponse, logError } = require('../../shared/utils')
const { Deal } = require('../deals/model')
const InvoiceService = require('../invoices/service')
const { RateCard } = require('../ratecards/model')
const ScriptService = require('../scripts/service')
const ContractService = require('../contracts/service')
const DealService = require('../deals/service')

class DashboardService {
  async getReports(userId, period = '30d', dateRange = {}) {
    try {
      // ============== DEALS ==============
      const dealPromObj = Deal.getRevenueAnalytics(userId, period)
      const dealPipelinePromObj = Deal.getDealPipelineData(userId, period)
      const revenueOverview = Deal.getRevenueOverview(userId)
      const upcomingTasksStats = Deal.getUpcomingTasks(userId)

      // ============== INVOICES ==============
      const invoicePromObj = InvoiceService.getInvoiceAnalytics(userId, dateRange)

      // ============== SCRIPTS ==============
      const scriptPromObj = ScriptService.getDashboardStats(userId)

      // ============== RATE CARDS ==============
      const rateCardPromObj = RateCard.find({ creatorId: userId })

      // ============== CONTRACTS ==============
      const contractsPromObj = ContractService.getContractAnalytics(userId)

      // ============== Common ==============
      const recentActivitesStats = Deal.getRecentActivites(userId)

      const [
        dealsReport,
        dealPipeline,
        revenueOverviewStats,
        invoiceReport,
        scriptsReport,
        rateCardsReport,
        contractsReport,
        recentActivities,
        upcomingTasks,
      ] = await Promise.all([
        dealPromObj,
        dealPipelinePromObj,
        revenueOverview,
        invoicePromObj,
        scriptPromObj,
        rateCardPromObj,
        contractsPromObj,
        recentActivitesStats,
        upcomingTasksStats,
      ])

      return successResponse(
        'Dashboard Reports fetched successfully',
        {
          stats: {
            dealsReport: {
              ...dealsReport[0],
              conversionRate:
                dealsReport[0].totalDeals > 0
                  ? (dealsReport[0].paidDeals / dealsReport[0].totalDeals) * 100
                  : 0,
            },
            invoiceReport,
            scriptsReport,
            rateCardsReport: {
              activeRateCards: rateCardsReport?.filter((item) => !item.isDeleted)?.length ?? 0,
              totalRateCards: rateCardsReport?.length ?? 0,
            },
            contractsReport,
          },
          dealPipelineStats: dealPipeline,
          revenueOverviewStats,
          recentActivities,
          upcomingTasks,
        },
        200
      )
    } catch (error) {
      logError('Failed to fetch data', { userId, error: error.message })
      throw error
    }
  }
}

module.exports = new DashboardService()
