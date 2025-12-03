import { logMessage } from '../src/utils.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import adapterManager from '../src/adapterManager.js';
import { EVENTS } from '../src/constants.js';
import { sendBeacon } from '../src/ajax.js';

const DEBOUNCE_DELAY = 200; // 0.2 second
const DEFAULT_CID = 5126;
const API_BASE_URL = 'https://b6.im-apps.net/bids';

const cache = {
  auctions: {},
  ReqBidsData: null,
  ReqBidsTimer: null,
  wonBidsData: null,
  wonBidsTimer: null
};

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
  sendBeacon(url, blob);
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
function initializeReqBidsCache(pageUrl) {
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
          cache.auctions[args.auctionId] = {
            bids: {},
            pv: {
              cid: args.cid,
              name: args.name,
              action_id: args.action_id,
              adUnits: args.adUnits,
            }
          };
          this.handleReqBidsData(args);
          break;

        case EVENTS.BID_WON:
          logMessage('IM Analytics: BID_WON', args);
          this.handleWonBidsData(args);
          break;
      }
    },

    /**
     * Handle request bids data with debounce
     * @param {Object} auctionArgs - Auction arguments
     */
    handleReqBidsData(auctionArgs) {
      const pageUrl = window.location.href;
      if (!cache.ReqBidsData || cache.ReqBidsData.pageUrl !== pageUrl) {
        cache.ReqBidsData = initializeReqBidsCache(pageUrl);
      }
      cache.ReqBidsData.auctions.push(this.transformReqBidsData(auctionArgs));
      cache.ReqBidsTimer = clearTimer(cache.ReqBidsTimer);
      cache.ReqBidsTimer = setTimeout(() => {
        this.sendReqBidsData();
      }, DEBOUNCE_DELAY);
    },

    /**
     * Transform auction data for payload
     * @param {Object} auctionArgs - Auction arguments
     * @returns {Object} Transformed auction data
     */
    transformReqBidsData(auctionArgs) {
      return {
        auctionId: auctionArgs.auctionId,
        pv: auctionArgs.pv,
        timestamp: auctionArgs.timestamp,
        timeout: auctionArgs.timeout,
        adUnitCodes: auctionArgs.adUnitCodes || [],
        adUnits: (auctionArgs.adUnits || []).map(adUnit => {
          return {
            code: adUnit.code,
            mediaTypes: adUnit.mediaTypes,
            sizes: adUnit.sizes,
            bids: (adUnit.bids || []).map(bid => ({
              bidder: bid.bidder,
              params: bid.paramsr
            }))
          }
        })
      };
    },

    /**
     * Send accumulated request bids data to API
     */
    sendReqBidsData() {
      if (!cache.ReqBidsData) return;
      const cid = getCid(this.options);
      sendToApi(buildApiUrl(cid, 'request'), cache.ReqBidsData);
      cache.ReqBidsData = null;
      cache.ReqBidsTimer = null;
    },

    /**
     * Handle won bids data with debounce
     * @param {Object} bidWonArgs - Bid won arguments
     */
    handleWonBidsData(bidWonArgs) {
      const pageUrl = window.location.href;
      if (!cache.wonBidsData || cache.wonBidsData.pageUrl !== pageUrl) {
        cache.wonBidsData = initializeWonBidsCache(pageUrl);
      }
      cache.wonBidsData.wonBids.push(this.transformWonBidsData(bidWonArgs));
      cache.wonBidsTimer = clearTimer(cache.wonBidsTimer);
      cache.wonBidsTimer = setTimeout(() => {
        this.sendWonBidsData();
      }, DEBOUNCE_DELAY);
    },

    /**
     * Transform won bids data for payload
     * @param {Object} bidWonArgs - Bid won arguments
     * @returns {Object} Transformed won bids data
     */
    transformWonBidsData(bidWonArgs) {
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
    },

    /**
     * Send accumulated won bids data to API
     */
    sendWonBidsData() {
      if (!cache.wonBidsData) return;
      const cid = getCid(this.options);
      sendToApi(buildApiUrl(cid, 'won'), cache.wonBidsData);
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
