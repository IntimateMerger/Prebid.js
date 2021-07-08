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

export const storage = getStorageManager();

const storageKey = '__im_uid';
const maxAge = 30 * 60 * 1000; // about 30 minites
const expirationString = new Date(utils.timestamp() + maxAge).toUTCString();

function setImuidDataInLocalStorage(value) {
  storage.setDataInLocalStorage(`${storageKey}`, value);
  storage.setDataInLocalStorage(`${storageKey}_exp`, expirationString);
}

function deleteFromAllStorages() {
  storage.removeDataFromLocalStorage(storageKey);
}

function getImuidDataFromStorages() {
  return {
    id: storage.getDataFromLocalStorage(storageKey, undefined),
    exp: storage.getDataFromLocalStorage(`${storageKey}_exp`, undefined)
  };
}

function callImuidSync(cid) {
  const url = `https://audiencedata.im-apps.net/imuid/get?cid=${cid}`;
  ajax.ajaxBuilder()(
    url,
    response => {
      const jsonResponse = JSON.parse(response);
      if (jsonResponse.uid) {
        setImuidDataInLocalStorage(jsonResponse.uid);
      } else {
        deleteFromAllStorages(storageKey);
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
  name: 'imuid',
  /**
   * decode the stored id value for passing to bid requests
   * @function
   * @returns {{imuid: string} | undefined}
   */
  decode(imuid) {
    return {imuid: imuid};
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
      callImuidSync(configParams.cid);
      return undefined;
    }
    if (localData.exp && (new Date(localData.exp)).getTime() - Date.now() > 0) {
      return {id: localData.id};
    }
    callImuidSync(configParams.cid);
    return {id: localData.id};
  }
};

submodule('userId', imuidIdSubmodule);
