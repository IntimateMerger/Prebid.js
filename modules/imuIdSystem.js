/**
 * The {@link module:modules/userId} module is required
 * @module modules/imuIdSystem
 *
 * @requires module:modules/userId
 */

import * as utils from '../src/utils.js'
import { ajax } from '../src/ajax.js'
import { submodule } from '../src/hook.js';
import { getStorageManager } from '../src/storageManager.js';

export const storage = getStorageManager();

const storageKey = '__im_uid';
const cookieKey = '_im_vid';
const storageMaxAge = 1800000; // 30 minites (30 * 60 * 1000)
const cookiesMaxAge = 97200000000; // 37 months ((365 * 3 + 30) * 24 * 60 * 60 * 1000)
const LOG_PREFIX = 'User ID - imuid submodule: ';

function setImDataInLocalStorage(value) {
  storage.setDataInLocalStorage(storageKey, value);
  storage.setDataInLocalStorage(`${storageKey}_mt`, new Date(utils.timestamp()).toUTCString());
}

function removeImDataFromLocalStorage() {
  storage.removeDataFromLocalStorage(storageKey);
  storage.removeDataFromLocalStorage(`${storageKey}_mt`);
}

function getLocalData() {
  const mt = storage.getDataFromLocalStorage(`${storageKey}_mt`);
  let expired = true;
  if (Date.parse(mt) && Date.now() - (new Date(mt)).getTime() < storageMaxAge) {
    expired = false;
  }
  return {
    id: storage.getDataFromLocalStorage(storageKey),
    vid: storage.getCookie(cookieKey),
    expired: expired
  };
}

function syncSuccessProcess(jsonResponse) {
  if (!jsonResponse) {
    return;
  }
  if (jsonResponse.uid) {
    setImDataInLocalStorage(jsonResponse.uid);
    if (jsonResponse.vid) {
      storage.setCookie(cookieKey, jsonResponse.vid, new Date(utils.timestamp() + cookiesMaxAge).toUTCString());
    }
  } else {
    removeImDataFromLocalStorage(storageKey);
  }
}

function callImuidSync(syncUrl) {
  return function (callback) {
    const callbacks = {
      success: response => {
        let responseObj;
        if (response) {
          try {
            responseObj = JSON.parse(response);
            syncSuccessProcess(responseObj);
          } catch (error) {
            utils.logError('User ID - imuid submodule: ' + error);
          }
        }
        if (callback) {
          callback(responseObj.uid);
        }
      },
      error: error => {
        utils.logError('ID fetch encountered an error', error);
        if (callback) {
          callback();
        }
      }
    };
    ajax(syncUrl, callbacks, undefined, {method: 'GET', withCredentials: true});
  };
}

/** @type {Submodule} */
export const imuIdSubmodule = {
  /**
   * used to link submodule with config
   * @type {string}
   */
  name: 'imuid',
  /**
   * decode the stored id value for passing to bid requests
   * @function
   * @returns {{imuid: string} | undefined}
   */
  decode(id) {
    if (id && typeof id === 'string') {
      return {imuid: id};
    }
    return undefined;
  },
  /**
   * @function
   * @param {SubmoduleConfig} [config]
   * @returns {{id: string} | undefined}}}
   */
  getId(config) {
    const configParams = (config && config.params) || {};
    if (!configParams || typeof configParams.cid !== 'number') {
      utils.logError('User ID - imuid submodule requires a valid cid to be defined');
      return undefined;
    }
    const localData = getLocalData();
    let syncUrl = `https://audiencedata.im-apps.net/imuid/get?cid=${configParams.cid}`;
    if (configParams.url) {
      syncUrl = `${configParams.url}?cid=${configParams.cid}`;
    }
    if (localData.vid) {
      syncUrl += `&vid=${localData.vid}`;
    }

    if (!localData.id) {
      return {callback: callImuidSync(syncUrl)}
    }
    if (localData.expired) {
      callImuidSync(syncUrl)();
    }
    return {id: localData.id};
  }
};

submodule('userId', imuIdSubmodule);
