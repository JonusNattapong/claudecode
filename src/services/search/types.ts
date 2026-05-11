export interface SearchResult {
  title: string
  url: string
  snippet?: string
  relevanceScore?: number
}

export interface SearchProvider {
  name: string
  description: string
  requiresApiKey: boolean
  apiKeyEnvVar?: string
  baseUrl?: string
  supportsPagination: boolean
  maxResultsPerPage: number
  rateLimit?: number // requests per minute

  search(query: string, options?: SearchOptions): Promise<SearchResponse>
}

export interface SearchOptions {
  num?: number
  start?: number
  language?: string
  region?: string
  safeSearch?: 'off' | 'moderate' | 'strict'
}

export interface SearchResponse {
  results: SearchResult[]
  totalResults?: number
  query: string
  provider: string
  creditsLeft?: number
}

export interface SearchProviderConfig {
  provider: string
  apiKey?: string
  defaultNumResults?: number
}