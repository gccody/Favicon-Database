import axios from 'axios';
import express from 'express';
import { FaviconScraper } from './faviconScraper';

const app = express();
const port = process.env.PORT || 3000;

// In-memory cache: URL -> {data: Buffer, type: string} | null
const cache = new Map<string, {data: Buffer, type: string} | null>();

app.get('/favicon', async (req: express.Request, res: express.Response) => {
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  // Check cache
  if (cache.has(url)) {
    const cached = cache.get(url);
    if (cached) {
      res.set('Content-Type', cached.type);
      return res.send(cached.data);
    } else {
      return res.status(404).send('Favicon not found');
    }
  }

  try {
    // Get favicon URL
    const faviconResult = await FaviconScraper.getFavicon(url);

    if (!faviconResult) {
      cache.set(url, null);
      return res.status(404).send('Favicon not found');
    }

    // Download the image
    const imageResponse = await axios.get(faviconResult.url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      validateStatus: (status) => status === 200,
    });

    const imageData = Buffer.from(imageResponse.data as ArrayBuffer);
    const contentType = imageResponse.headers['content-type'] || 'image/x-icon';

    // Cache the image
    cache.set(url, { data: imageData, type: contentType });

    // Serve the image
    res.set('Content-Type', contentType);
    res.send(imageData);
  } catch (error) {
    console.error('Error fetching favicon:', error);
    res.status(500).send('Internal server error');
  }
});

app.listen(port, () => {
  console.log(`Favicon API server running on port ${port}`);
});