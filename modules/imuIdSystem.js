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
const maxAge = 30 * 60 * 1000; // about 30 minites
const cookiesMaxAge = 97200000000; //  37 months ((365 * 3 + 30) * 24 * 60 * 60 * 1000)
const expirationString = new Date(utils.timestamp()).toUTCString();
const cookiesExpirationString = new Date(utils.timestamp() + cookiesMaxAge).toUTCString();

function setImuidDataInLocalStorage(value) {
  storage.setDataInLocalStorage(storageKey, value);
  storage.setDataInLocalStorage(`${storageKey}_mt`, expirationString);
}

function deleteFromAllLocalStorages() {
  storage.removeDataFromLocalStorage(storageKey);
  storage.removeDataFromLocalStorage(`${storageKey}_mt`);
}

function getLocalData() {
  const mt = storage.getDataFromLocalStorage(`${storageKey}_mt`);
  const expired = mt && Date.now() - (new Date(mt)).getTime() > maxAge;
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
    setImuidDataInLocalStorage(jsonResponse.uid);
    if (jsonResponse.vid) {
      storage.setCookie(cookieKey, jsonResponse.vid, cookiesExpirationString);
    }
  } else {
    deleteFromAllLocalStorages(storageKey);
  }
}

function callImuidSync(cid, vid, url) {
  let syncUrl = `https://audiencedata.im-apps.net/imuid/get?cid=${cid}`;
  if (url) {
    syncUrl = `${url}?cid=${cid}`;
  }
  if (vid) {
    syncUrl += `&vid=${vid}`;
  }
  ajax(
    syncUrl,
    {
      success: response => {
        syncSuccessProcess(JSON.parse(response));
      },
      error: error => {
        utils.logError('ID fetch encountered an error', error);
      }
    },
    undefined,
    { method: 'GET', withCredentials: true }
  );
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
    if (typeof id === 'string') {
      return {imuid: id};
    }
    return {imuid: id.uid};
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

    if (!localData.id) {
      let syncUrl = `https://audiencedata.im-apps.net/imuid/get?cid=${configParams.cid}`;
      if (configParams.url) {
        syncUrl = `${configParams.url}?cid=${configParams.cid}`;
      }
      if (configParams.vid) {
        syncUrl += `&vid=${configParams.vid}`;
      }

      const resp = function (callback) {
        const callbacks = {
          success: response => {
            const jsonResponse = JSON.parse(response);
            syncSuccessProcess(jsonResponse);
            callback(jsonResponse);
          },
          error: error => {
            utils.logError('ID fetch encountered an error', error);
            callback();
          }
        };
        ajax(syncUrl, callbacks, undefined, {method: 'GET', withCredentials: true});
      };
      return {callback: resp};
    }
    if (localData.expired) {
      callImuidSync();
    }
    return {id: localData.id};
  }
};

submodule('userId', imuIdSubmodule);
