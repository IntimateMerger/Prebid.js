/**
 * The {@link module:modules/userId} module is required
 * @module modules/imuidIdSystem
 *
 * @requires module:modules/userId
 */

import * as utils from '../src/utils.js'
import * as ajax from '../src/ajax.js'
import { submodule } from '../src/hook.js';
import { getStorageManager } from '../src/storageManager.js';

// const bidderCode = 'imuid';
export const storage = getStorageManager();

const bididStorageKey = '__im_uid';
const cookiesMaxAge = 13 * 30 * 24 * 60 * 60 * 1000;

// const pastDateString = new Date(0).toString();
const expirationString = new Date(utils.timestamp() + cookiesMaxAge).toUTCString();

function setImuidDataInLocalStorage(value) {
  storage.setDataInLocalStorage(`${bididStorageKey}_exp`, expirationString);
  storage.setDataInLocalStorage(`${bididStorageKey}`, value);
}

function deleteFromAllStorages(key) {
  storage.removeDataFromLocalStorage(key);
}

function getImuidDataFromStorages(key) {
  let value = null;
  if (storage.hasLocalStorage() && value === null) {
    const storedValueExp = storage.getDataFromLocalStorage(
      `${key}_exp`, undefined
    );
    if (storedValueExp === '') {
      value = storage.getDataFromLocalStorage(key, undefined);
    } else if (storedValueExp) {
      if ((new Date(storedValueExp)).getTime() - Date.now() > 0) {
        value = storage.getDataFromLocalStorage(key, undefined);
      }
    }
  }
  return value;
}

function callImuidSync() {
  const url = `https://audiencedata.im-apps.net/imuid/get?cid=3947`;
  ajax.ajaxBuilder()(
    url,
    response => {
      const jsonResponse = JSON.parse(response);
      if (jsonResponse.uid) {
        setImuidDataInLocalStorage(jsonResponse.uid);
      } else {
        deleteFromAllStorages(bididStorageKey);
      }
    },
    undefined,
    { method: 'GET', withCredentials: true }
  );
}

/** @type {Submodule} */
export const imuidIdSubmodule = {
  /**
    * used to link submodule with config
    * @type {string}
    */
  name: 'imuId',
  /**
      * decode the stored id value for passing to bid requests
      * @function
      * @returns {{imuid: string} | undefined}
      */
  decode(imuid) {
    return imuid;
  },
  /**
      * @function
      * @param {SubmoduleConfig} [config]
      * @param {ConsentData} [consentData]
      * @returns {{id: {imuid: string} | undefined}}}
      */
  getId() {
    const localData = getImuidDataFromStorages(bididStorageKey);
    callImuidSync();
    return { id: localData ? { imuid: localData } : undefined };
  }
};

submodule('userId', imuidIdSubmodule);
