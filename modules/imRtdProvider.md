## Intimate Merger Real-time Data Submodule

provided by Intimate Merger.

## Building Prebid with Real-time Data Support

First, make sure to add the Intimate Merger submodule to your Prebid.js package with:

`gulp build --modules=imRtdProvider`

The following configuration parameters are available:

```
pbjs.setConfig(
    ...
    realTimeData: {
        auctionDelay: 5000,
        dataProviders: [
            {
                name: "im",
                waitForIt: true,
                params: {
                    cid: 5126 // Set your Intimate Merger Customer ID here for production
                    overwrites: {
                        rubicon: function (bid, data, utils, bidderFn) {
                            if (bidderFn){
                                bid = bidderFn(bid, data)
                            }
                        }
                    }
                }
            }
        ]
    }
    ...
}
```

### Parameter Descriptions for the im Configuration Section

| Param under dataProviders | Scope | Type | Description | Example |
| --- | --- | --- | --- | --- |
| name | Required | String | The name of this module. | `"im"` |
| waitForIt | Optional | Boolean | Required to ensure that the auction is delayed until prefetch is complete. Defaults to false but recommended to true | `true` |
| params | Required | Object | Details of module params. | |
| params.cid | Required | Number | This is the Customer ID value obtained via Intimate Merger. | `5126` |
| params.overwrites | Object | See `Custom Bidder Setup` for details on how to define custom bidder functions.      | `{}` |

### Custom Bidder Setup
You can overwrite the default bidder function, for example to include a different set of segments or to support additional bidders. The below example modifies what first-party segments Magnite receives (segments from `gam` instead of `rubicon`). As best practise we recommend to first call `defaultFn` and then only overwrite specific key-values. The below example only overwrites `im` while `p_standard` are still set by `defaultFn` (if `rubicon` is an enabled `acBidder`).

```javascript
pbjs.setConfig({
  ...,
  realTimeData: {
    auctionDelay: 50,
    dataProviders: [{
      name: 'im',
      waitForIt: true,
      params: {
        acBidders: ['appnexus'],
        maxSegs: 450,
        overwrites: {
          rubicon: function (bid, data, acEnabled, utils, defaultFn) {
            if (defaultFn){
              bid = defaultFn(bid, data, acEnabled)
            }
            if (data.gam && data.gam.length) {
              utils.deepSetValue(bid, 'params.visitor.im_segments', data.gam)
            }
          }
        }
      }
    }]
  },
  ...
})
```
Any custom bidder function will receive the following parameters:

| Name          | Type          | Description                             |
| ------------- |-------------- | --------------------------------------- |
| bid           | Object        | The bidder specific bidder object. You will mutate this object to set the appropriate targeting keys.       |
| data          | Object        | An object containing Permutive segments |
| data.{{bidder}} | string[]      | Segments exposed by SSP integration |
| utils         | {}            | An object containing references to various util functions used by `permutiveRtdProvider.js`. Please make sure not to overwrite any of these. |
| defaultFn     | Function      | The default function for this bidder. Please note that this can be `undefined` if there is no default function for this bidder (see `Supported Bidders`). The function expect the following parameters: `bid`, `data`, and will return `bid`. |

### Testing

To view an example of available segments returned:

`gulp serve --modules=imRtdProvider`

and then point your browser at:

`http://localhost:9999/integrationExamples/gpt/imRtdProvider_example.html`




