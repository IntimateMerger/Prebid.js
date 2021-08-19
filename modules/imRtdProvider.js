/**
 * The {@link module:modules/realTimeData} module is required
 * The module will fetch real-time data from Intimate Merger
 * @module modules/imRtdProvider
 * @requires module:modules/realTimeData
 */
import {ajax} from '../src/ajax.js';
import {config} from '../src/config.js';
import { getGlobal } from '../src/prebidGlobal.js'
import {getStorageManager} from '../src/storageManager.js';
import {
  deepSetValue,
  deepAccess,
  timestamp,
  mergeDeep,
  logError,
  logInfo,
  isFn
} from '../src/utils.js'
import {submodule} from '../src/hook.js';

export const imuidLocalName = '__im_uid';
export const imRtdLocalName = '__im_sids';
export const storage = getStorageManager();
const submoduleName = 'im';
const storageMaxAge = 3600000; // 1 hour (30 * 60 * 1000)
const storageMaxAgeForImuid = 1800000; // 30 minites (30 * 60 * 1000)

function getCustomBidderFunction (config, bidder) {
  const overwriteFn = deepAccess(config, `params.overwrites.${bidder}`)

  if (overwriteFn && isFn(overwriteFn)) {
    return overwriteFn
  } else {
    return null
  }
}

/**
* @param {string} bidderName
* @param {object} data
*/
function getBidderFunction (bidderName) {
  const biddersFunction = {
    rubicon: function (bid, data) {
      if (data.im_segments && data.im_segments.length) {
        deepSetValue(bid, 'params.visitor.im_segments', data.im_segments)
      }
      return bid
    },
    openx: function (bid, data) {
      if (data.im_segments && data.im_segments.length) {
        deepSetValue(bid, 'params.visitor.im_segments', data.im_segments)
      }
      return bid
    }
  }
  return biddersFunction[bidderName] || getDefaultFn();
}

function getDefaultFn() {
  return function(bid, rtd) {
    if (rtd.im_segments) {
      deepSetValue(bid, 'params.customData.im_segments', rtd.im_segments);
      const ortb2 = config.getConfig('ortb2') || {};
      deepSetValue(ortb2, 'ext.data.im_segments', rtd.im_segments);
      config.setConfig({ortb2: ortb2});
    }
  }
}

/**
 * Add real-time data & merge segments.
 * @param {Object} bidConfig
 * @param {Object} rtd
 * @param {Object} rtdConfig
 */
export function setRealTimeData(bidConfig, rtd, rtdConfig) {
  const adUnits = bidConfig.adUnits || getGlobal().adUnits;
  const utils = { deepSetValue, deepAccess, isFn, mergeDeep };

  adUnits.forEach(adUnit => {
    adUnit.bids.forEach(bid => {
      const { bidder } = bid;
      const customFn = getCustomBidderFunction(rtdConfig, bidder);
      const bidderFn = getBidderFunction(bidder);

      if (customFn) {
        customFn(bid, rtd, utils, bidderFn);
      } else if (bidderFn) {
        bidderFn(bid, rtd);
      }
      logInfo(bid);
      logInfo(utils.deepAccess(bid, 'params'));
    })
  });
}

/**
 * Real-time data retrieval from Intimate Merger
 * @param {Object} reqBidsConfigObj
 * @param {function} onDone
 * @param {Object} rtdConfig
 * @param {Object} userConsent
 */
export function getRealTimeData(bidConfig, onDone, rtdConfig) {
  logInfo(`rtdConfig:`);
  logInfo(rtdConfig);
  const cid = deepAccess(rtdConfig, 'params.cid');
  if (!cid) {
    logError('imRtdProvider requires a valid cid to be defined');
    return undefined;
  }
  const sids = storage.getDataFromLocalStorage(imRtdLocalName);
  const mt = storage.getDataFromLocalStorage(`${imRtdLocalName}_mt`);
  let expired = true;
  if (Date.parse(mt) && Date.now() - (new Date(mt)).getTime() < storageMaxAge) {
    expired = false;
  }

  if (sids) {
    logInfo('sids');
    logInfo(sids);
    setRealTimeData(bidConfig, {im_segments: sids}, rtdConfig);
    onDone();
    if (expired) {
      getRealTimeDataAsync(bidConfig, rtdConfig, undefined);
      return;
    }
    return;
  }
  getRealTimeDataAsync(bidConfig, rtdConfig, onDone);
}

/**
 * Async rtd retrieval from Intimate Merger
 * @param {Object} reqBidsConfigObj
 * @param {Object} rtdConfig
 * @param {function} onDone
 */
export function getRealTimeDataAsync(bidConfig, rtdConfig, onDone) {
  const cid = deepAccess(rtdConfig, 'params.cid');
  const url = `https://sync6.im-apps.net/${cid}/rtd`;
  ajax(url, {
    success: function (response, req) {
      let parsedResponse = {};
      if (req.status === 200) {
        try {
          parsedResponse = JSON.parse(response);
        } catch (e) {
          logError('unable to get Intimate Merger segment data');
        }
        if (parsedResponse.uid) {
          const imuid = storage.getDataFromLocalStorage(imuidLocalName);
          const imuidMt = storage.getDataFromLocalStorage(`${imuidLocalName}_mt`);
          const imuidExpired = Date.parse(imuidMt) && Date.now() - (new Date(imuidMt)).getTime() < storageMaxAgeForImuid;
          if (!imuid || imuidExpired) {
            storage.setDataInLocalStorage(imuidLocalName, parsedResponse.uid);
            storage.setDataInLocalStorage(`${imuidLocalName}_mt`, new Date(timestamp()).toUTCString());
          }
        }
        if (parsedResponse.segments) {
          logInfo('parsedResponse.segments');
          logInfo(parsedResponse.segments);
          setRealTimeData(bidConfig, {im_segments: parsedResponse.segments}, rtdConfig);
          storage.setDataInLocalStorage(imRtdLocalName, parsedResponse.segments);
          storage.setDataInLocalStorage(`${imRtdLocalName}_mt`, new Date(timestamp()).toUTCString());
        }
      }
      if (onDone) {
        onDone();
      }
    },
    error: function () {
      if (onDone) {
        onDone();
      }
      logError('unable to get Intimate Merger segment data');
    }
  },
  undefined,
  {withCredentials: true}
  );
}

/**
 * Module init
 * @param {Object} provider
 * @param {Object} userConsent
 * @return {boolean}
 */
function init(provider, userConsent) {
  return true;
}

/** @type {RtdSubmodule} */
export const imRtdSubmodule = {
  name: submoduleName,
  getBidRequestData: getRealTimeData,
  init: init
};

submodule('realTimeData', imRtdSubmodule);
