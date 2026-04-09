import { Injectable } from '@nestjs/common';
import { CollectionStatus } from '../prisma/client';
import { CardQueryMode } from './dto/list-cards-query.dto';
import { TitleNormalizationService } from './title-normalization.service';

export type CatalogSearchFilters = {
  searchText?: string;
  collectionStatus?: CollectionStatus;
  year?: number;
  sport?: string;
  cardNumber?: string;
  brand?: string;
  setName?: string;
  season?: string;
  isForTrade?: boolean;
  isForSale?: boolean;
  isAutographed?: boolean;
  isVintage?: boolean;
  priority?: number;
};

@Injectable()
export class CatalogQueryService {
  constructor(private readonly titleNormalizationService: TitleNormalizationService) {}

  interpret(query: string | undefined, queryMode: CardQueryMode | undefined): CatalogSearchFilters {
    const trimmed = query?.trim();
    if (!trimmed) {
      return {};
    }

    if (queryMode !== CardQueryMode.NL) {
      return {
        searchText: trimmed,
      };
    }

    const normalized = this.titleNormalizationService.parseDeterministic(trimmed);
    let working = ` ${trimmed.toLowerCase()} `;
    const filters: CatalogSearchFilters = {
      ...normalized.search,
    };

    const yearMatch = working.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      filters.year = Number(yearMatch[1]);
      working = working.replace(yearMatch[0], ' ');
    }

    const collectionPatterns: Array<[RegExp, CollectionStatus]> = [
      [/\b(wanted|wishlist|wish list)\b/, CollectionStatus.WANTED],
      [/\b(owned|collection|binder)\b/, CollectionStatus.OWNED],
    ];

    for (const [pattern, value] of collectionPatterns) {
      if (pattern.test(working)) {
        filters.collectionStatus = value;
        working = working.replace(pattern, ' ');
        break;
      }
    }

    if (/\b(for trade|trade bait|trade)\b/.test(working)) {
      filters.isForTrade = true;
      working = working.replace(/\b(for trade|trade bait|trade)\b/g, ' ');
    }

    if (/\b(for sale|sale|selling)\b/.test(working)) {
      filters.isForSale = true;
      working = working.replace(/\b(for sale|sale|selling)\b/g, ' ');
    }

    if (/\b(autograph|autographed|signed|auto)\b/.test(working)) {
      filters.isAutographed = true;
      working = working.replace(/\b(autograph|autographed|signed|auto)\b/g, ' ');
    }

    if (/\b(vintage|classic|old school)\b/.test(working)) {
      filters.isVintage = true;
      working = working.replace(/\b(vintage|classic|old school)\b/g, ' ');
    }

    const priorityMatch = working.match(/\bpriority\s*(\d{1,2})\b/);
    if (priorityMatch) {
      filters.priority = Number(priorityMatch[1]);
      working = working.replace(priorityMatch[0], ' ');
    } else if (/\b(high priority|must have)\b/.test(working)) {
      filters.priority = 1;
      working = working.replace(/\b(high priority|must have)\b/g, ' ');
    }

    const sports = ['baseball', 'basketball', 'football', 'hockey', 'soccer', 'pokemon', 'golf'];
    const matchedSport = sports.find((candidate) => working.includes(candidate));
    if (matchedSport) {
      filters.sport = matchedSport;
      working = working.replace(new RegExp(`\\b${matchedSport}\\b`, 'g'), ' ');
    }

    const searchText = working.replace(/\s+/g, ' ').trim();
    if (searchText && !filters.searchText) {
      filters.searchText = searchText;
    }

    return filters;
  }
}
