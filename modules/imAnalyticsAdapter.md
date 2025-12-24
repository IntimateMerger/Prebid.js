# Overview

```
Module Name: IM Analytics Adapter
Module Type: Analytics Adapter
```

# Description

Analytics adapter for Intimate Merger platform. This adapter tracks auction events and bid won data for analytics purposes.

The adapter monitors the following Prebid.js events:
- `AUCTION_INIT`: Tracks page views and auction initialization
- `BID_WON`: Tracks winning bids with metadata
- `AUCTION_END`: Triggers batch sending of won bids data

# Configuration Options

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cid` | number | No | 5126 | Client ID for API endpoint |
| `bidWonTimeout` | number | No | 800 | Timeout in milliseconds before sending batched won bids |

# Example Configuration

## Basic Configuration

```javascript
pbjs.enableAnalytics({
    provider: 'imAnalytics'
});
```

## Configuration with Custom CID

```javascript
pbjs.enableAnalytics({
    provider: 'imAnalytics',
    options: {
        cid: 1234
    }
});
```

## Configuration with Custom Timeout

```javascript
pbjs.enableAnalytics({
    provider: 'imAnalytics',
    options: {
        cid: 1234,
        bidWonTimeout: 1000  // 1 second
    }
});
```
