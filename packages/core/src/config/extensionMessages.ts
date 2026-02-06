/**
 * Extension-specific messages and links
 * Centralized configuration for all user-facing messages that differ between extensions
 */

import { getExtensionType, EXTENSION_TYPE } from './extensionConfig';

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

    /** Product description for assist view */
    assistViewDescription: string;

    /** Server name for authentication messages (e.g., "Checkmarx One server", "Checkmarx Developer Assist server") */
    serverName: string;

    /** Connecting message (e.g., "Connecting to Checkmarx One...", "Connecting to Checkmarx Developer Assist...") */
    connectingMessage: string;

    /** Successfully authenticated message */
    authSuccessMessage: string;

    /** Failed to authenticate message */
    authFailedMessage: string;
}

/**
 * Messages for Checkmarx extension
 */
export const CHECKMARX_MESSAGES: ExtensionMessages = {
    productName: 'Checkmarx One Assist',
    authenticationRequiredMessage: 'In order to use Checkmarx One Assist, you need to setup your credentials.',
    learnMoreLink: 'https://checkmarx.com/resource/documents/en/34965-68742-checkmarx-one-vs-code-extension--plugin-.html',
    welcomePageTitle: 'Welcome to Checkmarx',
    displayName: 'Checkmarx',
    assistViewDescription: 'Checkmarx One Assist provides real-time threat detection and helps you avoid vulnerabilities before they happen.',
    serverName: 'Checkmarx One server',
    connectingMessage: 'Connecting to Checkmarx One...',
    authSuccessMessage: 'Successfully authenticated to Checkmarx One',
    authFailedMessage: 'Failed to authenticate to Checkmarx One'
};

/**
 * Messages for Checkmarx Developer Assist extension
 */
export const DEVASSIST_MESSAGES: ExtensionMessages = {
    productName: 'Checkmarx Developer Assist',
    authenticationRequiredMessage: 'In order to use Checkmarx Developer Assist, you need to setup your credentials.',
    learnMoreLink: 'https://docs.checkmarx.com/en/34965-405960-checkmarx-one-developer-assist.html',
    welcomePageTitle: 'Welcome to Checkmarx Developer Assist',
    displayName: 'Checkmarx Developer Assist',
    assistViewDescription: 'Checkmarx Developer Assist provides real-time threat detection and helps you avoid vulnerabilities before they happen.',
    serverName: 'Checkmarx Developer Assist server',
    connectingMessage: 'Connecting to Checkmarx Developer Assist...',
    authSuccessMessage: 'Successfully authenticated to Checkmarx Developer Assist',
    authFailedMessage: 'Failed to authenticate to Checkmarx Developer Assist'
};

/**
 * Get messages for the current extension
 * Automatically detects the extension type and returns the appropriate messages
 */
export function getMessages(): ExtensionMessages {
    const extensionType = getExtensionType();
    return extensionType === EXTENSION_TYPE.CHECKMARX ? CHECKMARX_MESSAGES : DEVASSIST_MESSAGES;
}

