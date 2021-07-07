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
        cid 3947 // change to the Partner Number you received from IntimateMerger
        }
      }
    }]
  }
});
```

| Param under userSync.userIds[] | Scope | Type | Description | Example |
| --- | --- | --- | --- | --- |
| name | Required | String | Module identification: `"imuid"` | `"imuid"` |
| params | Required | Object | Configuration specifications for the IntimateMerger module. | |
| params.cid | Required | String | This is the IntimateMerger Partner Number obtained via IntimateMerger registration. | `3947` |
| params.url | Optional | String | If you use it in test or specify a value from Intimate Merger, it will overwrite the default url. | `"https://somedomain.some/somepath?args"` |
