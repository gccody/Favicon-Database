#!/usr/bin/env node

import { FaviconScraper } from './faviconScraper';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: favicon-scraper <url>');
    process.exit(1);
  }

  const url = args[0];
  
  try {
    console.log(`Fetching favicon for: ${url}`);
    const favicon = await FaviconScraper.getFavicon(url);
    
    if (favicon) {
      console.log('Favicon found:');
      console.log(`URL: ${favicon.url}`);
      console.log(`Type: ${favicon.type || 'Unknown'}`);
      console.log(`Source: ${favicon.source}`);
    } else {
      console.log('No favicon found.');
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main().catch(console.error);