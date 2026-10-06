import type { Request, Response } from 'express';

const LTA_BASE_URL = 'https://datamall2.mytransport.sg/ltaodataservice';

// Allowed LTA DataMall endpoints
const ALLOWED_ENDPOINTS = new Set([
  'CarParkAvailabilityv2',
  'EVChargingPoints',
  'TrafficIncidents',
  'TaxiAvailability',
  'VMS',
  'BusArrivalv2',
  'EstTravelTimes',
  'TrafficSpeedBandsv2'
]);

export default async function ltaHandler(req: Request, res: Response) {
  const ltaKey = process.env.LTA_ACCOUNT_KEY;

  if (!ltaKey) {
    return res.status(503).json({
      error: 'LTA_ACCOUNT_KEY environment variable is not configured.',
      message: 'Please set LTA_ACCOUNT_KEY in your server environment variables (.env file).',
      status: 'unconfigured'
    });
  }

  // Get requested LTA endpoint from query or path
  const endpoint = (req.query.endpoint as string) || 'CarParkAvailabilityv2';

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({
      error: `Unsupported endpoint: ${endpoint}`,
      allowedEndpoints: Array.from(ALLOWED_ENDPOINTS)
    });
  }

  // Pass through any additional query params (e.g. BusStopCode, ServiceNo, skip)
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'endpoint' && typeof value === 'string') {
      queryParams.append(key, value);
    }
  }

  const queryString = queryParams.toString();
  const targetUrl = `${LTA_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ''}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const ltaResponse = await fetch(targetUrl, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      signal: controller.signal,
      headers: {
        'AccountKey': ltaKey,
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (!ltaResponse.ok) {
      return res.status(ltaResponse.status).json({
        error: `LTA DataMall responded with status ${ltaResponse.status}`,
        endpoint,
        statusText: ltaResponse.statusText
      });
    }

    const data = await ltaResponse.json();
    return res.status(200).json({
      status: 'success',
      endpoint,
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    return res.status(504).json({
      error: 'LTA DataMall request timed out or network error occurred',
      endpoint,
      details: error.message
    });
  }
}
