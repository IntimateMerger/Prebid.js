/**
 * The {@link module:modules/realTimeData} module is required
 * The module will fetch real-time data from Intimate Merger
 * @module modules/imRtdProvider
 * @requires module:modules/realTimeData
 */
import {ajax} from '../src/ajax.js';
import {config} from '../src/config.js';
import {getStorageManager} from '../src/storageManager.js';
import {submodule} from '../src/hook.js';
import {
  // isFn,
  // isStr,
  timestamp, isPlainObject, mergeDeep, logError, logInfo} from '../src/utils.js';

const MODULE_NAME = 'realTimeData';
const SUBMODULE_NAME = 'im';
const storageMaxAge = 3600000; // 1 hour (30 * 60 * 1000)
export const IMUID_LOCAL_NAME = '__imuid';
export const RTD_LOCAL_NAME = '__im_sids';
export const storage = getStorageManager();

/**
 * Lazy merge objects.
 * @param {String} target
 * @param {String} source
 */
function mergeLazy(target, source) {
  if (!isPlainObject(target)) {
    target = {};
  }
  if (!isPlainObject(source)) {
    source = {};
  }
  return mergeDeep(target, source);
}

function getUniq() {
  const date = new Date();
  const str = RTD_LOCAL_NAME + (date.getUTCDate() % 5);
  return btoa(str).replace(/=*$/g, '');
}

function getSeg(parsedSids, token) {
  if (!parsedSids) return '';
  const output = [];
  try {
    const input = atob(decodeURIComponent(parsedSids)).replace(/=*$/g, '');

    for (let i = 0; i < input.length; i++) {
      const charCode =
        input.charCodeAt(i) ^ token.charCodeAt(i % token.length);
      output.push(String.fromCharCode(charCode));
    }
    return output.join('');
  } catch (e) {
    return '';
  }
}

/**
 * Add real-time data & merge segments.
 * @param {Object} bidConfig
 * @param {Object} rtd
 * @param {Object} rtdConfig
 */
export function addRealTimeData(bidConfig, rtd, rtdConfig) {
  if (rtdConfig.params && rtdConfig.params.handleRtd) {
    rtdConfig.params.handleRtd(bidConfig, rtd, rtdConfig, config);
  } else {
    if (isPlainObject(rtd.ortb2)) {
      logInfo('isPlainObjectttttttttttttttttttttttttttttt');
      let ortb2 = config.getConfig('ortb2') || {};
      config.setConfig({ortb2: mergeLazy(ortb2, rtd.ortb2)});
    }

    if (isPlainObject(rtd.ortb2b)) {
      let bidderConfig = config.getBidderConfig();

      Object.keys(rtd.ortb2b).forEach(bidder => {
        let rtdOptions = rtd.ortb2b[bidder] || {};

        let bidderOptions = {};
        if (isPlainObject(bidderConfig[bidder])) {
          bidderOptions = bidderConfig[bidder];
        }

        config.setBidderConfig({
          bidders: [bidder],
          config: mergeLazy(bidderOptions, rtdOptions)
        });
      });
    }
  }
  logInfo("config.getConfig('ortb2')");
  logInfo(config.getConfig('ortb2'));
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
  const token = getUniq();
  const sids = storage.getDataFromLocalStorage(RTD_LOCAL_NAME);
  const mt = storage.getDataFromLocalStorage(`${RTD_LOCAL_NAME}_mt`);
  let expired = true;
  if (Date.parse(mt) && Date.now() - (new Date(mt)).getTime() < storageMaxAge) {
    expired = false;
  }

  if (sids) {
    addRealTimeData(bidConfig, {ortb2: {imsids: getSeg(sids, token)}}, rtdConfig);
    onDone();
    if (expired) {
      logInfo('expiredexpiredexpiredexpiredexpiredexpiredexpiredexpiredexpiredexpiredexpiredexpiredexpired');
      getRealTimeDataAsync(bidConfig, rtdConfig, token, undefined);
      return;
    }
    return;
  }
  getRealTimeDataAsync(bidConfig, rtdConfig, token, onDone);
}

/**
 * Async rtd retrieval from Intimate Merger
 * @param {Object} reqBidsConfigObj
 * @param {Object} rtdConfig
 * @param {String} token
 * @param {function} onDone
 */
export function getRealTimeDataAsync(bidConfig, rtdConfig, token, onDone) {
  const url = `https://sync6.im-apps.net/segment?token=${token}`;
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
          logInfo(`uidFromRes: ${parsedResponse.uid}`);
          if (!storage.getDataInLocalStorage(IMUID_LOCAL_NAME)) {
            storage.setDataInLocalStorage(IMUID_LOCAL_NAME, parsedResponse.uid);
          }
        }
        if (parsedResponse.encrypted) {
          logInfo(`parsedSids: ${parsedResponse.encrypted}`);
          logInfo(`[decrypted]parsedSids: ${getSeg(parsedResponse.encrypted, token)}`);
          addRealTimeData(bidConfig, {ortb2: {imsids: getSeg(parsedResponse.encrypted, token)}}, rtdConfig);
          storage.setDataInLocalStorage(RTD_LOCAL_NAME, parsedResponse.encrypted);
          storage.setDataInLocalStorage(`${RTD_LOCAL_NAME}_mt`, new Date(timestamp()).toUTCString());
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
 * @param {Objkect} userConsent
 * @return {boolean}
 */
function init(provider, userConsent) {
  return true;
}

/** @type {RtdSubmodule} */
export const imSubmodule = {
  name: SUBMODULE_NAME,
  getBidRequestData: getRealTimeData,
  init: init
};

submodule(MODULE_NAME, imSubmodule);
