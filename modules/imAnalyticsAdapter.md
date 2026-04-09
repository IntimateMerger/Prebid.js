# Overview

```
Module Name: IM Analytics Adapter
Module Type: Analytics Adapter
```

#### About

This analytics adapter collects data about auction events and bid won data on your site for analytics purposes.

The publisher must work with our account management team to obtain a
Customer ID (CID) and enable Analytics for their account.
To get a CID, you can reach out to your account manager or sign up via
<https://lp.intimatemerger.com/im-uid>.

If you are an existing publisher and you already use
[IM-UID](https://docs.prebid.org/dev-docs/modules/userid-submodules/imuid.html),
you can use the same CID for this analytics adapter.

By enabling this adapter, you agree to Intimate Merger's privacy policy at
<https://corp.intimatemerger.com/privacypolicy-en/>.

#### Analytics Options

| Parameter | Scope | Type | Default | Description |
|-----------|-------|------|---------|-------------|
| `cid` | optional | number | 5126 | Customer ID provided by Intimate Merger |
| `bidWonTimeout` | optional | number | 1500 | Timeout in milliseconds before sending batched won bids |

#### Example Configuration

##### Basic Configuration

```javascript
pbjs.enableAnalytics({
    provider: 'imAnalytics'
});
```

##### Configuration with Custom CID

```javascript
pbjs.enableAnalytics({
    provider: 'imAnalytics',
    options: {
        cid: 1234
    }
});
```

##### Configuration with Custom Timeout

```javascript
pbjs.enableAnalytics({
    provider: 'imAnalytics',
    options: {
        cid: 1234,
        bidWonTimeout: 1000  // 1 second
    }
});
```
