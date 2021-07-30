## Intimate Merger Real-time Data Submodule

provided by Intimate Merger.
The integration of [IM-UID](https://intimatemerger.com/r/uid) into Prebid.js consists of this module.

This real-time data module provides quality first-party data, contextual data, 
site-level data and more that can be injected into bid request objects destined 
for different bidders in order to optimize targeting.

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
                    handleRtd: function(bidConfig, rtd, rtdConfig, pbConfig) {
                        var adUnits = bidConfig.adUnits;
                        for (var i = 0; i < adUnits.length; i++) {
                            var adUnit = adUnits[i];
                            for (var j = 0; j < adUnit.bids.length; j++) {
                                var bid = adUnit.bids[j];
                                if (bid.bidder == 'sampleBidder' && rtd['sampleBidder'][0].value != 'excludeSeg') {
                                    bid.params.sampleBidderCustomSegments.push(rtd['sampleBidder'][0].id);
                                }
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
| params.handleRtd | Optional | Function | A passable RTD handler that allows custom adunit and ortb2 logic to be configured. | `(bidConfig, rtd, rtdConfig, pbConfig) => {}` |

### Testing

To view an example of available segments returned:

`gulp serve --modules=imRtdProvider`

and then point your browser at:

`http://localhost:9999/integrationExamples/gpt/imRtdProvider_example.html`




