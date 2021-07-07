import { imuIdSubmodule, storage } from 'modules/imuIdSystem.js';
import * as utils from 'src/utils.js';
import * as ajaxLib from 'src/ajax.js';

const pastDateString = new Date(0).toString()

function mockResponse(responseText, fakeResponse = (url, callback) => callback(responseText)) {
  return function() {
    return fakeResponse;
  }
}

describe('imuId module', function () {
  const nowTimestamp = new Date().getTime();
  let getLocalStorageStub;

  beforeEach(function (done) {
    getLocalStorageStub = sinon.stub(storage, 'getDataFromLocalStorage');
    done();
  });

  afterEach(function () {
    getLocalStorageStub.restore();
  });

  const storageTestCases = [
    { localStorage: 'uid2', expected: 'uid2' },
    { localStorage: 'uid', expected: 'uid' },
    { localStorage: undefined, expected: undefined },
  ]

  const configParamTestCase = {
    params: {
      cid: 3947
    }
  }

  storageTestCases.forEach(testCase => it('getId() should return the uid when it exists in local storages', function () {
    getLocalStorageStub.withArgs('__im_uid').returns(testCase.localStorage);
    const id = imuIdSubmodule.getId(configParamTestCase);
    expect(id).to.be.deep.equal(testCase.expected ? {id: testCase.expected} : undefined);
  }))

  it('decode() should return the uid when it exists in local storages', function () {
    const id = imuIdSubmodule.decode('testDecode');
    expect(id).to.be.deep.equal({imuid: 'testDecode'});
  });
});
