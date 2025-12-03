import { logMessage } from '../src/utils.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import adapterManager from '../src/adapterManager.js';
import { EVENTS } from '../src/constants.js';

const DEBOUNCE_DELAY = 200; // 0.2 second
const DEFAULT_CID = 5126;
const API_BASE_URL = 'https://b6.im-apps.net/bids';

const cache = {
  auctions: {},
  requestBidsData: null,
  requestBidsTimer: null,
  wonBidsData: null,
  wonBidsTimer: null
};

/**
 * Get current page URL
 * @returns {string} Current page URL
 */
function getPageUrl() {
  return window.location.href;
}

/**
 * Get CID from adapter options
 * @param {Object} options - Adapter options
 * @returns {string} CID or default value
 */
function getCid(options) {
  return (options && options.cid) || DEFAULT_CID;
}

/**
 * Build API endpoint URL
 * @param {string} cid - Customer ID
 * @param {string} endpoint - Endpoint path
 * @returns {string} Full API URL
 */
function buildApiUrl(cid, endpoint) {
  return `${API_BASE_URL}/${cid}/${endpoint}`;
}

/**
 * Send data to API endpoint using sendBeacon
 * @param {string} url - API endpoint URL
 * @param {Object} payload - Data to send
 */
function sendToApi(url, payload) {
  const data = JSON.stringify(payload);
  const blob = new Blob([data], { type: 'application/json' });
  navigator.sendBeacon(url, blob);
}

/**
 * Transform adUnit data for payload
 * @param {Object} adUnit - Ad unit object
 * @returns {Object} Transformed ad unit data
 */
function transformAdUnit(adUnit) {
  return {
    code: adUnit.code,
    mediaTypes: adUnit.mediaTypes,
    sizes: adUnit.sizes,
    bids: (adUnit.bids || []).map(bid => ({
      bidder: bid.bidder,
      params: bid.params
    }))
  };
}

/**
 * Transform auction data for payload
 * @param {Object} auctionArgs - Auction arguments
 * @returns {Object} Transformed auction data
 */
function transformAuctionData(auctionArgs) {
  return {
    auctionId: auctionArgs.auctionId,
    timestamp: auctionArgs.timestamp,
    timeout: auctionArgs.timeout,
    adUnitCodes: auctionArgs.adUnitCodes || [],
    adUnits: (auctionArgs.adUnits || []).map(transformAdUnit)
  };
}

/**
 * Transform bid won data for payload
 * @param {Object} bidWonArgs - Bid won arguments
 * @returns {Object} Transformed bid won data
 */
function transformBidWonData(bidWonArgs) {
  return {
    auctionId: bidWonArgs.auctionId,
    adId: bidWonArgs.adId,
    adUnitCode: bidWonArgs.adUnitCode,
    bidder: bidWonArgs.bidder || bidWonArgs.bidderCode,
    cpm: bidWonArgs.cpm,
    currency: bidWonArgs.currency,
    creativeId: bidWonArgs.creativeId,
    dealId: bidWonArgs.dealId,
    mediaType: bidWonArgs.mediaType,
    size: bidWonArgs.size,
    timeToRespond: bidWonArgs.timeToRespond,
    meta: bidWonArgs.meta || {}
  };
}

/**
 * Clear timer if exists
 * @param {number|null} timer - Timer ID
 * @returns {null}
 */
function clearTimer(timer) {
  if (timer) {
    clearTimeout(timer);
  }
  return null;
}

/**
 * Initialize or reset page-level data cache
 * @param {string} pageUrl - Current page URL
 * @returns {Object} Initialized cache object
 */
function initializePageCache(pageUrl) {
  return {
    pageUrl,
    timestamp: Date.now(),
    auctions: []
  };
}

/**
 * Initialize or reset won bids data cache
 * @param {string} pageUrl - Current page URL
 * @returns {Object} Initialized cache object
 */
function initializeWonBidsCache(pageUrl) {
  return {
    pageUrl,
    timestamp: Date.now(),
    wonBids: []
  };
}

// IM Analytics Adapter implementation
const imAnalyticsAdapter = Object.assign(
  adapter({ analyticsType: 'endpoint' }),
  {
    /**
     * Track Prebid.js events
     * @param {Object} params - Event parameters
     * @param {string} params.eventType - Type of event
     * @param {Object} params.args - Event arguments
     */
    track({ eventType, args }) {
      switch (eventType) {
        case EVENTS.AUCTION_INIT:
          logMessage('IM Analytics: AUCTION_INIT', args);
          this.handleAuctionInit(args);
          break;

        case EVENTS.BID_WON:
          logMessage('IM Analytics: BID_WON', args);
          this.handleBidWon(args);
          break;
      }
    },

    /**
     * Handle AUCTION_INIT event
     * @param {Object} auctionArgs - Auction arguments
     */
    handleAuctionInit(auctionArgs) {
      cache.auctions[auctionArgs.auctionId] = {
        bids: {},
        pv: {
          cid: auctionArgs.cid,
          name: auctionArgs.name,
          action_id: auctionArgs.action_id,
          adUnits: auctionArgs.adUnits,
        }
      };
      this.accumulateRequestBidsData(auctionArgs);
    },

    /**
     * Handle BID_WON event
     * @param {Object} bidWonArgs - Bid won arguments
     */
    handleBidWon(bidWonArgs) {
      this.accumulateWonBidsData(bidWonArgs);
    },

    /**
     * Accumulate request bids data with debounce
     * @param {Object} auctionArgs - Auction arguments
     */
    accumulateRequestBidsData(auctionArgs) {
      const pageUrl = getPageUrl();
      if (!cache.requestBidsData || cache.requestBidsData.pageUrl !== pageUrl) {
        cache.requestBidsData = initializePageCache(pageUrl);
      }

      cache.requestBidsData.auctions.push(transformAuctionData(auctionArgs));
      cache.requestBidsTimer = clearTimer(cache.requestBidsTimer);
      cache.requestBidsTimer = setTimeout(() => {
        this.sendRequestBidsData();
      }, DEBOUNCE_DELAY);
    },

    /**
     * Send accumulated request bids data to API
     */
    sendRequestBidsData() {
      if (!cache.requestBidsData) return;

      const cid = getCid(this.options);
      const payload = {
        pageUrl: cache.requestBidsData.pageUrl,
        timestamp: cache.requestBidsData.timestamp,
        auctionCount: cache.requestBidsData.auctions.length,
        auctions: cache.requestBidsData.auctions
      };
      sendToApi(buildApiUrl(cid, 'request'), payload);
      cache.requestBidsData = null;
      cache.requestBidsTimer = null;
    },

    /**
     * Accumulate won bids data with debounce
     * @param {Object} bidWonArgs - Bid won arguments
     */
    accumulateWonBidsData(bidWonArgs) {
      const pageUrl = getPageUrl();

      if (!cache.wonBidsData || cache.wonBidsData.pageUrl !== pageUrl) {
        cache.wonBidsData = initializeWonBidsCache(pageUrl);
      }
      cache.wonBidsData.wonBids.push(transformBidWonData(bidWonArgs));
      cache.wonBidsTimer = clearTimer(cache.wonBidsTimer);
      cache.wonBidsTimer = setTimeout(() => {
        this.sendWonBidsData();
      }, DEBOUNCE_DELAY);
    },

    /**
     * Send accumulated won bids data to API
     */
    sendWonBidsData() {
      if (!cache.wonBidsData) return;

      const cid = getCid(this.options);
      const payload = {
        pageUrl: cache.wonBidsData.pageUrl,
        timestamp: cache.wonBidsData.timestamp,
        wonBidCount: cache.wonBidsData.wonBids.length,
        wonBids: cache.wonBidsData.wonBids
      };
      sendToApi(buildApiUrl(cid, 'won'), payload);
      cache.wonBidsData = null;
      cache.wonBidsTimer = null;
    }
  }
);

const originalEnableAnalytics = imAnalyticsAdapter.enableAnalytics;
imAnalyticsAdapter.enableAnalytics = function(config) {
  this.options = (config && config.options) || {};
  logMessage('IM Analytics: enableAnalytics called with cid:', this.options.cid);
  originalEnableAnalytics.call(this, config);
};

adapterManager.registerAnalyticsAdapter({
  adapter: imAnalyticsAdapter,
  code: 'imAnalytics'
});

export default imAnalyticsAdapter;
