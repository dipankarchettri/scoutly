export interface Startup {
  id: string;
  name: string;
  fundingAmount: string;
  roundType: string;
  dateAnnounced: string;
  dateAnnouncedISO?: Date;
  description: string;
  investors: string[];
  teamSize?: string;
  founders: string[]; // Legacy field
  contactInfo?: {
    founders?: string[];
    email?: string;
    socials?: {
      twitter?: string;
      linkedin?: string;
    };
  };
  industry?: string;
  website?: string;
  location?: string;
  contactEmail?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    crunchbase?: string;
  };
  sources: string[];
  tags: string[];
  confidence?: number; // New field
  sourceUrl?: string; // New field
}

export type Timeframe = 'today' | 'yesterday' | '2_days' | 'week' | 'month' | 'quarter';

export interface FilterConfig {
  onlyNew: boolean;
  minValuation?: string;
  maxValuation?: string;
  domain?: string;
  teamSize?: string;
  foundedYear?: string;
  sort?: 'date' | 'amount';
}

export interface SearchState {
  isLoading: boolean;
  error: string | null;
  data: Startup[];
  lastUpdated: Date | null;
  queryTime: number;
}

// New Search Types
export interface SearchResponse {
  success: boolean;
  data: {
    companies: CompanyData[];
    pagination: {
      page: number;
      totalPages: number;
      totalCompanies: number;
      perPage: number;
    };
    meta: {
      query: string;
      sources: string[];
      totalLatencyMs: number;
    };
  };
  credits?: {
    tier: 'free' | 'paid';
    used: number;
    remaining: number;
  };
}

export interface CompanyData {
  name: string;
  description: string;
  website?: string;
  fundingAmount?: string;
  roundType?: string;
  dateAnnounced?: string;
  dateAnnouncedISO?: Date;
  location?: string;
  industry?: string;
  founders?: string[];
  investors?: string[];
  tags?: string[];
  source: string;
  sourceUrl: string;
  confidence: number;
}