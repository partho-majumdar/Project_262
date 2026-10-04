import axiosClient from './axiosClient';

/**
 * Client for the eBay-style proxy auction.
 *
 * Deliberately a separate module from `groupBuyingAuctionApi.js`. That one drives the collective
 * group-buying auction, where many customers' bids are cleared together once a collective quantity
 * is reached. This one is a plain sealed-bid proxy auction: one winner, one price, and a private
 * maximum that never leaves the bidder.
 *
 * The response interceptor already unwraps the HTTP envelope, so the body arrives here as the
 * `ApiResponse` JSON and the payload sits on `.data`.
 */
const unwrap = (res) => res?.data;

const withReason = (reason) => (reason ? { reason } : {});

/** Payment methods the backend accepts for a winning bid. Anything else is rejected server-side. */
export const AUCTION_PAYMENT_METHODS = [
  { id: 'CREDIT_CARD', label: 'Credit Card' },
  { id: 'PAYPAL', label: 'PayPal' },
  { id: 'STRIPE', label: 'Stripe' },
];

/** How often an open auction re-reads the server, in ms. The server is the only authority. */
export const AUCTION_POLL_MS = 10000;

export const auctionApi = {
  /** Every publicly visible auction. No authentication, and no bidder identity. */
  getAuctions: () => axiosClient.get('/auctions').then(unwrap),

  getAuction: (auctionId) => axiosClient.get(`/auctions/${auctionId}`).then(unwrap),

  /**
   * The public bid ladder. Amounts are what the bidders are committed to, never their ceilings,
   * and the bidders themselves appear only as pseudonymous aliases.
   */
  getBidHistory: (auctionId) => axiosClient.get(`/auctions/${auctionId}/bids`).then(unwrap),

  /** Bids the signed-in customer has placed across every auction. */
  getMyBids: () => axiosClient.get('/auctions/my-bids').then(unwrap),

  /** The signed-in customer's own bid on one auction, including their private maximum. */
  getMyBid: (auctionId) => axiosClient.get(`/auctions/${auctionId}/my-bid`).then(unwrap),

  /**
   * Authorise a maximum. The server bids on the customer's behalf up to that ceiling and keeps the
   * ceiling private; raising it re-runs the engine, lowering it below the standing price is refused.
   */
  placeBid: (auctionId, payload) =>
    axiosClient.post(`/auctions/${auctionId}/bids`, payload).then(unwrap),

  withdrawBid: (bidId) => axiosClient.post(`/auctions/bids/${bidId}/withdraw`).then(unwrap),
};

export const sellerAuctionApi = {
  getMyAuctions: () => axiosClient.get('/seller/auctions').then(unwrap),

  getAuction: (auctionId) => axiosClient.get(`/seller/auctions/${auctionId}`).then(unwrap),

  create: (payload) => axiosClient.post('/seller/auctions', payload).then(unwrap),

  update: (auctionId, payload) => axiosClient.put(`/seller/auctions/${auctionId}`, payload).then(unwrap),

  publish: (auctionId) => axiosClient.post(`/seller/auctions/${auctionId}/publish`).then(unwrap),

  /** Ends a running auction early. The server still applies the reserve and the proxy pricing. */
  close: (auctionId) => axiosClient.post(`/seller/auctions/${auctionId}/close`).then(unwrap),

  cancel: (auctionId, reason) =>
    axiosClient.post(`/seller/auctions/${auctionId}/cancel`, withReason(reason)).then(unwrap),

  /** The anonymous public ladder, in case only the standings are needed. */
  getBids: (auctionId) => axiosClient.get(`/seller/auctions/${auctionId}/bids`).then(unwrap),

  /**
   * The seller's privileged bid list: the real bidder, the amount each bid is committed to, the
   * ceiling behind it, and whether it currently leads. Includes withdrawn bids, which the public
   * ladder hides.
   */
  getDetailedBids: (auctionId) =>
    axiosClient.get(`/seller/auctions/${auctionId}/bids/detailed`).then(unwrap),
};

export const adminAuctionApi = {
  getAll: (status) => axiosClient.get('/admin/auctions', { params: { status } }).then(unwrap),

  getAuction: (auctionId) => axiosClient.get(`/admin/auctions/${auctionId}`).then(unwrap),

  close: (auctionId) => axiosClient.post(`/admin/auctions/${auctionId}/close`).then(unwrap),

  forceCancel: (auctionId, reason) =>
    axiosClient.post(`/admin/auctions/${auctionId}/force-cancel`, withReason(reason)).then(unwrap),
};

export default auctionApi;
