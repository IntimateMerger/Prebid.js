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

export const imUidLocalName = '__im_uid';
export const imVidCookieName = '_im_vid';
export const imRtdLocalName = '__im_sids';
export const storage = getStorageManager();
const submoduleName = 'im';
const segmentsMaxAge = 3600000; // 1 hour (30 * 60 * 1000)
const uidMaxAge = 1800000; // 30 minites (30 * 60 * 1000)
const vidMaxAge = 97200000000; // 37 months ((365 * 3 + 30) * 24 * 60 * 60 * 1000)

function setImDataInCookie(value) {
  storage.setCookie(
    imVidCookieName,
    value,
    new Date(timestamp() + vidMaxAge).toUTCString(),
    'none'
  );
}

export function getCustomBidderFunction(config, bidder) {
  const overwriteFn = deepAccess(config, `params.overwrites.${bidder}`)

  if (overwriteFn && isFn(overwriteFn)) {
    return overwriteFn
  } else {
    return null
  }
}

/**
 * Add real-time data & merge segments.
 * @param {Object} bidConfig
 * @param {Object} data
 * @param {Object} moduleConfig
 */
export function setRealTimeData(bidConfig, data, moduleConfig) {
  const adUnits = bidConfig.adUnits || getGlobal().adUnits;
  const utils = { deepSetValue, deepAccess, isFn, mergeDeep };

  const ortb2 = config.getConfig('ortb2') || {};
  deepSetValue(ortb2, 'user.data.ext.im_segments', data.im_segments);
  config.setConfig({ortb2: ortb2});

  if (moduleConfig.params.setGptKeyValues || !moduleConfig.params.hasOwnProperty('setGptKeyValues')) {
    window.googletag = window.googletag || {cmd: []};
    window.googletag.cmd = window.googletag.cmd || [];
    window.googletag.cmd.push(() => {
      window.googletag.pubads().setTargeting('im_segments', data.im_segments);
    });
  }

  adUnits.forEach(adUnit => {
    adUnit.bids.forEach(bid => {
      const overwriteFunction = getCustomBidderFunction(moduleConfig, bid.bidder);
      if (overwriteFunction) {
        overwriteFunction(bid, data, utils, moduleConfig);
      }
      logInfo(utils.deepAccess(bid, 'params'));
    })
  });
}

/**
 * Real-time data retrieval from Intimate Merger
 * @param {Object} reqBidsConfigObj
 * @param {function} onDone
 * @param {Object} moduleConfig
 */
export function getRealTimeData(reqBidsConfigObj, onDone, moduleConfig) {
  const cid = deepAccess(moduleConfig, 'params.cid');
  if (!cid) {
    logError('imRtdProvider requires a valid cid to be defined');
    onDone();
    return;
  }
  const sids = storage.getDataFromLocalStorage(imRtdLocalName);
  const mt = storage.getDataFromLocalStorage(`${imRtdLocalName}_mt`);
  const localVid = storage.getCookie(imVidCookieName);
  let apiUrl = `https://sync6.im-apps.net/${cid}/rtd`;
  if (localVid) {
    apiUrl += `&vid=${localVid}`;
    setImDataInCookie(localVid);
  }

  let expired = true;
  if (Date.parse(mt) && Date.now() - (new Date(mt)).getTime() < segmentsMaxAge) {
    expired = false;
  }

  if (sids) {
    logInfo(`sids: ${sids}`);
    setRealTimeData(reqBidsConfigObj, {im_segments: sids}, moduleConfig);
    onDone();
    if (expired) {
      callSidsApi(reqBidsConfigObj, moduleConfig, apiUrl, undefined);
      return;
    }
  }
  if (!expired) {
    return;
  }
  callSidsApi(reqBidsConfigObj, moduleConfig, apiUrl, expired ? undefined : onDone);
}

/**
 * Async rtd retrieval from Intimate Merger
 * @param {Object} reqBidsConfigObj
 * @param {Object} moduleConfig
 * @param {string} apiUrl
 * @param {function} onDone
 */
export function callSidsApi(reqBidsConfigObj, moduleConfig, apiUrl, onDone) {
  ajax(apiUrl, getApiCallback(reqBidsConfigObj, moduleConfig, onDone), undefined, {method: 'GET', withCredentials: true}
  );
}

export function getApiCallback(reqBidsConfigObj, moduleConfig, onDone) {
  return {
    success: function (response, req) {
      let parsedResponse = {};
      if (req.status === 200) {
        try {
          parsedResponse = JSON.parse(response);
        } catch (e) {
          logError('unable to get Intimate Merger segment data');
        }
        if (parsedResponse.uid) {
          const imuid = storage.getDataFromLocalStorage(imUidLocalName);
          const imuidMt = storage.getDataFromLocalStorage(`${imUidLocalName}_mt`);
          const imuidExpired = Date.parse(imuidMt) && Date.now() - (new Date(imuidMt)).getTime() < uidMaxAge;
          if (!imuid || imuidExpired) {
            storage.setDataInLocalStorage(imUidLocalName, parsedResponse.uid);
            storage.setDataInLocalStorage(`${imUidLocalName}_mt`, new Date(timestamp()).toUTCString());
          }
        }

        if (parsedResponse.vid) {
          setImDataInCookie(parsedResponse.vid);
        }

        if (parsedResponse.segments) {
          logInfo(`parsedResponse.segments: ${parsedResponse.segments}`);
          setRealTimeData(reqBidsConfigObj, {im_segments: parsedResponse.segments}, moduleConfig);
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
  }
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
