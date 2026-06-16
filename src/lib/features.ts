// Feature flags for gradual rollout of new funnels
export function isNewInquireFlowEnabled(): boolean {
  return process.env.FEATURE_NEW_INQUIRE_FLOW === 'true';
}

export function isNewCheckoutFlowEnabled(): boolean {
  return process.env.FEATURE_NEW_CHECKOUT_FLOW === 'true';
}
