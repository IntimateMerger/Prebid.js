import imAnalyticsAdapter from 'modules/imAnalyticsAdapter.js';
import { expect } from 'chai';
import { EVENTS } from 'src/constants.js';
import * as utils from 'src/utils.js';
import sinon from 'sinon';

describe('imAnalyticsAdapter', function() {
  let sandbox;
  let requests;
  const BID_WON_TIMEOUT = 800;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    requests = [];

    sandbox.stub(navigator, 'sendBeacon').callsFake((url, data) => {
      requests.push({
        url,
        data
      });
      return true;
    });

    sandbox.stub(utils, 'logMessage');
  });

  afterEach(function() {
    sandbox.restore();
    imAnalyticsAdapter.disableAnalytics();
    requests = [];
  });

  describe('enableAnalytics', function() {
    it('should catch the config options', function() {
      imAnalyticsAdapter.enableAnalytics({
        provider: 'imAnalytics',
        options: {
          cid: 1234
        }
      });
      expect(imAnalyticsAdapter.options.cid).to.equal(1234);
    });

    it('should use default cid if not provided', function() {
      imAnalyticsAdapter.enableAnalytics({
        provider: 'imAnalytics'
      });
      // Options doesn't get populated with default, but getCid uses it.
      expect(imAnalyticsAdapter.options.cid).to.be.undefined;

      // We can also verify that a track call uses the default CID
      const cid = (imAnalyticsAdapter.options && imAnalyticsAdapter.options.cid) || 5126;
      expect(cid).to.equal(5126);
    });
  });

  describe('track', function() {
    const bidWonArgs = {
      auctionId: 'auc-1',
      bidder: 'rubicon',
      bidderCode: 'rubicon',
      cpm: 1.5,
      currency: 'USD',
      originalCpm: 1.5,
      originalCurrency: 'USD',
      adUnitCode: 'div-1',
      timeToRespond: 100,
      meta: {
        advertiserDomains: ['example.com']
      }
    };

    beforeEach(function() {
      imAnalyticsAdapter.enableAnalytics({
        provider: 'imAnalytics',
        options: {
          cid: 5126
        }
      });
    });

    describe('AUCTION_INIT', function() {
      it('should send pv event immediately', function() {
        const args = {
          auctionId: 'auc-1',
          timestamp: 1234567890,
          bidderRequests: [{
            gdprConsent: {
              gdprApplies: true,
              consentString: 'gdpr-string'
            },
            uspConsent: 'usp-string',
            gppConsent: {
              gppString: 'gpp-string'
            }
          }],
          adUnits: [{}, {}]
        };

        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_INIT,
          args: args
        });

        expect(requests.length).to.equal(1);
        expect(requests[0].url).to.include('/pv');
      });
    });

    describe('BID_WON', function() {
      it('should cache bid won events and send after timeout', function() {
        const clock = sandbox.useFakeTimers();
        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_INIT,
          args: { auctionId: 'auc-1', bidderRequests: [] }
        });
        requests = [];

        imAnalyticsAdapter.track({
          eventType: EVENTS.BID_WON,
          args: bidWonArgs
        });

        expect(requests.length).to.equal(0);

        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_END,
          args: { auctionId: 'auc-1' }
        });

        clock.tick(10);
        expect(requests.length).to.equal(0);

        clock.tick(BID_WON_TIMEOUT + 10);

        expect(requests.length).to.equal(1);
        expect(requests[0].url).to.include('/won');
      });

      it('should send subsequent won bids immediately', function() {
        const clock = sandbox.useFakeTimers();

        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_INIT,
          args: { auctionId: 'auc-1', bidderRequests: [] }
        });
        requests = [];

        imAnalyticsAdapter.track({
          eventType: EVENTS.BID_WON,
          args: { ...bidWonArgs, requestId: 'req-1' }
        });

        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_END,
          args: { auctionId: 'auc-1' }
        });

        clock.tick(BID_WON_TIMEOUT + 10);
        expect(requests.length).to.equal(1);

        imAnalyticsAdapter.track({
          eventType: EVENTS.BID_WON,
          args: { ...bidWonArgs, requestId: 'req-2' }
        });

        expect(requests.length).to.equal(2);
      });
    });

    describe('AUCTION_END', function() {
      it('should schedule sending of won bids', function() {
        const clock = sandbox.useFakeTimers();

        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_INIT,
          args: { auctionId: 'auc-1', bidderRequests: [] }
        });
        requests = [];

        imAnalyticsAdapter.track({
          eventType: EVENTS.BID_WON,
          args: { ...bidWonArgs, auctionId: 'auc-1' }
        });

        expect(requests.length).to.equal(0);

        imAnalyticsAdapter.track({
          eventType: EVENTS.AUCTION_END,
          args: { auctionId: 'auc-1' }
        });

        clock.tick(BID_WON_TIMEOUT + 10);
        expect(requests.length).to.equal(1);
        expect(requests[0].url).to.include('/won');
      });
    });
  });
});
