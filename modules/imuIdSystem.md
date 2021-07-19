## IntimateMerger User ID Submodule

IntimateMerger UID - https://intimatemerger.com/r/uid

## IntimateMerger UID Configuration

Enable by adding the IntimateMerger submodule to your Prebid.js package with:

```
gulp build --modules=imuIdSystem, userId
```

Module activation and configuration:

```javascript
pbjs.setConfig({
  userSync: {
    userIds: [{
      name: 'imuid',
      params: {
        cid 5126 // Set your Intimate Merger Customer ID here for production
        }
      }
    }]
  }
});
```

| Param under userSync.userIds[] | Scope | Type | Description | Example |
| --- | --- | --- | --- | --- |
| name | Required | String | The name of this module. | `"imuid"` |
| params | Required | Object | Details of module params. | |
| params.cid | Required | String | This is the Customer ID value obtained via Intimate Merger. | `5126` |
| params.url | Optional | String | Use this to change the default endpoint URL. | `"https://somedomain.some/somepath?args"` |
