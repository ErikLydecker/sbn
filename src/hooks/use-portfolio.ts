import { usePortfolioStore } from '@/stores/portfolio.store'

export function usePortfolio() {
  return usePortfolioStore()
}
