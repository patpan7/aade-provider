import { AADEConfig } from '../types/mydata.types.js';

function getConfig(): AADEConfig {
  return {
    userId: process.env.AADE_USER_ID || '',
    subscriptionKey: process.env.AADE_SUBSCRIPTION_KEY || '',
    apiUrl: process.env.AADE_API_URL || 'https://mydataapidev.aade.gr/myDATAProvider/SendInvoices',
    qrBaseUrl: process.env.AADE_QR_BASE_URL || 'https://mydataapidev.aade.gr/open',
  };
}

export function getAadeConfig(): AADEConfig {
  return getConfig();
}

export function isConfigValid(): boolean {
  const config = getConfig();
  return !!(config.userId && config.subscriptionKey);
}

export function getConfigStatus() {
  const config = getConfig();
  return {
    userIdMasked: config.userId ? '***' + config.userId.slice(-4) : null,
    hasSubscriptionKey: !!config.subscriptionKey,
    apiUrl: config.apiUrl,
    qrBaseUrl: config.qrBaseUrl,
    isValid: isConfigValid(),
    isMock: process.env.AADE_MOCK === 'true',
  };
}

// For backward compatibility
export const aadeConfig = getConfig();