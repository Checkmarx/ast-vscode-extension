/**
 * Extension-specific messages and links
 * Centralized configuration for all user-facing messages that differ between extensions
 */

import { getExtensionType } from './extensionConfig';

export interface ExtensionMessages {
    /** Product name (e.g., "Checkmarx One Assist", "Checkmarx Developer Assist") */
    productName: string;

    /** Authentication required message */
    authenticationRequiredMessage: string;

    /** Learn more documentation link */
    learnMoreLink: string;

    /** Welcome page title */
    welcomePageTitle: string;

    /** Extension display name */
    displayName: string;
}

/**
 * Messages for Checkmarx extension
 */
export const CHECKMARX_MESSAGES: ExtensionMessages = {
    productName: 'Checkmarx One Assist',
    authenticationRequiredMessage: 'In order to use Checkmarx One Assist, you need to setup your credentials.',
    learnMoreLink: 'https://docs.checkmarx.com/en/34965-405960-checkmarx-one-developer-assist.html',
    welcomePageTitle: 'Welcome to Checkmarx',
    displayName: 'Checkmarx'
};

/**
 * Messages for Checkmarx Developer Assist extension
 */
export const DEVASSIST_MESSAGES: ExtensionMessages = {
    productName: 'Checkmarx Developer Assist',
    authenticationRequiredMessage: 'In order to use Checkmarx Developer Assist, you need to setup your credentials.',
    learnMoreLink: 'https://docs.checkmarx.com/en/34965-405960-checkmarx-one-developer-assist.html',
    welcomePageTitle: 'Welcome to Checkmarx Developer Assist',
    displayName: 'Checkmarx Developer Assist'
};

/**
 * Get messages for the current extension
 * Automatically detects the extension type and returns the appropriate messages
 */
export function getMessages(): ExtensionMessages {
    const extensionType = getExtensionType();
    return extensionType === 'checkmarx' ? CHECKMARX_MESSAGES : DEVASSIST_MESSAGES;
}

