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

const pastDateString = new Date(0).toString();
const expirationString = new Date(utils.timestamp() + cookiesMaxAge).toString();

function getFromAllStorages(key) {
  return storage.getCookie(key) || storage.getDataFromLocalStorage(key);
}

function saveOnAllStorages(key, value) {
  if (key && value) {
    storage.setCookie(key, value, expirationString);
    storage.setDataInLocalStorage(key, value);
  }
}

function deleteFromAllStorages(key) {
  storage.setCookie(key, '', pastDateString);
  storage.removeDataFromLocalStorage(key);
}

function getImuidDataFromAllStorages() {
  return {
    uid: getFromAllStorages(bididStorageKey),
  }
}

function buildImuidUrl(vid, cid) {
  const url = `https://audiencedata.im-apps.net/imuid/get?vid=${vid}&cid=${cid}`;
  return url;
}

function callImuidUserSync() {
  const url = buildImuidUrl();
  ajax.ajaxBuilder()(
    url,
    response => {
      const jsonResponse = JSON.parse(response);
      if (jsonResponse.uid) {
        saveOnAllStorages(bididStorageKey, jsonResponse.uid);
      } else {
        deleteFromAllStorages(bididStorageKey);
      }
    },
    undefined,
    { method: 'GET', contentType: 'application/json', withCredentials: true }
  );
}

/** @type {Submodule} */
export const imuidIdSubmodule = {
  /**
     * used to link submodule with config
     * @type {string}
     */
  // name: bidderCode,
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
  getId(config, consentData) {
    const hasGdprData = consentData && typeof consentData.gdprApplies === 'boolean' && consentData.gdprApplies;
    const gdprConsentString = hasGdprData ? consentData.consentString : undefined;

    let localData = getImuidDataFromAllStorages();
    callImuidUserSync(localData, gdprConsentString);

    return { id: localData.imuid ? { imuid: localData.imuid } : undefined }
  }
};

submodule('userId', imuidIdSubmodule);
