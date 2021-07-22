import { imuIdSubmodule, storage } from 'modules/imuIdSystem.js';

describe('imuId module', function () {
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
    { localStorage: 'uid', expected: 'uid' }
  ]

  const configParamTestCase = {
    params: {
      cid: 3947
    }
  }

  storageTestCases.forEach(testCase => it('getId() should return the uid when it exists in local storages', function () {
    getLocalStorageStub.withArgs('__im_uid').returns(testCase.localStorage);
    const id = imuIdSubmodule.getId(configParamTestCase);
    expect(id).to.be.deep.equal({id: testCase.expected});
  }))

  it('decode() should return the uid when it exists in local storages', function () {
    const id = imuIdSubmodule.decode('testDecode');
    expect(id).to.be.deep.equal({imuid: 'testDecode'});
  });
});
