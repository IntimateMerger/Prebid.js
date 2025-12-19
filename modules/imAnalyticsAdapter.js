import { logMessage } from '../src/utils.js';
import adapter from '../libraries/analyticsAdapter/AnalyticsAdapter.js';
import adapterManager from '../src/adapterManager.js';
import { EVENTS } from '../src/constants.js';
import { sendBeacon } from '../src/ajax.js';

const DEFAULT_BID_WON_TIMEOUT = 800; // 0.8 second for initial batch
const DEFAULT_CID = 5126;
const API_BASE_URL = 'https://b6.im-apps.net/bids';

// Send status flags
const WON_SENT = 1;

// Default values
const EMPTY_CONSENT_DATA = {
  gdprApplies: undefined,
  gdpr: undefined,
  usp: undefined,
};

const cache = {
  auctions: {}
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
 * Get Bid Won Timeout from adapter options
 * @param {Object} options - Adapter options
 * @returns {number} Timeout in ms or default value
 */
function getBidWonTimeout(options) {
  return (options && options.bidWonTimeout) || DEFAULT_BID_WON_TIMEOUT;
}

/**
 * Build API URL with CID from options
 * @param {Object} options - Adapter options
 * @param {string} endpoint - Endpoint path
 * @returns {string} Full API URL
 */
function buildApiUrlWithOptions(options, endpoint, auctionId) {
  const cid = getCid(options);
  return `${API_BASE_URL}/${cid}/${endpoint}/${auctionId}`;
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
 * Get consent data from bidder requests
 * @param {Array} bidderRequests - Bidder requests array
 * @returns {Object} Consent data object
 */
function getConsentData(bidderRequests) {
  if (!bidderRequests || !bidderRequests[0]) {
    return EMPTY_CONSENT_DATA;
  }

  const request = bidderRequests[0];
  const gdprConsent = request.gdprConsent || {};
  const uspConsent = request.uspConsent;

  return {
    gdprApplies: gdprConsent.gdprApplies,
    gdpr: gdprConsent.consentString,
    usp: uspConsent
  };
}

/**
 * Extract meta fields from bid won arguments
 * @param {Object} meta - Meta object
 * @returns {Object} Extracted meta fields
 */
function extractMetaFields(meta) {
  return {
    advertiserDomains: meta.advertiserDomains || [],
    primaryCatId: meta.primaryCatId || '',
    secondaryCatIds: meta.secondaryCatIds || [],
    advertiserName: meta.advertiserName || '',
    advertiserId: meta.advertiserId || '',
    brandName: meta.brandName || '',
    brandId: meta.brandId || ''
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
          this.handleWonBidsData(args);
          break;

        case EVENTS.AUCTION_END:
          logMessage('IM Analytics: AUCTION_END', args);
          this.scheduleWonBidsSend(args.auctionId);
          break;
      }
    },

    /**
     * Schedule won bids send for a specific auction
     * @param {string} auctionId - Auction ID
     */
    scheduleWonBidsSend(auctionId) {
      const auction = cache.auctions[auctionId];
      if (auction) {
        auction.wonBidsTimer = clearTimer(auction.wonBidsTimer);
        auction.wonBidsTimer = setTimeout(() => {
          this.sendWonBidsData(auctionId);
        }, getBidWonTimeout(this.options));
      }
    },

    /**
     * Handle auction init event
     * @param {Object} args - Auction arguments
     */
    handleAuctionInit(args) {
      const consentData = getConsentData(args.bidderRequests);

      cache.auctions[args.auctionId] = {
        consentData: consentData,
        sendStatus: 0,
        wonBids: [],
        wonBidsTimer: null,
        auctionInitTimestamp: args.timestamp
      };

      this.handleAucInitData(args, consentData);
    },

    /**
     * Handle auction init data - send immediately for PV tracking
     * @param {Object} auctionArgs - Auction arguments
     * @param {Object} consentData - Consent data object
     */
    handleAucInitData(auctionArgs, consentData) {
      const payload = {
        pageUrl: window.location.href,
        referrer: document.referrer || '',
        consentData,
        ...this.transformAucInitData(auctionArgs)
      };

      sendToApi(buildApiUrlWithOptions(this.options, 'pv', auctionArgs.auctionId), payload);
    },

    /**
     * Transform auction data for auction init event
     * @param {Object} auctionArgs - Auction arguments
     * @returns {Object} Transformed auction data
     */
    transformAucInitData(auctionArgs) {
      return {
        timestamp: auctionArgs.timestamp,
        adUnitCount: (auctionArgs.adUnits || []).length
      };
    },

    /**
     * Handle won bids data - batch first, then individual
     * @param {Object} bidWonArgs - Bid won arguments
     */
    handleWonBidsData(bidWonArgs) {
      const auctionId = bidWonArgs.auctionId;
      const auction = cache.auctions[auctionId];

      if (!auction) return;

      this.cacheWonBid(auctionId, bidWonArgs);

      // If initial batch has been sent, send immediately
      if (auction.sendStatus & WON_SENT) {
        this.sendIndividualWonBid(auctionId, bidWonArgs, auction.consentData);
      }
    },

    /**
     * Send individual won bid immediately
     * @param {string} auctionId - Auction ID
     * @param {Object} bidWonArgs - Bid won arguments
     * @param {Object} consentData - Consent data
     */
    sendIndividualWonBid(auctionId, bidWonArgs, consentData) {
      const wonBid = this.transformWonBidsData(bidWonArgs);
      const auction = cache.auctions[auctionId];

      sendToApi(buildApiUrlWithOptions(this.options, 'won', auctionId), {
        consentData: consentData || getConsentData(null),
        timestamp: auction.auctionInitTimestamp,
        wonBids: [wonBid]
      });
    },

    /**
     * Cache won bid for batch send
     * @param {string} auctionId - Auction ID
     * @param {Object} bidWonArgs - Bid won arguments
     */
    cacheWonBid(auctionId, bidWonArgs) {
      const auction = cache.auctions[auctionId];
      if (auction) {
        // Deduplicate based on requestId
        if (auction.wonBids.some(bid => bid.requestId === bidWonArgs.requestId)) {
          return;
        }
        auction.wonBids.push(this.transformWonBidsData(bidWonArgs));
      }
    },

    /**
     * Transform bid won data for payload
     * @param {Object} bidWonArgs - Bid won arguments
     * @returns {Object} Transformed bid won data
     */
    transformWonBidsData(bidWonArgs) {
      const meta = bidWonArgs.meta || {};

      return {
        requestId: bidWonArgs.requestId,
        bidderCode: bidWonArgs.bidderCode,
        ...extractMetaFields(meta)
      };
    },


    /**
     * Send accumulated won bids data to API - batch send after 800ms
     * @param {string} auctionId - Auction ID to send data for
     */
    sendWonBidsData(auctionId) {
      const auction = cache.auctions[auctionId];
      if (!auction || !auction.wonBids || auction.wonBids.length === 0 || (auction.sendStatus & WON_SENT)) {
        return;
      }

      const consentData = auction.consentData || getConsentData(null);
      const timestamp = auction.auctionInitTimestamp || Date.now();

      sendToApi(buildApiUrlWithOptions(this.options, 'won', auctionId), {
        consentData,
        timestamp,
        wonBids: auction.wonBids
      });

      // Clear cached bids after sending to prevent duplicates
      auction.sendStatus |= WON_SENT;
      auction.wonBidsTimer = null;
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
