/**
 * The {@link module:modules/userId} module is required
 * @module modules/imuIdSystem
 *
 * @requires module:modules/userId
 */

import * as utils from '../src/utils.js'
import * as ajax from '../src/ajax.js'
import { submodule } from '../src/hook.js';
import { getStorageManager } from '../src/storageManager.js';

export const storage = getStorageManager();

const storageKey = '__im_uid';
const cookieKey = '_im_vid';
const maxAge = 30 * 60 * 1000; // about 30 minites
const cookiesMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
const expirationString = new Date(utils.timestamp() + maxAge).toUTCString();
const cookiesExpirationString = new Date(utils.timestamp() + cookiesMaxAge).toUTCString();

function setImuidDataInLocalStorage(value) {
  storage.setDataInLocalStorage(storageKey, value);
  storage.setDataInLocalStorage(`${storageKey}_exp`, expirationString);
}

function deleteFromAllStorages() {
  storage.removeDataFromLocalStorage(storageKey);
  storage.removeDataFromLocalStorage(`${storageKey}_exp`);
}

function getImuidDataFromStorages() {
  return {
    id: storage.getDataFromLocalStorage(storageKey, undefined),
    vid: storage.getCookie(cookieKey),
    exp: storage.getDataFromLocalStorage(`${storageKey}_exp`, undefined)
  };
}

function callImuidSync(cid, vid, url) {
  let syncUrl = `https://audiencedata.im-apps.net/imuid/get?cid=${cid}`;
  if (url) {
    syncUrl = `${url}?cid=${cid}`;
  }
  if (vid) {
    syncUrl += `&vid=${vid}`;
  }
  ajax.ajaxBuilder()(
    syncUrl,
    response => {
      const jsonResponse = JSON.parse(response);
      if (jsonResponse.uid) {
        setImuidDataInLocalStorage(jsonResponse.uid);
        if (jsonResponse.vid) {
          storage.setCookie(cookieKey, jsonResponse.vid, cookiesExpirationString);
        }
      } else {
        deleteFromAllStorages(storageKey);
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
    return {imuid: id};
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
      return;
    }
    const localData = getImuidDataFromStorages();
    if (!localData.id) {
      callImuidSync(configParams.cid, localData.vid, configParams.url);
      return undefined;
    }
    if (localData.exp && (new Date(localData.exp)).getTime() - Date.now() > 0) {
      return {id: localData.id};
    }
    callImuidSync(configParams.cid, localData.vid, configParams.url);
    return {id: localData.id};
  }
};

submodule('userId', imuIdSubmodule);
