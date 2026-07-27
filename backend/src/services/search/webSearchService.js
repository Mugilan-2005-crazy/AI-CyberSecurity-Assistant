import logger from '../../utils/logger.js';
import config from '../../config/index.js';
import { sanitizePrompt } from '../../utils/sanitizePrompt.js';

const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = 8;

const SEARCH_TERMS_BLACKLIST = [
  /javascript\s*:/i,
  /<script/i,
  /on\w+\s*=/i,
];

const santizeQuery = (query) => {
  const result = sanitizePrompt(query);
  const cleaned = result.text;
  if (cleaned.length > MAX_QUERY_LENGTH) {
    return cleaned.slice(0, MAX_QUERY_LENGTH);
  }
  return cleaned;
};

const isQuerySafe = (query) => {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_QUERY_LENGTH) return false;
  for (const pattern of SEARCH_TERMS_BLACKLIST) {
    if (pattern.test(trimmed)) return false;
  }
  return true;
};

const buildSearchUrl = (query) => {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/search?q=${encodedQuery}&num=${MAX_RESULTS}`;
};

const fetchSearchResults = async (query) => {
  const url = buildSearchUrl(query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'CyberSecurityAssistant/1.0',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}`);
    }

    const html = await response.text();
    const results = extractResultsFromHtml(html);
    return results;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Search request timed out');
    }
    throw err;
  }
};

const extractResultsFromHtml = (html) => {
  const results = [];

  const headingRegex = /<h3[^>]*class="[^"]*LC20lb[^"]*"[^>]*>(.*?)<\/h3>/gi;
  const linkRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a>/gi;

  let headingMatch;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const title = headingMatch[1].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 5) {
      results.push({
        title,
        url: '',
        snippet: '',
      });
    }
  }

  let linkMatch;
  const usedUrls = new Set();
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const url = linkMatch[1];
    if (!usedUrls.has(url) && url.startsWith('http') && !url.includes('google.com')) {
      usedUrls.add(url);
      const existingResult = results.find((r) => r.url === url);
      if (existingResult) {
        existingResult.url = url;
      } else if (results.length < MAX_RESULTS) {
        results.push({
          title: '',
          url,
          snippet: '',
        });
      }
    }
  }

  return results.slice(0, MAX_RESULTS);
};

const generateSummary = (query, results) => {
  if (results.length === 0) {
    return 'No search results found for your query.';
  }

  const relevantResults = results.filter((r) => r.title || r.url);
  if (relevantResults.length === 0) {
    return 'No relevant search results found.';
  }

  const titles = relevantResults.map((r) => r.title).filter(Boolean);
  const urls = relevantResults.map((r) => r.url).filter(Boolean);

  return `Search results for "${query}":\n\n` +
    titles.map((t, i) => `${i + 1}. ${t}${urls[i] ? ` (${urls[i]})` : ''}`).join('\n') +
    '\n\nFor more details, please review the sources above.';
};

export const searchWeb = async (query) => {
  const sanitized = santizeQuery(query);

  if (!isQuerySafe(sanitized)) {
    logger.warn('[webSearch] Blocked unsafe query', { queryLength: sanitized.length });
    throw new Error('Invalid search query.');
  }

  logger.info('[webSearch] Searching for', { query: sanitized.slice(0, 100) });

  try {
    const results = await fetchSearchResults(sanitized);
    logger.info('[webSearch] Search completed', { resultCount: results.length });

    return {
      success: true,
      query: sanitized,
      results,
      summary: generateSummary(sanitized, results),
      sourceCount: results.length,
    };
  } catch (err) {
    logger.error(`[webSearch] Search failed: ${err.message}`);
    throw new Error('Web search service is currently unavailable. Please try again later.');
  }
};

export default { searchWeb };